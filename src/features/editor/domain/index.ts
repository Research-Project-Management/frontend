/**
 * domain/index.ts
 *
 * Barrel export for Editor Domain Layer (Pure Logic, Zero React, Zero DOM).
 */

export * from './lru-document-cache';
export * from './latex-dag-engine';
export * from './latex-symbols-core';
export * from './latex-symbols-index';
export * from './synctex-index';
export * from './compilation-snapshot';

export * from './types';
export * from './utils';

// Explicit re-exports to resolve TS2308 ambiguity
export { latexDependencyGraph, stripLatexComments } from './latex-dag-engine';
export type { BibEntry } from './latex-symbols-core';
export { forEachLine, resolvePageForLine } from './synctex-index';
export type { SyncTeXMap, SyncTeXNode } from './synctex-index';

