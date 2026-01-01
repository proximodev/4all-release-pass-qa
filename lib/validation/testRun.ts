import { z } from 'zod'
import { safeUrlSchema } from './url'

export const testRunSchema = z.object({
  projectId: z.string().uuid('Project ID must be a valid UUID'),
  type: z.enum(['PAGE_PREFLIGHT', 'SITE_AUDIT', 'PERFORMANCE', 'SCREENSHOTS', 'SPELLING'], {
    message: 'Invalid test type',
  }),
  scope: z.enum(['SINGLE_URL', 'CUSTOM_URLS', 'SITEMAP']).optional(),
  urls: z.array(safeUrlSchema).optional(),
})

export type TestRunInput = z.infer<typeof testRunSchema>
