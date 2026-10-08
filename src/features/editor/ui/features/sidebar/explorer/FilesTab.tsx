'use client';

/**
 * FilesTab.tsx
 *
 * Canonical Files & Explorer sidebar component:
 * - Tree building extracted to `tree-builder.util.ts` & `useFileTree.ts`
 * - Folder row rendering extracted to `FileTreeFolderRow.tsx`
 * - File actions extracted to `file-actions.util.ts`
 * - Drag-drop & upload orchestration extracted to `useFileUpload.ts`
 *
 * Location: `features/editor/ui/features/sidebar/explorer/FilesTab.tsx`
 */

import React, {
  useRef,
  useState,
  useCallback,
  useEffect,
  useMemo,
} from 'react';
import { useParams, useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FileCode2,
  Folder,
  Loader2,
  Upload,
} from 'lucide-react';
import dynamic from 'next/dynamic';

import { useEditorStorage } from '@/features/editor/ui/hooks/use-storage';
import { useEditorInstance } from '@/features/editor/ui/hooks/use-editor-instance';
import {
  createFileSchema,
  createFolderSchema,
  renameItemSchema,
} from '@/features/editor/domain/types/schemas';
import {
  usePageStore,
  useTabsStore,
  useSettingsStore,
  type AssetInfo,
} from '@/features/editor/store';
import {
  pageQuery,
  filesQuery,
  deletedFilesQuery,
  usePageActions,
  useFileActions,
} from '@/features/editor/ui/hooks/use-core';
import { editorCommandBus } from '@/features/editor/coordinators/command-bus';
import { workspaceCoordinator } from '@/features/editor/coordinators/workspace.coordinator';
import type { EditorStorageItem as StorageItem } from '@/features/editor/coordinators/services/storage.service';
import { manuscriptService, type LinkedFileDto } from '@/features/editor/coordinators/services/manuscript.service';
import {
  PlaneEmptyState,
  PlaneErrorState,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/shared/components/ui';

import {
  InlineInput,
  StorageFileRow,
} from './FileTreeNodes';
import { UploadConflictDialog } from './UploadConflictDialog';
import { FileOutlineSection } from './FileOutlineSection';
import { FileTreeToolbar } from './FileTreeToolbar';
import { TexFileRow, displayName } from './TexFileRow';
import { FileTreeFolderRow } from './FileTreeFolderRow';
import { useFileUpload } from './useFileUpload';
import { useFileTree } from './useFileTree';
import type { FileTreeNode } from './tree-builder.util';
import { useFileExplorerActions } from './useFileExplorerActions';
import type { AddFilesTab } from '@/features/editor/ui/modals/AddFilesModal';

const AddFilesModal = dynamic(
  () => import('@/features/editor/ui/modals/AddFilesModal'),
  { ssr: false },
);

const sanitizeTitle = (raw: string) => {
  const trimmed = raw.trim();
  if (/\.[a-z]+$/i.test(trimmed)) return trimmed;
  return trimmed.replace(/\.$/, '');
};

// ── Main FilesTab ───────────────────────────────────────────────────────────

const FilesTab = React.memo(function FilesTab({ onClose }: { onClose?: () => void }) {
  const { pageId } = useParams<{ pageId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const setSearchParams = useCallback(
    (newParams: Record<string, string>) => {
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        Object.entries(newParams).forEach(([k, v]) => {
          if (!v) url.searchParams.delete(k);
          else url.searchParams.set(k, v);
        });
        window.history.replaceState(window.history.state, '', url.pathname + url.search);
      }
    },
    [],
  );

  const currentPage = usePageStore((s) => s.currentPage);
  const activeFilePage = usePageStore((s) => s.activeFilePage);
  const setTexFiles = usePageStore((s) => s.setTexFiles);
  const setSelectedAsset = usePageStore((s) => s.setSelectedAsset);
  const setMainFile = useSettingsStore((s) => s.setMainFile);
  const configuredMainFile = useSettingsStore((s) => s.mainFile);
  const openTab = useTabsStore((s) => s.openTab);
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

  const newFileInputRef = useRef<HTMLInputElement>(null);
  const newFolderInputRef = useRef<HTMLInputElement>(null);

  const parentPageId: string | null = pageId ?? null;

  const { data: parentPage } = useQuery({
    ...pageQuery(parentPageId ?? ''),
    enabled: !!parentPageId,
  });

  const { data: deletedFilesList = [] } = useQuery({
    ...deletedFilesQuery(pageId),
    enabled: Boolean(pageId),
  });

  const projectId =
    (typeof parentPage?.projectId === 'string'
      ? parentPage.projectId
      : (parentPage?.projectId as any)?.id) ||
    (typeof currentPage?.projectId === 'string'
      ? currentPage.projectId
      : (currentPage?.projectId as any)?.id) ||
    '';

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

  useEffect(() => {
    if (!files && !parentPage) return;
    const allFiles: Array<{ id: string; title?: string; name?: string; content?: string }> = [];
    if (parentPage?.id) {
      const pageText = typeof parentPage.content === 'string'
        ? parentPage.content
        : (parentPage.content?.text || parentPage.content?.source || parentPage.content?.content || '');
      allFiles.push({
        id: parentPage.id,
        title: parentPage.title || 'main.tex',
        content: pageText,
      });
    }
    if (files && Array.isArray(files)) {
      for (const f of files) {
        allFiles.push(f as any);
      }
    }
    const names = allFiles.map((f) => f.title || f.name || 'untitled.tex');
    setTexFiles(names);
    workspaceCoordinator.initProjectSymbols(allFiles);
  }, [files, parentPage, setTexFiles]);

  const { createFile: createFileMutation, setMainFile: setMainFileMutation } = useFileActions();
  const {
    deletePage: deletePageMutation,
    updateTitle: updateTitleMutation,
    updateContent: updateContentMutation,
  } = usePageActions();

  const {
    files: projectFiles,
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
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('flux:filetree-updated'));
            }
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
        if (pageId) {
          queryClient.invalidateQueries({ queryKey: deletedFilesQuery(pageId).queryKey });
        }
      }
    };

    window.addEventListener('flux:filetree-updated', handleFileTreeUpdated);
    const unsubCmd = editorCommandBus.subscribe('filetree:updated', handleFileTreeUpdated);
    return () => {
      window.removeEventListener('flux:filetree-updated', handleFileTreeUpdated);
      unsubCmd();
    };
  }, [queryClient, parentPageId, pageId]);

  // Query external linked files (Zotero, Mendeley, remote URL)
  const { data: linkedFiles = [] } = useQuery<LinkedFileDto[]>({
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
    insertAsset,
  } = useFileExplorerActions({
    projectId,
    parentPageId,
    currentPage,
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
      const asset: AssetInfo = {
        id: item.id,
        filename: item.filename,
        url: item.url,
        mimeType: item.mimeType,
        size: item.size,
      };
      setSelectedAsset(asset);
      if (parentPageId)
        openTab(parentPageId, { id: item.id, title: item.filename, fileUrl: item.url });
      setSearchParams({ file: item.id });
    },
    [parentPageId, openTab, setSearchParams, setSelectedAsset],
  );

  const handleFileClick = useCallback(
    (fileId: string, title: string) => {
      const isTargetMain =
        fileId === pageId ||
        fileId === parentPageId ||
        fileId === mainFileId ||
        (configuredMainFile && (title.toLowerCase() === configuredMainFile.toLowerCase() || displayName(title).toLowerCase() === configuredMainFile.toLowerCase()));
      const currentParam = searchParams.get('file');
      if (isTargetMain && !currentParam) return;
      if (!isTargetMain && fileId === currentParam) return;

      if (parentPageId) {
        openTab(parentPageId, { id: fileId, title });
        useTabsStore.getState().setActive(parentPageId, fileId);
      }
      if (isTargetMain) {
        setSearchParams({ file: '' });
      } else {
        setSearchParams({ file: fileId });
      }
    },
    [searchParams, pageId, parentPageId, mainFileId, configuredMainFile, openTab, setSearchParams],
  );

  const handleStartCreateFolder = useCallback(() => {
    setIsCreatingFolder(true);
    setNewFolderName('');
    setTimeout(() => newFolderInputRef.current?.focus(), 0);
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
          setAddFilesTab(cmd.payload.initialTab);
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
        onSuccess: (file: any) => {
          setIsCreatingFile(false);
          setNewFileName('');
          queryClient.invalidateQueries({ queryKey: filesQuery(parentPageId).queryKey });
          setSearchParams({ file: file.id });
        },
      },
    );
  }, [newFileName, parentPageId, createFileMutation, queryClient, setSearchParams]);

  const handleCreateFolder = useCallback(() => {
    const name = newFolderName.trim();
    const parsed = createFolderSchema.safeParse({ name });
    if (!parentPageId || !projectId || !parsed.success) return;
    createFolder.mutate(
      { name: parsed.data.name, projectId, pageId: parentPageId },
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
      const oldTitle = files?.find((f: any) => f.id === fileId)?.title ?? '';
      updateTitleMutation.mutate(
        { pageId: fileId, title: parsed.data.name, oldTitle },
        { onSuccess: () => setRenamingId(null) },
      );
    },
    [renameValue, files, updateTitleMutation],
  );

  const closeTab = useTabsStore((s) => s.closeTab);

  const handleDelete = useCallback(
    (fileId: string) => {
      const target =
        files?.find((f: any) => f.id === fileId) ||
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
        closeTab(parentPageId, targetId, (nextId) => {
          if (nextId) {
            setSearchParams({ file: nextId });
          } else {
            setSearchParams({});
          }
        });
        setFileToDelete(null);
      },
    });
  }, [fileToDelete, parentPageId, deletePageMutation, closeTab, setSearchParams]);

  const handleSetMain = useCallback(
    (fileId: string) => {
      if (!parentPageId) return;
      const targetFile = files?.find((f: any) => f.id === fileId);
      if (targetFile) {
        const fileName = targetFile.title.endsWith('.tex')
          ? targetFile.title
          : `${targetFile.title}.tex`;
        setMainFile(fileName);
      }
      const effectiveProjectId = projectId || parentPageId;
      setMainFileMutation.mutate({ pageId: parentPageId, fileId, projectId: effectiveProjectId });
    },
    [parentPageId, files, setMainFile, projectId, setMainFileMutation],
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
      const activeId = activeFilePage?.id ?? (searchParams.get('file') || pageId);
      const isMain = Boolean(
        node.isRootDoc ||
        (mainFileId && node.id === mainFileId) ||
        (configuredMainFile && (node.displayLabel.toLowerCase() === configuredMainFile.toLowerCase() || node.title.toLowerCase() === configuredMainFile.toLowerCase())) ||
        (!mainFileId && !configuredMainFile && (node.id === parentPageId || node.id === `${parentPageId}-main`))
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
      activeFilePage,
      searchParams,
      pageId,
      mainFileId,
      configuredMainFile,
      parentPageId,
      linkedFileMap,
      refreshLinkedFile,
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
      <div className="w-full h-full flex flex-col select-none text-sm bg-transparent">
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
          {...({ webkitdirectory: '', directory: '' } as any)}
        />

        {/* Header Toolbar & Search Filter */}
        <FileTreeToolbar
          isFileTreeOpen={isFileTreeOpen}
          onToggleFileTree={() => setIsFileTreeOpen((prev) => !prev)}
          onOpenFileModal={handleOpenFileModal}
          onStartCreateFolder={handleStartCreateFolder}
          onOpenUploadModal={handleOpenUploadModal}
          onOpenDeletedFilesModal={() => {
            editorCommandBus.dispatch({ type: 'dialog:open', dialog: 'deleted-files' });
          }}
          deletedFilesCount={deletedFilesList.length}
          fileFilter={fileFilter}
          onFileFilterChange={setFileFilter}
          onClose={onClose}
        />

        {/* ── File tree ──────────────────────────────────────────────────────── */}
        {isFileTreeOpen && (
          <div
            className="relative min-h-0 flex-1 overflow-y-auto pl-2 pr-1 pb-3 thin-scrollbar"
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
                isPending={createFileMutation.isPending}
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
                isPending={createFolder.isPending}
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
                {treeItems.length > 0 && displayTree.length === 0 ? (
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
                ) : treeItems.length === 0 && !isCreatingFile && !isCreatingFolder ? (
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
        )}

        {/* ── File Outline Accordion ────────────────────────────────────────── */}
        <FileOutlineSection
          isFileTreeOpen={isFileTreeOpen}
          activeFileName={
            activeFilePage?.title
              ? displayName(activeFilePage.title)
              : currentPage?.title
                ? displayName(currentPage.title)
                : 'main.tex'
          }
          docContent={
            typeof currentPage?.content === 'string'
              ? currentPage.content
              : (currentPage?.content as any)?.source ||
                (currentPage?.content as any)?.text ||
                ''
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
      {fileToDelete && (
        <Dialog open={!!fileToDelete} onOpenChange={(open) => !open && setFileToDelete(null)}>
          <DialogContent className="sm:max-w-[400px] rounded-md p-5 gap-4">
            <DialogHeader className="pb-1">
              <DialogTitle className="text-sm font-semibold tracking-tight text-foreground">
                Delete file
              </DialogTitle>
              <DialogDescription className="text-xs text-foreground leading-relaxed pt-1">
                Are you sure you want to delete <span className="font-semibold text-foreground font-mono">{displayName(fileToDelete.title)}</span>? This file will be moved to Trash and can be restored at any time.
              </DialogDescription>
            </DialogHeader>

            <DialogFooter className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setFileToDelete(null)}
                disabled={deletePageMutation.isPending}
                className="h-8 text-xs cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleConfirmDelete}
                disabled={deletePageMutation.isPending}
                className="h-8 text-xs cursor-pointer"
              >
                {deletePageMutation.isPending ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none mr-1.5" />
                    Deleting...
                  </>
                ) : (
                  'Delete'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
});

export default FilesTab;
