/**
 * manuscript.service.ts
 *
 * UNIFIED MANUSCRIPT CLIENT SDK FACADE
 *
 * Re-exports the modular manuscript subsystem APIs from ./manuscript.
 * Sub-APIs are organized into focused single-responsibility domain modules:
 *  - docs: Document CRUD, lines, thumbnails, and sync (docs.api.ts)
 *  - compiler: LaTeX compilation, aux artifacts, word-count, preview (compiler.api.ts)
 *  - synctex: Forward and reverse SyncTeX coordinate mapping (synctex.api.ts)
 *  - comments: Inline discussion threads, replies, and resolution (comments.api.ts)
 *  - suggestions: Track changes and review suggestions (suggestions.api.ts)
 *  - review: Review threads and tracked changes (review.api.ts)
 *  - history: Snapshots, revisions, visual diffing, and audit logs (history.api.ts)
 *  - search: Full-text search and atomic batch replace across project files (search.api.ts)
 *  - export: Multi-format compilation export (export.api.ts)
 *  - collaboration: Real-time presence, heartbeat, SSE sync (collaboration.api.ts)
 *  - structure: Project hierarchy, folders, and file tree nodes (structure.api.ts)
 *  - diagnostics: Error explanation, linter, autofix (diagnostics.api.ts)
 *  - linkedFiles: URL, Zotero, Mendeley external file links (linked-files.api.ts)
 *  - citations: BibTeX entry resolution, validation, and search (citations.api.ts)
 *  - templates: Project and gallery template scaffolding (templates.api.ts)
 *  - filestore: Binary file upload, streaming, and signed URLs (filestore.api.ts)
 *  - updater: Batch document update buffering and buffer flushing (updater.api.ts)
 */

export * from './manuscript';
export { default } from './manuscript';
