'use client';

/**
 * CitationModal.tsx
 *
 * Canonical Academic Reference & Citation Modal for the Flux Editor.
 * Location: `features/editor/subsystems/citation/ui/modals/CitationModal.tsx`
 */

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogClose,
} from '@/shared/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/shared/components/ui/dropdown-menu';
import { Button } from '@/shared/components/ui/button';
import { X, Check, ChevronDown } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import type { BibEntry } from '@/features/editor/domain/latex/bib-parser';
import { CitationCollectionTreePane } from '../subcomponents/CitationCollectionTreePane';
import { CitationInspectorPane } from '../subcomponents/CitationInspectorPane';
import { CitationRetractionAlertDialog } from '../subcomponents/CitationRetractionAlertDialog';
import {
  CitationSpecs,
  useCitationPickerState,
  type CitationStyle,
  type CitationPredicate,
} from './useCitationPickerState';
import { CitationPickerListPane } from './CitationPickerListPane';

export { CitationSpecs, type CitationStyle, type CitationPredicate };

export const STYLE_OPTIONS: { id: CitationStyle; label: string; preview: string }[] = [
  { id: 'latex-cite', label: '\\cite', preview: '\\cite{key}' },
  { id: 'latex-citep', label: '\\citep', preview: '\\citep{key}' },
  { id: 'latex-citet', label: '\\citet', preview: '\\citet{key}' },
  { id: 'latex-autocite', label: '\\autocite', preview: '\\autocite{key}' },
  { id: 'markdown-bracket', label: 'Pandoc', preview: '[@key]' },
];

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
}

export type CitationPickerModalProps = CitationModalProps;

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
}: CitationModalProps) {
  const s = useCitationPickerState({
    open,
    onOpenChange,
    items: propsItems,
    onSelectCitation,
    defaultStyle,
    projectId: propsProjectId,
    initialQuery,
    initialKey,
    citedKeys: propsCitedKeys,
  });

  const selectedOption =
    STYLE_OPTIONS.find((opt) => opt.id === s.selectedStyle) || STYLE_OPTIONS[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="w-[94vw] sm:max-w-5xl md:max-w-6xl h-[660px] max-h-[88vh] min-h-0 sm:min-h-[520px] p-0 gap-0 overflow-hidden rounded-md border border-border shadow-raised-500 bg-background flex flex-col"
      >
        {/* Header with clear dividing line */}
        <div className="h-12 px-4 sm:px-6 flex items-center justify-between shrink-0 bg-background border-b border-border">
          <div className="flex items-center gap-3">
            <DialogTitle className="text-14 font-semibold text-foreground tracking-tight">
              Citations
            </DialogTitle>

            <div className="flex md:hidden items-center bg-muted/60 p-0.5 rounded-md border border-border/60 select-none">
              <button
                type="button"
                onClick={() => s.setActiveView('tree')}
                className={cn(
                  'px-2.5 py-1 text-11 rounded-md transition-colors font-medium cursor-pointer',
                  s.activeView === 'tree'
                    ? 'bg-background text-foreground font-semibold border border-border/60'
                    : 'text-muted-foreground hover:text-foreground border border-transparent',
                )}
              >
                Library
              </button>
              <button
                type="button"
                onClick={() => s.setActiveView('list')}
                className={cn(
                  'px-2.5 py-1 text-11 rounded-md transition-colors font-medium cursor-pointer',
                  s.activeView === 'list'
                    ? 'bg-background text-foreground font-semibold border border-border/60'
                    : 'text-muted-foreground hover:text-foreground border border-transparent',
                )}
              >
                Papers ({s.filteredItems.length})
              </button>
              <button
                type="button"
                onClick={() => s.setActiveView('detail')}
                disabled={!s.selectedEntry}
                className={cn(
                  'px-2.5 py-1 text-11 rounded-md transition-colors font-medium cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed',
                  s.activeView === 'detail'
                    ? 'bg-background text-foreground font-semibold border border-border/60'
                    : 'text-muted-foreground hover:text-foreground border border-transparent',
                )}
              >
                Details
              </button>
            </div>
          </div>

          <DialogClose asChild>
            <button
              type="button"
              className="size-7 flex items-center justify-center rounded-md text-foreground hover:bg-muted transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-border relative after:absolute after:-inset-1.5 after:content-['']"
              aria-label="Close"
            >
              <X className="size-4" />
            </button>
          </DialogClose>
        </div>

        {/* 3-Column Cockpit Body */}
        <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden bg-background">
          <CitationCollectionTreePane
            activeView={s.activeView}
            selectedNav={s.selectedNav}
            navCounts={s.navCounts}
            collectionTree={s.collectionTree}
            onSelectNav={(navId) => {
              s.setSelectedNav(navId);
              s.setActiveView('list');
            }}
          />

          <CitationPickerListPane
            activeView={s.activeView}
            search={s.search}
            onSearchChange={s.setSearch}
            onKeyDown={s.handleKeyDown}
            searchInputRef={s.searchInputRef}
            listRef={s.listRef}
            isIdentifier={s.isIdentifier}
            effectiveProjectId={s.effectiveProjectId}
            isResolving={s.isResolving}
            onResolveIdentifier={s.handleResolveIdentifier}
            isSearchingServer={s.isSearchingServer}
            filteredItems={s.filteredItems}
            selectedKey={s.selectedKey}
            selectedEntry={s.selectedEntry}
            citedKeysSet={s.citedKeysSet}
            isLargeCardsList={s.isLargeCardsList}
            cardsVirtualizer={s.cardsVirtualizer}
            onSelectCard={s.handleSelectCard}
            onSelectItem={s.handleSelectItem}
          />

          <CitationInspectorPane
            activeView={s.activeView}
            selectedEntry={s.selectedEntry}
            selectedStyle={s.selectedStyle}
            citedKeysSet={s.citedKeysSet}
            onSelectStyle={s.setSelectedStyle}
            onBackToList={() => s.setActiveView('list')}
            onCloseModal={() => onOpenChange(false)}
            copyCitationSnippet={s.copyCitationSnippet}
            copyBibtex={s.copyBibtex}
            copyKey={s.copyKey}
            copyDoi={s.copyDoi}
          />
        </div>

        {/* Footer with clear dividing line and intuitive format + insert flow */}
        <div className="h-13 px-6 flex items-center justify-between shrink-0 bg-background border-t border-border">
          {/* Format selector placed in natural footer workflow */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-medium select-none">
              Format:
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="h-8 px-2.5 text-xs font-mono rounded-md border border-border bg-background hover:bg-muted text-foreground flex items-center gap-1.5 transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-border"
                >
                  <span>{selectedOption.label}</span>
                  <ChevronDown className="size-3 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48 p-1">
                {STYLE_OPTIONS.map((opt) => (
                  <DropdownMenuItem
                    key={opt.id}
                    onClick={() => s.setSelectedStyle(opt.id)}
                    className={cn(
                      'flex items-center justify-between px-2.5 py-1.5 text-xs font-mono rounded-md cursor-pointer text-foreground',
                      s.selectedStyle === opt.id && 'bg-muted font-medium text-foreground',
                    )}
                  >
                    <span>{opt.label}</span>
                    <span className="text-10 text-muted-foreground font-sans">
                      {opt.preview}
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
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
              disabled={!s.selectedEntry}
              onClick={() => s.selectedEntry && s.handleSelectItem(s.selectedEntry)}
              className="h-8 px-4 text-xs font-medium rounded-md bg-primary hover:bg-primary-hover text-primary-foreground cursor-pointer disabled:opacity-50"
            >
              <Check className="size-3.5" />
              <span>Insert Citation</span>
            </Button>
          </div>
        </div>
      </DialogContent>

      <CitationRetractionAlertDialog
        pendingRetracted={s.pendingRetracted}
        onDismiss={() => s.setPendingRetracted(null)}
        onConfirmCiteAnyway={(entry) => s.insertCitation(entry)}
      />
    </Dialog>
  );
}

export const CitationPickerModal = CitationModal;
export default CitationModal;
