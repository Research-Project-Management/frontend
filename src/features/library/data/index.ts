/**
 * Data Layer Barrel Export
 * Centralized Server State (Queries & Mutations), API Services, and Query Keys.
 * Organized into 6 Bounded Contexts + Unified Library SDK.
 */

// ── Query Keys ────────────────────────────────────────────────────────────────
export * from './query-keys';

// ── Unified Library Client SDK ────────────────────────────────────────────────
export * from './library-services';

// ── 6 Bounded Context Sub-Domains ─────────────────────────────────────────────
export * from './catalog/catalog.service';
export * from './catalog/catalog.queries';
export * from './extraction/extraction.service';
export * from './extraction/extraction.queries';
export * from './ingestion/ingestion.service';
export * from './ingestion/ingestion.queries';
export * from './citation/citation.service';
export * from './citation/citation.queries';
export * from './search/search.service';
export * from './search/search.queries';
export * from './sync/sync.service';
export * from './sync/sync.queries';
