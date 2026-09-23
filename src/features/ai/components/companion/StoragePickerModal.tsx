'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
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
  Calendar,
} from 'lucide-react';
import { getMyFiles } from '@/features/storage/services/drive.service';
import type { StorageItem } from '@/features/storage/types/storage.types';
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

function formatBytes(bytes?: number): string {
  if (!bytes || isNaN(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(name: string, mime?: string) {
  const parts = (name || '').split('.');
  const ext = parts.length > 1 ? parts.pop()!.toLowerCase() : '';

  if (ext === 'pdf' || mime?.includes('pdf')) {
    return <FileText className='size-4 text-red-500 shrink-0' />;
  }
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext) || mime?.includes('image')) {
    return <FileImage className='size-4 text-purple-500 shrink-0' />;
  }
  if (['xls', 'xlsx', 'csv'].includes(ext) || mime?.includes('sheet') || mime?.includes('excel')) {
    return <FileSpreadsheet className='size-4 text-emerald-600 shrink-0' />;
  }
  if (['ts', 'tsx', 'js', 'jsx', 'json', 'py', 'java', 'cpp', 'c', 'go', 'rs', 'md', 'html', 'css'].includes(ext)) {
    return <FileCode className='size-4 text-amber-500 shrink-0' />;
  }
  if (['doc', 'docx', 'txt', 'rtf'].includes(ext) || mime?.includes('word')) {
    return <FileText className='size-4 text-blue-500 shrink-0' />;
  }
  return <File className='size-4 text-muted-foreground shrink-0' />;
}

const TYPE_FILTERS = [
  { id: 'all', label: 'All Files' },
  { id: 'pdf', label: 'PDFs', exts: ['pdf'] },
  { id: 'docs', label: 'Docs', exts: ['doc', 'docx', 'txt', 'md'] },
  { id: 'sheets', label: 'Sheets', exts: ['xls', 'xlsx', 'csv'] },
  { id: 'code', label: 'Code', exts: ['ts', 'tsx', 'js', 'py', 'json', 'rs', 'go'] },
  { id: 'images', label: 'Images', exts: ['png', 'jpg', 'jpeg', 'svg', 'webp'] },
];

export function StoragePickerModal({
  isOpen,
  onClose,
  projectId,
  onSelectItem,
  onSelectItems,
}: StoragePickerModalProps) {
  const [items, setItems] = useState<StorageItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([
    { id: null, name: 'Drive' },
  ]);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [selectedFiles, setSelectedFiles] = useState<Map<string, StorageItem>>(new Map());

  // Reset state on open
  useEffect(() => {
    if (isOpen) {
      setSelectedFiles(new Map());
      setSearch('');
      setCurrentFolderId(null);
      setBreadcrumbs([{ id: null, name: 'Drive' }]);
      setSelectedFilter('all');
    }
  }, [isOpen]);

  // Load files & folders in current parentId
  const loadFiles = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getMyFiles(projectId || null, {
        parentId: currentFolderId,
        search: search.trim() || undefined,
        limit: 100,
      });
      const list = res?.files || (Array.isArray(res) ? res : []);
      setItems(list);
    } catch (err) {
      console.error('[StoragePickerModal] Failed to load files:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId, currentFolderId, search]);

  useEffect(() => {
    if (isOpen) {
      loadFiles();
    }
  }, [isOpen, loadFiles]);

  // Navigate into subfolder
  const handleOpenFolder = (folder: StorageItem) => {
    const folderName = folder.filename || folder.name || 'Folder';
    setCurrentFolderId(folder.id);
    setBreadcrumbs((prev) => [...prev, { id: folder.id, name: folderName }]);
    setSearch('');
  };

  // Navigate to specific breadcrumb
  const handleNavigateBreadcrumb = (index: number) => {
    const target = breadcrumbs[index];
    setCurrentFolderId(target.id);
    setBreadcrumbs((prev) => prev.slice(0, index + 1));
    setSearch('');
  };

  // Back button (up one level)
  const handleGoBack = () => {
    if (breadcrumbs.length <= 1) return;
    handleNavigateBreadcrumb(breadcrumbs.length - 2);
  };

  // Split into folders and files
  const { folders, files } = useMemo(() => {
    const f: StorageItem[] = [];
    const fl: StorageItem[] = [];

    const activeFilterObj = TYPE_FILTERS.find((tf) => tf.id === selectedFilter);

    for (const item of items) {
      if (item.isFolder) {
        f.push(item);
      } else {
        if (!activeFilterObj || activeFilterObj.id === 'all') {
          fl.push(item);
        } else {
          const parts = (item.filename || item.name || '').split('.');
          const ext = parts.length > 1 ? parts.pop()!.toLowerCase() : '';
          if (activeFilterObj.exts?.includes(ext)) {
            fl.push(item);
          }
        }
      }
    }

    return { folders: f, files: fl };
  }, [items, selectedFilter]);

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

  const handleSelectAllFiles = () => {
    if (selectedFiles.size === files.length) {
      setSelectedFiles(new Map());
    } else {
      const next = new Map<string, StorageItem>();
      files.forEach((f) => next.set(f.id, f));
      setSelectedFiles(next);
    }
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
      <DialogContent className='sm:max-w-2xl max-h-[85vh] h-[640px] flex flex-col p-0 overflow-hidden rounded-lg bg-popover border border-border shadow-xl'>
        {/* Header */}
        <DialogHeader className='px-5 py-3.5 border-b border-border bg-background shrink-0'>
          <div className='flex items-center justify-between'>
            <DialogTitle className='text-14 font-semibold text-foreground flex items-center gap-2'>
              <HardDrive className='size-4 text-primary shrink-0' />
              <span>Upload from Storage</span>
            </DialogTitle>
          </div>
          <p className='text-11 text-muted-foreground mt-0.5 text-left'>
            Browse your project drive and attach files to your AI chat session.
          </p>
        </DialogHeader>

        {/* Navigation & Breadcrumbs Bar */}
        <div className='px-4 py-2 border-b border-border bg-muted/20 flex items-center justify-between gap-2 shrink-0 select-none'>
          {/* Breadcrumb Trail */}
          <div className='flex items-center gap-1 min-w-0 flex-1 overflow-x-auto text-12 text-foreground scrollbar-none'>
            {breadcrumbs.length > 1 && (
              <button
                type='button'
                onClick={handleGoBack}
                className='size-6 rounded flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer mr-0.5 shrink-0'
                title='Go to parent folder'
              >
                <ChevronLeft className='size-3.5' />
              </button>
            )}

            {breadcrumbs.map((bc, idx) => {
              const isLast = idx === breadcrumbs.length - 1;
              return (
                <React.Fragment key={bc.id || 'root'}>
                  {idx > 0 && <ChevronRight className='size-3 text-muted-foreground/60 shrink-0' />}
                  <button
                    type='button'
                    onClick={() => handleNavigateBreadcrumb(idx)}
                    disabled={isLast}
                    className={cn(
                      'flex items-center gap-1.5 px-1.5 py-0.5 rounded truncate max-w-[140px] transition-colors',
                      isLast
                        ? 'font-medium text-foreground cursor-default'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer'
                    )}
                  >
                    {idx === 0 ? <HardDrive className='size-3 shrink-0' /> : <Folder className='size-3 shrink-0 text-amber-500' />}
                    <span className='truncate'>{bc.name}</span>
                  </button>
                </React.Fragment>
              );
            })}
          </div>

          {/* Quick Select All Button */}
          {files.length > 0 && (
            <button
              type='button'
              onClick={handleSelectAllFiles}
              className='h-7 px-2 rounded-md border border-border hover:bg-muted text-11 font-medium text-foreground transition-colors cursor-pointer shrink-0 shadow-2xs'
            >
              {selectedFiles.size === files.length ? 'Deselect all' : 'Select all files'}
            </button>
          )}
        </div>

        {/* Search & Type Filter Tabs */}
        <div className='px-4 py-2.5 border-b border-border bg-background flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 shrink-0'>
          {/* Search Input */}
          <div className='relative flex-1'>
            <Search className='absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground' />
            <input
              type='text'
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder='Search files in this directory...'
              className='w-full h-8 pl-8 pr-7 text-12 rounded-md border border-border bg-muted/30 focus:bg-background outline-none focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground transition-all shadow-2xs'
            />
            {search && (
              <button
                type='button'
                onClick={() => setSearch('')}
                className='absolute right-2 top-1/2 -translate-y-1/2 size-4 flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer'
              >
                <X className='size-3' />
              </button>
            )}
          </div>

          {/* Type Filter Pills */}
          <div className='flex items-center gap-1 overflow-x-auto scrollbar-none py-0.5'>
            {TYPE_FILTERS.map((tf) => (
              <button
                key={tf.id}
                type='button'
                onClick={() => setSelectedFilter(tf.id)}
                className={cn(
                  'h-7 px-2.5 rounded-full text-11 font-medium transition-colors cursor-pointer shrink-0 select-none',
                  selectedFilter === tf.id
                    ? 'bg-primary text-white shadow-2xs'
                    : 'bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>

        {/* Explorer Content */}
        <div className='flex-1 overflow-y-auto p-3 space-y-3 bg-background'>
          {loading ? (
            <div className='flex flex-col items-center justify-center py-20 text-foreground'>
              <Loader2 className='size-5 animate-spin text-primary mb-2' />
              <span className='text-12 text-muted-foreground'>Loading storage contents...</span>
            </div>
          ) : folders.length === 0 && files.length === 0 ? (
            <div className='flex flex-col items-center justify-center py-20 text-center px-4'>
              <HardDrive className='size-8 text-muted-foreground/40 mb-2' />
              <p className='text-13 font-medium text-foreground'>No items in this folder</p>
              <p className='text-11 text-muted-foreground mt-0.5 max-w-[280px]'>
                {search
                  ? `No files matching "${search}" in this folder.`
                  : 'This folder is currently empty. Upload files to your drive.'}
              </p>
            </div>
          ) : (
            <>
              {/* Folders Section */}
              {folders.length > 0 && (
                <div>
                  <p className='text-10 font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 px-0.5 select-none'>
                    Folders ({folders.length})
                  </p>
                  <div className='grid grid-cols-1 sm:grid-cols-2 gap-1.5'>
                    {folders.map((folder) => {
                      const name = folder.filename || folder.name || 'Folder';
                      return (
                        <div
                          key={folder.id}
                          onClick={() => handleOpenFolder(folder)}
                          className='flex items-center justify-between p-2 rounded-md border border-border/70 hover:border-border bg-card hover:bg-muted/40 transition-colors cursor-pointer group shadow-2xs select-none'
                        >
                          <div className='flex items-center gap-2.5 min-w-0'>
                            <div className='size-6 rounded bg-amber-500/10 flex items-center justify-center shrink-0'>
                              <Folder className='size-3.5 text-amber-500 fill-amber-500/30' />
                            </div>
                            <span className='text-12 font-medium text-foreground truncate'>
                              {name}
                            </span>
                          </div>
                          <ChevronRight className='size-3.5 text-muted-foreground/50 group-hover:text-foreground shrink-0 transition-transform group-hover:translate-x-0.5' />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Files Section */}
              {files.length > 0 && (
                <div>
                  <p className='text-10 font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 px-0.5 select-none'>
                    Files ({files.length})
                  </p>
                  <div className='space-y-1'>
                    {files.map((file) => {
                      const isSelected = selectedFiles.has(file.id);
                      const name = file.filename || file.name || 'Untitled File';
                      const sizeStr = file.size ? formatBytes(file.size) : '';

                      return (
                        <div
                          key={file.id}
                          onClick={() => toggleSelectFile(file)}
                          onDoubleClick={() => handleDoubleClickFile(file)}
                          className={cn(
                            'group flex items-center justify-between p-2 rounded-md border transition-all cursor-pointer select-none',
                            isSelected
                              ? 'border-primary/60 bg-primary/[0.04] shadow-2xs'
                              : 'border-border/60 bg-card hover:bg-muted/40 hover:border-border'
                          )}
                        >
                          <div className='flex items-center gap-2.5 min-w-0 flex-1 mr-2'>
                            {/* Checkbox */}
                            <div
                              className={cn(
                                'size-4 rounded border flex items-center justify-center shrink-0 transition-colors',
                                isSelected
                                  ? 'border-primary bg-primary text-white'
                                  : 'border-border bg-background group-hover:border-muted-foreground/60'
                              )}
                            >
                              {isSelected && <Check className='size-3 stroke-[3]' />}
                            </div>

                            {/* File Icon */}
                            {getFileIcon(name, file.mimeType)}

                            {/* File Title */}
                            <span className='text-12 font-medium text-foreground truncate'>
                              {name}
                            </span>
                          </div>

                          {/* File Metadata */}
                          <div className='flex items-center gap-2.5 text-11 text-muted-foreground shrink-0'>
                            {sizeStr && <span className='font-mono text-10'>{sizeStr}</span>}
                            {file.updatedAt && (
                              <span className='hidden sm:inline-block text-10'>
                                {new Date(file.updatedAt).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className='px-4 py-3 border-t border-border bg-background flex items-center justify-between shrink-0 select-none'>
          <div className='flex items-center gap-2'>
            <span className='text-12 font-medium text-foreground'>
              {selectedFiles.size > 0 ? (
                <span>
                  <strong className='text-primary'>{selectedFiles.size}</strong> file{selectedFiles.size === 1 ? '' : 's'} selected
                </span>
              ) : (
                <span className='text-muted-foreground truncate max-w-[200px]'>
                  Location: {breadcrumbs[breadcrumbs.length - 1]?.name || 'Root'}
                </span>
              )}
            </span>

            {selectedFiles.size > 0 && (
              <button
                type='button'
                onClick={() => setSelectedFiles(new Map())}
                className='text-11 text-muted-foreground hover:text-foreground underline ml-1 cursor-pointer'
              >
                Clear
              </button>
            )}
          </div>

          <div className='flex items-center gap-2'>
            <button
              type='button'
              onClick={onClose}
              className='h-8 px-3 rounded-md border border-border bg-background hover:bg-muted text-12 font-medium text-foreground transition-colors cursor-pointer shadow-2xs'
            >
              Cancel
            </button>
            <button
              type='button'
              onClick={handleConfirm}
              disabled={selectedFiles.size === 0}
              className='h-8 px-4 rounded-md bg-primary text-white hover:bg-primary-hover active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-12 font-medium transition-all cursor-pointer shadow-2xs'
            >
              Attach {selectedFiles.size > 0 ? `(${selectedFiles.size})` : ''}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
