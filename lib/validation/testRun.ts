import { z } from 'zod'

export const testRunSchema = z.object({
  projectId: z.string().uuid('Project ID must be a valid UUID'),
  type: z.enum(['SITE_AUDIT', 'PERFORMANCE', 'SCREENSHOTS', 'SPELLING'], {
    errorMap: () => ({ message: 'Invalid test type' }),
  }),
  scope: z.enum(['SINGLE_URL', 'CUSTOM_URLS', 'SITEMAP']).optional(),
  urls: z.array(z.string().url('Each URL must be valid')).optional(),
})

export type TestRunInput = z.infer<typeof testRunSchema>
