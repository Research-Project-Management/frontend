// ── Home schemas ──────────────────────────────────────────────────────────────
import { z } from 'zod';

export const sectionIdSchema = z.enum(['quicklinks', 'stickies', 'recent']);
export type SectionId = z.infer<typeof sectionIdSchema>;

export const sectionConfigSchema = z.object({
  id: sectionIdSchema,
  visible: z.boolean(),
});
export type SectionConfig = z.infer<typeof sectionConfigSchema>;
