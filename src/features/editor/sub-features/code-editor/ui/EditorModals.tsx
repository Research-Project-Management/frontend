'use client';

/**
 * EditorModals.tsx
 *
 * Dedicated self-contained Modal Registry for the Code Editor workspace:
 * - Citation Picker (Overleaf-grade)
 * - Table Wizard
 * - Figure Wizard
 * - Symbol Palette
 * - Word Count Dialog
 * - Track Changes / Suggest Edit Modal
 * - Rename Symbol Dialog
 *
 * Listens directly to editorCommandBus dialog events to avoid re-rendering
 * the main Editor shell when dialogs open/close.
 */

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import type { SuggestModalState } from '../../../components/editor/subcomponents/SuggestEditModal';
import type { RenameDialogState } from '../../../components/editor/subcomponents/RenameSymbolDialog';
import { useEditorInstance } from '../../../core/context/editor-instance.context';
import { editorCommandBus } from '../../../core/command-bus/editor-command-bus';
import { EditorEventBus } from '@/features/editor/utils/editor.util';

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
const WordCountDialog = dynamic(
  () =>
    import('../../../components/editor/subcomponents/WordCountDialog').then(
      (m) => m.WordCountDialog
    ),
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
  // Citation Picker
  citationModalOpen?: boolean;
  setCitationModalOpen?: (open: boolean) => void;
  bibEntries?: any[];
  onInsertCitation?: (key: string) => void;
  projectId?: string;
  initialCitationQuery?: string;
  initialCitationKey?: string;
  citedKeys?: string[];

  // Optional manual overrides (backward compatibility)
  tableWizardOpen?: boolean;
  setTableWizardOpen?: (open: boolean) => void;
  figureWizardOpen?: boolean;
  setFigureWizardOpen?: (open: boolean) => void;
  symbolPaletteOpen?: boolean;
  setSymbolPaletteOpen?: (open: boolean) => void;
  wordCountOpen?: boolean;
  setWordCountOpen?: (open: boolean) => void;

  rootPageId: string | null;
  onInsertSnippet?: (snippet: string) => void;

  // Track Changes / Suggestions
  suggestModal: SuggestModalState | null;
  setSuggestModal: (updater: (prev: SuggestModalState | null) => SuggestModalState | null) => void;
  isCreatingSuggestion?: boolean;
  onCloseSuggestModal: () => void;
  onSuggestionSubmit: () => Promise<void>;

  // Rename Symbol
  renameDialog: RenameDialogState | null;
  renameInputRef: React.RefObject<HTMLInputElement | null>;
  onChangeRenameName: (name: string) => void;
  onApplyRename: (word: string, newName: string) => void;
  onCancelRename: () => void;
}

export function EditorModals({
  citationModalOpen: controlledCitationOpen,
  setCitationModalOpen: setControlledCitationOpen,
  bibEntries = [],
  onInsertCitation,
  projectId,
  initialCitationQuery,
  initialCitationKey,
  citedKeys,

  tableWizardOpen: controlledTableOpen,
  setTableWizardOpen: setControlledTableOpen,
  figureWizardOpen: controlledFigureOpen,
  setFigureWizardOpen: setControlledFigureOpen,
  symbolPaletteOpen: controlledSymbolOpen,
  setSymbolPaletteOpen: setControlledSymbolOpen,
  wordCountOpen: controlledWordCountOpen,
  setWordCountOpen: setControlledWordCountOpen,

  rootPageId,
  onInsertSnippet,

  suggestModal,
  setSuggestModal,
  isCreatingSuggestion = false,
  onCloseSuggestModal,
  onSuggestionSubmit,

  renameDialog,
  renameInputRef,
  onChangeRenameName,
  onApplyRename,
  onCancelRename,
}: EditorModalsProps) {
  const { engine } = useEditorInstance();

  // Internal states for wizard dialogs to avoid lifting state up to Editor.tsx
  const [internalTableOpen, setInternalTableOpen] = useState(false);
  const [internalFigureOpen, setInternalFigureOpen] = useState(false);
  const [internalSymbolOpen, setInternalSymbolOpen] = useState(false);
  const [internalWordCountOpen, setInternalWordCountOpen] = useState(false);

  const isTableOpen = controlledTableOpen !== undefined ? controlledTableOpen : internalTableOpen;
  const setIsTableOpen = setControlledTableOpen || setInternalTableOpen;

  const isFigureOpen = controlledFigureOpen !== undefined ? controlledFigureOpen : internalFigureOpen;
  const setIsFigureOpen = setControlledFigureOpen || setInternalFigureOpen;

  const isSymbolOpen = controlledSymbolOpen !== undefined ? controlledSymbolOpen : internalSymbolOpen;
  const setIsSymbolOpen = setControlledSymbolOpen || setInternalSymbolOpen;

  const isWordCountOpen = controlledWordCountOpen !== undefined ? controlledWordCountOpen : internalWordCountOpen;
  const setIsWordCountOpen = setControlledWordCountOpen || setInternalWordCountOpen;

  // Listen directly to CommandBus dialog events
  useEffect(() => {
    const unsubOpen = editorCommandBus.subscribe('dialog:open', (cmd) => {
      switch (cmd.dialog) {
        case 'table-wizard':
          setIsTableOpen(true);
          break;
        case 'figure-wizard':
          setIsFigureOpen(true);
          break;
        case 'symbol-palette':
          setIsSymbolOpen(true);
          break;
        case 'word-count':
          setIsWordCountOpen(true);
          break;
        default:
          break;
      }
    });

    const unsubClose = editorCommandBus.subscribe('dialog:close', (cmd) => {
      if (!cmd.dialog || cmd.dialog === 'table-wizard') setIsTableOpen(false);
      if (!cmd.dialog || cmd.dialog === 'figure-wizard') setIsFigureOpen(false);
      if (!cmd.dialog || cmd.dialog === 'symbol-palette') setIsSymbolOpen(false);
      if (!cmd.dialog || cmd.dialog === 'word-count') setIsWordCountOpen(false);
    });

    // Also support fallback direct event names
    const unsubLegacyTable = EditorEventBus.on('flux:open-table-wizard', () => setIsTableOpen(true));
    const unsubLegacyFigure = EditorEventBus.on('flux:open-figure-wizard', () => setIsFigureOpen(true));
    const unsubLegacySymbol = EditorEventBus.on('flux:open-symbol-palette', () => setIsSymbolOpen(true));
    const unsubLegacyWordCount = EditorEventBus.on('flux:open-word-count', () => setIsWordCountOpen(true));

    return () => {
      unsubOpen();
      unsubClose();
      unsubLegacyTable();
      unsubLegacyFigure();
      unsubLegacySymbol();
      unsubLegacyWordCount();
    };
  }, [setIsTableOpen, setIsFigureOpen, setIsSymbolOpen, setIsWordCountOpen]);

  const handleInsertSnippet = useCallback(
    (snippet: string) => {
      if (onInsertSnippet) {
        onInsertSnippet(snippet);
      } else if (engine) {
        engine.insertText(snippet);
      }
    },
    [onInsertSnippet, engine]
  );

  const handleInsertCitation = useCallback(
    (key: string) => {
      if (onInsertCitation) {
        onInsertCitation(key);
      } else if (engine) {
        engine.insertText(`\\cite{${key}}`);
      }
    },
    [onInsertCitation, engine]
  );

  return (
    <>
      {controlledCitationOpen && (
        <CitationPickerModal
          open={controlledCitationOpen}
          onOpenChange={setControlledCitationOpen || (() => {})}
          items={bibEntries}
          onSelectCitation={handleInsertCitation}
          projectId={projectId}
          initialQuery={initialCitationQuery}
          initialKey={initialCitationKey}
          citedKeys={citedKeys}
        />
      )}

      {isTableOpen && (
        <TableWizardModal
          open={isTableOpen}
          onOpenChange={setIsTableOpen}
          onInsert={handleInsertSnippet}
        />
      )}

      {isFigureOpen && (
        <FigureWizardModal
          open={isFigureOpen}
          onOpenChange={setIsFigureOpen}
          parentPageId={rootPageId}
          onInsert={handleInsertSnippet}
        />
      )}

      {isSymbolOpen && (
        <SymbolPaletteModal
          open={isSymbolOpen}
          onOpenChange={setIsSymbolOpen}
          onInsert={handleInsertSnippet}
        />
      )}

      {isWordCountOpen && (
        <WordCountDialog
          open={isWordCountOpen}
          onClose={() => setIsWordCountOpen(false)}
          content={engine?.getContent() || ''}
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
