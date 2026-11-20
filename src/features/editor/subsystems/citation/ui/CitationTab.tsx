'use client';

/**
 * CitationTab.tsx
 *
 * Canonical BibTeX & Workspace Reference Viewlet (Block 6: UI Features Layer).
 * Location: `features/editor/subsystems/citation/ui/CitationTab.tsx`
 */

import React, { useCallback, useRef, useState } from 'react';
import { Search as SearchIcon, Plus, X } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/shared/components/ui/tooltip';
import { PlaneEmptyState } from '@/shared/components/ui/PlaneEmptyState';
import { PlaneErrorState } from '@/shared/components/ui/PlaneErrorState';
import { useCitationTabState } from './hooks/useCitationTabState';
import { VirtualizedCitationList } from './subcomponents/VirtualizedCitationList';
import { CitationValidationBanner } from './subcomponents/CitationValidationBanner';
import { UnresolvedKeysList } from './subcomponents/UnresolvedKeysList';
import { CitationBottomNav } from './subcomponents/CitationBottomNav';
import { BibliographyInjectorCard } from './subcomponents/BibliographyInjectorCard';
import { SidebarPanelHeader } from '@/features/editor/core';

interface CitationTabProps {
  onClose?: () => void;
}

export default function CitationTab({ onClose }: CitationTabProps) {
  const {
    searchQuery,
    setSearchQuery,
    filterTab,
    setFilterTab,
    copiedKey,
    citationValidation,
    missingKeys,
    citedEntries,
    citedItems,
    filteredCitedEntries,
    filteredAvailableEntries,
    isLibraryLoading,
    isLibraryError,
    handleCopyKey,
    handleInsertKey,
    openPickerModal,
    projectId,
    activeFilePath,
    engine,
    getContent,
    refreshContent,
  } = useCitationTabState();

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const handleOpenSearch = useCallback(() => {
    setIsSearchOpen(true);
    requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });
  }, []);

  const handleCloseSearch = useCallback(() => {
    setSearchQuery('');
    setIsSearchOpen(false);
  }, [setSearchQuery]);

  return (
    <div className="h-full flex flex-col bg-background text-foreground select-none">
      {/* ── Header Toolbar (h-9 sticky) ── */}
      <div className="relative h-9 shrink-0">
        <SidebarPanelHeader
          title="Citations"
          onClose={onClose}
          closeAriaLabel="Close citations panel"
        >
          <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={handleOpenSearch}
                className="size-7 flex items-center justify-center rounded-md text-foreground hover:bg-muted transition-colors motion-reduce:transition-none cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-border"
                aria-label="Search citations"
              >
                <SearchIcon className="size-3.5 shrink-0 text-foreground" strokeWidth={1.5} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-11">
              Search citations
            </TooltipContent>
          </Tooltip>

          <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => openPickerModal()}
                className="size-7 flex items-center justify-center rounded-md text-foreground hover:bg-muted transition-colors motion-reduce:transition-none cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-border"
                aria-label="Insert citation"
              >
                <Plus className="size-3.5 shrink-0 text-foreground" strokeWidth={1.5} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-11">
              Insert citation
            </TooltipContent>
          </Tooltip>
        </SidebarPanelHeader>

        {/* ── Search Overlay (Bung ra kiểu sticky che thông tin header) ── */}
        {isSearchOpen && (
          <div className="absolute inset-0 bg-background flex items-center px-2 z-10 animate-in fade-in duration-100">
            <div className="w-full flex items-center h-7 px-2 rounded-md bg-muted/50 text-foreground">
              <SearchIcon className="size-3.5 text-muted-foreground shrink-0 mr-1.5 pointer-events-none" strokeWidth={1.5} />
              <input
                ref={searchInputRef}
                type="text"
                autoFocus
                placeholder="Search citations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    handleCloseSearch();
                  }
                }}
                className="flex-1 min-w-0 bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none border-0 focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:outline-none shadow-none"
              />
              <Tooltip delayDuration={300}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={handleCloseSearch}
                    className="size-5 shrink-0 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-border ml-1"
                    aria-label="Close search"
                  >
                    <X className="size-3.5 shrink-0" strokeWidth={1.5} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-11">
                  Close search
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        )}
      </div>

      {/* ── Content List ── */}
      <div className="flex-1 min-h-0 overflow-y-auto p-2 pb-4 space-y-1 bg-background sidebar-scrollbar">
        {filterTab === 'document' ? (
          <>
            {/* Authoritative Bibliography Validation Warnings */}
            <CitationValidationBanner
              validation={citationValidation}
              onSelectKey={(k) => setSearchQuery(k)}
            />

            {/* Missing/Unresolved Keys */}
            <UnresolvedKeysList
              missingKeys={missingKeys}
              copiedKey={copiedKey}
              onFind={(k) => openPickerModal(k, k)}
              onCopy={handleCopyKey}
            />

            {/* One-Click Bibliography Injector Card */}
            {citedEntries.length > 0 && (
              <BibliographyInjectorCard
                citedCount={citedEntries.length}
                citedItems={citedItems}
                projectId={projectId}
                engine={engine}
                getContent={getContent}
                refreshContent={refreshContent}
                activeFilePath={activeFilePath}
              />
            )}

            {/* Resolved Cited Items */}
            {filteredCitedEntries.length === 0 && missingKeys.length === 0 ? (
              searchQuery ? (
                <div className="py-6 px-2">
                  <PlaneEmptyState
                    variant="search"
                    isCompact
                    title="No citations found"
                    description={`No citations matching "${searchQuery}"`}
                  />
                </div>
              ) : (
                <div className="py-6 px-2">
                  <PlaneEmptyState
                    variant="citations"
                    isCompact
                    title="No citations in document"
                    description="Citations added with \\cite{...} will appear here."
                    action={
                      <button
                        type="button"
                        onClick={() => openPickerModal()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-12 font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer"
                      >
                        <Plus className="size-3.5" />
                        <span>Insert Citation</span>
                      </button>
                    }
                  />
                </div>
              )
            ) : (
              <VirtualizedCitationList
                items={filteredCitedEntries}
                copiedKey={copiedKey}
                onSelect={handleInsertKey}
                onCopy={handleCopyKey}
                onInspect={(k) => openPickerModal(k, k)}
              />
            )}
          </>
        ) : (
          /* Workspace Library Tab */
          <>
            {isLibraryLoading ? (
              <div className="py-10 text-center text-12 text-muted-foreground">
                Loading workspace references...
              </div>
            ) : isLibraryError ? (
              <div className="py-6 px-2">
                <PlaneErrorState
                  title="Unable to load citations"
                  description="An issue occurred while loading references from your library."
                  error={new Error('Failed to load workspace references')}
                />
              </div>
            ) : filteredAvailableEntries.length === 0 ? (
              searchQuery ? (
                <div className="py-6 px-2">
                  <PlaneEmptyState
                    variant="search"
                    isCompact
                    title="No citations found"
                    description={`No citations matching "${searchQuery}"`}
                  />
                </div>
              ) : (
                <div className="py-6 px-2">
                  <PlaneEmptyState
                    variant="citations"
                    isCompact
                    title="Workspace library is empty"
                    description="Add papers to your workspace library or create a .bib file in this project."
                    action={
                      <button
                        type="button"
                        onClick={() => openPickerModal()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-12 font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer"
                      >
                        <Plus className="size-3.5" />
                        <span>Search References</span>
                      </button>
                    }
                  />
                </div>
              )
            ) : (
              <VirtualizedCitationList
                items={filteredAvailableEntries}
                copiedKey={copiedKey}
                onSelect={handleInsertKey}
                onCopy={handleCopyKey}
                onInspect={(k) => openPickerModal(k, k)}
              />
            )}
          </>
        )}
      </div>

      {/* ── Bottom Navigation Tabs: In Document vs Library ── */}
      <CitationBottomNav
        filterTab={filterTab}
        onFilterTabChange={setFilterTab}
      />
    </div>
  );
}
