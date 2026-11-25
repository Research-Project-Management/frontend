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
import { Button } from '@/shared/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { X } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import type { BibEntry } from '@/features/editor/domain/latex/bib-parser';
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

const LATEX_COMMAND_OPTIONS = STYLE_OPTIONS.filter((opt) => opt.id.startsWith('latex-'));

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
  });

  const showSourceFilters = state.navCounts.bib > 0 && state.navCounts.library > 0;
  const filterPills: { id: string; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'cited', label: 'In document' },
    ...(showSourceFilters
      ? [
          { id: 'bib', label: 'Project .bib' },
          { id: 'library', label: 'Library' },
        ]
      : []),
  ];

  const selectionCount = state.selectedKeys.size;
  const isInsertDisabled = !state.selectedEntry && selectionCount === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="w-[94vw] sm:max-w-[560px] h-[540px] max-h-[84vh] p-0 gap-0 overflow-hidden rounded-lg border border-border bg-background flex flex-col"
      >
        <div className="px-5 pt-4 pb-2 flex items-center justify-between shrink-0 bg-background">
          <DialogTitle className="text-sm font-semibold text-foreground tracking-tight">
            Insert citation
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

        <div className="px-4 pb-2 flex items-center gap-1 shrink-0 bg-background">
          {filterPills.map((pill) => {
            const isActive = state.selectedNav === pill.id;
            return (
              <button
                key={pill.id}
                type="button"
                onClick={() => state.setSelectedNav(pill.id)}
                className={cn(
                  'px-2.5 py-1 text-11 rounded-md transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-border select-none',
                  isActive
                    ? 'bg-muted text-foreground font-medium'
                    : 'bg-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                {pill.label}
              </button>
            );
          })}
        </div>

        <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-background">
          <CitationPickerListPane
            activeView="list"
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
            onSelectItem={state.handleSelectItem}
          />
        </div>

        <div className="px-5 py-3 flex items-center justify-between gap-2 shrink-0 bg-background">
          <Select
            value={state.selectedStyle}
            onValueChange={(v) => state.setSelectedStyle(v as CitationStyle)}
          >
            <SelectTrigger
              size="sm"
              aria-label="Citation command"
              className="h-8 w-[132px] rounded-md border border-border bg-background px-2.5 text-xs font-mono text-foreground shadow-none focus-visible:ring-1 focus-visible:ring-border cursor-pointer"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent
              position="popper"
              align="start"
              sideOffset={4}
              className="min-w-[var(--radix-select-trigger-width)] font-mono text-xs"
            >
              {LATEX_COMMAND_OPTIONS.map((opt) => (
                <SelectItem
                  key={opt.id}
                  value={opt.id}
                  className="font-mono text-xs cursor-pointer"
                >
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

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
              disabled={isInsertDisabled}
              onClick={state.handleInsertSelected}
              className="h-8 px-4 text-xs font-medium rounded-md bg-primary hover:bg-primary-hover text-primary-foreground cursor-pointer disabled:opacity-50"
            >
              <span>
                {selectionCount > 1
                  ? `Insert ${selectionCount} citations`
                  : 'Insert citation'}
              </span>
            </Button>
          </div>
        </div>
      </DialogContent>

      <CitationRetractionAlertDialog
        pendingRetracted={state.pendingRetracted}
        onDismiss={() => state.setPendingRetracted(null)}
        onConfirmCiteAnyway={(entry) => state.insertCitation(entry)}
      />
    </Dialog>
  );
}

export default CitationModal;
