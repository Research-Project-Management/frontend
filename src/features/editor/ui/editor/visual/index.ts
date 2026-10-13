/**
 * @deprecated
 * Legacy Visual Editor Components (Retired in favor of Overleaf-style CodeMirror 6 Visual Mode).
 * 
 * In the modern unified architecture, visual editing is accomplished directly on top of CodeMirror 6
 * via extensions (latexVisualHeadings, latexVisualMath, latexVisualCitations) located in:
 * `src/features/editor/engines/extensions/`
 */

export * from './modals/VisualMathSymbolPalette';
export * from './modals/VisualMathEditorModal';
export * from './modals/VisualProtectedEditorModal';
export * from './toolbars/VisualFigureToolbar';
export * from './toolbars/VisualReferenceHoverCard';
export * from './toolbars/VisualSelectionBubbleMenu';
export * from './toolbars/VisualSlashCommandMenu';
export * from './toolbars/VisualTableToolbar';
export * from './VisualCollaboratorCursors';
