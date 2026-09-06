'use client';

import React, { useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowDown, ArrowUp, ArrowUpDown, BookOpen, Search, Download, Plus, Library, MoreVertical, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/shared/components/ui/button';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { Checkbox } from '@/shared/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { useProject } from '@/features/workspaces/projects/shell/hooks/use-project';
import { useCatalogItems as usePapers } from '@/features/workspaces/library/hooks/use-items';
import { useCollections } from '@/features/workspaces/library/hooks/use-library';
import Panel from '@/features/workspaces/library/components/Panel';
import UploadModal from '@/features/workspaces/library/components/modals/UploadModal';
import CreateCollectionModal from '@/features/workspaces/library/components/modals/CreateCollectionModal';
import { convertToBibTeX, filterPapers, formatCreatorCompact } from '@/features/workspaces/library/utils/library.util';
import { useItemTable } from '@/features/workspaces/library/hooks/use-items';
import type { Paper } from '@/features/workspaces/library/types/library.types';

export default function CollectionPage() {
  const params = useParams<{ workspaceId: string; projectId: string }>();
  const workspaceUrl = params?.workspaceId || '';
  const projectId = params?.projectId || '';
  const router = useRouter();

  const projectQuery = useProject(projectId);
  const project = projectQuery.state.project;
  const paperService = usePapers({ workspaceId: workspaceUrl });
  const collectionService = useCollections(workspaceUrl);

  const [search, setSearch] = useState('');
  const [selectedPaperId, setSelectedPaperId] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadMode, setUploadMode] = useState<'file' | 'folder' | 'link'>('file');
  const [createColOpen, setCreateColOpen] = useState(false);

  const allPapers = useMemo(
    () => paperService.state.allPapers ?? [],
    [paperService.state.allPapers],
  );
  const collections = useMemo(
    () => collectionService.state.collections ?? [],
    [collectionService.state.collections],
  );
  const isLoading = paperService.state.isLoadingAll || projectQuery.isLoading;

  // Filter papers for search query
  const filteredPapers = useMemo(() => {
    return filterPapers(allPapers, search, null, null);
  }, [allPapers, search]);

  const selectedPaper = useMemo(() => {
    if (!selectedPaperId) return null;
    return allPapers.find((p: Paper) => p.id === selectedPaperId) ?? null;
  }, [allPapers, selectedPaperId]);

  const handleSelectPaper = (paper: Paper) => {
    setSelectedPaperId((prev) => (prev === paper.id ? null : paper.id || null));
  };

  const handleDeletePaper = (paperId: string) => {
    paperService.actions.deletePaper({ paperId });
    if (selectedPaperId === paperId) setSelectedPaperId(null);
  };

  const handleBatchDeletePapers = (paperIds: string[]) => {
    for (const paperId of paperIds) {
      paperService.actions.deletePaper({ paperId });
    }
    if (selectedPaperId && paperIds.includes(selectedPaperId)) {
      setSelectedPaperId(null);
    }
  };

  const handleBatchMovePapers = (paperIds: string[], targetCollectionId: string | null) => {
    for (const paperId of paperIds) {
      paperService.actions.updatePaper({ paperId, collectionId: targetCollectionId ?? undefined });
    }
  };

  const handleExportBibtex = () => {
    if (allPapers.length === 0) {
      toast.error('No references to export');
      return;
    }
    const bibtex = allPapers.map((p: Paper) => convertToBibTeX(p)).join('\n\n');
    const blob = new Blob([bibtex], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `project-${project?.name ? project.name.toLowerCase().replace(/\s+/g, '-') : 'collection'}.bib`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Exported project references to .bib file');
  };

  const handleOpenUpload = (mode: 'file' | 'folder' | 'link' = 'file') => {
    setUploadMode(mode);
    setUploadOpen(true);
  };

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-background">
      {/* Top Header */}
      <header className="flex items-center justify-between border-b border-border/50 bg-background px-6 h-14 shrink-0 select-none">
        <div className="flex items-center gap-2.5 min-w-0">
          <BookOpen className="size-4.5 text-foreground shrink-0" />
          <h1 className="text-base font-semibold tracking-tight text-foreground truncate">
            {project?.name ? `${project.name} Collection` : 'Project Collection'}
          </h1>
          <span className="text-xs font-mono text-muted-foreground px-2 py-0.5 rounded-full bg-muted/60">
            {filteredPapers.length} {filteredPapers.length === 1 ? 'item' : 'items'}
          </span>
        </div>

        {/* Search & Action Buttons */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Search */}
          <div className="relative flex items-center w-48 sm:w-56 h-8 rounded-md border border-border/50 bg-background/60 hover:bg-background focus-within:bg-background focus-within:border-primary/50 transition-colors">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
            <input
              placeholder="Search papers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-full text-xs py-0 bg-transparent focus:outline-none border-none shadow-none w-full placeholder:text-muted-foreground/60 pl-8 pr-7"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 text-muted-foreground hover:text-foreground cursor-pointer"
                aria-label="Clear search"
              >
                <Plus className="size-3.5 rotate-45" />
              </button>
            )}
          </div>

          {/* Export BibTeX */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportBibtex}
            className="h-8 gap-1.5 text-xs text-foreground hover:bg-muted cursor-pointer"
            title="Download .bib file for this project"
          >
            <Download className="size-3.5 text-foreground" />
            <span className="hidden sm:inline">Export .bib</span>
          </Button>

          {/* Add Reference Button */}
          <Button
            size="sm"
            onClick={() => handleOpenUpload('file')}
            className="h-8 gap-1.5 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer shadow-xs"
          >
            <Plus className="size-3.5" />
            <span>Add Paper</span>
          </Button>
        </div>
      </header>

      {/* Main Table + Inspector Panel */}
      <div className="flex-1 flex overflow-hidden min-h-0 relative">
        <main className="flex-1 overflow-auto p-4 sm:p-6 min-w-0">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-9 w-full rounded-md" />
              <Skeleton className="h-9 w-full rounded-md" />
              <Skeleton className="h-9 w-full rounded-md" />
            </div>
          ) : filteredPapers.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[300px] text-center border border-dashed border-border/60 rounded-xl p-8 bg-muted/10">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-3">
                <BookOpen className="size-6" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">No papers in this collection</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                Add references or academic papers to this project to organize them in this collection.
              </p>
              <div className="mt-4 flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => handleOpenUpload('file')}
                  className="h-8 text-xs gap-1.5 cursor-pointer"
                >
                  <Plus className="size-3.5" />
                  Add Paper
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/${workspaceUrl}/library`)}
                  className="h-8 text-xs gap-1.5 cursor-pointer"
                >
                  <Library className="size-3.5" />
                  Open Workspace Library
                </Button>
              </div>
            </div>
          ) : (
            <CollectionTable
              items={filteredPapers}
              collections={collections}
              selectedItemId={selectedPaperId}
              onSelectItem={handleSelectPaper}
              onDeleteItem={handleDeletePaper}
              onBatchDeleteItems={handleBatchDeletePapers}
              onBatchMoveItems={handleBatchMovePapers}
              onOpenItem={(itemId) => router.push(`/${workspaceUrl}/library/papers/${itemId}`)}
            />
          )}
        </main>

        {/* Metadata Inspector Right Panel */}
        {selectedPaper && (
          <Panel
            paper={selectedPaper}
            workspaceId={workspaceUrl}
            onClose={() => setSelectedPaperId(null)}
          />
        )}
      </div>

      {/* Upload Modal (DOI, File, Link) */}
      {workspaceUrl && (
        <UploadModal
          open={uploadOpen}
          onOpenChange={setUploadOpen}
          onSubmit={async (data) => {
            await paperService.actions.addPaper(data);
            setUploadOpen(false);
          }}
          isPending={paperService.state.isAdding}
          workspaceId={workspaceUrl}
          initialMode={uploadMode}
        />
      )}

      {/* Create Collection Modal */}
      <CreateCollectionModal
        open={createColOpen}
        onOpenChange={setCreateColOpen}
        collections={collections}
        onSubmit={async (data) => {
          await collectionService.actions.createAsync(data);
          setCreateColOpen(false);
        }}
        isPending={collectionService.state.isCreating}
      />
    </div>
  );
}

interface CollectionTableProps {
  items: Paper[];
  collections: { id: string; name: string }[];
  selectedItemId: string | null;
  onSelectItem: (item: Paper) => void;
  onDeleteItem: (itemId: string) => void;
  onBatchDeleteItems: (itemIds: string[]) => void;
  onBatchMoveItems: (itemIds: string[], collectionId: string | null) => void;
  onOpenItem: (itemId: string) => void;
}

function CollectionTable({ items, collections, selectedItemId, onSelectItem, onDeleteItem, onBatchDeleteItems, onBatchMoveItems, onOpenItem }: CollectionTableProps) {
  const { sortedItems, sortField, sortOrder, handleSort, selectedIds, isAllSelected, isPartiallySelected, toggleSelectAll, toggleSelect, clearSelection } = useItemTable({ items, initialSortField: 'createdAt', initialSortOrder: 'desc' });
  const selectedItemIds = Array.from(selectedIds);
  const [hasUserSorted, setHasUserSorted] = useState(false);

  const onColumnSort = (field: 'title' | 'authors') => {
    setHasUserSorted(true);
    handleSort(field);
  };

  return (
    <div className="overflow-hidden rounded-md border border-border/60 bg-background">
      <div className="max-h-full overflow-auto">
        <table className="w-full table-fixed border-collapse text-left type-dense">
          <colgroup>
            <col className="w-10" />
            <col className="w-6/12" />
            <col className="w-6/12" />
            <col className="w-10" />
          </colgroup>
          <thead className="sticky top-0 z-10 bg-background">
            <tr className="h-9 border-b border-border/60 type-dense font-normal text-foreground [&_th]:font-normal [&_th]:text-foreground">
              <th className="w-10 px-2.5 text-center">
                <Checkbox
                  checked={isAllSelected ? true : isPartiallySelected ? 'indeterminate' : false}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Select all collection items"
                />
              </th>
              {(['title', 'authors'] as const).map((field) => (
                <th key={field} className="group/th px-3.5 py-2 font-normal text-foreground">
                  <button
                    type="button"
                    onClick={() => onColumnSort(field)}
                    className="inline-flex items-center rounded-sm text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
                  >
                    <span>{field === 'title' ? 'Title' : 'Creator'}</span>
                    {hasUserSorted && sortField === field && (
                      <span className="shrink-0 ml-1.5 inline-flex items-center text-foreground">
                        {sortOrder === 'desc' ? (
                          <ArrowDown className="size-3.5 text-foreground" />
                        ) : (
                          <ArrowUp className="size-3.5 text-foreground" />
                        )}
                      </span>
                    )}
                  </button>
                </th>
              ))}
              <th className="w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {sortedItems.map((item) => (
              <tr
                key={item.id}
                onClick={() => onSelectItem(item)}
                onDoubleClick={() => onOpenItem(item.id)}
                className={item.id === selectedItemId ? 'h-9 bg-muted/60 cursor-pointer' : 'h-9 hover:bg-muted/40 cursor-pointer'}
              >
                <td className="w-10 px-2.5 py-1.5 text-center align-middle" onClick={(event) => event.stopPropagation()}>
                  <Checkbox
                    checked={selectedIds.has(item.id)}
                    onCheckedChange={() => toggleSelect(item.id)}
                    aria-label={`Select ${item.title || 'item'}`}
                  />
                </td>
                <td className="max-w-0 px-3.5 py-1.5 align-middle text-foreground">
                  <span className="block truncate type-dense font-normal text-foreground">
                    {item.title || 'Untitled item'}
                  </span>
                </td>
                <td className="w-72 px-3.5 py-1.5 align-middle text-foreground">
                  <span className="block truncate type-dense font-normal text-foreground">
                    {formatCreatorCompact(item.authors)}
                  </span>
                </td>
                <td className="w-10 px-2 py-1.5 align-middle text-right" onClick={(event) => event.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button type="button" aria-label="Collection item actions" className="flex size-7 items-center justify-center rounded-md text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer">
                        <MoreVertical className="size-4 text-foreground" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="text-xs">
                      <DropdownMenuItem onClick={() => onOpenItem(item.id)} className="text-foreground focus:bg-muted cursor-pointer">
                        Open in reader
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onDeleteItem(item.id)} className="text-foreground focus:bg-muted cursor-pointer">
                        <Trash2 className="size-3.5 text-foreground" /> Move to trash
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selectedItemIds.length > 0 && (
        <div className="flex items-center justify-between border-t border-border/60 px-3 py-2 text-xs">
          <span className="text-foreground font-medium">{selectedItemIds.length} selected</span>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="rounded-md px-2 py-1 text-foreground hover:bg-muted border border-border text-xs cursor-pointer">
                  Move to
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="text-xs">
                <DropdownMenuItem onClick={() => onBatchMoveItems(selectedItemIds, null)} className="text-foreground focus:bg-muted cursor-pointer">
                  My Library
                </DropdownMenuItem>
                {collections.map((collection) => (
                  <DropdownMenuItem key={collection.id} onClick={() => onBatchMoveItems(selectedItemIds, collection.id)} className="text-foreground focus:bg-muted cursor-pointer">
                    {collection.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <button type="button" onClick={() => onBatchDeleteItems(selectedItemIds)} className="rounded-md px-2 py-1 text-foreground hover:bg-muted border border-border text-xs cursor-pointer">
              Move to trash
            </button>
            <button type="button" onClick={clearSelection} className="rounded-md px-2 py-1 text-foreground hover:bg-muted text-xs cursor-pointer">
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
