import { z } from 'zod'
import { isValidHttpUrl } from './url'

/**
 * Zod schema for company create/update operations
 */
export const companySchema = z.object({
  name: z
    .string()
    .min(1, 'Company name is required')
    .max(255, 'Company name must be 255 characters or less'),
  url: z
    .string()
    .transform((val) => val.trim())
    .refine((val) => val === '' || isValidHttpUrl(val), {
      message: 'URL must be a valid HTTP or HTTPS address',
    })
    .optional()
    .or(z.literal(''))
    .transform((val) => val || null), // Convert empty string to null for DB storage
})

export type CompanyInput = z.infer<typeof companySchema>
