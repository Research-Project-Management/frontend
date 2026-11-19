'use client';

/**
 * FilesTab.tsx
 *
 * Canonical Files & Explorer sidebar component:
 * Location: `features/editor/subsystems/explorer/ui/FilesTab.tsx`
 */

import React, { useCallback } from 'react';
import { FileCode2, Folder } from 'lucide-react';
import dynamic from 'next/dynamic';

import { normalizeVirtualPath } from '@/features/editor/domain/document/document-naming';
import { DEFAULT_MAIN_FILE } from '@/features/editor/domain/constants/editor.constants';
import type { EditorStorageItem as StorageItem } from '@/features/editor/domain/types/storage-item.types';
import { StorageFileRow } from './subcomponents/FileTreeNodes';
import { UploadConflictDialog } from './modals/UploadConflictDialog';
import { FileOutlineSection } from './subcomponents/FileOutlineSection';
import { FileTreeToolbar } from './subcomponents/FileTreeToolbar';
import { TexFileRow } from './subcomponents/TexFileRow';
import { FileTreeFolderRow } from './subcomponents/FileTreeFolderRow';
import {
  type FileTreeNode,
  type FlattenedTreeNode,
} from '@/features/editor/subsystems/explorer/model/document-tree';
import { DeleteFileDialog } from './modals/DeleteFileDialog';
import { FileTreeContainer } from './FileTreeContainer';
import { InlineInput } from './subcomponents/FileTreePrimitives';
import { useFilesTabController } from './hooks/useFilesTabController';

const AddFilesModal = dynamic(
  () => import('@/features/editor/subsystems/explorer/ui/modals/AddFilesModal'),
  { ssr: false },
);

const FilesTab = React.memo(function FilesTab({ onClose }: { onClose?: () => void }) {
  const c = useFilesTabController();

  const renderTreeNode = useCallback(
    (node: FileTreeNode, depth = 0, isFlat = false): React.ReactNode => {
      if (node.type === 'folder') {
        return (
          <FileTreeFolderRow
            key={node.id}
            node={node}
            depth={depth}
            isExpanded={c.isFolderExpanded(node)}
            isRenaming={c.renamingId === node.id}
            renameValue={c.renameValue}
            isRenamePending={c.isRenamePending}
            onToggle={c.toggleFolder}
            onMoveItem={c.handleMoveItem}
            onNewFileInFolder={(folderPath) => {
              const cleanFolder = normalizeVirtualPath(folderPath);
              if (cleanFolder) {
                c.expandPaths([cleanFolder]);
              }
              c.setIsCreatingFolder(false);
              c.setNewFolderName('');
              c.setCreateParentFolderPath(cleanFolder || null);
              c.setNewFileName('');
              c.setIsCreatingFile(true);
            }}
            onNewFolderInFolder={(folderPath) => {
              const cleanFolder = normalizeVirtualPath(folderPath);
              if (cleanFolder) {
                c.expandPaths([cleanFolder]);
              }
              c.handleStartCreateFolder(cleanFolder);
            }}
            onUploadToFolder={(folderId, droppedFiles) => {
              c.handleUploadToFolder(droppedFiles ?? [], folderId);
            }}
            onStartRename={c.handleStartRename}
            onRenameChange={c.setRenameValue}
            onCommitRename={c.handleCommitRename}
            onCancelRename={() => c.setRenamingId(null)}
            onDelete={c.handleDelete}
          >
            {!isFlat && node.children.map((child) => renderTreeNode(child, depth + 1, false))}
          </FileTreeFolderRow>
        );
      }

      if (node.kind === 'asset') {
        const storageItem: StorageItem = node.storageData || {
          id: node.id,
          filename: node.displayLabel,
          path: node.title,
          isFolder: false,
          size: 0,
        };
        return (
          <StorageFileRow
            key={node.id}
            item={storageItem}
            depth={depth}
            onInsertAsset={c.insertAsset}
            onPreview={c.handleOpenPreview}
            onRequestDelete={c.handleDelete}
            onStartRename={c.handleStartRename}
            isRenaming={c.renamingId === storageItem.id}
            renameValue={c.renameValue}
            isRenamePending={c.isRenamePending}
            onRenameChange={c.setRenameValue}
            onCommitRename={c.handleCommitRename}
            onCancelRename={() => c.setRenamingId(null)}
            projectId={c.projectId}
          />
        );
      }

      const activeId = c.activeTabId || c.activeFileId || c.fileParam || c.pageId;
      const isMain = Boolean(node.isRootDoc);
      const isActive =
        node.id === activeId ||
        node.title === activeId ||
        (activeId === c.pageId && isMain);

      return (
        <TexFileRow
          key={node.id}
          file={{ id: node.id, title: node.title, updatedAt: node.updatedAt }}
          depth={depth}
          displayLabel={node.displayLabel}
          isActive={isActive}
          isMain={isMain}
          isRenaming={c.renamingId === node.id}
          renameValue={c.renameValue}
          isRenamePending={c.isRenamePending}
          onFileClick={c.handleFileClick}
          onFileDoubleClick={c.handleFileDoubleClick}
          onStartRename={c.handleStartRename}
          onRenameChange={c.setRenameValue}
          onCommitRename={c.handleCommitRename}
          onCancelRename={() => c.setRenamingId(null)}
          onDelete={c.handleDelete}
          onSetMain={c.handleSetMain}
          onDownload={c.downloadTex}
          onCopyCommand={c.copyTexCommand}
        />
      );
    },
    [c],
  );

  const renderFlatRow = useCallback(
    (item: FlattenedTreeNode): React.ReactNode => {
      if (item.inlineCreateKind === 'file') {
        return (
          <InlineInput
            depth={item.depth}
            icon={FileCode2}
            iconColor="text-foreground"
            value={c.newFileName}
            onChange={c.setNewFileName}
            placeholder="filename.tex"
            onCommit={c.handleCreateFile}
            onCancel={c.handleCancelCreate}
            isPending={c.isCreateFilePending}
          />
        );
      }
      if (item.inlineCreateKind === 'folder') {
        return (
          <InlineInput
            depth={item.depth}
            icon={Folder}
            iconColor="text-foreground"
            value={c.newFolderName}
            onChange={c.setNewFolderName}
            placeholder="folder name"
            onCommit={c.handleCreateFolder}
            onCancel={c.handleCancelCreateFolder}
            isPending={c.isCreateFolderPending}
          />
        );
      }
      return renderTreeNode(item.node, item.depth, true);
    },
    [renderTreeNode, c],
  );

  return (
    <>
      <div className="w-full h-full flex flex-col select-none text-sm">
        <input
          id="editor-combined-file-upload"
          name="combinedFileUpload"
          ref={c.combinedUploadRef}
          type="file"
          multiple
          className="hidden"
          onChange={c.handleFilePicked}
        />
        <input
          id="editor-folder-upload"
          name="folderUpload"
          ref={c.folderUploadRef}
          type="file"
          multiple
          className="hidden"
          onChange={c.handleFolderPicked}
          {...({ webkitdirectory: '', directory: '' } as React.InputHTMLAttributes<HTMLInputElement> & {
            webkitdirectory?: string;
            directory?: string;
          })}
        />

        <FileTreeToolbar
          isFileTreeOpen={c.isFileTreeOpen}
          onToggleFileTree={() => c.setIsFileTreeOpen((prev) => !prev)}
          onOpenFileModal={c.handleOpenFileModal}
          onStartCreateFolder={() => c.handleStartCreateFolder('')}
          onOpenUploadModal={c.handleOpenUploadModal}
          onClose={onClose}
          fileFilter={c.fileFilter}
          onFileFilterChange={c.setFileFilter}
        />

        {c.isFileTreeOpen && (
          <FileTreeContainer
            isDragging={c.isDragging}
            handleDragEnter={c.handleDragEnter}
            handleDragLeave={c.handleDragLeave}
            handleDragOver={c.handleDragOver}
            handleDrop={c.handleDrop}
            handleMoveItem={c.handleMoveItem}
            isCreatingFile={c.isCreatingFile}
            newFileName={c.newFileName}
            setNewFileName={c.setNewFileName}
            handleCreateFile={c.handleCreateFile}
            handleCancelCreate={c.handleCancelCreate}
            isCreateFilePending={c.isCreateFilePending}
            isCreatingFolder={c.isCreatingFolder}
            newFolderName={c.newFolderName}
            setNewFolderName={c.setNewFolderName}
            handleCreateFolder={c.handleCreateFolder}
            handleCancelCreateFolder={c.handleCancelCreateFolder}
            isCreateFolderPending={c.isCreateFolderPending}
            isLoading={c.isLoading}
            projectFilesLoading={c.projectFilesLoading}
            uploadingCount={c.uploadingCount}
            isFilesError={c.isFilesError}
            filesError={c.filesError}
            treeItemsLength={c.treeItems.length}
            displayTree={c.displayTree}
            fileFilter={c.fileFilter}
            setFileFilter={c.setFileFilter}
            renderTreeNode={renderTreeNode}
            flattenedTree={c.flattenedTree}
            renderFlatRow={renderFlatRow}
            showTopInlineCreate={c.inlineCreateFlatIndex === -1}
            activeFlatIndex={c.activeFlatIndex}
            inlineCreateFlatIndex={c.inlineCreateFlatIndex}
            isFolderExpanded={c.isFolderExpanded}
            onToggleFolder={c.toggleFolder}
          />
        )}

        <FileOutlineSection
          isFileTreeOpen={c.isFileTreeOpen}
          activeFileName={c.activeOutlineFileName || c.configuredMainFile || DEFAULT_MAIN_FILE}
        />
      </div>

      <UploadConflictDialog
        open={c.uploadDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            c.setUploadDialogOpen(false);
            c.setPendingUploads([]);
          }
        }}
        pendingUploads={c.pendingUploads}
        onRemoveItem={(i) => c.setPendingUploads((prev) => prev.filter((_, j) => j !== i))}
        onSetResolution={(i, resolution) =>
          c.setPendingUploads((prev) => prev.map((p, j) => (j === i ? { ...p, resolution } : p)))
        }
        onToggleUnpackZip={(i, unpack) =>
          c.setPendingUploads((prev) => prev.map((p, j) => (j === i ? { ...p, unpackZip: unpack } : p)))
        }
        onCancel={() => {
          c.setUploadDialogOpen(false);
          c.setPendingUploads([]);
        }}
        onConfirm={c.handleConfirmUpload}
      />

      {c.isAddFilesModalOpen && (
        <AddFilesModal
          open={c.isAddFilesModalOpen}
          onOpenChange={c.setIsAddFilesModalOpen}
          defaultTab={c.addFilesTab}
          parentPageId={c.parentPageId}
          projectId={c.projectId}
          onPickItems={c.handleAddFilesPick}
        />
      )}

      <DeleteFileDialog
        fileToDelete={c.fileToDelete}
        isPending={c.isDeletePending}
        onClose={() => c.setFileToDelete(null)}
        onConfirm={c.handleConfirmDelete}
      />
    </>
  );
});

export default FilesTab;
