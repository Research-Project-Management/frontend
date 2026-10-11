/**
 * domain/latex/index.ts
 *
 * Pure domain logic for LaTeX AST parsing, dependency graph resolution,
 * static analysis (linter), converter, tabular/matrix generation,
 * academic AI entity masking/heuristics, and LaTeX error repair heuristics.
 */

export * from './latex-dag-engine';
export * from './latex-symbols-core';
export * from './latex-symbols-index';
export * from './latex-linter';
export * from './latex-converter';
export * from './table-matrix';
export * from './smart-paste';
export * from './latex-structure';
export * from './ai-academic-assistant';
export * from './ai-error-assist';
export * from './prefix-trie';
