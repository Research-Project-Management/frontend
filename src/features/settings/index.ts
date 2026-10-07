/**
 * Public API Surface for features/settings
 * Conforms to ADR 002 Deep Modules & Hexagonal Architecture
 * Organized cleanly by pages (components), with flat types/ (including schemas), flat hooks/, and flat services/.
 */

// ── Pages ─────────────────────────────────────────────────────────────
export { default as SettingsProfilePage } from './pages/ProfilePage';
export { default as SettingsPreferencesPage } from './pages/PreferencesPage';
export { default as SettingsNotificationsPage } from './pages/NotificationsPage';
export { default as SettingsSecurityPage } from './pages/SecurityPage';
export { default as SettingsIntegrationsPage } from './pages/IntegrationsPage';
export { default as SettingsLabelsPage } from './pages/LabelsPage';

// ── Components by Page ────────────────────────────────────────────────
export { ProfileTab } from './components/profile/ProfileTab';
export { CoverModal } from './components/profile/CoverModal';
export { PreferencesTab } from './components/preferences/PreferencesTab';
export { NotificationsTab } from './components/notifications/NotificationsTab';
export { SecurityTab } from './components/security/SecurityTab';
export { IntegrationsHub } from './components/integrations/IntegrationsHub';
export { IntegrationCard } from './components/integrations/IntegrationCard';
export { IntegrationDetailView } from './components/integrations/IntegrationDetailView';
export { DeleteModal } from './components/labels/DeleteModal';
export { SideBar } from './components/layout/SideBar';

// ── Hooks (Flat) ──────────────────────────────────────────────────────
export { useUpdateProfile } from './hooks/use-profile';
export { useUserCover, DEFAULT_USER_COVER } from './hooks/use-user-cover';
export { useChangePassword } from './hooks/use-security';
export {
  useIntegrations,
  useRemoteCollections,
  useSyncCollection,
  INTEGRATIONS_QUERY_KEY,
  FALLBACK_INTEGRATIONS,
} from './hooks/use-integrations';
export {
  useUserLabels,
  useWorkspaceLabels,
  useCreateWorkspaceLabel,
  useCreateUserLabel,
  useUpdateWorkspaceLabel,
  useUpdateUserLabel,
  useDeleteWorkspaceLabel,
  useDeleteUserLabel,
  userLabelKeys,
  workspaceLabelKeys,
} from './hooks/use-workspace-labels';

// ── Services (Flat) ───────────────────────────────────────────────────
export * as profileService from './services/profile.service';
export * as securityService from './services/security.service';
export { integrationService } from './services/integration.service';

// ── Types & Schemas (Flat in types/) ──────────────────────────────────
export * from './types';
