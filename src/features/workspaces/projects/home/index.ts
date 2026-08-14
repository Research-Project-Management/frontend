// ── Home public API ───────────────────────────────────────────────────────────

// Components
export { default as HomePage } from './pages/home-page';

// Services & Hooks
export { getRecentItems } from './services/home.service';
export { useRecentItems } from './hooks/use-home';

// Schemas / Types
export type { SectionId, SectionConfig } from './schemas/home.schema';
