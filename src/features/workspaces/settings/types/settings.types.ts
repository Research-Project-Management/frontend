import { z } from 'zod';
import { GeneralSettingsSchema } from '../schemas/settings.schema';

export type WorkspaceRole = 'owner';

export type GeneralSettingsFormValues = z.infer<typeof GeneralSettingsSchema>;


