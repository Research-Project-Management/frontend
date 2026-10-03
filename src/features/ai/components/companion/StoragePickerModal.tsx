'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import {
  Search,
  HardDrive,
  Folder,
  ChevronRight,
  ChevronLeft,
  FileText,
  FileSpreadsheet,
  FileCode,
  FileImage,
  File,
  Loader2,
  X,
  Check,
} from 'lucide-react';
import { getMyFiles } from '@/features/storage/services/drive.service';
import type { StorageItem } from '@/features/storage/types/storage.types';
import { StorageEmptyState } from '@/features/storage/components/layout/StorageEmptyState';
import { PlaneErrorState } from '@/shared/components/ui/PlaneErrorState';
import { cn } from '@/shared/lib/utils';
import { toast } from 'sonner';

interface StoragePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId?: string | null;
  onSelectItem?: (item: { id: string; name: string; size: number }) => void;
  onSelectItems?: (items: Array<{ id: string; name: string; size: number }>) => void;
}

interface BreadcrumbItem {
  id: string | null;
  name: string;
}


function getFileIcon(name: string, mime?: string) {
  const parts = (name || '').split('.');
  const ext = parts.length > 1 ? parts.pop()!.toLowerCase() : '';

  if (ext === 'pdf' || mime?.includes('pdf')) {
    return <FileText className="size-3.5 text-muted-foreground shrink-0" strokeWidth={1.5} />;
  }
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext) || mime?.includes('image')) {
    return <FileImage className="size-3.5 text-muted-foreground shrink-0" strokeWidth={1.5} />;
  }
  if (['xls', 'xlsx', 'csv'].includes(ext) || mime?.includes('sheet') || mime?.includes('excel')) {
    return <FileSpreadsheet className="size-3.5 text-muted-foreground shrink-0" strokeWidth={1.5} />;
  }
  if (['ts', 'tsx', 'js', 'jsx', 'json', 'py', 'java', 'cpp', 'c', 'go', 'rs', 'md', 'html', 'css'].includes(ext)) {
    return <FileCode className="size-3.5 text-muted-foreground shrink-0" strokeWidth={1.5} />;
  }
  return <File className="size-3.5 text-muted-foreground shrink-0" strokeWidth={1.5} />;
}

export function StoragePickerModal({
  isOpen,
  onClose,
  projectId,
  onSelectItem,
  onSelectItems,
}: StoragePickerModalProps) {
  const [items, setItems] = useState<StorageItem[]>([]);
  const [rootFolders, setRootFolders] = useState<StorageItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [foldersLoading, setFoldersLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [foldersError, setFoldersError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([
    { id: null, name: 'All Files' },
  ]);
  const [selectedFiles, setSelectedFiles] = useState<Map<string, StorageItem>>(new Map());

  // Reset state on open
  useEffect(() => {
    if (isOpen) {
      setSelectedFiles(new Map());
      setSearch('');
      setSelectedFolderId(null);
      setError(null);
      setFoldersError(null);
      setBreadcrumbs([{ id: null, name: 'All Files' }]);
    }
  }, [isOpen]);

  // Load root folders for the sidebar
  const loadRootFolders = useCallback(async () => {
    try {
      setFoldersLoading(true);
      setFoldersError(null);
      const res = await getMyFiles(projectId || null, {
        parentId: null,
        limit: 100,
      });
      const list = res?.files || (Array.isArray(res) ? res : []);
      const f = list.filter((item: StorageItem) => item.isFolder);
      setRootFolders(f);
    } catch (err: any) {
      console.error('[StoragePickerModal] Failed to load root folders:', err);
      setFoldersError(err?.message || 'Failed to load folders');
    } finally {
      setFoldersLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (isOpen) {
      loadRootFolders();
    }
  }, [isOpen, loadRootFolders]);

  // Load files & folders in current selectedFolderId
  const loadFiles = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getMyFiles(projectId || null, {
        parentId: selectedFolderId,
        search: search.trim() || undefined,
        limit: 100,
      });
      const list = res?.files || (Array.isArray(res) ? res : []);
      setItems(list);
    } catch (err: any) {
      console.error('[StoragePickerModal] Failed to load files:', err);
      setError(err?.message || 'Failed to load storage files');
    } finally {
      setLoading(false);
    }
  }, [projectId, selectedFolderId, search]);

  useEffect(() => {
    if (isOpen) {
      loadFiles();
    }
  }, [isOpen, loadFiles]);

  // Split items into subfolders and files
  const { subfolders, files } = useMemo(() => {
    const sf: StorageItem[] = [];
    const fl: StorageItem[] = [];
    for (const item of items) {
      if (item.isFolder) {
        sf.push(item);
      } else {
        fl.push(item);
      }
    }
    return { subfolders: sf, files: fl };
  }, [items]);

  // Sidebar selection: All Files (root)
  const handleSelectRoot = () => {
    setSelectedFolderId(null);
    setBreadcrumbs([{ id: null, name: 'All Files' }]);
    setSearch('');
  };

  // Sidebar selection: Folder
  const handleSelectFolder = (folder: StorageItem) => {
    const folderName = folder.filename || folder.name || 'Folder';
    setSelectedFolderId(folder.id);
    setBreadcrumbs([
      { id: null, name: 'All Files' },
      { id: folder.id, name: folderName },
    ]);
    setSearch('');
  };

  // Navigate into subfolder from main explorer
  const handleOpenFolder = (folder: StorageItem) => {
    const folderName = folder.filename || folder.name || 'Folder';
    setSelectedFolderId(folder.id);
    setBreadcrumbs((prev) => [...prev, { id: folder.id, name: folderName }]);
    setSearch('');
  };

  // Navigate to specific breadcrumb
  const handleNavigateBreadcrumb = (index: number) => {
    const target = breadcrumbs[index];
    setSelectedFolderId(target.id);
    setBreadcrumbs((prev) => prev.slice(0, index + 1));
    setSearch('');
  };

  // Back button (up one level)
  const handleGoBack = () => {
    if (breadcrumbs.length <= 1) return;
    handleNavigateBreadcrumb(breadcrumbs.length - 2);
  };

  const toggleSelectFile = (file: StorageItem) => {
    setSelectedFiles((prev) => {
      const next = new Map(prev);
      if (next.has(file.id)) {
        next.delete(file.id);
      } else {
        next.set(file.id, file);
      }
      return next;
    });
  };

  // Double click file to immediately attach
  const handleDoubleClickFile = (file: StorageItem) => {
    const payload = {
      id: file.id,
      name: file.filename || file.name || 'Untitled File',
      size: file.size || 0,
    };
    onSelectItem?.(payload);
    onSelectItems?.([payload]);
    toast.success(`Attached "${payload.name}" to chat`);
    onClose();
  };

  // Batch confirm
  const handleConfirm = () => {
    if (selectedFiles.size === 0) return;
    const list = Array.from(selectedFiles.values()).map((file) => ({
      id: file.id,
      name: file.filename || file.name || 'Untitled File',
      size: file.size || 0,
    }));

    if (onSelectItems) {
      onSelectItems(list);
    } else if (onSelectItem) {
      list.forEach((file) => onSelectItem(file));
    }

    toast.success(`Attached ${list.length} ${list.length === 1 ? 'file' : 'files'} to chat`);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] h-[600px] flex flex-col p-0 overflow-hidden rounded-lg bg-background border border-border shadow-raised-400">
        {/* ── Header: Title only, no icon and no subtitle as instructed ── */}
        <DialogHeader className="px-5 py-3.5 border-b border-border flex flex-row items-center justify-between shrink-0">
          <DialogTitle className="text-14 font-semibold text-foreground">
            Import from Storage
          </DialogTitle>
        </DialogHeader>

        {/* ── Search Bar: Not full-width, no select all button ── */}
        <div className="px-4 py-2 border-b border-border flex items-center shrink-0">
          <div className="relative w-64 sm:w-72">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" strokeWidth={1.5} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search files in storage..."
              className="w-full h-8 pl-8 pr-7 text-13 rounded-md border border-border bg-background hover:border-foreground/30 focus:border-border focus:ring-1 focus:ring-ring text-foreground placeholder:text-muted-foreground outline-none transition-colors"
              autoFocus
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 size-4 flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              >
                <X className="size-3" strokeWidth={1.5} />
              </button>
            )}
          </div>
        </div>

        {/* ── Main Body: Sidebar + List ── */}
        <div className="flex-1 flex min-h-0">
          {/* Left Sidebar: Folders only (no types section) */}
          <div className="w-48 sm:w-52 border-r border-border p-2 overflow-y-auto space-y-1 shrink-0 select-none">
            <p className="px-2 pb-1.5 text-11 font-medium text-muted-foreground">
              Folders
            </p>

            <button
              type="button"
              onClick={handleSelectRoot}
              className={cn(
                'w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-12 text-left cursor-pointer transition-colors',
                selectedFolderId === null
                  ? 'bg-muted text-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted font-normal'
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                <HardDrive className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.5} />
                <span className="truncate">All Files</span>
              </div>
            </button>

            {foldersLoading ? (
              <div className="px-2 py-2 flex items-center gap-1.5 text-11 text-muted-foreground">
                <Loader2 className="size-3 animate-spin" />
                <span>Loading...</span>
              </div>
            ) : foldersError ? (
              <div className="px-2 py-2 text-11 text-muted-foreground/60 italic">
                Failed to load folders
              </div>
            ) : rootFolders.length === 0 ? (
              <div className="px-2 py-2 text-11 text-muted-foreground/60 italic">
                No folders
              </div>
            ) : (
              <div className="space-y-0.5 pt-0.5">
                {rootFolders.map((folder) => {
                  const isSelected = selectedFolderId === folder.id;
                  const name = folder.filename || folder.name || 'Folder';
                  return (
                    <button
                      key={folder.id}
                      type="button"
                      onClick={() => handleSelectFolder(folder)}
                      className={cn(
                        'w-full flex items-center justify-between gap-1.5 px-2 py-1.5 rounded-md text-12 text-left cursor-pointer transition-colors',
                        isSelected
                          ? 'bg-muted text-foreground font-medium'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted font-normal'
                      )}
                      title={name}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <Folder className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.5} />
                        <span className="truncate">{name}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Main Content: Explorer List */}
          <div className="flex-1 flex flex-col min-w-0 overflow-y-auto p-2 space-y-2">
            {/* Breadcrumb Navigation when inside a subfolder */}
            {breadcrumbs.length > 1 && (
              <div className="flex items-center gap-1 text-12 text-muted-foreground pb-1.5 border-b border-border/40 select-none shrink-0">
                <button
                  type="button"
                  onClick={handleGoBack}
                  className="size-5 rounded flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer shrink-0"
                  title="Go to parent folder"
                >
                  <ChevronLeft className="size-3.5" strokeWidth={1.5} />
                </button>
                {breadcrumbs.map((bc, idx) => {
                  const isLast = idx === breadcrumbs.length - 1;
                  return (
                    <React.Fragment key={bc.id || 'root'}>
                      {idx > 0 && <ChevronRight className="size-3 text-muted-foreground/40 shrink-0" />}
                      <button
                        type="button"
                        onClick={() => handleNavigateBreadcrumb(idx)}
                        disabled={isLast}
                        className={cn(
                          'truncate max-w-[140px] transition-colors text-12',
                          isLast
                            ? 'font-medium text-foreground cursor-default'
                            : 'hover:text-foreground cursor-pointer'
                        )}
                      >
                        {bc.name}
                      </button>
                    </React.Fragment>
                  );
                })}
              </div>
            )}

            {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center py-16 text-foreground">
                <Loader2 className="size-5 animate-spin text-muted-foreground mb-2" />
                <span className="text-12 text-muted-foreground">Loading storage files...</span>
              </div>
            ) : error ? (
              <PlaneErrorState
                title="Failed to load files"
                description={error}
                className="min-h-0 py-8 px-4"
              />
            ) : subfolders.length === 0 && files.length === 0 ? (
              <StorageEmptyState
                searchQuery={search}
                title={selectedFolderId && !search ? 'This folder is empty' : undefined}
                description={selectedFolderId && !search ? 'No files or subfolders found in this directory.' : undefined}
                className="min-h-0 py-8 px-4"
              />
            ) : (
              <>
                {/* Subfolders list if any */}
                {subfolders.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-10 font-semibold text-muted-foreground uppercase tracking-wider px-0.5 select-none">
                      Folders ({subfolders.length})
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {subfolders.map((folder) => {
                        const name = folder.filename || folder.name || 'Folder';
                        return (
                          <div
                            key={folder.id}
                            onClick={() => handleOpenFolder(folder)}
                            className="flex items-center justify-between p-2 rounded-md border border-border bg-background hover:bg-muted/40 hover:border-foreground/20 transition-colors cursor-pointer group select-none"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <Folder className="size-3.5 text-muted-foreground shrink-0" strokeWidth={1.5} />
                              <span className="text-12 font-medium text-foreground truncate">
                                {name}
                              </span>
                            </div>
                            <ChevronRight className="size-3 text-muted-foreground/40 group-hover:text-foreground shrink-0" />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Files List */}
                {files.length > 0 && (
                  <div className="space-y-0.5">
                    {subfolders.length > 0 && (
                      <p className="text-10 font-semibold text-muted-foreground uppercase tracking-wider px-3 py-1 select-none">
                        Files ({files.length})
                      </p>
                    )}
                    {files.map((file, idx) => {
                      const isSelected = selectedFiles.has(file.id);
                      const name = file.filename || file.name || 'Untitled File';

                      return (
                        <React.Fragment key={file.id}>
                          <div
                            onClick={() => toggleSelectFile(file)}
                            onDoubleClick={() => handleDoubleClickFile(file)}
                            className={cn(
                              'group relative flex items-center gap-2.5 px-3 py-2 rounded-md transition-colors cursor-pointer select-none',
                              isSelected
                                ? 'bg-primary/[0.06] text-primary'
                                : 'hover:bg-muted/60 text-foreground'
                            )}
                          >
                            {/* Checkbox */}
                            <div
                              className={cn(
                                'size-4 rounded border flex items-center justify-center shrink-0 transition-colors',
                                isSelected
                                  ? 'border-primary bg-primary text-primary-foreground'
                                  : 'border-border bg-background group-hover:border-foreground/40'
                              )}
                            >
                              {isSelected && <Check className="size-3 stroke-[2.5]" />}
                            </div>

                            {/* File Icon */}
                            {getFileIcon(name, file.mimeType)}

                            {/* File Title */}
                            <span
                              className={cn(
                                'text-13 truncate flex-1 leading-normal',
                                isSelected ? 'font-medium text-primary' : 'font-normal text-foreground'
                              )}
                              title={name}
                            >
                              {name}
                            </span>
                          </div>

                          {/* Separator line not touching borders */}
                          {idx < files.length - 1 && (
                            <div className="h-px bg-border/40 mx-3 my-0.5" />
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Footer: Actions only, zero quantity numbers ── */}
        <div className="px-4 py-3 border-t border-border flex items-center justify-end gap-2 shrink-0 select-none">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="h-8 px-3 text-12 font-medium rounded-md border-border bg-background hover:bg-muted text-foreground transition-colors cursor-pointer shadow-none"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleConfirm}
            disabled={selectedFiles.size === 0}
            className="h-8 px-3.5 text-12 font-medium rounded-md cursor-pointer shadow-none"
          >
            Attach
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
