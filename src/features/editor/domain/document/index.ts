/**
 * domain/document/index.ts
 *
 * Pure domain logic for document structure, PDF outline extraction,
 * SyncTeX indexing, compilation snapshots, unified multi-tier document storage,
 * and document naming.
 *
 * Clean Architecture Guarantee: Pure Domain layer with ZERO outwards dependencies.
 */

export * from './compilation-snapshot';
export * from './lru-document-cache';
export * from './draft-storage';
export * from './document-store';
export * from './synctex-index';
export * from './pdf-outline';
export * from './pdf-utils';
export * from './document-naming';
