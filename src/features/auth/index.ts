/**
 * Public API Surface for features/auth
 * Conforms to ADR 002 Deep Modules & Hexagonal Architecture
 */

// Hooks
export { useAuth } from './hooks/use-auth';
export { useLogin } from './hooks/use-login';
export { useRegister } from './hooks/use-register';
export { useForgotPassword } from './hooks/use-forgot-password';
export { useOAuthCallback } from './hooks/use-oauth-callback';

// Services
export * as authService from './services/auth.service';

// Types
export type * from './types/auth.types';

// Pages
export { default as LoginPage } from './pages/login-page';
export { default as RegisterPage } from './pages/register-page';
export { default as ForgotPasswordPage } from './pages/forgot-password-page';
export { default as OAuthCallbackPage } from './pages/oauth-callback-page';
