/**
 * index.ts
 *
 * Barrel export for all Editor Zod schemas and inferred types.
 * Matches backend document modules 1:1.
 */

export * from './core.schema';
export * from './compiler.schema';
export * from './synctex.schema';
export * from './comment.schema';
export * from './suggestion.schema';
export * from './history.schema';
export * from './outline.schema';
export * from './collaboration.schema';
export * from './export.schema';
export * from './asset.schema';
export * from './node.schema';
export * from './template.schema';
