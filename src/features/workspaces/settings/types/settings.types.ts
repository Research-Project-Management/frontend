import { z } from 'zod';
import { GeneralSettingsSchema } from '@/features/workspaces/settings/schemas/settings.schema';

export type GeneralSettingsFormValues = z.infer<typeof GeneralSettingsSchema>;
