/**
 * Global Application Custom Window Events Registry.
 *
 * Centralizes all cross-component `window` custom event names and provides
 * SSR-safe, typed `emitAppEvent` / `onAppEvent` helpers.
 */
export const APP_EVENTS = {
  OPEN_QUICK_SEARCH: 'open-quick-search',
  TOGGLE_PROJECT_SIDEBAR: 'toggle-project-sidebar',
  TOGGLE_PAGES_SIDEBAR: 'toggle-pages-sidebar',
  FAVORITES_CHANGED: 'flux:favorites-changed',
  FILETREE_UPDATED: 'flux:filetree-updated',
  OUTBOX_MUTATED: 'flux:outbox:mutated',
  USER_COVER_CHANGED: 'flux_user_cover_changed',
} as const;

export type AppEventName = (typeof APP_EVENTS)[keyof typeof APP_EVENTS];

export function emitAppEvent<T = undefined>(name: AppEventName, detail?: T): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    detail === undefined ? new CustomEvent(name) : new CustomEvent(name, { detail }),
  );
}

export function onAppEvent<T = undefined>(
  name: AppEventName,
  handler: (detail: T, event: Event) => void,
): () => void {
  if (typeof window === 'undefined') return () => {};
  const listener = (event: Event) => {
    handler((event as CustomEvent<T>).detail, event);
  };
  window.addEventListener(name, listener);
  return () => window.removeEventListener(name, listener);
}
