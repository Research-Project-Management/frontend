/**
 * domain/index.ts
 *
 * Barrel export for Editor Domain Layer (Pure Business Logic, Zero React, Zero DOM).
 * Conforms to Clean Architecture & Domain-Driven Design (DDD).
 */

export * from './types';
export * from './citation';
export * from './latex';
export * from './document';
export * from './collaboration';

// Explicit re-exports to resolve TS2308 ambiguity
export { latexDependencyGraph, stripLatexComments } from './latex';
export type { BibEntry } from './citation';
export { forEachLine, resolvePageForLine, parseSyncTeX } from './document';
export type { SyncTeXMap, SyncTeXNode } from './document';
