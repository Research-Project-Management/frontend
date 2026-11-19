/**
 * src/features/editor/subsystems/authoring-wizards/index.ts
 *
 * Authoring Wizards Subsystem Public Seam (Matt Pocock Deep Module).
 *
 * Responsibilities:
 * - Interactive LaTeX Table & Matrix Wizard Modal + Matrix State Hook.
 * - Figure Insertion Wizard Modal.
 * - Mathematical Symbol Palette Modal.
 */

export {
  TableWizardModal,
  type TableWizardModalProps,
} from './ui/table-wizard/TableWizardModal';
export {
  useTableMatrixWizard,
  type UseTableMatrixWizardOptions,
} from './ui/table-wizard/useTableMatrixWizard';
export {
  FigureWizardModal,
  type FigureWizardModalProps,
} from './ui/FigureWizardModal';
export {
  SymbolPaletteModal,
  type SymbolPaletteModalProps,
} from './ui/SymbolPaletteModal';
