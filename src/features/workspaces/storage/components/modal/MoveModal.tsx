'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Folder,
  FolderOpen,
  FolderPlus,
  ChevronRight,
  HardDrive,
  Loader2,
  Check,
  ArrowLeft,
  CornerDownRight,
  FolderInput,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { cn } from '@/shared/lib/utils';
import type { StorageItem } from '@/features/workspaces/storage/types/storage.types';
import { getAllFiles as getWorkspaceFiles, createFolder as createWorkspaceFolder } from '@/features/workspaces/storage/services/file.service';
import { getAllFiles as getProjectFiles, createFolder as createProjectFolder } from '@/features/workspaces/projects/project-id/storage/services/file.service';
import { useMoveItem } from '@/features/workspaces/storage/hooks/use-storage';
import { useStorageSelectionStore } from '@/features/workspaces/storage/store/use-selection-store';

export type OpenMoveModalDetail = {
  item?: StorageItem;
  items?: StorageItem[];
  workspaceId?: string;
  projectId?: string;
};

interface MoveModalProps {
  workspaceId?: string;
  projectId?: string;
}

interface BreadcrumbStep {
  id: string | null;
  name: string;
}

export default function MoveModal({ workspaceId: propWorkspaceId, projectId: propProjectId }: MoveModalProps) {
  const params = useParams() as { workspaceId?: string; projectId?: string };
  const queryClient = useQueryClient();
  const { clearSelection } = useStorageSelectionStore();

  const [open, setOpen] = useState(false);
  const [itemsToMove, setItemsToMove] = useState<StorageItem[]>([]);
  const [scopeWorkspaceId, setScopeWorkspaceId] = useState<string | undefined>(propWorkspaceId || params.workspaceId);
  const [scopeProjectId, setScopeProjectId] = useState<string | undefined>(propProjectId || params.projectId);

  // Navigation state
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbStep[]>([
    { id: null, name: 'My Drive' },
  ]);

  // Destination selection (selected folder in the list or the current folder level)
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedFolderName, setSelectedFolderName] = useState<string>('My Drive');

  // Inline new folder creation state
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const { mutateAsync: moveItemMutation, isPending: isMoving } = useMoveItem();

  const isProject = !!scopeProjectId;
  const targetScopeId = isProject ? scopeProjectId : scopeWorkspaceId;

  // Listen for open event
  useEffect(() => {
    const handleOpen = (e: CustomEvent<OpenMoveModalDetail>) => {
      const detail = e.detail || {};
      const targetItems = detail.items || (detail.item ? [detail.item] : []);
      if (targetItems.length === 0) return;

      setItemsToMove(targetItems);
      setScopeWorkspaceId(detail.workspaceId || propWorkspaceId || params.workspaceId);
      setScopeProjectId(detail.projectId || propProjectId || params.projectId);

      // Start at root
      setCurrentFolderId(null);
      setBreadcrumbs([{ id: null, name: 'My Drive' }]);
      setSelectedFolderId(null);
      setSelectedFolderName('My Drive');
      setIsCreatingFolder(false);
      setNewFolderName('');
      setOpen(true);
    };

    window.addEventListener('open-move-modal', handleOpen as EventListener);
    return () => window.removeEventListener('open-move-modal', handleOpen as EventListener);
  }, [propWorkspaceId, propProjectId, params.workspaceId, params.projectId]);

  // Fetch subfolders in the current folder being browsed
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['storage-move-modal-folders', isProject ? 'project' : 'workspace', targetScopeId, currentFolderId],
    queryFn: async () => {
      if (!targetScopeId) return { files: [] };
      if (isProject) {
        return getProjectFiles(targetScopeId, currentFolderId);
      }
      return getWorkspaceFiles(targetScopeId, currentFolderId);
    },
    enabled: open && !!targetScopeId,
  });

  const availableFolders = useMemo(() => {
    return (data?.files || []).filter((f) => f.isFolder) as StorageItem[];
  }, [data?.files]);

  // Set of forbidden IDs: Any folder being moved cannot be chosen as target or navigated into
  const forbiddenFolderIds = useMemo(() => {
    return new Set(itemsToMove.filter((i) => i.isFolder).map((i) => i.id));
  }, [itemsToMove]);

  // Check if target is already the current location of all items
  const isCurrentLocation = useMemo(() => {
    if (itemsToMove.length === 0) return false;
    return itemsToMove.every((item) => (item.parentId ?? null) === selectedFolderId);
  }, [itemsToMove, selectedFolderId]);

  // Navigate into a folder
  const handleEnterFolder = (folder: StorageItem) => {
    if (forbiddenFolderIds.has(folder.id)) return;
    setCurrentFolderId(folder.id);
    setBreadcrumbs((prev) => [...prev, { id: folder.id, name: folder.filename }]);
    setSelectedFolderId(folder.id);
    setSelectedFolderName(folder.filename);
    setIsCreatingFolder(false);
  };

  // Navigate to a breadcrumb step
  const handleNavigateBreadcrumb = (index: number) => {
    const target = breadcrumbs[index];
    setCurrentFolderId(target.id);
    setBreadcrumbs((prev) => prev.slice(0, index + 1));
    setSelectedFolderId(target.id);
    setSelectedFolderName(target.name);
    setIsCreatingFolder(false);
  };

  // Navigate back one step
  const handleBackOneStep = () => {
    if (breadcrumbs.length <= 1) return;
    handleNavigateBreadcrumb(breadcrumbs.length - 2);
  };

  // Create folder inside current level
  const handleCreateFolder = async () => {
    if (!newFolderName.trim() || !targetScopeId) return;
    setIsCreating(true);
    try {
      if (isProject) {
        await createProjectFolder(newFolderName.trim(), {
          projectId: targetScopeId,
          parentId: currentFolderId,
        });
      } else {
        await createWorkspaceFolder(newFolderName.trim(), {
          workspaceId: targetScopeId,
          parentId: currentFolderId,
        });
      }
      toast.success(`Created folder "${newFolderName.trim()}"`);
      setNewFolderName('');
      setIsCreatingFolder(false);
      await refetch();
      queryClient.invalidateQueries({ queryKey: ['storage'] });
    } catch (error) {
      toast.error('Failed to create folder');
      console.error(error);
    } finally {
      setIsCreating(false);
    }
  };

  // Execute Move
  const handleConfirmMove = async () => {
    if (itemsToMove.length === 0) return;
    if (isCurrentLocation) {
      toast.info('Item is already in this location');
      return;
    }

    try {
      for (const item of itemsToMove) {
        await moveItemMutation({
          itemId: item.id,
          parentId: selectedFolderId,
        });
      }

      const destName = selectedFolderId ? selectedFolderName : 'My Drive';
      if (itemsToMove.length === 1) {
        toast.success(`Moved "${itemsToMove[0].filename}" to ${destName}`);
      } else {
        toast.success(`Moved ${itemsToMove.length} items to ${destName}`);
      }

      clearSelection();
      setOpen(false);
    } catch (error) {
      toast.error('Failed to move items');
      console.error(error);
    }
  };

  const titleText =
    itemsToMove.length === 1
      ? `Move "${itemsToMove[0].filename}"`
      : `Move ${itemsToMove.length} items`;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        onCloseAutoFocus={(e) => e.preventDefault()}
        className="sm:max-w-lg p-0 gap-0 overflow-hidden bg-popover text-popover-foreground border border-border rounded-lg shadow-sm"
      >
        <DialogHeader className="px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-md bg-muted text-primary flex items-center justify-center shrink-0">
              <FolderInput className="size-4 shrink-0" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-sm font-semibold truncate text-foreground">
                {titleText}
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Select a destination folder
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* Navigation & Breadcrumb Toolbar */}
        <div className="px-5 py-2.5 bg-background border-b border-border flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0 overflow-x-auto py-0.5 text-xs">
            {breadcrumbs.length > 1 && (
              <button
                type="button"
                onClick={handleBackOneStep}
                className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer mr-1"
                title="Go back"
              >
                <ArrowLeft className="size-3.5" />
              </button>
            )}
            <HardDrive className="size-3.5 text-muted-foreground shrink-0" />
            {breadcrumbs.map((step, idx) => {
              const isLast = idx === breadcrumbs.length - 1;
              return (
                <div key={step.id || `root-${idx}`} className="flex items-center gap-1 shrink-0">
                  {idx > 0 && <ChevronRight className="size-3 text-muted-foreground/50 shrink-0" />}
                  <button
                    type="button"
                    onClick={() => handleNavigateBreadcrumb(idx)}
                    disabled={isLast}
                    className={cn(
                      "px-1.5 py-0.5 rounded-md transition-colors max-w-[130px] truncate",
                      isLast
                        ? "font-semibold text-foreground cursor-default"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
                    )}
                  >
                    {step.name}
                  </button>
                </div>
              );
            })}
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsCreatingFolder((prev) => !prev)}
            className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground cursor-pointer shrink-0"
          >
            <FolderPlus className="size-3.5" />
            <span>New folder</span>
          </Button>
        </div>

        {/* Inline New Folder Input */}
        {isCreatingFolder && (
          <div className="px-5 py-2.5 bg-accent border-b border-border/40 flex items-center gap-2 animate-in fade-in-0 duration-150">
            <FolderPlus className="size-4 text-primary shrink-0" />
            <Input
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="New folder name"
              autoFocus
              disabled={isCreating}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleCreateFolder();
                } else if (e.key === 'Escape') {
                  setIsCreatingFolder(false);
                }
              }}
              className="h-8 text-xs bg-background"
            />
            <Button
              type="button"
              size="sm"
              onClick={handleCreateFolder}
              disabled={!newFolderName.trim() || isCreating}
              className="h-8 px-3 text-xs cursor-pointer"
            >
              {isCreating ? <Loader2 className="size-3 animate-spin" /> : 'Create'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsCreatingFolder(false)}
              disabled={isCreating}
              className="h-8 px-2 text-xs cursor-pointer text-muted-foreground"
            >
              Cancel
            </Button>
          </div>
        )}

        {/* Folder List / Explorer Area */}
        <div className="p-3 max-h-64 min-h-[220px] overflow-y-auto space-y-1">
          {/* Option: Current Browsed Folder Root Level */}
          <div
            onClick={() => {
              setSelectedFolderId(currentFolderId);
              setSelectedFolderName(breadcrumbs[breadcrumbs.length - 1].name);
            }}
            className={cn(
              "flex items-center justify-between px-3 py-2 rounded-md text-xs cursor-pointer border transition-all duration-150 select-none",
              selectedFolderId === currentFolderId
                ? "bg-muted border-primary text-primary font-medium"
                : "border-transparent hover:bg-muted text-foreground"
            )}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <HardDrive className="size-4 text-muted-foreground shrink-0" />
              <div className="flex items-center gap-1.5 truncate">
                <span className="truncate">
                  {currentFolderId === null ? 'My Drive (Root directory)' : `Current: ${breadcrumbs[breadcrumbs.length - 1].name}`}
                </span>
                {itemsToMove.every((i) => (i.parentId ?? null) === currentFolderId) && (
                  <span className="text-10 text-muted-foreground font-normal px-1.5 py-0.5 rounded-sm bg-muted">
                    Current location
                  </span>
                )}
              </div>
            </div>
            {selectedFolderId === currentFolderId && (
              <Check className="size-4 text-primary shrink-0 ml-2" />
            )}
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
              <Loader2 className="size-5 animate-spin text-primary" />
              <span className="text-xs">Loading folders…</span>
            </div>
          ) : availableFolders.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground/70">
              No subfolders in this location
            </div>
          ) : (
            <div className="space-y-1 pt-1 border-t border-border/30">
              {availableFolders.map((folder) => {
                const isForbidden = forbiddenFolderIds.has(folder.id);
                const isSelected = selectedFolderId === folder.id;
                const isFolderCurrentLocation = itemsToMove.every((i) => (i.parentId ?? null) === folder.id);

                return (
                  <div
                    key={folder.id}
                    onClick={() => {
                      if (!isForbidden) {
                        setSelectedFolderId(folder.id);
                        setSelectedFolderName(folder.filename);
                      }
                    }}
                    onDoubleClick={() => {
                      if (!isForbidden) {
                        handleEnterFolder(folder);
                      }
                    }}
                    className={cn(
                      "flex items-center justify-between px-3 py-2 rounded-md text-xs group transition-all duration-150 border select-none",
                      isForbidden && "opacity-40 pointer-events-none bg-muted border-transparent",
                      isSelected
                        ? "bg-muted border-primary text-primary font-medium"
                        : "border-transparent hover:bg-muted text-foreground cursor-pointer"
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      {isSelected ? (
                        <FolderOpen className="size-4 text-primary shrink-0" />
                      ) : (
                        <Folder className="size-4 text-muted-foreground shrink-0" />
                      )}
                      <span className="truncate">{folder.filename}</span>
                      {isFolderCurrentLocation && (
                        <span className="text-10 text-muted-foreground font-normal px-1.5 py-0.2 rounded-sm bg-muted shrink-0">
                          Current location
                        </span>
                      )}
                      {isForbidden && (
                        <span className="text-10 text-destructive font-normal px-1.5 py-0.2 rounded-sm bg-destructive/10 shrink-0">
                          Cannot move into itself
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      {isSelected && <Check className="size-4 text-primary shrink-0" />}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEnterFolder(folder);
                        }}
                        disabled={isForbidden}
                        className="p-1 rounded-md hover:bg-muted text-foreground transition-colors cursor-pointer"
                        title={`Browse into ${folder.filename}`}
                      >
                        <ChevronRight className="size-3.5 shrink-0" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer with Destination Preview and Confirm Action */}
        <DialogFooter className="px-5 py-3.5 bg-background border-t border-border flex sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground truncate min-w-0">
            <CornerDownRight className="size-3.5 text-primary shrink-0" />
            <span className="shrink-0">Destination:</span>
            <strong className="text-foreground font-semibold truncate">
              {selectedFolderId === null ? 'My Drive' : selectedFolderName}
            </strong>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
              disabled={isMoving}
              className="h-8 px-3 text-xs cursor-pointer text-foreground hover:bg-muted"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleConfirmMove}
              disabled={isMoving || isCurrentLocation}
              className="h-8 px-4 text-xs font-medium cursor-pointer"
            >
              {isMoving ? (
                <>
                  <Loader2 className="size-3.5 animate-spin mr-1.5" />
                  Moving…
                </>
              ) : isCurrentLocation ? (
                'Already here'
              ) : (
                'Move here'
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
