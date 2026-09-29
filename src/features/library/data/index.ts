/**
 * Data Layer Barrel Export
 * Centralized Server State (Queries & Mutations), API Services, and Query Keys.
 * Organized into 6 Bounded Contexts + Unified Library SDK.
 */

// ── Query Keys ────────────────────────────────────────────────────────────────
export * from './query-keys';

// ── Unified Library Client SDK ────────────────────────────────────────────────
export * from './library.service';

// ── 6 Bounded Context Sub-Domains ─────────────────────────────────────────────
export * from './catalog';
export * from './extraction';
export * from './ingestion';
export * from './citation';
export * from './search';
export * from './sync';
export * from './library-cache-sync';
