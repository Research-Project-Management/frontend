import type { z } from 'zod';
import type {
  loginSchema,
  registerSchema,
  changePasswordSchema,
  forgotPasswordSchema,
} from '../schemas/auth.schema';

// ─── 1. Branded Identifiers ──────────────────────────────────────────────────

export type UserId = string & { readonly __brand: unique symbol };
export type WorkspaceId = string & { readonly __brand: unique symbol };
export type ProjectId = string & { readonly __brand: unique symbol };

export const toUserId = (id: string): UserId => id as UserId;
export const toWorkspaceId = (id: string): WorkspaceId => id as WorkspaceId;
export const toProjectId = (id: string): ProjectId => id as ProjectId;

// ─── 2. User & Session Models ────────────────────────────────────────────────

export type AuthUser = {
  id: UserId | string;
  name: string;
  email: string;
  avatar?: string | null;
  role?: string;
  isVerified?: boolean;
};

export type AuthenticatedUser = AuthUser & {
  id: UserId;
};

// ─── 3. Discriminated Union Auth State ───────────────────────────────────────

export type AuthState =
  | { readonly status: 'loading'; readonly user: null; readonly error: null }
  | { readonly status: 'unauthenticated'; readonly user: null; readonly error: string | null }
  | { readonly status: 'authenticated'; readonly user: AuthUser; readonly error: null };

export const isAuth = (
  state: AuthState,
): state is { readonly status: 'authenticated'; readonly user: AuthUser; readonly error: null } =>
  state.status === 'authenticated';

// ─── 4. Payloads & Responses ─────────────────────────────────────────────────

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

