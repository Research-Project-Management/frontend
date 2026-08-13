/**
 * features/auth/index.ts
 * Public API of the auth feature.
 */

// ─── Pages ────────────────────────────────────────────────────────────────────
export { default as LoginPage } from './pages/login-page';
export { default as RegisterPage } from './pages/register-page';
export { default as ForgotPasswordPage } from './pages/forgot-password-page';
export { default as OAuthCallbackPage } from './pages/oauth-callback-page';

// ─── Hooks ────────────────────────────────────────────────────────────────────
export { useAuth } from './hooks/use-auth';
export { useLogin } from './hooks/use-login';
export { useRegister } from './hooks/use-register';
export { useForgotPassword } from './hooks/use-forgot-password';
export { useLogout } from './hooks/use-logout';
export { useChangePassword } from './hooks/use-change-password';

// ─── Services ─────────────────────────────────────────────────────────────────
export {
  loginUser,
  getUser,
  registerUser,
  logoutUser,
  forgotPassword,
  changePassword,
} from './services/auth-service';

// ─── Types ────────────────────────────────────────────────────────────────────
export type {
  AuthUser,
  LoginPayload,
  RegisterPayload,
  RegisterResponse,
  ChangePasswordPayload,
  ChangePasswordResponse,
} from './types/auth-types';

// ─── Schemas ──────────────────────────────────────────────────────────────────
export {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  changePasswordSchema,
} from './schemas/auth-schemas';

export type {
  LoginSchema,
  RegisterSchema,
  ForgotPasswordSchema,
  ChangePasswordSchema,
} from './schemas/auth-schemas';
