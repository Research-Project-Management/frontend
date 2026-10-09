'use client';

import React from 'react';
import {
  FileCode2,
  Folder,
  Loader2,
  Upload,
} from 'lucide-react';
import { PlaneEmptyState, PlaneErrorState } from '@/shared/components/ui';
import { InlineInput } from './FileTreeNodes';
import type { FileTreeNode } from './tree-builder.util';

export interface FileTreeContainerProps {
  isDragging: boolean;
  handleDragEnter: (e: React.DragEvent<HTMLDivElement>) => void;
  handleDragLeave: (e: React.DragEvent<HTMLDivElement>) => void;
  handleDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  handleDrop: (e: React.DragEvent<HTMLDivElement>) => Promise<void> | void;
  handleMoveItem: (itemId: string, targetFolderId: string | null) => void;

  isCreatingFile: boolean;
  newFileName: string;
  setNewFileName: (val: string) => void;
  handleCreateFile: () => void;
  handleCancelCreate: () => void;
  isCreateFilePending: boolean;

  isCreatingFolder: boolean;
  newFolderName: string;
  setNewFolderName: (val: string) => void;
  handleCreateFolder: () => void;
  handleCancelCreateFolder: () => void;
  isCreateFolderPending: boolean;

  isLoading: boolean;
  projectFilesLoading: boolean;
  uploadingCount: number;

  isFilesError: boolean;
  filesError: Error | null;

  treeItemsLength: number;
  displayTree: FileTreeNode[];
  fileFilter: string;
  setFileFilter: (val: string) => void;
  renderTreeNode: (node: FileTreeNode, depth?: number) => React.ReactNode;
}

export function FileTreeContainer({
  isDragging,
  handleDragEnter,
  handleDragLeave,
  handleDragOver,
  handleDrop,
  handleMoveItem,

  isCreatingFile,
  newFileName,
  setNewFileName,
  handleCreateFile,
  handleCancelCreate,
  isCreateFilePending,

  isCreatingFolder,
  newFolderName,
  setNewFolderName,
  handleCreateFolder,
  handleCancelCreateFolder,
  isCreateFolderPending,

  isLoading,
  projectFilesLoading,
  uploadingCount,

  isFilesError,
  filesError,

  treeItemsLength,
  displayTree,
  fileFilter,
  setFileFilter,
  renderTreeNode,
}: FileTreeContainerProps) {
  return (
    <div
      className="relative min-h-0 flex-1 overflow-y-auto px-2 pt-2.5 pb-3 thin-scrollbar space-y-0.5 border-b border-border"
      onDragEnter={(e) => {
        if (!e.dataTransfer.types.includes('application/flux-file-id')) {
          handleDragEnter(e);
        }
      }}
      onDragLeave={handleDragLeave}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('application/flux-file-id')) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
        } else {
          handleDragOver(e);
        }
      }}
      onDrop={(e) => {
        const internalFileId = e.dataTransfer.getData('application/flux-file-id');
        if (internalFileId) {
          e.preventDefault();
          e.stopPropagation();
          handleMoveItem(internalFileId, null);
          return;
        }
        handleDrop(e);
      }}
    >
      {/* Drag-over overlay */}
      {isDragging && (
        <div className="absolute inset-1.5 z-10 flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-foreground/40 bg-muted/40 pointer-events-none backdrop-blur-[1px]">
          <div className="p-2 rounded-full bg-muted">
            <Upload className="size-5 text-foreground shrink-0" strokeWidth={1.5} />
          </div>
          <span className="text-12 font-medium text-foreground">Drop files to upload</span>
        </div>
      )}

      {/* ── Inline create inputs ────────────────────────────────────────── */}
      {isCreatingFile && (
        <InlineInput
          icon={FileCode2}
          iconColor="text-foreground"
          value={newFileName}
          onChange={setNewFileName}
          placeholder="filename.tex"
          onCommit={handleCreateFile}
          onCancel={handleCancelCreate}
          isPending={isCreateFilePending}
        />
      )}
      {isCreatingFolder && (
        <InlineInput
          icon={Folder}
          iconColor="text-foreground"
          value={newFolderName}
          onChange={setNewFolderName}
          placeholder="folder name"
          onCommit={handleCreateFolder}
          onCancel={handleCancelCreateFolder}
          isPending={isCreateFolderPending}
        />
      )}

      {/* Loading skeleton */}
      {(isLoading || projectFilesLoading) && (
        <div className="flex flex-col py-1 space-y-0.5">
          {[65, 80, 45, 75, 55].map((w, i) => (
            <div key={i} className="flex h-8 items-center gap-2 px-3">
              <div className="size-4 rounded-md bg-muted animate-pulse motion-reduce:animate-none shrink-0" />
              <div
                className="h-3 rounded-md bg-muted animate-pulse motion-reduce:animate-none"
                style={{ width: `${w}%` }}
              />
            </div>
          ))}
        </div>
      )}

      {/* Uploading indicator */}
      {uploadingCount > 0 && (
        <div className="flex h-8 items-center gap-2 px-3 text-12 text-muted-foreground select-none">
          <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none text-foreground shrink-0" />
          <span>
            Uploading {uploadingCount} file{uploadingCount > 1 ? 's' : ''}…
          </span>
        </div>
      )}

      {/* ── UNIFIED FILE TREE ITEMS ─────────────────────────────────────── */}
      {isFilesError ? (
        <div className="py-6 px-2">
          <PlaneErrorState
            title="Unable to load files"
            description="An issue occurred while loading project files."
            error={filesError || new Error('Failed to load project files')}
          />
        </div>
      ) : !isLoading && !projectFilesLoading && (
        <>
          {treeItemsLength > 0 && displayTree.length === 0 ? (
            <div className="py-6 px-2">
              <PlaneEmptyState
                variant="search"
                isCompact
                title="No files match"
                description={`No files found matching "${fileFilter}".`}
                action={
                  <button
                    type="button"
                    onClick={() => setFileFilter('')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-12 font-medium bg-muted hover:bg-muted/80 text-foreground transition-colors cursor-pointer"
                  >
                    Clear filter
                  </button>
                }
              />
            </div>
          ) : treeItemsLength === 0 && !isCreatingFile && !isCreatingFolder ? (
            <div className="py-6 px-2">
              <PlaneEmptyState
                variant="files"
                isCompact
                title="No files yet"
                description="Create your first document or upload files to begin editing."
              />
            </div>
          ) : (
            displayTree.map((node) => renderTreeNode(node, 0))
          )}
        </>
      )}
    </div>
  );
}
