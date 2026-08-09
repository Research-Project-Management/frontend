// ── Home public API ───────────────────────────────────────────────────────────

// Components
export { default as HomeDashboard } from './components/HomeDashboard';

// Services
export { fetchRecentItems, fetchActivityFeed } from './services/home.service';

// Schemas / Types
export type { SectionId, SectionConfig } from './schemas/home.schema';
