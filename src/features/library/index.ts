/**
 * Features / Library - Public API
 *
 * Scoped, lean entry point exporting only public contracts and pure types.
 * Concrete sub-domains, UI components, and stores must be imported directly
 * from their respective subpaths (e.g. @/features/library/data, @/features/library/pages).
 */

// ── Pure Type Definitions (Zero runtime bundle overhead) ──────────────────────
export * from './types';

// ── Public SDK Facade ─────────────────────────────────────────────────────────
export {
  libraryServices,
  libraryService,
  LibraryServices,
  LIBRARY_SERVICES_API_BASE,
  LIBRARY_DOMAINS,
  getDomainEndpoint,
} from './data/library-services';
