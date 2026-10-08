/**
 * Editor Features Module (Block 6: UI Features Layer).
 * Location: `features/editor/ui/features/editor/index.ts`
 */

export { EditorArea } from './EditorArea';
export { CodeMirrorView } from './CodeMirrorView';
export { EditorToolbar } from './EditorToolbar';
export { EditorTabs } from './EditorTabs';
export { SourceVisualSwitcher } from './SourceVisualSwitcher';
export { VisualEditorView } from './VisualEditorView';
export { VisualSlashCommandMenu, SLASH_COMMANDS, type SlashCommandItem } from './VisualSlashCommandMenu';
export { VisualTableToolbar, type VisualTableToolbarProps } from './VisualTableToolbar';
export {
  VisualMathSymbolPalette,
  MATH_SYMBOLS,
  type MathSymbolItem,
  type MathPaletteCategory,
  type VisualMathSymbolPaletteProps,
} from './VisualMathSymbolPalette';
export {
  VisualSelectionBubbleMenu,
  type VisualSelectionBubbleMenuProps,
  type BlockType,
} from './VisualSelectionBubbleMenu';
export {
  VisualFigureToolbar,
  type VisualFigureToolbarProps,
} from './VisualFigureToolbar';
export { ImagePanel } from './ImagePanel';
export { CollaboratorCursors } from './CollaboratorCursors';
export {
  VisualCollaboratorCursors,
  type VisualCollaboratorCursorsProps,
} from './VisualCollaboratorCursors';
export {
  VisualReferenceHoverCard,
  type VisualReferenceHoverCardProps,
} from './VisualReferenceHoverCard';
export { createDiagnosticsGutter } from './DiagnosticsGutter';
