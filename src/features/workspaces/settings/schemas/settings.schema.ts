import { z } from 'zod';

export const ResearchScaleEnum = z.enum([
  '1',
  '2-10',
  '11-50',
  '51-200',
  '201-500',
  '500+',
]);

export const GeneralSettingsSchema = z.object({
  name: z.string().min(1, 'Workspace name is required').max(100, 'Name is too long'),
  url: z.string().optional(),
  avatar: z.string().nullable().optional(),
  teamSize: ResearchScaleEnum.optional(),
});

export type GeneralSettingsInput = z.infer<typeof GeneralSettingsSchema>;


