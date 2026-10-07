/**
 * engines/index.ts
 *
 * Barrel export for Editor Technology Engines (Block 4: Engines Layer).
 * Houses CodeMirror 6 configuration, language grammars, extension slices, and collaboration adapters.
 */

// 1. CodeMirror 6 Baseline Preset & Dynamic Compartments
export * from './codemirror-preset';

// 2. Real-time Collaboration Adapter (Yjs CRDT)
export * from './yjs-codemirror-adapter';

// 3. LaTeX Extension Slices
export * from './latex-language';
export * from './latex-macros';
export * from './latex-linter';
export * from './latex-math-preview';
export * from './inline-diff';
export * from './latex-folding';
export * from './latex-error-lens';
export * from './editor-themes';
