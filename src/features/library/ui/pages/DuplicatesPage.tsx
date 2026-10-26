'use client';

import React, { useState, useMemo, useCallback, useRef } from 'react';
import { Files } from 'lucide-react';
import { LibraryTopbar } from '@/features/library/ui/topbar/LibraryTopbar';
import { LibraryInspector } from '@/features/library/ui/inspector/LibraryInspector';
import { DuplicateMergeInspector } from '@/features/library/ui/inspector/DuplicateMergeInspector';
import { DuplicatesContent } from '@/features/library/ui/content/DuplicatesContent';
import { useMergeDuplicates } from '@/features/library/sdk/queries/ingestion.queries';
import { useLibraryUIStore } from '@/features/library/core/store/library-ui.store';
import { useLibraryPermissions } from '@/features/library/core/coordinator/permissions.coordinator';
import { LibraryModals } from '@/features/library/ui/modals/LibraryModals';
import { toast } from 'sonner';
import { useCreateLibraryItemMutation } from '@/features/library/sdk/queries/catalog.queries';
import { getItemTypeDefinition } from '@/features/library/domain/types/item-types.types';
import type { Item, DuplicateGroup } from '@/features/library/domain/types/library.types';

/**
 * DuplicatesPage - Streamlined duplicate curation page delegating list rendering to DuplicatesContent.
 */
export function DuplicatesPage() {
  const activeScope = useLibraryUIStore((s) => s.activeScope);
  const effectiveScopeId = activeScope.type === 'project' ? activeScope.id : 'user';
  const { canEditItem: canEdit } = useLibraryPermissions();
  const mergeMutation = useMergeDuplicates(effectiveScopeId);

  const openModal = useLibraryUIStore((s) => s.openModal);
  const { mutateAsync: createItem } = useCreateLibraryItemMutation(effectiveScopeId);

  const handleNewManualItem = useCallback(
    async (itemType: string) => {
      try {
        const typeDef = getItemTypeDefinition(itemType);
        const label = typeDef?.label || 'Item';
        const res = (await createItem({
          itemType,
          title: `Untitled ${label}`,
        })) as { id?: string; data?: { id?: string } } | undefined;
        toast.success(`Created new ${label.toLowerCase()}`);
        const createdId = res?.data?.id || res?.id;
        if (createdId) {
          useLibraryUIStore.getState().setActiveItem(createdId);
          useLibraryUIStore.getState().setIsInspectorOpen(true);
        }
      } catch (err: unknown) {
        toast.error('Failed to create manual item', {
          description: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    },
    [createItem],
  );

  const [selectedGroup, setSelectedGroup] = useState<DuplicateGroup | null>(null);
  const [selectedGroupKey, setSelectedGroupKey] = useState<string | null>(null);
  const dismissGroupRef = useRef<((groupKey: string) => void) | null>(null);
  const openMergeRef = useRef<((group: DuplicateGroup, groupKey?: string) => void) | null>(null);

  const handleSelectedGroupChange = useCallback(
    (
      group: DuplicateGroup | null,
      groupKey: string | null,
      dismissGroup: (groupKey: string) => void,
      openMerge: (group: DuplicateGroup, groupKey?: string) => void,
    ) => {
      setSelectedGroup(group);
      setSelectedGroupKey(groupKey);
      dismissGroupRef.current = dismissGroup;
      openMergeRef.current = openMerge;
    },
    [],
  );

  const selectedGroupItems = useMemo(() => {
    if (!selectedGroup) return [];
    return (selectedGroup.items || []) as Item[];
  }, [selectedGroup]);

  const handleExecuteMerge = async (
    masterPaper: Item,
    mergedFields: Partial<Item>,
    duplicateIdsToDelete: string[],
  ) => {
    await mergeMutation.mutateAsync({
      primaryItemId: masterPaper.id,
      duplicateItemIds: duplicateIdsToDelete,
      overrides: Object.keys(mergedFields).length > 0 ? mergedFields : undefined,
    });
  };

  return (
    <div className="flex h-full w-full overflow-hidden bg-background">
      {/* Main Workspace Content */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <LibraryTopbar
          title="Duplicate Items"
          icon={Files}
          showDisplay={false}
          canEdit={canEdit}
          onNewManualItem={canEdit ? handleNewManualItem : undefined}
          onImportFromUser={
            canEdit && activeScope.type === 'project'
              ? () => openModal('IMPORT_FROM_USER')
              : undefined
          }
        />

        <div className="flex-1 overflow-hidden min-h-0 bg-background">
          <DuplicatesContent
            scopeId={effectiveScopeId}
            canEdit={canEdit}
            onSelectedGroupChange={handleSelectedGroupChange}
          />
        </div>
      </div>

      {/* Zone 4: Inspector Panel (Merge Inspector when duplicates selected) */}
      {selectedGroupItems.length >= 2 ? (
        <div className="hidden md:flex w-80 lg:w-96 xl:w-[420px] h-full shrink-0 flex-col overflow-hidden border-l border-border bg-background">
          <DuplicateMergeInspector
            items={selectedGroupItems}
            recommendedMasterId={selectedGroup?.recommendedMasterId}
            scopeId={effectiveScopeId}
            canEdit={canEdit}
            onOpenModal={() => {
              if (selectedGroup) {
                openMergeRef.current?.(selectedGroup, selectedGroupKey || undefined);
              }
            }}
            onMerge={handleExecuteMerge}
            onDismiss={() => {
              if (selectedGroupKey) {
                dismissGroupRef.current?.(selectedGroupKey);
              }
            }}
          />
        </div>
      ) : (
        <LibraryInspector scopeId={effectiveScopeId} canEdit={canEdit} isLibrary={true} />
      )}

      {/* Zone 5: Self-managed Modals */}
      {/* LibraryModals mounted at LibraryLayout */}
    </div>
  );
}

export default DuplicatesPage;
