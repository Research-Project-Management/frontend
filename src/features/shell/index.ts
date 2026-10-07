/**
 * Public API Surface for features/shell
 * Conforms to ADR 002 Deep Modules & Hexagonal Architecture
 */

// ── Pages ─────────────────────────────────────────────────────────────
export { default as InboxPage } from './pages/InboxPage';

// ── Shell Navigation & Layout Components ──────────────────────────────
export { default as AppSidebar } from './components/Sidebar';
export { default as AppTopbar } from './components/Topbar';
export { default as StickyDock } from './components/StickyDock';
export { default as WorkspaceSwitcher } from './components/Switcher';
export { default as AccountDropdown } from './components/AccountDropdown';

// ── Inbox Components ──────────────────────────────────────────────────
export { default as InboxView } from './components/inbox/InboxView';
export { default as InboxPopover } from './components/inbox/InboxPopover';
export { default as InboxTabs } from './components/inbox/InboxTabs';
export { default as InboxItem } from './components/inbox/InboxItem';

// ── Hooks ─────────────────────────────────────────────────────────────
export * from './hooks';

// ── Services ──────────────────────────────────────────────────────────
export * from './services';

// ── Types ─────────────────────────────────────────────────────────────
export * from './types';
