/**
 * lru-document-cache.ts
 * Backward compatibility re-export bridge.
 * The canonical domain model now resides at `@/features/editor/domain/document/lru-document-cache`.
 */

export * from '@/features/editor/domain/document/lru-document-cache';
export { lruDocumentCache as default } from '@/features/editor/domain/document/lru-document-cache';
