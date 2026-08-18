import { z } from 'zod';

export const sectionIdSchema = z.enum(['quicklinks', 'stickies', 'recent']);
export type SectionId = z.infer<typeof sectionIdSchema>;

export const sectionConfigSchema = z.object({
  id: sectionIdSchema,
  visible: z.boolean(),
});
export type SectionConfig = z.infer<typeof sectionConfigSchema>;

export const quicklinkSchema = z.object({
  url: z.string().url("Please enter a valid URL"),
  title: z.string().optional(),
});
