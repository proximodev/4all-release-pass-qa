import { z } from 'zod'
import { safeUrlSchema } from './url'

export const TestType = z.enum([
  'PAGE_PREFLIGHT',
  'PERFORMANCE',
  'SCREENSHOTS',
  'SPELLING',
])

export const releaseRunSchema = z.object({
  projectId: z.string().uuid('Project ID must be a valid UUID'),
  name: z.string().min(1, 'Test name is required').optional(),
  urls: z
    .array(safeUrlSchema)
    .min(1, 'At least one URL is required'),
  selectedTests: z
    .array(TestType)
    .min(1, 'At least one test type must be selected'),
})

export type ReleaseRunInput = z.infer<typeof releaseRunSchema>
export type TestTypeValue = z.infer<typeof TestType>
