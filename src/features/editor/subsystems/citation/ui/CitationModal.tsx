'use client';

/**
 * CitationModal.tsx
 *
 * Add-from-Library Modal for the Flux Editor (Overleaf <-> Zotero flow).
 * Selects references or collections from Library and writes them to the configured `.bib` file.
 */

import React, { useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogClose,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { X } from 'lucide-react';
import type { BibEntry } from '@/features/editor/domain/latex/bib-parser';
import { CitationRetractionAlertDialog } from './RetractionDialog';
import {
  useCitationPickerState,
  type CitationStyle,
} from '../hooks/useCitationModal';
import { CitationPickerListPane } from './CitationList';
import { CitationSidebar } from './CitationSidebar';
import { CitationDetailPane } from './CitationDetail';

export interface CitationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items?: BibEntry[];
  onSelectCitation?: (snippet: string, citeKey: string, entry?: BibEntry) => void;
  defaultStyle?: CitationStyle;
  projectId?: string;
  initialQuery?: string;
  initialKey?: string;
  citedKeys?: string[];
  targetBibFile?: string;
}

export function CitationModal({
  open,
  onOpenChange,
  items: propsItems,
  onSelectCitation,
  defaultStyle = 'latex-cite',
  projectId: propsProjectId,
  initialQuery = '',
  initialKey = '',
  citedKeys: propsCitedKeys,
  targetBibFile,
}: CitationModalProps) {
  const state = useCitationPickerState({
    open,
    onOpenChange,
    items: propsItems,
    onSelectCitation,
    defaultStyle,
    projectId: propsProjectId,
    initialQuery,
    initialKey,
    citedKeys: propsCitedKeys,
    targetBibFile,
  });

  const handleNoopSelectItem = useCallback(() => {}, []);

  const selectionCount = state.selectedEntries.length;
  const isAddDisabled =
    selectionCount === 0 || state.isAddingToBib || !state.effectiveProjectId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="w-[96vw] sm:max-w-[1200px] h-[720px] max-h-[90vh] p-0 gap-0 overflow-hidden rounded-lg border border-border bg-background flex flex-col"
      >
        <div className="px-5 pt-4 pb-3 border-b border-border flex items-center justify-between shrink-0 bg-background">
          <DialogTitle className="text-sm font-semibold text-foreground tracking-tight">
            Add from Library
          </DialogTitle>

          <DialogClose asChild>
            <button
              type="button"
              className="size-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-border relative after:absolute after:-inset-1.5 after:content-['']"
              aria-label="Close"
            >
              <X className="size-4" />
            </button>
          </DialogClose>
        </div>

        <div className="flex-1 min-h-0 flex overflow-hidden bg-background">
          <CitationSidebar
            selectedNav={state.selectedNav}
            onSelectNav={state.setSelectedNav}
            libraryCount={state.navCounts.library}
            byCollectionCounts={state.navCounts}
            collections={state.collectionTree}
            canSyncCollection={Boolean(state.effectiveProjectId)}
            isSyncingCollection={state.isSyncingCollection}
            onSyncCollection={(collectionId) => {
              void state.handleSyncCollection(collectionId);
            }}
          />

          <div className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden bg-background">
            <CitationPickerListPane
              search={state.search}
              onSearchChange={state.setSearch}
              onKeyDown={state.handleKeyDown}
              searchInputRef={state.searchInputRef}
              listRef={state.listRef}
              isIdentifier={state.isIdentifier}
              effectiveProjectId={state.effectiveProjectId}
              isResolving={state.isResolving}
              onResolveIdentifier={state.handleResolveIdentifier}
              isSearchingServer={state.isSearchingServer}
              filteredItems={state.filteredItems}
              selectedKey={state.selectedKey}
              selectedKeys={state.selectedKeys}
              onToggleSelectKey={state.toggleSelectKey}
              sortBy={state.sortBy}
              onSortChange={state.setSortBy}
              selectedEntry={state.selectedEntry}
              citedKeysSet={state.citedKeysSet}
              isLargeCardsList={state.isLargeCardsList}
              cardsVirtualizer={state.cardsVirtualizer}
              onSelectCard={state.handleSelectCard}
              onSelectItem={handleNoopSelectItem}
            />
          </div>

          <CitationDetailPane entry={state.selectedEntry} />
        </div>

        <div className="px-5 py-3 border-t border-border flex items-center justify-end gap-2 shrink-0 bg-background">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-8 px-3 text-xs cursor-pointer rounded-md border-border bg-background hover:bg-muted text-foreground"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="default"
            size="sm"
            disabled={isAddDisabled}
            onClick={state.handleAddToBib}
            className="h-8 px-4 text-xs font-medium rounded-md bg-primary hover:bg-primary-hover text-primary-foreground cursor-pointer disabled:opacity-50"
          >
            <span>
              {state.isAddingToBib
                ? 'Adding...'
                : selectionCount > 1
                  ? `Add ${selectionCount} to .bib`
                  : 'Add to .bib'}
            </span>
          </Button>
        </div>
      </DialogContent>

      {state.pendingRetracted && (
        <CitationRetractionAlertDialog
          pendingRetracted={state.pendingRetracted}
          onDismiss={() => state.setPendingRetracted(null)}
          onConfirmCiteAnyway={(entry) => {
            if (onSelectCitation) {
              state.insertCitation(entry);
            } else {
              void state.commitAddEntriesToBib(
                state.selectedEntries.length > 0 ? state.selectedEntries : [entry],
              );
            }
          }}
        />
      )}
    </Dialog>
  );
}

export default CitationModal;
