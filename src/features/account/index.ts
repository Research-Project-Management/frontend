/**
 * Public API Surface for features/account
 * Conforms to ADR 002 Deep Modules & Hexagonal Architecture
 */

// Components & Modals
export { default as AccountModal } from './pages/AccountModal';

// Hooks
export { useUpdateProfile } from './hooks/use-profile';
export { useChangePassword } from './hooks/use-security';
export { useUserCover } from './hooks/use-user-cover';

// Services
export * as profileService from './services/profile.service';
export * as securityService from './services/security.service';

// Types
export type * from './types/profile.types';
export type * from './types/security.types';
