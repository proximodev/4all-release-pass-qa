import { z } from 'zod'

export const projectSchema = z.object({
  name: z.string().min(1, 'Project name is required'),
  siteUrl: z.string().url('Site URL must be a valid URL'),
  sitemapUrl: z.string().url('Sitemap URL must be a valid URL'),
  notes: z.string().optional(),
})

export type ProjectInput = z.infer<typeof projectSchema>
