// ── Home public API ───────────────────────────────────────────────────────────

// Components
export { default as HomePage } from './pages/HomePage';

// Services & Hooks
export { fetchRecentItems, fetchActivityFeed } from './services/home.service';
export { useRecentItems, useActivityFeed } from './hooks/use-home';

// Schemas / Types
export type { SectionId, SectionConfig } from './schemas/home.schema';
