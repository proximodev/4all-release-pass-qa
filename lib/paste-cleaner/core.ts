/**
 * Paste Cleaner Core - HTML sanitization module
 *
 * Pure cleaning logic for sanitizing pasted HTML content.
 * Keeps semantic formatting (bold, italic, lists, headings, links)
 * while stripping inline styles, event handlers, and junk markup.
 *
 * @version 1.2.0
 */

// ---------- Types ----------

export interface CleanerOptions {
  preserveImages?: boolean
  preserveSpan?: boolean
  preserveDiv?: boolean
  preserveTables?: boolean
  preserveStyle?: boolean
  preserveClass?: boolean
  preserveId?: boolean
  preserveDataAttrs?: boolean
  maxDepth?: number
  singleNewline?: boolean
  breakTags?: Set<string> | null
  maxInputSize?: number
  debug?: boolean
  debugCallback?: ((label: string, data?: unknown) => void) | null
}

// ---------- Constants ----------

const DEFAULT_ALLOWED_TAGS = new Set([
  'p', 'a', 'strong', 'em', 'ul', 'ol', 'li',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'blockquote', 'code', 'pre', 'br', 'hr'
])

const SELF_CLOSING_TAGS = new Set([
  'img', 'br', 'hr', 'input', 'source', 'track', 'wbr', 'area', 'col', 'embed', 'param', 'meta', 'link', 'base'
])

const SELF_CONTENT_TAGS = new Set(['IMG', 'BR', 'HR'])

const DEFAULT_BREAK_TAGS = new Set([
  'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'blockquote', 'pre', 'code',
  'table', 'hr', 'div', 'section', 'tr', 'th'
])

const PER_TAG_ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href', 'title', 'target', 'rel']),
  img: new Set(['src', 'alt', 'width', 'height']),
  th: new Set(['colspan', 'rowspan', 'scope']),
  td: new Set(['colspan', 'rowspan']),
  table: new Set(['summary']),
  caption: new Set()
}

const DANGEROUS_PROTOCOLS = [/^\s*javascript:/i, /^\s*data:/i, /^\s*vbscript:/i, /^\s*file:/i]

// Security: Max input size to prevent DoS attacks (1MB)
const MAX_INPUT_SIZE = 1_000_000

const DEFAULT_OPTIONS: Required<CleanerOptions> = {
  preserveImages: false,
  preserveSpan: false,
  preserveDiv: false,
  preserveTables: false,
  preserveStyle: false,
  preserveClass: false,
  preserveId: false,
  preserveDataAttrs: false,
  maxDepth: 0,
  singleNewline: true,
  breakTags: null,
  maxInputSize: MAX_INPUT_SIZE,
  debug: false,
  debugCallback: null
}

// ---------- Helper Functions ----------

/**
 * Sanitize URL to prevent XSS attacks
 */
export function sanitizeUrl(href: string | null): string {
  if (!href) return ''
  const trimmed = href.trim()
  for (const pattern of DANGEROUS_PROTOCOLS) {
    if (pattern.test(trimmed)) return ''
  }
  return trimmed
}

/**
 * Check if a string looks like HTML
 */
export function looksLikeHTML(s: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(s)
}

/**
 * Check if an element is effectively empty
 */
function isEmpty(el: Element): boolean {
  if (SELF_CONTENT_TAGS.has(el.tagName)) return false
  for (const c of Array.from(el.children)) {
    if (c.tagName !== 'BR') return false
  }
  const text = (el.textContent || '').replace(/\u00A0/g, ' ').trim()
  return text.length === 0
}

/**
 * Convert B/I tags to strong/em
 */
function convertBI(el: Element): Element {
  if (el.tagName === 'B') {
    const strong = el.ownerDocument.createElement('strong')
    while (el.firstChild) strong.appendChild(el.firstChild)
    el.replaceWith(strong)
    return strong
  }
  if (el.tagName === 'I') {
    const em = el.ownerDocument.createElement('em')
    while (el.firstChild) em.appendChild(el.firstChild)
    el.replaceWith(em)
    return em
  }
  return el
}

/**
 * Build allowed tag set based on options
 */
function buildAllowedSet(options: CleanerOptions): Set<string> {
  const allowed = new Set(DEFAULT_ALLOWED_TAGS)
  if (options.preserveImages) allowed.add('img')
  if (options.preserveSpan) allowed.add('span')
  if (options.preserveDiv) allowed.add('div')
  if (options.preserveTables) {
    ['table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption'].forEach(t => allowed.add(t))
  }
  return allowed
}

/**
 * Unwrap phrasing elements that incorrectly contain block elements
 */
function unwrapPhrasingAroundBlocks(root: Element): void {
  const BLOCK = /^(P|H[1-6]|UL|OL|LI|DIV|TABLE|TBODY|THEAD|TFOOT|TR|TD|TH|BLOCKQUOTE|PRE)$/
  root.querySelectorAll('strong, em, b, i').forEach(el => {
    if ([...el.children].some(c => BLOCK.test(c.tagName))) {
      const parent = el.parentNode
      if (!parent) return
      const kids = Array.from(el.childNodes)
      kids.forEach(k => parent.insertBefore(k, el))
      parent.removeChild(el)
    }
  })
}

type DebugFn = (label: string, data?: unknown) => void

/**
 * Scrub attributes from an element based on options
 */
function scrubAttributes(el: Element, options: CleanerOptions, dbg: DebugFn): void {
  const tag = el.tagName.toLowerCase()
  const before = { tag, attrs: Array.from(el.attributes).map(a => `${a.name}="${a.value}"`) }

  const perTag = PER_TAG_ALLOWED_ATTRS[tag] || new Set<string>()

  const toRemove: string[] = []
  for (const a of Array.from(el.attributes)) {
    const name = a.name.toLowerCase()

    // Always drop event handlers
    if (name.startsWith('on')) { toRemove.push(a.name); continue }

    // Keep per-tag allowed
    if (perTag.has(name)) continue

    // Global preservation toggles
    if (name === 'style' && options.preserveStyle) continue
    if (name === 'class' && options.preserveClass) continue
    if (name === 'id' && options.preserveId) continue
    if (name.startsWith('data-') && options.preserveDataAttrs) continue

    // Otherwise remove
    toRemove.push(a.name)
  }
  toRemove.forEach(n => el.removeAttribute(n))

  // Link hardening
  if (tag === 'a') {
    if (el.hasAttribute('href')) {
      const beforeHref = el.getAttribute('href') || ''
      const safe = sanitizeUrl(beforeHref)
      if (beforeHref !== safe) dbg('Sanitize href', { before: beforeHref, after: safe })
      el.setAttribute('href', safe)
    }
    if (el.getAttribute('target') === '_blank') {
      const rel = (el.getAttribute('rel') || '').toLowerCase().split(/\s+/).filter(Boolean)
      const parts = new Set([...rel, 'noopener', 'noreferrer'])
      el.setAttribute('rel', Array.from(parts).join(' '))
    }
  }

  // Image sanity
  if (tag === 'img') {
    const src = el.getAttribute('src') || ''
    if (/^data:/i.test(src)) {
      dbg('drop data:image', { length: src.length })
      el.remove()
      return
    }
    ;['width', 'height'].forEach(attr => {
      if (el.hasAttribute(attr)) {
        const v = parseInt(el.getAttribute(attr) || '', 10)
        if (!Number.isFinite(v) || v <= 0) el.removeAttribute(attr)
        else el.setAttribute(attr, String(v))
      }
    })
  }

  const after = { tag, attrs: Array.from(el.attributes).map(a => `${a.name}="${a.value}"`) }
  dbg('scrubAttributes', { before, after })
}

/**
 * Remove empty elements recursively
 */
function removeEmptyDeep(root: Element, options: CleanerOptions, dbg: DebugFn): void {
  const doc = root.ownerDocument
  const it = doc.createTreeWalker(root, NodeFilter.SHOW_ELEMENT)
  const nodes: Element[] = []
  while (it.nextNode()) nodes.push(it.currentNode as Element)

  let removed = 0
  nodes.reverse().forEach(el => {
    // Don't remove <li> that contains an <img> when images are preserved
    if (el.tagName === 'LI' && options.preserveImages && el.querySelector('img')) {
      return
    }
    if (isEmpty(el)) { el.remove(); removed++ }
  })

  dbg('removeEmptyDeep', { removed })
}

/**
 * Add line breaks after block-level parents
 */
function addLineBreaksAfterParents(html: string, opts: CleanerOptions, dbg: DebugFn): string {
  const breakTags = opts.breakTags instanceof Set ? opts.breakTags : DEFAULT_BREAK_TAGS
  const maxDepth = typeof opts.maxDepth === 'number' ? opts.maxDepth : 0
  const singleNewline = opts.singleNewline !== false

  const tmp = document.createElement('div')
  tmp.innerHTML = html

  let added = 0
  let visited = 0

  function ensureOneNewlineAfter(el: Element): boolean {
    const parent = el.parentNode
    if (!parent) return false

    const after = el.nextSibling

    if (after && after.nodeType === Node.TEXT_NODE) {
      if (singleNewline) {
        const collapsed = (after.nodeValue || '').replace(/\n+$/, '\n')
        if (collapsed !== after.nodeValue) {
          after.nodeValue = collapsed
          return true
        }
        if (!/\n$/.test(after.nodeValue || '')) {
          after.nodeValue = (after.nodeValue || '') + '\n'
          return true
        }
        return false
      } else {
        if (!/\n$/.test(after.nodeValue || '')) {
          after.nodeValue = (after.nodeValue || '') + '\n'
          return true
        }
        return false
      }
    }

    const tn = document.createTextNode('\n')
    parent.insertBefore(tn, after)
    return true
  }

  function walk(node: Node, depth: number): void {
    if (node.nodeType !== Node.ELEMENT_NODE) return

    const el = node as Element
    const tag = el.tagName.toLowerCase()
    const withinDepth = depth <= maxDepth
    const match = breakTags.has(tag)

    visited++

    if (withinDepth && match) {
      const changed = ensureOneNewlineAfter(el)
      if (changed) {
        added++
        dbg('LineBreaks:add', { tag, depth })
      }
    }

    for (const child of Array.from(el.children)) {
      walk(child, depth + 1)
    }
  }

  for (const child of Array.from(tmp.children)) {
    walk(child, 0)
  }

  dbg('LineBreaks:summary', { visited, added, maxDepth })

  let out = tmp.innerHTML
  if (singleNewline) {
    out = out.replace(/\n+$/, '\n').trimEnd()
  }
  return out
}

// ---------- Main Cleaner ----------

/**
 * Clean HTML string
 */
export function cleanHTML(inputHTML: string, userOptions: CleanerOptions = {}): string {
  const options = { ...DEFAULT_OPTIONS, ...userOptions }

  // Debug helper
  const dbg: DebugFn = options.debug && options.debugCallback
    ? options.debugCallback
    : (options.debug ? (label, data) => console.log(`[PasteCleanerCore] ${label}:`, data) : () => {})

  // Input validation
  if (typeof inputHTML !== 'string') {
    throw new Error('Input must be a string')
  }
  if (inputHTML.length > options.maxInputSize) {
    throw new Error(`Input too large (${inputHTML.length} chars). Maximum allowed: ${options.maxInputSize} chars.`)
  }

  const parser = new DOMParser()
  const parsedDoc = parser.parseFromString(inputHTML, 'text/html')
  const body = parsedDoc.body

  // Light normalization first
  unwrapPhrasingAroundBlocks(body)
  body.querySelectorAll('b,i').forEach(el => convertBI(el))

  // Build allowed set
  const allowedSet = buildAllowedSet(options)
  dbg('allowedSet', Array.from(allowedSet))

  const processElement = (el: Element): void => {
    const tag = el.tagName.toLowerCase()

    // Hard drop dangerous elements
    if (tag === 'script' || tag === 'style' || tag === 'meta' || tag === 'link') {
      el.remove()
      return
    }

    // IMG fast-path
    if (tag === 'img') {
      if (options.preserveImages) {
        scrubAttributes(el, options, dbg)
      } else {
        el.remove()
      }
      return
    }

    // Allowlist check
    if (!allowedSet.has(tag)) {
      dbg('not allowed -> unwrap', { tag })
      const parent = el.parentNode
      if (!parent) return
      const kids = Array.from(el.childNodes)
      kids.forEach(k => parent.insertBefore(k, el))
      parent.removeChild(el)
      kids.forEach(k => {
        if (k.nodeType === Node.ELEMENT_NODE) processElement(k as Element)
        else if (k.nodeType === Node.COMMENT_NODE) k.parentNode?.removeChild(k)
      })
      return
    }

    // Allowed -> scrub
    scrubAttributes(el, options, dbg)

    // Recurse into children
    let child = el.firstChild
    while (child) {
      const next = child.nextSibling
      if (child.nodeType === Node.ELEMENT_NODE) processElement(child as Element)
      else if (child.nodeType === Node.COMMENT_NODE) child.parentNode?.removeChild(child)
      child = next
    }

    // Prune empties (skip self-closing)
    if (!SELF_CLOSING_TAGS.has(tag) && isEmpty(el)) el.remove()
  }

  // Walk top-level children
  let cur = body.firstChild
  while (cur) {
    const next = cur.nextSibling
    if (cur.nodeType === Node.ELEMENT_NODE) processElement(cur as Element)
    else if (cur.nodeType === Node.COMMENT_NODE) cur.parentNode?.removeChild(cur)
    cur = next
  }

  // Final cleanup
  removeEmptyDeep(body, options, dbg)

  return body.innerHTML.trim()
}

/**
 * Clean and format HTML with line breaks
 */
export function cleanAndFormat(inputHTML: string, userOptions: CleanerOptions = {}): string {
  const options = { ...DEFAULT_OPTIONS, ...userOptions }
  const cleaned = cleanHTML(inputHTML, options)

  const dbg: DebugFn = options.debug && options.debugCallback
    ? options.debugCallback
    : (options.debug ? (label, data) => console.log(`[PasteCleanerCore] ${label}:`, data) : () => {})

  return addLineBreaksAfterParents(cleaned, options, dbg)
}

/**
 * Count links in HTML string
 */
export function countLinks(html: string): number {
  const tmp = document.createElement('div')
  tmp.innerHTML = html
  return tmp.querySelectorAll('a[href]').length
}
