'use client';

/**
 * CitationTab.tsx
 *
 * Canonical BibTeX & Workspace Reference Viewlet (Block 6: UI Features Layer).
 * Location: `features/editor/ui/features/sidebar/citation/CitationTab.tsx`
 */

import React from 'react';
import { Search as SearchIcon, Plus, X } from 'lucide-react';
import { Input } from '@/shared/components/ui/input';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/shared/components/ui/tooltip';
import { PlaneEmptyState, PlaneErrorState } from '@/shared/components/ui';
import { useCitationTabState } from './hooks/useCitationTabState';
import { CitationItem } from './subcomponents/CitationItem';
import { VirtualizedCitationList } from './subcomponents/VirtualizedCitationList';
import { CitationValidationBanner } from './subcomponents/CitationValidationBanner';
import { UnresolvedKeysList } from './subcomponents/UnresolvedKeysList';
import { CitationBottomNav } from './subcomponents/CitationBottomNav';
import { SidebarPanelHeader } from '../SidebarPanelHeader';

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
    filteredCitedEntries,
    filteredAvailableEntries,
    isLibraryLoading,
    isLibraryError,
    handleCopyKey,
    handleInsertKey,
    openPickerModal,
  } = useCitationTabState();

  return (
    <div className="h-full flex flex-col bg-background text-foreground select-none">
      {/* ── Header Toolbar (h-9) ── */}
      <SidebarPanelHeader
        title="Citations"
        onClose={onClose}
        closeAriaLabel="Close citations panel"
      >
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => openPickerModal()}
              className="size-7 flex items-center justify-center rounded-md text-foreground hover:bg-muted transition-colors motion-reduce:transition-none cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
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

      {/* ── Search Bar ── */}
      <div className="p-2 border-b border-border shrink-0 bg-background">
        <div className="relative">
          <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none shrink-0" />
          <Input
            type="text"
            placeholder="Search citations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-8 pr-7 text-xs bg-background border border-border rounded-md placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary w-full transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 size-4 flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer"
              aria-label="Clear search"
            >
              <X className="size-3" />
            </button>
          )}
        </div>
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
