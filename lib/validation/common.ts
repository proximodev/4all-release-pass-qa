/**
 * Common validation schemas and helpers
 */

import { z } from 'zod'

/**
 * UUID validation schema
 */
export const uuidSchema = z.string().uuid('Invalid UUID format')

/**
 * Validate a UUID string, returns null if invalid
 */
export function validateUuid(value: string | null): string | null {
  if (!value) return null
  const result = uuidSchema.safeParse(value)
  return result.success ? result.data : null
}

/**
 * Check if a string is a valid UUID
 */
export function isValidUuid(value: string | null): boolean {
  if (!value) return false
  return uuidSchema.safeParse(value).success
}
