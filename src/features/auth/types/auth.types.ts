import type { z } from 'zod';
import type {
  loginSchema,
  registerSchema,
  changePasswordSchema,
  forgotPasswordSchema,
} from '../schemas/auth.schema';

export type AuthUser = {
  id?: string;
  _id: string;
  name: string;
  email: string;
  avatar?: string;
  role?: string;
};

export type LoginPayload = z.infer<typeof loginSchema>;
export type RegisterFormValues = z.infer<typeof registerSchema>;
export type RegisterPayload = {
  name: string;
  email: string;
  password: string;
};
export type ForgotPasswordPayload = z.infer<typeof forgotPasswordSchema>;
export type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;
export type ChangePasswordPayload = {
  currentPassword: string;
  newPassword: string;
};

export type RegisterResponse = {
  user: AuthUser;
};

export type ChangePasswordResponse = {
  message: string;
};
