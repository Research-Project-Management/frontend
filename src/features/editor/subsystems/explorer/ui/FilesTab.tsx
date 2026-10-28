'use client';

/**
 * FilesTab.tsx
 *
 * Canonical Files & Explorer sidebar component:
 * - File tree building handled by `document-tree.ts` & `useFileTree.ts`
 * - Folder row rendering extracted to `FileTreeFolderRow.tsx`
 * - Asset insertion & LaTeX actions powered by `domain/latex` & `domain/document`
 * - Drag-drop & upload orchestration extracted to `useFileUpload.ts`
 *
 * Location: `features/editor/ui/features/sidebar/explorer/FilesTab.tsx`
 */

import React, {
  useState,
  useCallback,
  useEffect,
  useMemo,
} from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import dynamic from 'next/dynamic';

import { useEditorStorage } from '@/features/editor/ui/hooks/useStorage';
import { useEditorInstance } from '@/features/editor/ui/hooks/useEditorInstance';
import { createFileSchema, createFolderSchema, renameItemSchema, extractProjectId, extractDocumentContentString } from '@/features/editor/domain/types/core.types';
import { DEFAULT_MAIN_FILE } from '@/features/editor/domain/constants/editor.constants';
import {
  usePageStore,
  useSettingsStore,
  useWorkspaceStore,
  editorCommandBus,
  workspaceCoordinator,
  sessionCoordinator,
  lruDocumentCache,
  syncShallowUrlParams,
} from '@/features/editor/core';
import { latexDagEngine } from '@/features/editor/domain/latex/latex-dag-engine';
import { latexSymbolsIndex } from '@/features/editor/domain/latex/latex-symbols-index';
import { navigationCoordinator } from '@/features/editor/subsystems/navigation';
import type { AssetInfo } from '@/features/editor/domain/types/asset.types';
import {
  pageQuery,
  filesQuery,
  deletedFilesQuery,
} from '@/features/editor/ui/hooks/document.queries';
import { usePageActions } from '@/features/editor/ui/hooks/usePageActions';
import type { EditorStorageItem as StorageItem } from '@/features/editor/domain/types/storage-item.types';
import { manuscriptService } from '@/features/editor/sdk/manuscript.service';
import { type LinkedFileDto } from '@/features/editor/sdk/manuscript/types';
import { StorageFileRow } from './subcomponents/FileTreeNodes';
import { UploadConflictDialog } from './modals/UploadConflictDialog';
import { FileOutlineSection } from './subcomponents/FileOutlineSection';
import { FileTreeToolbar } from './subcomponents/FileTreeToolbar';
import { TexFileRow, displayName } from './subcomponents/TexFileRow';
import { FileTreeFolderRow } from './subcomponents/FileTreeFolderRow';
import { useFileUpload } from './hooks/useFileUpload';
import { useFileTree } from './hooks/useFileTree';
import type { FileTreeNode } from '@/features/editor/subsystems/explorer/model/document-tree';
import { useFileExplorerActions } from './hooks/useFileExplorerActions';
import type { AddFilesTab } from '@/features/editor/subsystems/explorer/ui/modals/add-files.types';
import { DeleteFileDialog } from './modals/DeleteFileDialog';
import { FileTreeContainer } from './FileTreeContainer';

const AddFilesModal = dynamic(
  () => import('@/features/editor/subsystems/explorer/ui/modals/AddFilesModal'),
  { ssr: false },
);

const sanitizeTitle = (raw: string) => {
  const trimmed = raw.trim();
  if (/\.[a-z]+$/i.test(trimmed)) return trimmed;
  return trimmed.replace(/\.$/, '');
};

const EMPTY_LINKED_FILES: LinkedFileDto[] = [];

// ── Main FilesTab ───────────────────────────────────────────────────────────

const FilesTab = React.memo(function FilesTab({ onClose }: { onClose?: () => void }) {
  const { pageId, projectId: routeProjectId } = useParams<{ pageId?: string; projectId?: string }>();
  const searchParams = useSearchParams();
  const fileParam = searchParams.get('file');
  const setSearchParams = useCallback(
    (newParams: Record<string, string>) => {
      syncShallowUrlParams(newParams);
    },
    [],
  );

  const currentPageId = usePageStore((s) => s.currentPage?.id);
  const currentPageTitle = usePageStore((s) => s.currentPage?.title);
  const currentPageProjectId = usePageStore((s) => extractProjectId(s.currentPage));
  const storeParentPageId = usePageStore((s) => s.parentPageId);
  const activeFileId = usePageStore((s) => s.activeFilePage?.id);
  const activeFileTitle = usePageStore((s) => s.activeFilePage?.title);
  const setSelectedAsset = usePageStore((s) => s.setSelectedAsset);
  const setMainFile = useSettingsStore((s) => s.setMainFile);
  const configuredMainFile = useSettingsStore((s) => s.mainFile);
  const openTab = useWorkspaceStore((s) => s.openTab);

  const parentPageId: string | null = pageId || storeParentPageId || currentPageId || null;

  const { data: parentPage } = useQuery({
    ...pageQuery(parentPageId ?? ''),
    enabled: !!parentPageId,
  });

  const projectId =
    routeProjectId ||
    extractProjectId(parentPage) ||
    currentPageProjectId ||
    '';

  const activeTabId = useWorkspaceStore((s) =>
    (parentPageId ? s.activeByProject[parentPageId] : null) ||
    (projectId ? s.activeByProject[projectId] : null) ||
    null
  );
  const { engine } = useEditorInstance();

  const [isFileTreeOpen, setIsFileTreeOpen] = useState(true);
  const [isAddFilesModalOpen, setIsAddFilesModalOpen] = useState(false);
  const [addFilesTab, setAddFilesTab] = useState<AddFilesTab>('new-file');

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [fileFilter, setFileFilter] = useState('');
  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [fileToDelete, setFileToDelete] = useState<{ id: string; title: string } | null>(null);

  const mainFileId =
    parentPage?.mainFile && typeof parentPage.mainFile === 'object'
      ? parentPage.mainFile.id
      : ((parentPage?.mainFile as string | null | undefined) ?? null);

  const {
    data: files,
    isLoading,
    isError: isFilesError,
    error: filesError,
  } = useQuery({
    ...filesQuery(parentPageId ?? ''),
    enabled: !!parentPageId,
  });

  const {
    createFile: createFileMutation,
    setMainFile: setMainFileMutation,
    deletePage: deletePageMutation,
    updateTitle: updateTitleMutation,
    updateContent: updateContentMutation,
  } = usePageActions();

  const {
    items: projectFiles,
    isLoading: projectFilesLoading,
    uploadFile,
    createFolder,
    moveItem,
  } = useEditorStorage(parentPageId || null, undefined, projectId || null);

  const queryClient = useQueryClient();

  const handleMoveItem = useCallback(
    (itemId: string, targetFolderId: string | null) => {
      moveItem.mutate(
        { itemId, targetFolderId },
        {
          onSuccess: () => {
            if (parentPageId) {
              queryClient.invalidateQueries({ queryKey: filesQuery(parentPageId).queryKey });
            }
            queryClient.invalidateQueries({ queryKey: ['editor-storage-files'] });
            editorCommandBus.dispatch({ type: 'filetree:updated' });
          },
        },
      );
    },
    [moveItem, queryClient, parentPageId],
  );

  // Listen for real-time WebSocket file-tree mutations from collaborating peers
  useEffect(() => {
    const handleFileTreeUpdated = () => {
      if (parentPageId) {
        queryClient.invalidateQueries({ queryKey: filesQuery(parentPageId).queryKey });
        queryClient.invalidateQueries({ queryKey: deletedFilesQuery(parentPageId).queryKey });
      }
    };

    return editorCommandBus.subscribe('filetree:updated', handleFileTreeUpdated);
  }, [queryClient, parentPageId]);

  // Query external linked files (Zotero, Mendeley, remote URL)
  const { data: linkedFilesData } = useQuery<LinkedFileDto[]>({
    queryKey: ['project-linked-files', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      try {
        return await manuscriptService.linkedFiles.list(projectId);
      } catch {
        return [];
      }
    },
    enabled: Boolean(projectId),
  });

  const linkedFiles = linkedFilesData ?? EMPTY_LINKED_FILES;

  const linkedFileMap = useMemo(() => {
    const map = new Map<string, LinkedFileDto>();
    linkedFiles.forEach((lf) => {
      if (lf.name) map.set(lf.name.toLowerCase(), lf);
      if (lf.targetBibFile) map.set(lf.targetBibFile.toLowerCase(), lf);
    });
    return map;
  }, [linkedFiles]);

  const {
    downloadTex,
    copyTexCommand,
    refreshLinkedFile,
    deleteLinkedFile,
    refreshAllLinkedFiles,
    insertAsset,
    handleRenameSubmit,
  } = useFileExplorerActions({
    projectId,
    parentPageId,
    engine,
  });

  // Hook extracting all upload orchestration, zip extraction, drag-drop
  const {
    combinedUploadRef,
    folderUploadRef,
    uploadingCount,
    uploadDialogOpen,
    setUploadDialogOpen,
    pendingUploads,
    setPendingUploads,
    isDragging,
    handleFilePicked,
    handleFolderPicked,
    handleAddFilesPick,
    handleDrop,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleConfirmUpload,
    handleUploadToFolder,
  } = useFileUpload({
    parentPageId,
    projectId,
    parentPage,
    files,
    projectFiles,
    createFileMutation,
    uploadFile,
    createFolder,
    updateContentMutation,
    setSearchParams,
  });

  // Pure hierarchical tree builder hook
  const {
    treeItems,
    displayTree,
    toggleFolder,
    isFolderExpanded,
    collapseAll,
  } = useFileTree({
    projectFiles,
    files,
    parentPage,
    projectId,
    parentPageId,
    mainFileId,
    configuredMainFile,
    fileFilter,
  });



  const handleOpenPreview = useCallback(
    (item: StorageItem) => {
      const assetTabId = item.id.startsWith('asset:') ? item.id : `asset:${item.id}`;
      const asset: AssetInfo = {
        id: item.id,
        filename: item.filename,
        url: item.url,
        mimeType: item.mimeType,
        size: item.size,
      };
      setSelectedAsset(asset);
      if (parentPageId)
        openTab(parentPageId, {
          id: assetTabId,
          title: item.filename,
          path: item.filename,
          isDirty: false,
          isPinned: false,
        });
      setSearchParams({ file: assetTabId });
    },
    [parentPageId, openTab, setSearchParams, setSelectedAsset],
  );

  const handleFileClick = useCallback(
    (fileId: string, title: string) => {
      const layoutStore = useWorkspaceStore.getState();
      if (layoutStore.editorSplitMode !== 'none' && layoutStore.activeEditorPane === 'secondary') {
        layoutStore.setSecondaryFileId(fileId);
        return;
      }

      const isTargetMain =
        fileId === pageId ||
        fileId === parentPageId ||
        fileId === mainFileId ||
        (configuredMainFile && (title.toLowerCase() === configuredMainFile.toLowerCase() || displayName(title).toLowerCase() === configuredMainFile.toLowerCase()));
      const currentParam = fileParam;
      if (isTargetMain && !currentParam) return;
      if (!isTargetMain && fileId === currentParam) return;

      navigationCoordinator.openDocument({
        fileId,
        title,
      });
    },
    [fileParam, pageId, parentPageId, mainFileId, configuredMainFile],
  );

  const handleStartCreateFolder = useCallback(() => {
    setIsCreatingFolder(true);
    setNewFolderName('');
  }, []);

  const handleCancelCreate = useCallback(() => {
    setIsCreatingFile(false);
    setNewFileName('');
  }, []);

  const handleCancelCreateFolder = useCallback(() => {
    setIsCreatingFolder(false);
    setNewFolderName('');
  }, []);

  const handleOpenFileModal = useCallback(() => {
    setAddFilesTab('new-file');
    setIsAddFilesModalOpen(true);
  }, []);

  const handleOpenUploadModal = useCallback(() => {
    setAddFilesTab('upload');
    setIsAddFilesModalOpen(true);
  }, []);

  useEffect(() => {
    const unsubCmd = editorCommandBus.subscribe('dialog:open', (cmd) => {
      if (cmd.dialog === 'add-files') {
        setIsFileTreeOpen(true);
        if (cmd.payload?.initialTab) {
          setAddFilesTab(cmd.payload.initialTab as AddFilesTab);
        }
        setIsAddFilesModalOpen(true);
      } else if (cmd.dialog === 'new-file') {
        setIsFileTreeOpen(true);
        setAddFilesTab('new-file');
        setIsAddFilesModalOpen(true);
      } else if (cmd.dialog === 'new-folder') {
        setIsFileTreeOpen(true);
        handleStartCreateFolder();
      } else if (cmd.dialog === 'upload-file') {
        setIsFileTreeOpen(true);
        setAddFilesTab('upload');
        setIsAddFilesModalOpen(true);
      }
    });
    return () => {
      unsubCmd();
    };
  }, [handleStartCreateFolder]);

  const handleCreateFile = useCallback(() => {
    const title = sanitizeTitle(newFileName);
    const parsed = createFileSchema.safeParse({ title });
    if (!parentPageId || !parsed.success) return;
    createFileMutation.mutate(
      { parentPageId, title: parsed.data.title },
      {
        onSuccess: (file: { id: string }) => {
          setIsCreatingFile(false);
          setNewFileName('');
          queryClient.invalidateQueries({ queryKey: filesQuery(parentPageId).queryKey });
          navigationCoordinator.openDocument({
            fileId: file.id,
            title: parsed.data.title,
            content: '',
          });
          setSearchParams({ file: file.id });
        },
      },
    );
  }, [newFileName, parentPageId, createFileMutation, queryClient, setSearchParams]);

  const handleCreateFolder = useCallback(() => {
    const name = newFolderName.trim();
    const parsed = createFolderSchema.safeParse({ name });
    if (!parentPageId || !parsed.success) return;
    const effectiveProjectId = projectId || parentPageId;
    createFolder.mutate(
      { name: parsed.data.name, projectId: effectiveProjectId, pageId: parentPageId },
      {
        onSuccess: () => {
          setIsCreatingFolder(false);
          setNewFolderName('');
        },
      },
    );
  }, [newFolderName, parentPageId, projectId, createFolder]);

  const handleStartRename = useCallback((file: { id: string; title: string }) => {
    setRenamingId(file.id);
    setRenameValue(file.title);
  }, []);

  const handleCommitRename = useCallback(
    (fileId: string) => {
      const title = sanitizeTitle(renameValue);
      const parsed = renameItemSchema.safeParse({ name: title });
      if (!parsed.success) {
        setRenamingId(null);
        return;
      }
      const oldTitle = files?.find((f) => f.id === fileId)?.title ?? '';
      void handleRenameSubmit(fileId, parsed.data.name, oldTitle).finally(() => {
        setRenamingId(null);
      });
    },
    [renameValue, files, handleRenameSubmit, updateTitleMutation],
  );

  const handleDelete = useCallback(
    (fileId: string) => {
      const target =
        files?.find((f) => f.id === fileId) ||
        (fileId === parentPageId || fileId === mainFileId ? { id: fileId, title: 'main.tex' } : null);
      setFileToDelete(target || { id: fileId, title: 'document.tex' });
    },
    [files, parentPageId, mainFileId],
  );

  const handleConfirmDelete = useCallback(() => {
    if (!fileToDelete || !parentPageId) return;
    const targetId = fileToDelete.id;

    deletePageMutation.mutate(targetId, {
      onSuccess: () => {
        sessionCoordinator.evictDeletedFile(targetId);
        const wsStore = useWorkspaceStore.getState();
        if (wsStore.secondaryFileId === targetId) {
          wsStore.setSecondaryFileId(null);
        }
        lruDocumentCache.evictModel(targetId);
        latexDagEngine.removeFileNode(targetId);
        latexSymbolsIndex.removeFile(targetId);
        navigationCoordinator.closeDocument(targetId);
        setFileToDelete(null);
      },
    });
  }, [fileToDelete, parentPageId, deletePageMutation]);

  const handleSetMain = useCallback(
    (fileId: string) => {
      if (!parentPageId) return;
      const targetFile =
        files?.find((f) => f.id === fileId) ||
        (fileId === parentPageId ? parentPage : null);
      if (targetFile) {
        const rawTitle = targetFile.title || 'main.tex';
        const fileName = rawTitle.endsWith('.tex')
          ? rawTitle
          : `${rawTitle}.tex`;
        setMainFile(fileName);
      }
      const effectiveProjectId = projectId || parentPageId;
      setMainFileMutation.mutate({ pageId: parentPageId, fileId, projectId: effectiveProjectId });
    },
    [parentPageId, files, parentPage, setMainFile, projectId, setMainFileMutation],
  );

  const renderTreeNode = useCallback(
    (node: FileTreeNode, depth = 0): React.ReactNode => {
      if (node.type === 'folder') {
        return (
          <FileTreeFolderRow
            key={node.id}
            node={node}
            depth={depth}
            isExpanded={isFolderExpanded(node)}
            onToggle={toggleFolder}
            onMoveItem={handleMoveItem}
            onNewFileInFolder={(folderName) => {
              setNewFileName(`${folderName}/`);
              setIsCreatingFile(true);
            }}
            onUploadToFolder={(folderId) => {
              handleUploadToFolder([], folderId);
            }}
          >
            {node.children.map((child) => renderTreeNode(child, depth + 1))}
          </FileTreeFolderRow>
        );
      }

      // Storage asset
      if (node.kind === 'asset') {
        const storageItem: StorageItem = node.storageData || {
          id: node.id,
          filename: node.displayLabel,
          isFolder: false,
          size: 0,
        };
        return (
          <StorageFileRow
            key={node.id}
            item={storageItem}
            depth={depth}
            onInsertAsset={insertAsset}
            onPreview={handleOpenPreview}
            projectId={projectId}
          />
        );
      }

      // TeX file node
      const activeId = activeTabId || activeFileId || fileParam || pageId;
      const isMain = Boolean(
        mainFileId
          ? node.id === mainFileId
          : configuredMainFile
            ? node.displayLabel.toLowerCase() === configuredMainFile.toLowerCase() ||
              node.title.toLowerCase() === configuredMainFile.toLowerCase()
            : node.isRootDoc ||
              node.id === parentPageId ||
              node.id === `${parentPageId}-main` ||
              node.displayLabel.toLowerCase() === 'main.tex'
      );
      const isActive =
        node.id === activeId ||
        node.title === activeId ||
        (activeId === pageId && isMain);

      const linked =
        linkedFileMap.get(node.displayLabel.toLowerCase()) ||
        linkedFileMap.get(node.title.toLowerCase());

      return (
        <TexFileRow
          key={node.id}
          file={{ id: node.id, title: node.title, updatedAt: node.updatedAt }}
          depth={depth}
          displayLabel={node.displayLabel}
          isActive={isActive}
          isMain={isMain}
          linkedFile={linked}
          onRefreshLinked={refreshLinkedFile}
          onDeleteLinked={deleteLinkedFile}
          isRenaming={renamingId === node.id}
          renameValue={renameValue}
          isRenamePending={updateTitleMutation.isPending}
          onFileClick={handleFileClick}
          onStartRename={handleStartRename}
          onRenameChange={setRenameValue}
          onCommitRename={handleCommitRename}
          onCancelRename={() => setRenamingId(null)}
          onDelete={handleDelete}
          onSetMain={handleSetMain}
          onDownload={downloadTex}
          onCopyCommand={copyTexCommand}
        />
      );
    },
    [
      isFolderExpanded,
      toggleFolder,
      handleMoveItem,
      handleUploadToFolder,
      insertAsset,
      handleOpenPreview,
      projectId,
      activeFileId,
      activeTabId,
      fileParam,
      pageId,
      mainFileId,
      configuredMainFile,
      parentPageId,
      linkedFileMap,
      refreshLinkedFile,
      deleteLinkedFile,
      renamingId,
      renameValue,
      updateTitleMutation.isPending,
      handleFileClick,
      handleStartRename,
      handleCommitRename,
      handleDelete,
      handleSetMain,
      downloadTex,
      copyTexCommand,
    ],
  );

  return (
    <>
      <div className="w-full h-full flex flex-col select-none text-sm">
        {/* Hidden upload inputs */}
        <input
          id="editor-combined-file-upload"
          name="combinedFileUpload"
          ref={combinedUploadRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFilePicked}
        />
        <input
          id="editor-folder-upload"
          name="folderUpload"
          ref={folderUploadRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFolderPicked}
          {...({ webkitdirectory: '', directory: '' } as React.InputHTMLAttributes<HTMLInputElement> & {
            webkitdirectory?: string;
            directory?: string;
          })}
        />

        {/* Header Toolbar */}
        <FileTreeToolbar
          isFileTreeOpen={isFileTreeOpen}
          onToggleFileTree={() => setIsFileTreeOpen((prev) => !prev)}
          onOpenFileModal={handleOpenFileModal}
          onStartCreateFolder={handleStartCreateFolder}
          onOpenUploadModal={handleOpenUploadModal}
          linkedFilesCount={linkedFiles.length}
          onRefreshAllLinkedFiles={refreshAllLinkedFiles}
          onClose={onClose}
        />

        {/* ── File tree ──────────────────────────────────────────────────────── */}
        {isFileTreeOpen && (
          <FileTreeContainer
            isDragging={isDragging}
            handleDragEnter={handleDragEnter}
            handleDragLeave={handleDragLeave}
            handleDragOver={handleDragOver}
            handleDrop={handleDrop}
            handleMoveItem={handleMoveItem}
            isCreatingFile={isCreatingFile}
            newFileName={newFileName}
            setNewFileName={setNewFileName}
            handleCreateFile={handleCreateFile}
            handleCancelCreate={handleCancelCreate}
            isCreateFilePending={createFileMutation.isPending}
            isCreatingFolder={isCreatingFolder}
            newFolderName={newFolderName}
            setNewFolderName={setNewFolderName}
            handleCreateFolder={handleCreateFolder}
            handleCancelCreateFolder={handleCancelCreateFolder}
            isCreateFolderPending={createFolder.isPending}
            isLoading={isLoading}
            projectFilesLoading={projectFilesLoading}
            uploadingCount={uploadingCount}
            isFilesError={isFilesError}
            filesError={filesError}
            treeItemsLength={treeItems.length}
            displayTree={displayTree}
            fileFilter={fileFilter}
            setFileFilter={setFileFilter}
            renderTreeNode={renderTreeNode}
          />
        )}

        {/* ── File Outline Accordion ────────────────────────────────────────── */}
        <FileOutlineSection
          isFileTreeOpen={isFileTreeOpen}
          activeFileName={
            activeFileTitle
              ? displayName(activeFileTitle)
              : currentPageTitle
                ? displayName(currentPageTitle)
                : (configuredMainFile || DEFAULT_MAIN_FILE)
          }
        />
      </div>

      <UploadConflictDialog
        open={uploadDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setUploadDialogOpen(false);
            setPendingUploads([]);
          }
        }}
        pendingUploads={pendingUploads}
        onRemoveItem={(i) =>
          setPendingUploads((prev) => prev.filter((_, j) => j !== i))
        }
        onSetResolution={(i, resolution) =>
          setPendingUploads((prev) =>
            prev.map((p, j) => (j === i ? { ...p, resolution } : p)),
          )
        }
        onToggleUnpackZip={(i, unpack) =>
          setPendingUploads((prev) =>
            prev.map((p, j) => (j === i ? { ...p, unpackZip: unpack } : p)),
          )
        }
        onCancel={() => {
          setUploadDialogOpen(false);
          setPendingUploads([]);
        }}
        onConfirm={handleConfirmUpload}
      />

      {isAddFilesModalOpen && (
        <AddFilesModal
          open={isAddFilesModalOpen}
          onOpenChange={setIsAddFilesModalOpen}
          defaultTab={addFilesTab}
          parentPageId={parentPageId}
          projectId={projectId}
          onPickItems={handleAddFilesPick}
        />
      )}

      {/* ── Delete File Confirmation Modal ── */}
      <DeleteFileDialog
        fileToDelete={fileToDelete}
        isPending={deletePageMutation.isPending}
        onClose={() => setFileToDelete(null)}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
});

export default FilesTab;
