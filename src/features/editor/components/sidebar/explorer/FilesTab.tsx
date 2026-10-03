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
  Loader2,
  Search,
  Upload,
} from 'lucide-react';
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

import {
  InlineInput,
  StorageFolderNode,
  StorageFileRow,
} from './FileTreeNodes';
import { UploadConflictDialog } from './UploadConflictDialog';
import { FileOutlineSection } from './FileOutlineSection';
import { FileTreeToolbar } from './FileTreeToolbar';
import { TexFileRow, displayName } from './TexFileRow';
import { useFileUpload } from './useFileUpload';
import { EditorEmptyState } from '../../shared';

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

  const { data: files, isLoading } = useQuery({
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
  } = useEditorStorage(parentPageId || null, undefined, projectId || null);

  const queryClient = useQueryClient();

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
      const activeFileId = searchParams.get('file') ?? pageId;
      if (fileId === activeFileId) return;
      if (parentPageId) openTab(parentPageId, { id: fileId, title });
      setSearchParams({ file: fileId });
    },
    [searchParams, pageId, parentPageId, openTab, setSearchParams],
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
    setMainFileMutation.mutate({ pageId: parentPageId, fileId });
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

  // Build unified file tree items
  type UnifiedItem =
    | { kind: 'folder'; data: StorageItem }
    | { kind: 'asset'; data: StorageItem }
    | {
        kind: 'tex';
        data: { id: string; title: string; updatedAt: string };
      };

  const items = useMemo(() => {
    const list: UnifiedItem[] = [];
    const existingTexNames = new Set<string>();

    projectFiles?.forEach((f: any) => {
      if (f.isFolder) {
        if (f.id !== projectId && f.id !== parentPageId) {
          list.push({ kind: 'folder', data: f });
        }
      }
    });

    const fileItems: UnifiedItem[] = [];
    files?.forEach((f: any) => {
      fileItems.push({ kind: 'tex', data: f });
      existingTexNames.add(displayName(f.title).toLowerCase());
    });

    // Ensure parentPage is always visible in the tree even before child files are created or fetched
    if (parentPage && !fileItems.some((f) => f.data.id === parentPage.id)) {
      fileItems.unshift({
        kind: 'tex',
        data: {
          id: parentPage.id,
          title: parentPage.title || 'main.tex',
          updatedAt: parentPage.updatedAt || new Date().toISOString(),
        },
      });
      existingTexNames.add(displayName(parentPage.title || 'main.tex').toLowerCase());
    }

    projectFiles?.forEach((f: any) => {
      if (f.isFolder) return;
      const fname = (f.filename || '').trim();

      // Filter out root buckets, placeholders, or invalid items without extension
      if (
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

      // If storage has a file matching an existing .tex document, skip storage duplicate
      if (existingTexNames.has(fname.toLowerCase())) {
        return;
      }

      fileItems.push({ kind: 'asset', data: f });
    });

    fileItems.sort((a, b) => {
      const nameA = a.kind === 'tex' ? a.data.title : a.data.filename;
      const nameB = b.kind === 'tex' ? b.data.title : b.data.filename;
      return nameA.localeCompare(nameB);
    });

    list.push(...fileItems);
    return list;
  }, [projectFiles, files, parentPage, projectId, parentPageId]);

  const displayItems = useMemo(() => {
    const trimmedFilter = fileFilter.trim().toLowerCase();
    if (!trimmedFilter) return items;
    return items.filter((item) => {
      if (item.kind === 'folder') {
        return item.data.filename.toLowerCase().includes(trimmedFilter);
      }
      if (item.kind === 'asset') {
        return item.data.filename.toLowerCase().includes(trimmedFilter);
      }
      return item.data.title.toLowerCase().includes(trimmedFilter);
    });
  }, [items, fileFilter]);

  return (
    <>
      <div className="w-full h-full flex flex-col select-none text-sm bg-background">
        {/* Hidden upload inputs */}
        <input
          ref={combinedUploadRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFilePicked}
        />
        <input
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
            className="relative min-h-0 flex-1 overflow-y-auto"
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            {/* Drag-over overlay */}
            {isDragging && (
              <div className="absolute inset-1.5 z-10 flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-primary/40 bg-primary/5 pointer-events-none backdrop-blur-[1px]">
                <div className="p-2 rounded-full bg-primary/10">
                  <Upload className="size-5 text-primary shrink-0" strokeWidth={1.5} />
                </div>
                <span className="text-12 font-medium text-primary">Drop files to upload</span>
              </div>
            )}

            {/* ── Inline create inputs ────────────────────────────────────────── */}
            {isCreatingFile && (
              <InlineInput
                icon={FileCode2}
                iconColor="text-primary"
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
                iconColor="text-warning"
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
                <Loader2 className="size-3.5 animate-spin text-primary shrink-0" />
                <span>
                  Uploading {uploadingCount} file{uploadingCount > 1 ? 's' : ''}…
                </span>
              </div>
            )}

            {/* ── UNIFIED FILE TREE ITEMS ─────────────────────────────────────── */}
            {!isLoading && !projectFilesLoading && (
              <>
                {items.length > 0 && displayItems.length === 0 ? (
                  <div className="py-6 px-2">
                    <EditorEmptyState
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
                ) : items.length === 0 && !isCreatingFile && !isCreatingFolder ? (
                  <div className="py-6 px-2">
                    <EditorEmptyState
                      variant="files"
                      isCompact
                      title="No files yet"
                      description="Create your first document or upload files to begin editing."
                      action={
                        <button
                          type="button"
                          onClick={handleStartCreate}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-12 font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer"
                        >
                          Create file
                        </button>
                      }
                    />
                  </div>
                ) : (
                  displayItems.map((item) => {
                    if (item.kind === 'folder') {
                      return (
                        <StorageFolderNode
                          key={item.data.id}
                          folder={item.data}
                          projectId={parentPageId || ''}
                          depth={0}
                          onInsertAsset={handleInsertAsset}
                          onPreview={handleOpenPreview}
                          onUploadToFolder={handleUploadToFolder}
                        />
                      );
                    }

                    if (item.kind === 'asset') {
                      return (
                        <StorageFileRow
                          key={item.data.id}
                          item={item.data}
                          depth={0}
                          onInsertAsset={handleInsertAsset}
                          onPreview={handleOpenPreview}
                          projectId={projectId}
                        />
                      );
                    }

                    // kind === "tex"
                    const file = item.data;
                    const activeId =
                      activeFilePage?.id ?? (searchParams.get('fileId') || pageId);
                    const isActive = file.id === activeId || file.id === pageId;
                    const isMain = file.id === mainFileId;

                    return (
                      <TexFileRow
                        key={file.id}
                        file={file}
                        isActive={isActive}
                        isMain={isMain}
                        isRenaming={renamingId === file.id}
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
                  })
                )}
              </>
            )}
          </div>
        )}

        {/* ── File Outline Accordion ────────────────────────────────────────── */}
        <FileOutlineSection
          isFileTreeOpen={isFileTreeOpen}
          docContent={currentPage?.content || ''}
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
