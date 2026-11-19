'use client';

import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Folder,
  Loader2,
  Search,
} from 'lucide-react';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { PlaneEmptyState } from '@/shared/components/ui/PlaneEmptyState';
import { cn } from '@/shared/lib/utils';
import { getFileIcon, getFileType } from '@/features/storage';
import { formatBytes, type SourceEntry } from '../../context/source.port';
import { useStorageContextItems } from '../../context/storage';

export interface StorageTabProps {
  spaceId?: string | null;
  pending: ReadonlyMap<string, SourceEntry>;
  selectedIds?: ReadonlySet<string>;
  onToggle: (entry: SourceEntry) => void;
  onQuickAttach: (entry: SourceEntry) => void;
}

export function StorageTab({
  spaceId = null,
  pending,
  selectedIds,
  onToggle,
  onQuickAttach,
}: StorageTabProps) {
  const [search, setSearch] = useState('');
  const [folderId, setFolderId] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<
    Array<{ id: string | null; name: string }>
  >([{ id: null, name: 'All Files' }]);

  const { folders, files, isLoading } = useStorageContextItems({
    spaceId,
    parentId: folderId,
    search,
    enabled: true,
  });

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      <div className="p-3 border-b border-border flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 text-12 text-muted-foreground min-w-0">
          {breadcrumbs.length > 1 && (
            <button
              type="button"
              onClick={() => {
                const prev = breadcrumbs[breadcrumbs.length - 2];
                setFolderId(prev.id);
                setBreadcrumbs(breadcrumbs.slice(0, -1));
              }}
              className="p-1 rounded hover:bg-muted text-foreground cursor-pointer"
              aria-label="Go back"
            >
              <ChevronLeft className="size-3.5" />
            </button>
          )}
          {breadcrumbs.map((bc, idx) => (
            <React.Fragment key={bc.id || 'root'}>
              {idx > 0 && <span>/</span>}
              <button
                type="button"
                onClick={() => {
                  setFolderId(bc.id);
                  setBreadcrumbs(breadcrumbs.slice(0, idx + 1));
                }}
                className="hover:text-foreground truncate cursor-pointer"
              >
                {bc.name}
              </button>
            </React.Fragment>
          ))}
        </div>
        <div className="flex items-center gap-1.5 border border-border rounded-md px-2 h-8 w-56 bg-background">
          <Search className="size-3.5 text-muted-foreground shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search storage..."
            className="w-full bg-transparent text-12 outline-none"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground gap-2 text-12">
            <Loader2 className="size-4 animate-spin" />
            <span>Loading storage files...</span>
          </div>
        ) : folders.length === 0 && files.length === 0 ? (
          <PlaneEmptyState
            variant="files"
            title="No storage files"
            description="No files found in this folder."
            isCompact
          />
        ) : (
          <>
            {folders.map((folder) => (
              <button
                key={folder.id}
                type="button"
                onClick={() => {
                  setFolderId(folder.id);
                  setBreadcrumbs((prev) => [
                    ...prev,
                    { id: folder.id, name: folder.name },
                  ]);
                }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted/60 text-left cursor-pointer"
              >
                <Folder className="size-4 text-warning shrink-0" />
                <span className="text-12 font-medium text-foreground truncate flex-1">
                  {folder.name}
                </span>
                <ChevronRight className="size-3.5 text-muted-foreground" />
              </button>
            ))}
            {files.map((file) => {
              const { entry } = file;
              const isChecked =
                pending.has(entry.id) || Boolean(selectedIds?.has(entry.id));
              return (
                <div
                  key={file.id}
                  onClick={() => onToggle(entry)}
                  onDoubleClick={() => onQuickAttach(entry)}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-md border cursor-pointer transition-colors',
                    isChecked
                      ? 'border-ai/40 bg-ai/5'
                      : 'border-transparent hover:bg-muted/60',
                  )}
                >
                  <Checkbox checked={isChecked} />
                  <span className="shrink-0">
                    {getFileIcon(getFileType(file), 4)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-12 font-medium text-foreground truncate">
                      {file.filename}
                    </p>
                    {file.size ? (
                      <p className="text-10 text-muted-foreground">
                        {formatBytes(file.size)}
                      </p>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
