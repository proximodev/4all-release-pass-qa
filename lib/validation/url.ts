import { z } from 'zod'

/**
 * Blocked hostnames that could be used for SSRF attacks
 */
const BLOCKED_HOSTNAMES = [
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '[::1]',
  'metadata.google.internal',
  'metadata.google',
]

/**
 * Check if an IP address is in a private/internal range
 */
function isPrivateIP(hostname: string): boolean {
  // IPv4 patterns
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/
  const match = hostname.match(ipv4Regex)

  if (!match) return false

  const [, a, b, c, d] = match.map(Number)

  // Validate octets are in range
  if ([a, b, c, d].some(octet => octet > 255)) return false

  // 10.0.0.0/8 - Private
  if (a === 10) return true

  // 172.16.0.0/12 - Private
  if (a === 172 && b >= 16 && b <= 31) return true

  // 192.168.0.0/16 - Private
  if (a === 192 && b === 168) return true

  // 169.254.0.0/16 - Link-local (includes AWS metadata endpoint)
  if (a === 169 && b === 254) return true

  // 127.0.0.0/8 - Loopback
  if (a === 127) return true

  // 0.0.0.0/8 - Current network
  if (a === 0) return true

  return false
}

/**
 * Validate that a URL is safe for external requests (not vulnerable to SSRF)
 */
export function isValidPublicUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString)

    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(url.protocol)) {
      return false
    }

    const hostname = url.hostname.toLowerCase()

    // Check against blocked hostnames
    if (BLOCKED_HOSTNAMES.some(blocked => hostname === blocked || hostname.endsWith('.' + blocked))) {
      return false
    }

    // Check for private/internal IP addresses
    if (isPrivateIP(hostname)) {
      return false
    }

    // Block URLs with credentials (potential for abuse)
    if (url.username || url.password) {
      return false
    }

    return true
  } catch {
    return false
  }
}

/**
 * Zod schema for a safe public URL
 * Validates URL format and ensures it's not pointing to internal/private resources
 */
export const safeUrlSchema = z
  .string()
  .url('Must be a valid URL')
  .refine(isValidPublicUrl, {
    message: 'URL must be a public HTTP/HTTPS address (internal IPs and localhost are not allowed)',
  })

/**
 * Zod schema for an array of safe public URLs
 */
export const safeUrlArraySchema = z
  .array(safeUrlSchema)
  .min(1, 'At least one URL is required')

/**
 * Validate that a URL uses HTTP or HTTPS protocol
 * Simpler than safeUrlSchema - for display URLs like company websites
 */
export function isValidHttpUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString)
    return ['http:', 'https:'].includes(url.protocol)
  } catch {
    return false
  }
}

/**
 * Zod schema for company URL (optional, display-only)
 * Less strict than safeUrlSchema - just validates HTTP/HTTPS format
 */
export const companyUrlSchema = z
  .string()
  .transform((val) => val.trim())
  .refine((val) => val === '' || isValidHttpUrl(val), {
    message: 'URL must be a valid HTTP or HTTPS address',
  })
  .optional()
  .or(z.literal(''))
