/**
 * Global Browser Storage Keys Registry (localStorage / sessionStorage).
 *
 * Centralizes all persistence keys to prevent typos and cross-feature drift.
 * Existing string values are preserved verbatim to avoid breaking persisted user state.
 */
export const STORAGE_KEYS = {
  // Auth & Session
  CACHED_USER: 'flux_cached_user',
  OAUTH_REDIRECT: 'flux_oauth_redirect',
  AUTH_REDIRECT_ATTEMPT: 'flux_auth_redirect_attempt',

  // API / Runtime overrides
  API_BASE_URL_OVERRIDE: 'FLUX_API_BASE_URL',
  REALTIME_BASE_URL_OVERRIDE: 'FLUX_REALTIME_BASE_URL',

  // Theme & Appearance
  THEME: 'flux-theme',
  THEME_ACCENT: 'flux-accent',
  UI_SCALE: 'flux-ui-scale',

  // Workspace & Navigation
  ACTIVE_PROJECT_ID: 'flux_active_project_id',
  SIDEBAR_FAVORITES: 'sidebar_favorites',
  PROJECT_SIDEBAR_VISIBLE: 'flux:project-sidebar-visible',
  PAGES_SIDEBAR_VISIBLE: 'flux:pages-sidebar-visible',
  PROJECTS_VIEW_MODE: 'flux:projects-view-mode',

  // Work Items Timeline
  TIMELINE_SIDEBAR_WIDTH: 'flux:timeline_view:sidebar_width',
  TIMELINE_ZOOM: 'flux:timeline_view:zoom',
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];
