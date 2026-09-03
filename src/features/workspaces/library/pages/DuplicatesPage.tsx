'use client';

import React, { useMemo } from 'react';
import { Files } from 'lucide-react';
import Topbar from '../components/Topbar';
import ItemTable from '../components/Table';
import InspectorPanel from '../components/Panel';
import AddLinkModal from '../components/modals/AddLinkModal';
import CreateCollectionModal from '../components/modals/CreateCollectionModal';
import MergeDialog from '../components/modals/MergeDialog';
import { Button } from '@/shared/components/ui/button';
import { useLibrary, useDuplicateGroups, useMergePapers } from '../hooks/library/use-library';
import type { CatalogItem } from '../types/library.types';

export default function DuplicatesPage() {
  const { state, actions } = useLibrary();
  const {
    workspaceId,
    search,
    selectedItemId,
    selectedItem,
    selectedCollection,
    collectionMap,
    collections,
    addLinkOpen,
    createCollectionOpen,
    isAddingItem,
    isCreatingCollection,
  } = state;

  const {
    setSearch,
    setSelectedItemId,
    setAddLinkOpen,
    handleDirectFilesUpload,
    handleDirectFolderUpload,
    handleAddLinkSubmit,
    setCreateCollectionOpen,
    handleCreateCollection,
    handleDeleteItem,
    handleBatchDeleteItems,
    handleBatchMoveItems,
  } = actions;

  const { data: duplicateData, isLoading: isDupLoading } = useDuplicateGroups(workspaceId);
  const mergeMutation = useMergePapers(workspaceId);

  const duplicateGroups = useMemo(
    () =>
      (duplicateData as any)?.duplicateGroups ||
      (duplicateData as any)?.groups ||
      [],
    [duplicateData],
  );

  const allDuplicateItems = useMemo(() => {
    const list: CatalogItem[] = [];
    const seen = new Set<string>();
    for (const group of duplicateGroups) {
      const groupItems = group.items || group.papers || [];
      for (const p of groupItems) {
        if (!seen.has(p.id)) {
          seen.add(p.id);
          list.push(p);
        }
      }
    }
    return list;
  }, [duplicateGroups]);

  const filteredItems = useMemo(() => {
    if (!search.trim()) return allDuplicateItems;
    const q = search.toLowerCase();
    return allDuplicateItems.filter(
      (p) =>
        p.title?.toLowerCase().includes(q) ||
        (Array.isArray(p.authors) && p.authors.some((a: any) => (typeof a === 'string' ? a : a.name || '').toLowerCase().includes(q))) ||
        (p.doi && p.doi.toLowerCase().includes(q)),
    );
  }, [allDuplicateItems, search]);

  const handleSelectItem = (item: CatalogItem) => {
    const itemId = item.id;
    if (selectedItemId === itemId) {
      setSelectedItemId(null);
    } else {
      setSelectedItemId(itemId);
    }
  };

  const [mergeCluster, setMergeCluster] = React.useState<CatalogItem[] | null>(null);
  const [mergeDialogOpen, setMergeDialogOpen] = React.useState(false);

  const handleOpenMergeDialog = (clusterItems: CatalogItem[]) => {
    if (!clusterItems || clusterItems.length < 2) return;
    setMergeCluster(clusterItems);
    setMergeDialogOpen(true);
  };

  const handleExecuteMerge = async (
    masterItem: CatalogItem,
    _mergedFields: Partial<CatalogItem>,
    duplicateIdsToDelete: string[],
  ) => {
    await mergeMutation.mutateAsync({
      masterPaperId: masterItem.id,
      sourcePaperIds: duplicateIdsToDelete,
    });
  };

  return (
    <div className="flex h-full min-w-0 flex-1 overflow-hidden">
      {/* Left Main Content Area */}
      <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden">
        <Topbar
          title="Duplicate Items"
          icon={Files}
          search={search}
          onSearchChange={setSearch}
          onDirectFilesUpload={handleDirectFilesUpload}
          onDirectFolderUpload={handleDirectFolderUpload}
          onAddCollection={() => setCreateCollectionOpen(true)}
          onAddLink={() => setAddLinkOpen(true)}
        />

        {/* Central Duplicate Table */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {duplicateGroups.length > 0 && !isDupLoading && (
            <div className="px-4 py-2 bg-muted/40 border-b border-border/50 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-medium text-foreground">
                  {duplicateGroups.length} duplicate {duplicateGroups.length === 1 ? 'cluster' : 'clusters'} detected
                </span>
                <span className="text-muted-foreground font-mono">({allDuplicateItems.length} items)</span>
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-0.5">
                {duplicateGroups.map((group: any, idx: number) => {
                  const items = group.items || group.papers || [];
                  if (items.length < 2) return null;
                  const matchLabel = group.matchType === 'DOI' ? 'DOI' : 'Title';
                  return (
                    <Button
                      key={group.key || idx}
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenMergeDialog(items)}
                      className="h-6.5 px-2 text-[11px] font-medium gap-1.5 cursor-pointer bg-background hover:bg-accent border-border/60 shadow-none"
                    >
                      <Files className="size-3 text-muted-foreground" />
                      <span>Review & Merge #{idx + 1} ({items.length} · {matchLabel})</span>
                    </Button>
                  );
                })}
              </div>
            </div>
          )}

          {duplicateGroups.length === 0 && !isDupLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
              <Files className="size-12 mb-3 opacity-20" />
              <p className="text-sm font-medium text-foreground">No duplicates detected</p>
              <p className="text-xs text-muted-foreground mt-1">
                No duplicate items found by DOI or Title/Author/Year.
              </p>
            </div>
          ) : (
            <ItemTable
              items={filteredItems}
              isLoading={isDupLoading}
              isSearch={Boolean(search.trim())}
              selectedItemId={selectedItemId}
              onSelectItem={handleSelectItem}
              onDeleteItem={handleDeleteItem}
              onBatchDeleteItems={handleBatchDeleteItems}
              onBatchMoveItems={handleBatchMoveItems}
              onClearSearch={() => setSearch('')}
              onAddItem={() => setAddLinkOpen(true)}
              collectionMap={collectionMap}
              collections={collections}
            />
          )}
        </div>
      </div>

      {/* Right Inspector Panel */}
      <InspectorPanel
        paper={selectedItem || null}
        item={selectedItem || null}
        collection={selectedCollection || null}
        workspaceId={workspaceId}
        onClose={() => setSelectedItemId(null)}
      />

      <AddLinkModal
        open={addLinkOpen}
        onOpenChange={setAddLinkOpen}
        onSubmit={handleAddLinkSubmit}
        isPending={isAddingItem}
      />

      <CreateCollectionModal
        open={createCollectionOpen}
        onOpenChange={setCreateCollectionOpen}
        onSubmit={handleCreateCollection}
        isPending={isCreatingCollection}
        collections={collections}
      />

      {mergeCluster && (
        <MergeDialog
          open={mergeDialogOpen}
          onOpenChange={setMergeDialogOpen}
          duplicates={mergeCluster}
          onMerge={handleExecuteMerge}
        />
      )}
    </div>
  );
}

