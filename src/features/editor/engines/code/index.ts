/**
 * engines/code/index.ts
 *
 * Public API for LaTeX Code Editor Engine (CodeMirror 6, Vim/Emacs, Visual Mode, Extensions).
 */

export { default as CodeEditorSurface } from '../../components/editor/UnifiedCodeMirrorEditor';
export { default as UnifiedCodeMirrorEditor } from '../../components/editor/UnifiedCodeMirrorEditor';
export * from '../../components/editor/UnifiedCodeMirrorEditor';

// Subcomponents and toolbars
export * from '../../sub-features/code-editor/components/FormatToolbar';
export * from '../../sub-features/code-editor/ui/EditorModals';
export * from '../../sub-features/code-editor/ui/EditorFloatingOverlay';
