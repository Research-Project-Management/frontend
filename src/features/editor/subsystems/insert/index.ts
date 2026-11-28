/**
 * subsystems/insert/index.ts
 *
 * Insert Subsystem Public Seam & Entry Point (Matt Pocock Deep Module).
 *
 * Responsibilities:
 * - Visual/AI Table Editor & Toolbar Quick-Size Popover (`TableModal`, `TablePopover`, `useTableEditor`).
 * - AI/KaTeX Equation Generator (`EquationModal`).
 * - Space-aware Figure Picker & Uploader (`FigureModal`).
 * - Docked LaTeX Math Symbol Palette (`SymbolPalette`).
 */

export { TableModal, type TableModalProps } from './ui/table/TableModal';
export { TablePopover, type TablePopoverProps } from './ui/table/TablePopover';
export { EquationModal, type EquationModalProps } from './ui/EquationModal';
export { FigureModal, type FigureModalProps } from './ui/FigureModal';
export { SymbolPalette, type SymbolPaletteProps } from './ui/SymbolPalette';
export { useTableEditor, type TableTab, type UseTableEditorOptions } from './hooks/useTableEditor';
