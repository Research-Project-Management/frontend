import { z } from 'zod';
import { changePasswordSchema } from '../schemas/security.schema';

export type ChangePasswordPayload = z.infer<typeof changePasswordSchema>;
