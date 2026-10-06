'use client';

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
  FileText,
  Folder,
  FolderOpen,
  ChevronRight,
  Loader2,
  Search,
  Upload,
} from 'lucide-react';
import { DropdownMenuItem } from '@/shared/components/ui/dropdown-menu';
import { cn } from '@/shared/lib/utils';
import { useEditorStorage } from '@/features/editor/hooks/use-storage';
import { useEditorInstance } from '@/features/editor/core/context/editor-instance.context';
import {
  createFileSchema,
  createFolderSchema,
  renameItemSchema,
} from '@/features/editor/schemas';
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
} from '@/features/editor/hooks/use-core';
import { pageService } from '@/features/editor/services/core.service';
import { toast } from 'sonner';
import dynamic from 'next/dynamic';
import type { AddFilesTab } from '@/features/editor/components/modals/AddFilesModal';

const AddFilesModal = dynamic(
  () => import('@/features/editor/components/modals/AddFilesModal'),
  { ssr: false }
);

const DeletedFilesModal = dynamic(
  () => import('@/features/editor/components/modals/DeletedFilesModal'),
  { ssr: false }
);
import { EditorEventBus } from '@/features/editor/utils/editor.util';
import type { EditorStorageItem as StorageItem } from '@/features/editor/services/storage.service';
import { manuscriptService, type LinkedFileDto } from '@/features/editor/services/manuscript.service';

import {
  InlineInput,
  StorageFolderNode,
  StorageFileRow,
  IndentGuides,
  RowActions,
} from './FileTreeNodes';
import { UploadConflictDialog } from './UploadConflictDialog';
import { FileOutlineSection } from './FileOutlineSection';
import { FileTreeToolbar } from './FileTreeToolbar';
import { TexFileRow, displayName } from './TexFileRow';
import { useFileUpload } from './useFileUpload';
import { PlaneEmptyState, PlaneErrorState } from '@/shared/components/ui';

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
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(newParams).forEach(([k, v]) => {
        if (!v) params.delete(k);
        else params.set(k, v);
      });
      router.replace(`${pathname}?${params.toString()}`);
    },
    [searchParams, router, pathname],
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
  const [isDeletedFilesModalOpen, setIsDeletedFilesModalOpen] = useState(false);
  const [isAddFilesModalOpen, setIsAddFilesModalOpen] = useState(false);
  const [addFilesTab, setAddFilesTab] = useState<AddFilesTab>('new-file');

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [fileFilter, setFileFilter] = useState('');
  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [newFolderName, setNewFolderName] = useState('');

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
    if (!files) return;
    const names = files.map((f: any) => f.title);
    setTexFiles(names);
  }, [files, setTexFiles]);

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
    return () => {
      window.removeEventListener('flux:filetree-updated', handleFileTreeUpdated);
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

  const handleRefreshLinkedFile = useCallback(
    async (linkedFileId: string, fileName: string) => {
      if (!projectId) return;
      const toastId = toast.loading(`Refreshing ${fileName} from external source...`);
      try {
        await manuscriptService.linkedFiles.refresh(projectId, linkedFileId);
        if (parentPageId) {
          queryClient.invalidateQueries({ queryKey: filesQuery(parentPageId).queryKey });
        }
        queryClient.invalidateQueries({ queryKey: ['project-linked-files', projectId] });
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('flux:filetree-updated'));
        }
        toast.success(`Successfully refreshed ${fileName}`, { id: toastId });
      } catch (err: any) {
        toast.error(`Failed to refresh ${fileName}: ${err?.message || 'Network error'}`, { id: toastId });
      }
    },
    [projectId, parentPageId, queryClient],
  );

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
    handleUpload,
    handleFolderUpload: _handleFolderUpload,
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

      if (parentPageId) openTab(parentPageId, { id: fileId, title });
      if (isTargetMain) {
        setSearchParams({ file: '' });
      } else {
        setSearchParams({ file: fileId });
      }
    },
    [searchParams, pageId, parentPageId, mainFileId, configuredMainFile, openTab, setSearchParams],
  );

  const handleStartCreate = () => {
    setIsCreatingFile(true);
    setNewFileName('');
    setTimeout(() => newFileInputRef.current?.focus(), 0);
  };

  const handleStartCreateFolder = () => {
    setIsCreatingFolder(true);
    setNewFolderName('');
    setTimeout(() => newFolderInputRef.current?.focus(), 0);
  };

  const handleCancelCreate = () => {
    setIsCreatingFile(false);
    setNewFileName('');
  };

  const handleCancelCreateFolder = () => {
    setIsCreatingFolder(false);
    setNewFolderName('');
  };

  const handleOpenFileModal = () => {
    setAddFilesTab('new-file');
    setIsAddFilesModalOpen(true);
  };

  const handleOpenUploadModal = () => {
    setAddFilesTab('upload');
    setIsAddFilesModalOpen(true);
  };

  useEffect(() => {
    const unsubFile = EditorEventBus.on('flux:new-file', () => {
      setIsFileTreeOpen(true);
      handleOpenFileModal();
    });
    const unsubFolder = EditorEventBus.on('flux:new-folder', () => {
      setIsFileTreeOpen(true);
      handleStartCreateFolder();
    });
    const unsubUpload = EditorEventBus.on('flux:upload-file', () => {
      setIsFileTreeOpen(true);
      handleOpenUploadModal();
    });
    return () => {
      unsubFile();
      unsubFolder();
      unsubUpload();
    };
  }, []);

  const handleCreateFile = () => {
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
  };

  const handleCreateFolder = () => {
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
  };

  const handleStartRename = (file: { id: string; title: string }) => {
    setRenamingId(file.id);
    setRenameValue(file.title);
  };

  const handleCommitRename = (fileId: string) => {
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
  };

  const handleDelete = (fileId: string) => {
    if (!parentPageId) return;
    deletePageMutation.mutate(fileId, {
      onSuccess: () => {
        const activeFileId = searchParams.get('file') ?? pageId;
        if (fileId === activeFileId) setSearchParams({});
      },
    });
  };

  const handleSetMain = (fileId: string) => {
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
  };

  const handleInsertAsset = (name: string) => {
    if (!engine) return;
    const ext = name.split('.').pop()?.toLowerCase() ?? '';
    const snippet =
      ext === 'svg'
        ? `\\includesvg[width=\\linewidth]{${name}}`
        : `\\includegraphics[width=\\linewidth]{${name}}`;

    if (ext !== 'svg') {
      const src = engine.getContent();
      if (!/\\usepackage(?:\[.*?\])?\{graphicx\}/.test(src)) {
        const lines = src.split('\n');
        const beginDocIdx = lines.findIndex((l: string) => /\\begin\{document\}/.test(l));
        if (beginDocIdx >= 0) {
          lines.splice(beginDocIdx, 0, '\\usepackage{graphicx}');
          engine.setContent(lines.join('\n'));
        }
      }
    }

    engine.insertText(snippet);
    engine.focus();
  };

  const handleDownloadTex = useCallback(
    async (file: { id: string; title: string }) => {
      try {
        let rawContent: unknown = '';
        if (currentPage && currentPage.id === file.id && currentPage.content) {
          rawContent = currentPage.content;
        } else {
          const doc = await pageService.getById(file.id);
          rawContent = doc?.content ?? '';
        }
        const textContent =
          typeof rawContent === 'string'
            ? rawContent
            : (rawContent as any)?.source ||
              (rawContent as any)?.text ||
              (rawContent as any)?.content ||
              '';
        const blob = new Blob([textContent], { type: 'text/x-tex;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = displayName(file.title);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success(`Downloaded ${displayName(file.title)}`);
      } catch {
        toast.error('Failed to download file');
      }
    },
    [currentPage],
  );

  const handleCopyTexCommand = useCallback((title: string) => {
    const full = displayName(title);
    const base = full.replace(/\.[a-z0-9]+$/i, '');
    const ext = full.split('.').pop()?.toLowerCase();
    const snippet = ext === 'bib' ? `\\bibliography{${base}}` : `\\input{${base}}`;
    navigator.clipboard.writeText(snippet);
    toast.success(`Copied ${snippet} to clipboard`);
  }, []);

  // ── Hierarchical Tree Types ───────────────────────────────────────────────
  type FileTreeNode =
    | {
        type: 'folder';
        id: string;
        name: string;
        fullPath: string;
        children: FileTreeNode[];
        storageData?: StorageItem;
      }
    | {
        type: 'file';
        id: string;
        title: string;        // canonical title/path, e.g. "sections/01_abstract.tex"
        displayLabel: string; // clean leaf name, e.g. "01_abstract.tex"
        updatedAt?: string;
        kind: 'tex' | 'asset';
        isRootDoc?: boolean;
        storageData?: StorageItem;
      };

  const treeItems = useMemo<FileTreeNode[]>(() => {
    const rootFiles: Extract<FileTreeNode, { type: 'file' }>[] = [];
    const folderMap = new Map<
      string,
      {
        type: 'folder';
        id: string;
        name: string;
        fullPath: string;
        children: FileTreeNode[];
        storageData?: StorageItem;
      }
    >();

    // 1. Explicit storage folders from projectFiles
    projectFiles?.forEach((f: any) => {
      if (f.isFolder && f.id !== projectId && f.id !== parentPageId) {
        const name = (f.filename || '').trim();
        if (name && !folderMap.has(name)) {
          folderMap.set(name, {
            type: 'folder',
            id: f.id || `folder:${name}`,
            name,
            fullPath: name,
            children: [],
            storageData: f,
          });
        }
      }
    });

    const existingTexTitles = new Set<string>();

    // Helper to intelligently categorize flat research files into Overleaf standard folders
    const inferResearchFolder = (filename: string): string | null => {
      const lower = filename.toLowerCase();
      if (
        (configuredMainFile && lower === configuredMainFile.toLowerCase()) ||
        (parentPage?.title && lower === parentPage.title.toLowerCase()) ||
        lower === 'main.tex' ||
        lower === 'preamble.tex' ||
        lower === 'references.bib'
      ) {
        return null;
      }
      if (
        /^\d\d_/.test(lower) ||
        lower.includes('abstract') ||
        lower.includes('intro') ||
        lower.includes('related') ||
        lower.includes('prelim') ||
        lower.includes('method') ||
        lower.includes('theoret') ||
        lower.includes('experiment') ||
        lower.includes('ablation') ||
        lower.includes('discuss') ||
        lower.includes('conclu')
      ) {
        return 'sections';
      }
      if (lower.startsWith('table') || lower.includes('benchmark')) {
        return 'tables';
      }
      if (lower.startsWith('alg') || lower.includes('algorithm')) {
        return 'algorithms';
      }
      if (lower.startsWith('appendix') || lower.startsWith('app_')) {
        return 'appendices';
      }
      if (lower.startsWith('math_') || lower.startsWith('notation_') || lower.includes('macro')) {
        return 'macros';
      }
      if (lower.endsWith('.sty') || lower.endsWith('.cls') || lower.includes('style')) {
        return 'styles';
      }
      if (lower.startsWith('fig') || /\.(png|jpe?g|svg|webp|eps)$/i.test(lower)) {
        return 'figures';
      }
      if (lower.includes('slide') || lower.includes('defense') || lower.includes('beamer')) {
        return 'supplementary';
      }
      return null;
    };

    // 2. Process TeX files
    files?.forEach((f: any) => {
      const rawPath = (f.title || '').trim().replace(/\\/g, '/');
      if (!rawPath) return;
      existingTexTitles.add(rawPath.toLowerCase());

      const parts = rawPath.split('/').filter(Boolean);
      if (parts.length <= 1) {
        const rawFileName = displayName(parts[0] || f.title);
        const inferredFolder = inferResearchFolder(rawFileName);

        if (inferredFolder) {
          if (!folderMap.has(inferredFolder)) {
            folderMap.set(inferredFolder, {
              type: 'folder',
              id: `folder:${inferredFolder}`,
              name: inferredFolder,
              fullPath: inferredFolder,
              children: [],
            });
          }
          folderMap.get(inferredFolder)!.children.push({
            type: 'file',
            id: f.id,
            title: f.title,
            displayLabel: rawFileName,
            updatedAt: f.updatedAt,
            kind: 'tex',
            isRootDoc: Boolean(f.isRootDoc),
          });
        } else {
          rootFiles.push({
            type: 'file',
            id: f.id,
            title: f.title,
            displayLabel: rawFileName,
            updatedAt: f.updatedAt,
            kind: 'tex',
            isRootDoc: Boolean(f.isRootDoc),
          });
        }
      } else {
        const folderName = parts[0];
        if (!folderMap.has(folderName)) {
          folderMap.set(folderName, {
            type: 'folder',
            id: `folder:${folderName}`,
            name: folderName,
            fullPath: folderName,
            children: [],
          });
        }
        const leafName = parts.slice(1).join('/');
        folderMap.get(folderName)!.children.push({
          type: 'file',
          id: f.id,
          title: f.title,
          displayLabel: displayName(leafName),
          updatedAt: f.updatedAt,
          kind: 'tex',
          isRootDoc: Boolean(f.isRootDoc),
        });
      }
    });

    // Root TeX document (parentPage)
    const rawRootTitle = (parentPage?.title || '').trim();
    const resolvedRootTitle = rawRootTitle
      ? (rawRootTitle.toLowerCase().endsWith('.tex') ? rawRootTitle : `${rawRootTitle}.tex`)
      : (configuredMainFile || 'main.tex');

    const hasRootDocument =
      rootFiles.some(
        (rf) =>
          rf.type === 'file' &&
          (rf.id === parentPage?.id ||
            rf.id === mainFileId ||
            rf.displayLabel.toLowerCase() === resolvedRootTitle.toLowerCase())
      ) || existingTexTitles.has(resolvedRootTitle.toLowerCase());

    if (parentPage && !hasRootDocument) {
      rootFiles.unshift({
        type: 'file',
        id: parentPage.id,
        title: rawRootTitle || resolvedRootTitle,
        displayLabel: resolvedRootTitle,
        updatedAt: parentPage.updatedAt || new Date().toISOString(),
        kind: 'tex',
      });
    }

    // 3. Storage assets / files
    projectFiles?.forEach((f: any) => {
      if (f.isFolder) return;
      const fname = (f.filename || '').trim();
      if (
        !fname ||
        f.id === projectId ||
        f.id === parentPageId ||
        fname.toLowerCase() === 'flux' ||
        fname === '.keep' ||
        fname.startsWith('.')
      ) {
        return;
      }
      if (!fname.includes('.') && (!f.size || f.size === 0) && !f.url) {
        return;
      }
      if (existingTexTitles.has(fname.toLowerCase())) return;

      const rawPath = fname.replace(/\\/g, '/');
      const parts = rawPath.split('/').filter(Boolean);
      if (parts.length <= 1) {
        rootFiles.push({
          type: 'file',
          id: f.id,
          title: f.filename,
          displayLabel: parts[0],
          kind: 'asset',
          storageData: f,
        });
      } else {
        const folderName = parts[0];
        if (!folderMap.has(folderName)) {
          folderMap.set(folderName, {
            type: 'folder',
            id: `folder:${folderName}`,
            name: folderName,
            fullPath: folderName,
            children: [],
          });
        }
        folderMap.get(folderName)!.children.push({
          type: 'file',
          id: f.id,
          title: f.filename,
          displayLabel: parts.slice(1).join('/'),
          kind: 'asset',
          storageData: f,
        });
      }
    });

    // Sort root files: designated main document (1), preamble.tex (2), references.bib (3), others (10)
    const getRootFilePriority = (item: Extract<FileTreeNode, { type: 'file' }>) => {
      const lower = item.displayLabel.toLowerCase();
      if (
        item.id === mainFileId ||
        (configuredMainFile && lower === configuredMainFile.toLowerCase()) ||
        item.id === parentPageId
      ) {
        return 1;
      }
      if (lower === 'preamble.tex') return 2;
      if (lower === 'references.bib') return 3;
      return 10;
    };

    rootFiles.sort((a, b) => {
      const prioA = getRootFilePriority(a);
      const prioB = getRootFilePriority(b);
      if (prioA !== prioB) return prioA - prioB;
      return a.displayLabel.localeCompare(b.displayLabel, undefined, {
        numeric: true,
        sensitivity: 'base',
      });
    });

    // Sort folders in Overleaf research sequence
    const getFolderPriority = (folderName: string) => {
      const f = folderName.toLowerCase();
      if (f === 'sections' || f === 'chapters' || f === 'src') return 10;
      if (f === 'figures' || f === 'images' || f === 'plots') return 20;
      if (f === 'tables') return 30;
      if (f === 'algorithms') return 40;
      if (f.startsWith('appendi')) return 50;
      if (f === 'macros') return 60;
      if (f === 'styles') return 70;
      if (f === 'supplementary') return 80;
      return 90;
    };

    const sortedFolders = Array.from(folderMap.values()).sort((a, b) => {
      const prioA = getFolderPriority(a.name);
      const prioB = getFolderPriority(b.name);
      if (prioA !== prioB) return prioA - prioB;
      return a.name.localeCompare(b.name, undefined, {
        numeric: true,
        sensitivity: 'base',
      });
    });

    // Sort children inside each folder naturally
    sortedFolders.forEach((folder) => {
      folder.children.sort((a, b) => {
        if (a.type === 'file' && b.type === 'file') {
          return a.displayLabel.localeCompare(b.displayLabel, undefined, {
            numeric: true,
            sensitivity: 'base',
          });
        }
        return 0;
      });
    });

    // Clean document organization: Group root document files together (main document, preamble.tex, references.bib), then structured resource folders
    return [...rootFiles, ...sortedFolders];
  }, [projectFiles, files, parentPage, projectId, parentPageId, mainFileId, configuredMainFile]);

  const displayTree = useMemo<FileTreeNode[]>(() => {
    const trimmedFilter = fileFilter.trim().toLowerCase();
    if (!trimmedFilter) return treeItems;

    const filterNodes = (nodes: FileTreeNode[]): FileTreeNode[] => {
      const res: FileTreeNode[] = [];
      for (const node of nodes) {
        if (node.type === 'file') {
          if (
            node.displayLabel.toLowerCase().includes(trimmedFilter) ||
            node.title.toLowerCase().includes(trimmedFilter)
          ) {
            res.push(node);
          }
        } else {
          const matchingChildren = filterNodes(node.children);
          if (
            node.name.toLowerCase().includes(trimmedFilter) ||
            matchingChildren.length > 0
          ) {
            res.push({
              ...node,
              children: matchingChildren.length > 0 ? matchingChildren : node.children,
            });
          }
        }
      }
      return res;
    };

    return filterNodes(treeItems);
  }, [treeItems, fileFilter]);

  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => {
    return new Set(['sections', 'supplementary']);
  });

  const toggleFolder = useCallback((folderKey: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderKey)) {
        next.delete(folderKey);
      } else {
        next.add(folderKey);
      }
      return next;
    });
  }, []);

  const renderTreeNode = useCallback(
    (node: FileTreeNode, depth = 0): React.ReactNode => {
      if (node.type === 'folder') {
        const isExpanded = fileFilter.trim()
          ? true
          : expandedFolders.has(node.name) || expandedFolders.has(node.id);

        return (
          <div key={node.id} className="flex flex-col">
            <div
              role="button"
              tabIndex={0}
              aria-expanded={isExpanded}
              aria-label={`Folder ${node.name}`}
              onClick={() => toggleFolder(node.name)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  toggleFolder(node.name);
                }
              }}
              onDragOver={(e) => {
                if (e.dataTransfer.types.includes('application/flux-file-id')) {
                  e.preventDefault();
                  e.stopPropagation();
                  e.dataTransfer.dropEffect = 'move';
                }
              }}
              onDrop={(e) => {
                const internalFileId = e.dataTransfer.getData('application/flux-file-id');
                if (internalFileId && internalFileId !== node.id) {
                  e.preventDefault();
                  e.stopPropagation();
                  handleMoveItem(internalFileId, node.id);
                  return;
                }
              }}
              className={cn(
                'group/row relative flex h-7.5 w-full items-center gap-1.5 rounded-md pl-2 pr-1 transition-colors cursor-pointer select-none text-12 leading-5 tracking-tight outline-none focus-visible:ring-1 focus-visible:ring-foreground',
                'text-foreground hover:bg-muted/60 font-normal',
              )}
            >
              <IndentGuides depth={depth} />
              <ChevronRight
                className={cn(
                  'size-3.5 shrink-0 text-foreground transition-transform duration-150',
                  isExpanded && 'rotate-90',
                )}
                strokeWidth={1.75}
              />
              {isExpanded ? (
                <FolderOpen className="size-4 shrink-0 text-foreground" strokeWidth={1.5} />
              ) : (
                <Folder className="size-4 shrink-0 text-foreground" strokeWidth={1.5} />
              )}

              <span className="flex-1 min-w-0 truncate font-mono text-12 font-medium tracking-tight text-foreground">
                {node.name}
              </span>

              <RowActions>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    setNewFileName(`${node.name}/`);
                    setIsCreatingFile(true);
                  }}
                  className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
                >
                  <FileCode2 className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
                  <span>New file in {node.name}</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    handleUploadToFolder([], node.id);
                  }}
                  className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
                >
                  <Upload className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
                  <span>Upload to {node.name}</span>
                </DropdownMenuItem>
              </RowActions>
            </div>

            {isExpanded && (
              <div className="flex flex-col">
                {node.children.length === 0 ? (
                  <div
                    className="flex h-7 items-center text-11 italic text-muted-foreground/60 select-none"
                    style={{ paddingLeft: `${8 + (depth + 1) * 14 + 20}px` }}
                  >
                    Empty folder
                  </div>
                ) : (
                  node.children.map((child) => renderTreeNode(child, depth + 1))
                )}
              </div>
            )}
          </div>
        );
      }

      // It's a file node
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
            onInsertAsset={handleInsertAsset}
            onPreview={handleOpenPreview}
            projectId={projectId}
          />
        );
      }

      // kind === 'tex'
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
          onRefreshLinked={handleRefreshLinkedFile}
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
          onDownload={handleDownloadTex}
          onCopyCommand={handleCopyTexCommand}
        />
      );
    },
    [
      linkedFileMap,
      handleRefreshLinkedFile,
      fileFilter,
      expandedFolders,
      toggleFolder,
      activeFilePage,
      searchParams,
      pageId,
      mainFileId,
      configuredMainFile,
      parentPageId,
      renamingId,
      renameValue,
      updateTitleMutation.isPending,
      handleFileClick,
      handleStartRename,
      handleCommitRename,
      handleDelete,
      handleSetMain,
      handleDownloadTex,
      handleCopyTexCommand,
      handleInsertAsset,
      handleOpenPreview,
      handleUploadToFolder,
      projectId,
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
          onOpenDeletedFilesModal={() => setIsDeletedFilesModalOpen(true)}
          deletedFilesCount={deletedFilesList.length}
          fileFilter={fileFilter}
          onFileFilterChange={setFileFilter}
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
                    <div className="size-4 rounded-md bg-muted animate-pulse shrink-0" />
                    <div
                      className="h-3 rounded-md bg-muted animate-pulse"
                      style={{ width: `${w}%` }}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Uploading indicator */}
            {uploadingCount > 0 && (
              <div className="flex h-8 items-center gap-2 px-3 text-12 text-muted-foreground select-none">
                <Loader2 className="size-3.5 animate-spin text-foreground shrink-0" />
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

      {isDeletedFilesModalOpen && (
        <DeletedFilesModal
          open={isDeletedFilesModalOpen}
          onOpenChange={setIsDeletedFilesModalOpen}
          pageId={pageId}
        />
      )}
    </>
  );
});

export default FilesTab;
