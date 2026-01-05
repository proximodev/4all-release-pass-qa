'use client'

import { useState, useRef, useCallback } from 'react'
import Card from '@/components/ui/card/Card'
import Button from '@/components/ui/button/Button'
import PageContainer from '@/components/layout/PageContainer'
import TabPanel from '@/components/layout/TabPanel'
import Tabs from '@/components/ui/tabs/Tabs'
import { utilitiesTabs } from '@/lib/constants/navigation'
import { cleanAndFormat, looksLikeHTML, countLinks, type CleanerOptions } from '@/lib/paste-cleaner/core'

interface DebugEntry {
  time: string
  label: string
  data?: unknown
}

export default function PasteCleanerPage() {
  const [output, setOutput] = useState('')
  const [viewMode, setViewMode] = useState<'html' | 'preview'>('html')
  const [inputChars, setInputChars] = useState(0)
  const [outputChars, setOutputChars] = useState(0)
  const [linkCount, setLinkCount] = useState(0)
  const [debugEnabled, setDebugEnabled] = useState(false)
  const [debugLog, setDebugLog] = useState<DebugEntry[]>([])
  const [isEmpty, setIsEmpty] = useState(true)

  // Options
  const [preserveTables, setPreserveTables] = useState(true)
  const [preserveImages, setPreserveImages] = useState(true)
  const [preserveDiv, setPreserveDiv] = useState(false)
  const [preserveSpan, setPreserveSpan] = useState(false)
  const [preserveStyle, setPreserveStyle] = useState(false)
  const [preserveClass, setPreserveClass] = useState(false)
  const [preserveId, setPreserveId] = useState(false)
  const [preserveDataAttrs, setPreserveDataAttrs] = useState(false)

  const pasteBoxRef = useRef<HTMLDivElement>(null)

  const logDebug = useCallback((label: string, data?: unknown) => {
    if (!debugEnabled) return
    const time = new Date().toISOString().split('T')[1].replace('Z', '')
    setDebugLog(prev => [...prev, { time, label, data }])
  }, [debugEnabled])

  const getOptions = useCallback((): CleanerOptions => ({
    preserveImages,
    preserveSpan,
    preserveDiv,
    preserveTables,
    preserveStyle,
    preserveClass,
    preserveId,
    preserveDataAttrs,
    maxDepth: 0,
    singleNewline: true,
    debug: debugEnabled,
    debugCallback: logDebug
  }), [preserveImages, preserveSpan, preserveDiv, preserveTables, preserveStyle, preserveClass, preserveId, preserveDataAttrs, debugEnabled, logDebug])

  const doClean = useCallback(() => {
    const pasteBox = pasteBoxRef.current
    if (!pasteBox) return

    const src = pasteBox.innerHTML.trim()
    if (!src || src === '<br>') {
      setOutput('')
      setInputChars(0)
      setOutputChars(0)
      setLinkCount(0)
      setIsEmpty(true)
      return
    }

    setIsEmpty(false)

    try {
      const options = getOptions()
      const formatted = cleanAndFormat(src, options)
      setOutput(formatted)
      setInputChars(src.length)
      setOutputChars(formatted.length)
      setLinkCount(countLinks(formatted))
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error'
      setOutput(`Error: ${errorMsg}`)
      logDebug('doClean error', { error: errorMsg })
    }
  }, [getOptions, logDebug])

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    const html = e.clipboardData?.getData('text/html')
    const text = e.clipboardData?.getData('text/plain')

    if (html || (text && looksLikeHTML(text))) {
      e.preventDefault()
      const toInsert = html || text || ''
      const pasteBox = pasteBoxRef.current
      if (!pasteBox) return

      const sel = window.getSelection()
      if (!sel || sel.rangeCount === 0) {
        pasteBox.insertAdjacentHTML('beforeend', toInsert)
      } else {
        const range = sel.getRangeAt(0)
        range.deleteContents()
        const frag = range.createContextualFragment(toInsert)
        range.insertNode(frag)
        sel.collapse(pasteBox, pasteBox.childNodes.length)
      }
      setIsEmpty(pasteBox.textContent?.trim() === '')
      setTimeout(doClean, 0)
    } else {
      setTimeout(doClean, 0)
    }
  }, [doClean])

  const handleInput = useCallback(() => {
    const pasteBox = pasteBoxRef.current
    if (pasteBox) {
      setIsEmpty(pasteBox.textContent?.trim() === '')
    }
    doClean()
  }, [doClean])

  const handleClear = useCallback(() => {
    const pasteBox = pasteBoxRef.current
    if (pasteBox) {
      pasteBox.innerHTML = ''
      pasteBox.focus()
    }
    setOutput('')
    setInputChars(0)
    setOutputChars(0)
    setLinkCount(0)
    setIsEmpty(true)
  }, [])

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(output)
      logDebug('Copied output', { length: output.length })
    } catch (err) {
      logDebug('Copy failed', { err: String(err) })
    }
  }, [output, logDebug])

  const handleDownload = useCallback(() => {
    const blob = new Blob([output], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'clean.html'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }, [output])

  const handleClearLog = useCallback(() => {
    setDebugLog([])
  }, [])

  // Re-clean when options change
  const handleOptionChange = useCallback(() => {
    setTimeout(doClean, 0)
  }, [doClean])

  return (
    <PageContainer>
      <Tabs tabs={utilitiesTabs} />
      <TabPanel>
        <div className="space-y-4">
          {/* Header */}
          <div>
            <p className="text-gray-600">
              Keeps <strong>bold</strong>, <em>italics</em>, lists, headings, and links; strips inline styles,
              random <code className="bg-gray-100 px-1 rounded">span</code>/<code className="bg-gray-100 px-1 rounded">div</code> soup,
              and event handlers. Paste left, copy right.
            </p>
          </div>

          {/* Options */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium">Preserve Tags and Attributes</h3>
              <div className="px-3 py-1 bg-gray-100 rounded-full text-sm text-gray-600">
                Input: {inputChars} | Output: {outputChars} | Links: {linkCount}
              </div>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={preserveTables} onChange={(e) => { setPreserveTables(e.target.checked); handleOptionChange() }} className="w-4 h-4" />
                <code className="text-sm">&lt;table&gt;</code>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={preserveImages} onChange={(e) => { setPreserveImages(e.target.checked); handleOptionChange() }} className="w-4 h-4" />
                <code className="text-sm">&lt;img&gt;</code>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={preserveDiv} onChange={(e) => { setPreserveDiv(e.target.checked); handleOptionChange() }} className="w-4 h-4" />
                <code className="text-sm">&lt;div&gt;</code>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={preserveSpan} onChange={(e) => { setPreserveSpan(e.target.checked); handleOptionChange() }} className="w-4 h-4" />
                <code className="text-sm">&lt;span&gt;</code>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={preserveStyle} onChange={(e) => { setPreserveStyle(e.target.checked); handleOptionChange() }} className="w-4 h-4" />
                <code className="text-sm">style</code>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={preserveClass} onChange={(e) => { setPreserveClass(e.target.checked); handleOptionChange() }} className="w-4 h-4" />
                <code className="text-sm">class</code>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={preserveId} onChange={(e) => { setPreserveId(e.target.checked); handleOptionChange() }} className="w-4 h-4" />
                <code className="text-sm">id</code>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={preserveDataAttrs} onChange={(e) => { setPreserveDataAttrs(e.target.checked); handleOptionChange() }} className="w-4 h-4" />
                <code className="text-sm">data-*</code>
              </label>
            </div>
          </Card>

          {/* Main Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Input Pane */}
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium">Paste Here (Rich Text)</h3>
                <Button variant="secondary" onClick={handleClear}>Clear</Button>
              </div>
              <div className="relative">
                <div
                  ref={pasteBoxRef}
                  contentEditable
                  onPaste={handlePaste}
                  onInput={handleInput}
                  spellCheck={false}
                  className={`min-h-[260px] p-3 bg-white border border-medium-gray rounded outline-none whitespace-pre-wrap ${isEmpty ? 'text-gray-400' : ''}`}
                  data-placeholder="Paste formatted content from Google Docs/Word/Web here..."
                  suppressContentEditableWarning
                >
                  {isEmpty && <span className="pointer-events-none">Paste formatted content from Google Docs/Word/Web here...</span>}
                </div>
                <div className="absolute bottom-2 left-3 text-xs text-gray-500">
                  {inputChars} chars
                </div>
              </div>
            </Card>

            {/* Output Pane */}
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium">Output (Clean HTML)</h3>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1 cursor-pointer text-sm">
                    <input
                      type="radio"
                      name="viewMode"
                      checked={viewMode === 'html'}
                      onChange={() => setViewMode('html')}
                    />
                    HTML
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer text-sm">
                    <input
                      type="radio"
                      name="viewMode"
                      checked={viewMode === 'preview'}
                      onChange={() => setViewMode('preview')}
                    />
                    Preview
                  </label>
                  <Button variant="secondary" onClick={handleDownload}>Download</Button>
                  <Button variant="secondary" onClick={handleCopy}>Copy</Button>
                </div>
              </div>
              <div className="relative">
                {viewMode === 'html' ? (
                  <textarea
                    value={output}
                    readOnly
                    spellCheck={false}
                    className="w-full min-h-[260px] p-3 bg-white border border-medium-gray rounded resize-y font-mono text-sm"
                  />
                ) : (
                  <div
                    className="min-h-[260px] p-3 bg-white border border-medium-gray rounded overflow-auto prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: output }}
                  />
                )}
                <div className="absolute bottom-2 left-3 text-xs text-gray-500">
                  {outputChars} chars
                </div>
              </div>
            </Card>
          </div>

          {/* Debug Panel */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium">Debug</h3>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={debugEnabled}
                    onChange={(e) => setDebugEnabled(e.target.checked)}
                    className="w-4 h-4"
                  />
                  Log
                </label>
                <Button variant="secondary" onClick={handleClearLog}>Clear Log</Button>
              </div>
            </div>
            <pre className="bg-white border border-medium-gray rounded p-3 overflow-auto whitespace-pre-wrap text-sm max-h-48">
              {debugLog.length === 0 ? (
                <span className="text-gray-400">Debug log empty. Enable logging and paste content to see output.</span>
              ) : (
                debugLog.map((entry, i) => (
                  <div key={i}>
                    [{entry.time}] {entry.label}: {entry.data ? JSON.stringify(entry.data) : ''}
                  </div>
                ))
              )}
            </pre>
          </Card>

          {/* Footer */}
          <div className="flex justify-between text-sm text-gray-500">
            <div>Gutenberg: paste into <em>Code editor</em>. Elementor: paste into <em>Text</em> tab.</div>
          </div>
        </div>
      </TabPanel>
    </PageContainer>
  )
}
