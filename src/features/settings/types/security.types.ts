import { z } from 'zod';
import { changePasswordSchema } from './security.schema';

export type ChangePasswordPayload = z.infer<typeof changePasswordSchema>;
