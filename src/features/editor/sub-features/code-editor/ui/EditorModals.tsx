'use client';

/**
 * EditorModals.tsx
 *
 * Dedicated container for all dialogs and modals attached to the Code Editor workspace:
 * - Citation Picker
 * - Table Wizard
 * - Figure Wizard
 * - Symbol Palette
 * - Track Changes / Suggest Edit Modal
 * - Rename Symbol Dialog
 */

import React from 'react';
import dynamic from 'next/dynamic';
import type { SuggestModalState } from '../../../components/editor/subcomponents/SuggestEditModal';
import type { RenameDialogState } from '../../../components/editor/subcomponents/RenameSymbolDialog';

const CitationPickerModal = dynamic(
  () => import('../../../components/editor/CitationPickerModal'),
  { ssr: false }
);
const TableWizardModal = dynamic(
  () => import('../../../components/modals/TableWizardModal'),
  { ssr: false }
);
const FigureWizardModal = dynamic(
  () => import('../../../components/modals/FigureWizardModal'),
  { ssr: false }
);
const SymbolPaletteModal = dynamic(
  () => import('../../../components/modals/SymbolPaletteModal'),
  { ssr: false }
);
const SuggestEditModal = dynamic(
  () =>
    import('../../../components/editor/subcomponents/SuggestEditModal').then(
      (m) => m.SuggestEditModal
    ),
  { ssr: false }
);
const RenameSymbolDialog = dynamic(
  () =>
    import('../../../components/editor/subcomponents/RenameSymbolDialog').then(
      (m) => m.RenameSymbolDialog
    ),
  { ssr: false }
);

export interface EditorModalsProps {
  citationModalOpen: boolean;
  setCitationModalOpen: (open: boolean) => void;
  bibEntries: any[];
  onInsertCitation: (key: string) => void;

  tableWizardOpen: boolean;
  setTableWizardOpen: (open: boolean) => void;

  figureWizardOpen: boolean;
  setFigureWizardOpen: (open: boolean) => void;
  rootPageId: string | null;

  symbolPaletteOpen: boolean;
  setSymbolPaletteOpen: (open: boolean) => void;
  onInsertSnippet: (snippet: string) => void;

  suggestModal: SuggestModalState | null;
  setSuggestModal: (updater: (prev: SuggestModalState | null) => SuggestModalState | null) => void;
  isCreatingSuggestion: boolean;
  onCloseSuggestModal: () => void;
  onSuggestionSubmit: () => Promise<void>;

  renameDialog: RenameDialogState | null;
  renameInputRef: React.RefObject<HTMLInputElement | null>;
  onChangeRenameName: (name: string) => void;
  onApplyRename: (word: string, newName: string) => void;
  onCancelRename: () => void;
}

export function EditorModals({
  citationModalOpen,
  setCitationModalOpen,
  bibEntries,
  onInsertCitation,
  tableWizardOpen,
  setTableWizardOpen,
  figureWizardOpen,
  setFigureWizardOpen,
  rootPageId,
  symbolPaletteOpen,
  setSymbolPaletteOpen,
  onInsertSnippet,
  suggestModal,
  setSuggestModal,
  isCreatingSuggestion,
  onCloseSuggestModal,
  onSuggestionSubmit,
  renameDialog,
  renameInputRef,
  onChangeRenameName,
  onApplyRename,
  onCancelRename,
}: EditorModalsProps) {
  return (
    <>
      {citationModalOpen && (
        <CitationPickerModal
          open={citationModalOpen}
          onOpenChange={setCitationModalOpen}
          items={bibEntries}
          onSelectCitation={onInsertCitation}
        />
      )}

      {tableWizardOpen && (
        <TableWizardModal
          open={tableWizardOpen}
          onOpenChange={setTableWizardOpen}
          onInsert={onInsertSnippet}
        />
      )}

      {figureWizardOpen && (
        <FigureWizardModal
          open={figureWizardOpen}
          onOpenChange={setFigureWizardOpen}
          parentPageId={rootPageId}
          onInsert={onInsertSnippet}
        />
      )}

      {symbolPaletteOpen && (
        <SymbolPaletteModal
          open={symbolPaletteOpen}
          onOpenChange={setSymbolPaletteOpen}
          onInsert={onInsertSnippet}
        />
      )}

      {Boolean(suggestModal) && (
        <SuggestEditModal
          suggestModal={suggestModal}
          isPending={isCreatingSuggestion}
          onClose={onCloseSuggestModal}
          onSubmit={onSuggestionSubmit}
          onChangeState={setSuggestModal}
        />
      )}

      {Boolean(renameDialog) && (
        <RenameSymbolDialog
          renameDialog={renameDialog}
          renameInputRef={renameInputRef}
          onChangeNewName={onChangeRenameName}
          onApply={onApplyRename}
          onCancel={onCancelRename}
        />
      )}
    </>
  );
}
