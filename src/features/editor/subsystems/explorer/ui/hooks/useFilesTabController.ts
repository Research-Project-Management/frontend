/**
 * useFilesTabController.ts
 *
 * State, queries, mutations, inline create/rename/delete handlers, upload wiring,
 * and flattened virtual-tree computations for FilesTab.
 */

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useEditorStorage } from './useStorage';
import { useEditorInstance } from '@/features/editor/core/bus/use-editor-instance';
import {
  createFileSchema,
  createFolderSchema,
  renameItemSchema,
  extractProjectId,
  type Page,
} from '@/features/editor/domain/types/core.types';
import {
  splitVirtualPath,
  normalizeVirtualPath,
} from '@/features/editor/domain/document/document-naming';
import { syncShallowUrlParams } from '@/features/editor/domain/constants/editor.constants';
import { usePageStore } from '@/features/editor/core/store/editor.store';
import { useSettingsStore } from '@/features/editor/core/store/settings.store';
import { useWorkspaceStore } from '@/features/editor/core/store/workspace.store';
import { editorCommandBus } from '@/features/editor/core/bus/command-bus';
import { navigationCoordinator } from '@/features/editor/subsystems/navigation/coordinator/navigation.coordinator';
import type { AssetInfo } from '@/features/editor/domain/types/asset.types';
import {
  pageQuery,
  filesQuery,
  invalidateFileTreeQueries,
} from '@/features/editor/core/queries/document.queries';
import { usePageActions } from '@/features/editor/core/queries/usePageActions';
import type { EditorStorageItem as StorageItem } from '@/features/editor/domain/types/storage-item.types';
import { displayName } from '../subcomponents/TexFileRow';
import { useFileUpload } from './useFileUpload';
import { useFileTree } from './useFileTree';
import {
  flattenVisibleTree,
  findAncestorFolderPaths,
} from '@/features/editor/subsystems/explorer/model/document-tree';
import { useFileExplorerActions } from './useFileExplorerActions';
import type { AddFilesTab } from '@/features/editor/subsystems/explorer/ui/modals/add-files.types';

const FILE_EXTENSION_REGEX = /\.[a-z]+$/i;
const VALID_MAIN_TEX_EXT_REGEX = /\.(tex|ltx|rtex|rnw)$/i;
const TRAILING_DOT_REGEX = /\.$/;

export const sanitizeTitle = (raw: string) => {
  const trimmed = raw.trim();
  if (FILE_EXTENSION_REGEX.test(trimmed)) return trimmed;
  return trimmed.replace(TRAILING_DOT_REGEX, '');
};

export function resolveExplorerItemById(
  fileId: string,
  files?: Array<{ id: string; title: string }> | null,
  projectFiles?: StorageItem[] | null,
  parentPage?: { id: string; title?: string } | null,
  parentPageId?: string | null,
  mainFileId?: string | null,
): { id: string; title: string; isFolder?: boolean } | null {
  const matchedDoc = files?.find((f) => f.id === fileId);
  if (matchedDoc) {
    return { id: matchedDoc.id, title: matchedDoc.title };
  }
  const matchedStorage = projectFiles?.find(
    (pf) => pf.id === fileId || pf.docId === fileId || pf.fileId === fileId,
  );
  if (matchedStorage) {
    return {
      id: matchedStorage.id,
      title: matchedStorage.path || matchedStorage.filename,
      isFolder: matchedStorage.isFolder,
    };
  }
  if (fileId === parentPageId || fileId === mainFileId) {
    return {
      id: fileId,
      title: parentPage?.title || 'main.tex',
    };
  }
  return null;
}

export function useFilesTabController() {
  const { pageId, projectId: routeProjectId } = useParams<{ pageId?: string; projectId?: string }>();
  const searchParams = useSearchParams();
  const fileParam = searchParams.get('file');
  const setSearchParams = useCallback((newParams: Record<string, string>) => {
    syncShallowUrlParams(newParams);
  }, []);

  const storeCurrentPage = usePageStore((s) => s.currentPage);
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

  const { data: queriedParentPage } = useQuery({
    ...pageQuery(parentPageId ?? ''),
    enabled: Boolean(parentPageId && !storeCurrentPage),
  });
  const parentPage = queriedParentPage ?? (storeCurrentPage as Page | null);

  const projectId =
    routeProjectId ||
    extractProjectId(parentPage) ||
    currentPageProjectId ||
    '';

  const activeTabId = useWorkspaceStore(
    (s) =>
      (parentPageId ? s.activeByProject[parentPageId] : null) ||
      (projectId ? s.activeByProject[projectId] : null) ||
      null,
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
  const [createParentFolderPath, setCreateParentFolderPath] = useState<string | null>(null);
  const [newFileName, setNewFileName] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [fileToDelete, setFileToDelete] = useState<{
    id: string;
    title: string;
    isFolder?: boolean;
  } | null>(null);

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
    async (itemId: string, targetFolderId: string | null) => {
      moveItem.mutate({ itemId, targetFolderId });
    },
    [moveItem],
  );

  useEffect(() => {
    const handleFileTreeUpdated = () => {
      invalidateFileTreeQueries(queryClient, {
        parentPageId,
        includeRootDoc: true,
        includeProjects: false,
      });
    };

    return editorCommandBus.subscribe('filetree:updated', handleFileTreeUpdated);
  }, [queryClient, parentPageId]);

  const {
    downloadTex,
    copyTexCommand,
    insertAsset,
    handleRenameSubmit,
    isRenamePending,
  } = useFileExplorerActions({
    projectId,
    parentPageId,
    engine,
  });

  const uploadState = useFileUpload({
    parentPageId,
    projectId,
    parentPage,
    files,
    projectFiles,
    createFileMutation,
    uploadFile,
    updateContentMutation,
    setSearchParams,
  });

  const {
    treeItems,
    displayTree,
    toggleFolder,
    expandPaths,
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
      const assetTabId = item.id.startsWith('asset:') ? item.id : `asset:${item.id}`;
      const fullAssetPath = normalizeVirtualPath(item.path || item.filename) || item.filename;
      const asset: AssetInfo = {
        id: item.id,
        filename: item.filename,
        url: item.url,
        mimeType: item.mimeType,
        size: item.size,
      };
      setSelectedAsset(asset);
      const isPreviewMode = useSettingsStore.getState().previewEditorTabs;
      if (parentPageId)
        openTab(parentPageId, {
          id: assetTabId,
          title: item.filename,
          path: fullAssetPath,
          isDirty: false,
          isPreview: isPreviewMode,
          isPinned: !isPreviewMode,
        });
      setSearchParams({ file: assetTabId });
    },
    [parentPageId, openTab, setSearchParams, setSelectedAsset],
  );

  const handleFileClick = useCallback(
    (fileId: string, title: string) => {
      const layoutStore = useWorkspaceStore.getState();
      if (layoutStore.editorSplitMode !== 'none' && layoutStore.activeEditorPane === 'secondary') {
        if (parentPageId) {
          layoutStore.setSecondaryActiveTab(parentPageId, fileId);
        }
        layoutStore.pinTabForFile(fileId);
        layoutStore.setSecondaryFileId(fileId);
        return;
      }

      const isTargetMain =
        fileId === pageId ||
        fileId === parentPageId ||
        fileId === mainFileId ||
        (configuredMainFile &&
          (title.toLowerCase() === configuredMainFile.toLowerCase() ||
            displayName(title).toLowerCase() === configuredMainFile.toLowerCase()));
      const activeScopeId = parentPageId || pageId;
      const currentActive =
        (activeScopeId ? layoutStore.activeByProject[activeScopeId] : null) ?? fileParam;
      if (isTargetMain && !currentActive) return;
      if (fileId === currentActive) return;

      navigationCoordinator.openDocument({
        fileId,
        title,
        path: title,
        preview: useSettingsStore.getState().previewEditorTabs,
      });
    },
    [fileParam, pageId, parentPageId, mainFileId, configuredMainFile],
  );

  const handleFileDoubleClick = useCallback(
    (fileId: string, title: string) => {
      const layoutStore = useWorkspaceStore.getState();
      if (layoutStore.editorSplitMode !== 'none' && layoutStore.activeEditorPane === 'secondary') {
        if (parentPageId) {
          layoutStore.setSecondaryActiveTab(parentPageId, fileId);
        }
        layoutStore.pinTabForFile(fileId);
        layoutStore.setSecondaryFileId(fileId);
        return;
      }

      navigationCoordinator.openDocument({
        fileId,
        title,
        path: title,
        preview: false,
      });
      if (parentPageId) {
        layoutStore.pinTab(parentPageId, fileId);
      }
    },
    [parentPageId],
  );

  const handleStartCreateFolder = useCallback((initialPrefix = '') => {
    const cleanParent = normalizeVirtualPath(initialPrefix);
    setIsCreatingFile(false);
    setNewFileName('');
    setIsCreatingFolder(true);
    setNewFolderName('');
    setCreateParentFolderPath(cleanParent || null);
  }, []);

  const handleCancelCreate = useCallback(() => {
    setIsCreatingFile(false);
    setNewFileName('');
    setCreateParentFolderPath(null);
  }, []);

  const handleCancelCreateFolder = useCallback(() => {
    setIsCreatingFolder(false);
    setNewFolderName('');
    setCreateParentFolderPath(null);
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
    return editorCommandBus.subscribe('dialog:open', (cmd) => {
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
  }, [handleStartCreateFolder]);

  const handleCreateFile = useCallback(() => {
    const rawLeaf = normalizeVirtualPath(sanitizeTitle(newFileName));
    const fullTitle =
      createParentFolderPath && rawLeaf && !rawLeaf.startsWith(`${createParentFolderPath}/`)
        ? `${createParentFolderPath}/${rawLeaf}`
        : rawLeaf;
    const parsed = createFileSchema.safeParse({ title: fullTitle });
    if (!parentPageId || !parsed.success) return;
    createFileMutation.mutate(
      { parentPageId, title: parsed.data.title },
      {
        onSuccess: (file: { id: string }) => {
          handleCancelCreate();
          navigationCoordinator.openDocument({
            fileId: file.id,
            title: parsed.data.title,
            content: '',
          });
        },
      },
    );
  }, [newFileName, createParentFolderPath, parentPageId, createFileMutation, handleCancelCreate]);

  const handleCreateFolder = useCallback(() => {
    const rawLeaf = normalizeVirtualPath(newFolderName);
    const fullFolderName =
      createParentFolderPath && rawLeaf && !rawLeaf.startsWith(`${createParentFolderPath}/`)
        ? `${createParentFolderPath}/${rawLeaf}`
        : rawLeaf;
    const parsed = createFolderSchema.safeParse({ name: fullFolderName });
    if (!parentPageId || !parsed.success) return;
    const effectiveProjectId = projectId || parentPageId;
    createFolder.mutate(
      { name: parsed.data.name, projectId: effectiveProjectId, pageId: parentPageId },
      { onSuccess: handleCancelCreateFolder },
    );
  }, [
    newFolderName,
    createParentFolderPath,
    parentPageId,
    projectId,
    createFolder,
    handleCancelCreateFolder,
  ]);

  const handleStartRename = useCallback(
    (file: { id: string; title: string; isFolder?: boolean }) => {
      setRenamingId(file.id);
      const { leafName } = splitVirtualPath(file.title);
      setRenameValue(leafName || file.title);
    },
    [],
  );

  const handleCommitRename = useCallback(
    (fileId: string) => {
      const title = sanitizeTitle(renameValue);
      const parsed = renameItemSchema.safeParse({ name: title });
      if (!parsed.success) {
        setRenamingId(null);
        return;
      }
      const existing = resolveExplorerItemById(
        fileId,
        files,
        projectFiles,
        parentPage,
        parentPageId,
        mainFileId,
      );
      void handleRenameSubmit(fileId, parsed.data.name, existing?.title ?? '').finally(() => {
        setRenamingId(null);
      });
    },
    [renameValue, files, projectFiles, parentPage, parentPageId, mainFileId, handleRenameSubmit],
  );

  const handleDelete = useCallback(
    (fileId: string) => {
      const target = resolveExplorerItemById(
        fileId,
        files,
        projectFiles,
        parentPage,
        parentPageId,
        mainFileId,
      );
      setFileToDelete(target ?? { id: fileId, title: 'document.tex' });
    },
    [files, projectFiles, parentPage, parentPageId, mainFileId],
  );

  const handleConfirmDelete = useCallback(() => {
    if (!fileToDelete || !parentPageId) return;
    deletePageMutation.mutate(fileToDelete.id, {
      onSuccess: () => {
        setFileToDelete(null);
      },
    });
  }, [fileToDelete, parentPageId, deletePageMutation]);

  const handleSetMain = useCallback(
    (fileId: string) => {
      if (!parentPageId) return;
      const targetFile = resolveExplorerItemById(
        fileId,
        files,
        projectFiles,
        parentPage,
        parentPageId,
        mainFileId,
      );
      const effectiveProjectId = projectId || parentPageId;
      if (targetFile) {
        const cleanTitle = normalizeVirtualPath(targetFile.title) || 'main.tex';
        if (!VALID_MAIN_TEX_EXT_REGEX.test(cleanTitle)) return;
        const prevMainFile = useSettingsStore.getState().mainFile;
        setMainFile(cleanTitle);
        setMainFileMutation.mutate(
          { pageId: parentPageId, fileId, projectId: effectiveProjectId },
          { onError: () => setMainFile(prevMainFile) },
        );
        return;
      }
      setMainFileMutation.mutate({ pageId: parentPageId, fileId, projectId: effectiveProjectId });
    },
    [parentPageId, files, projectFiles, parentPage, mainFileId, setMainFile, projectId, setMainFileMutation],
  );

  const effectiveActiveId = activeTabId || activeFileId || fileParam || pageId || null;
  const lastRevealedTargetRef = useRef<string | null>(null);

  useEffect(() => {
    if (!effectiveActiveId || treeItems.length === 0) return;
    if (lastRevealedTargetRef.current === effectiveActiveId) return;
    lastRevealedTargetRef.current = effectiveActiveId;
    const ancestors = findAncestorFolderPaths(treeItems, effectiveActiveId);
    if (ancestors.length > 0) {
      expandPaths(ancestors);
    }
  }, [effectiveActiveId, treeItems, expandPaths]);

  const flattenedTree = useMemo(() => {
    const base = flattenVisibleTree(displayTree, isFolderExpanded);
    if ((isCreatingFile || isCreatingFolder) && createParentFolderPath) {
      const parentIdx = base.findIndex(
        (item) =>
          item.node.type === 'folder' &&
          normalizeVirtualPath(item.node.fullPath || item.node.path || item.node.name) ===
            createParentFolderPath,
      );
      if (parentIdx !== -1) {
        const next = [...base];
        next.splice(parentIdx + 1, 0, {
          node: {
            type: 'file',
            id: '__inline_tree_create__',
            title: '__inline_tree_create__',
            displayLabel: '',
            kind: 'tex',
          },
          depth: base[parentIdx].depth + 1,
          inlineCreateKind: isCreatingFile ? 'file' : 'folder',
        });
        return next;
      }
    }
    return base;
  }, [displayTree, isFolderExpanded, isCreatingFile, isCreatingFolder, createParentFolderPath]);

  const inlineCreateFlatIndex = useMemo(
    () => flattenedTree.findIndex((item) => item.inlineCreateKind !== undefined),
    [flattenedTree],
  );

  const activeFlatIndex = useMemo(() => {
    if (!effectiveActiveId) return -1;
    const stripped = effectiveActiveId.startsWith('asset:')
      ? effectiveActiveId.slice('asset:'.length)
      : effectiveActiveId;
    return flattenedTree.findIndex(
      (item) =>
        !item.inlineCreateKind &&
        item.node.type === 'file' &&
        (item.node.id === effectiveActiveId ||
          item.node.id === stripped ||
          item.node.fileId === stripped ||
          item.node.docId === stripped ||
          item.node.title === effectiveActiveId ||
          (effectiveActiveId === pageId && Boolean(item.node.isRootDoc))),
    );
  }, [flattenedTree, effectiveActiveId, pageId]);

  const activeOutlineFileName = activeFileTitle
    ? displayName(activeFileTitle)
    : currentPageTitle
      ? displayName(currentPageTitle)
      : null;

  return {
    pageId,
    parentPageId,
    projectId,
    activeTabId,
    activeFileId,
    fileParam,
    configuredMainFile,
    activeOutlineFileName,
    isFileTreeOpen,
    setIsFileTreeOpen,
    isAddFilesModalOpen,
    setIsAddFilesModalOpen,
    addFilesTab,
    renamingId,
    setRenamingId,
    renameValue,
    setRenameValue,
    fileFilter,
    setFileFilter,
    isCreatingFile,
    setIsCreatingFile,
    isCreatingFolder,
    setIsCreatingFolder,
    setCreateParentFolderPath,
    newFileName,
    setNewFileName,
    newFolderName,
    setNewFolderName,
    fileToDelete,
    setFileToDelete,
    isLoading,
    isFilesError,
    filesError,
    projectFilesLoading,
    isCreateFilePending: createFileMutation.isPending,
    isCreateFolderPending: createFolder.isPending,
    isDeletePending: deletePageMutation.isPending,
    treeItems,
    displayTree,
    toggleFolder,
    expandPaths,
    isFolderExpanded,
    flattenedTree,
    inlineCreateFlatIndex,
    activeFlatIndex,
    downloadTex,
    copyTexCommand,
    insertAsset,
    isRenamePending,
    handleMoveItem,
    handleOpenPreview,
    handleFileClick,
    handleFileDoubleClick,
    handleStartCreateFolder,
    handleCancelCreate,
    handleCancelCreateFolder,
    handleOpenFileModal,
    handleOpenUploadModal,
    handleCreateFile,
    handleCreateFolder,
    handleStartRename,
    handleCommitRename,
    handleDelete,
    handleConfirmDelete,
    handleSetMain,
    ...uploadState,
  };
}
