/**
 * engines/index.ts
 *
 * Unified Barrel Export for Editor Technology Engines (Layer 2).
 * Houses CodeMirror 6 configuration, extensions, collaboration, and workers.
 */

// 1. CodeMirror 6 Infrastructure & Presets
export * from './codemirror/codemirror-preset';
export * from './codemirror/editor-themes';

// 2. Independent CodeMirror Extension Slices
export * from './extensions/latex-language';
export * from './extensions/latex-autocomplete';
export * from './extensions/latex-linter';
export * from './extensions/latex-linter-core';
export * from './extensions/latex-math-preview';
export * from './extensions/latex-citation-hover';
export * from './extensions/inline-diff';
export * from './extensions/latex-folding';
export * from './extensions/latex-error-lens';
export * from './extensions/track-changes.extension';

// 3. Real-time Collaboration Engine (Yjs CRDT & Persistence)
export * from './collaboration/yjs-codemirror-adapter';
export * from './collaboration/yjs-persistence-adapter';

// 4. Platform Engine Adapters
export * from './adapters';
