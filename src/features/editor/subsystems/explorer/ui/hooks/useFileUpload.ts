'use client';

import { useState, useRef, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { invalidateFileTreeQueries } from '@/features/editor/ui/hooks/document.queries';
import { editorCommandBus } from '@/features/editor/core';
import { lruDocumentCache } from '@/features/editor/domain/document/lru-document-cache';
import { navigationCoordinator } from '@/features/editor/subsystems/navigation';
import type { EditorStorageItem as StorageItem } from '@/features/editor/domain/types/storage-item.types';
import { TEX_EXTS, type PendingUploadItem as PendingItem } from '@/features/editor/subsystems/explorer/ui/modals/UploadConflictDialog';
import { manuscriptService } from '@/features/editor/sdk/manuscript.service';
import { extractProjectId } from '@/features/editor/domain/types/core.types';
import { normalizeVirtualPath, parseVirtualFolderId } from '@/features/editor/domain/document/document-naming';
import { readEntriesRecursively } from '../modals/directory-reader';

export interface UseFileUploadOptions {
  parentPageId: string | null;
  projectId: string;
  parentPage: Parameters<typeof extractProjectId>[0];
  files: Array<{ id: string; title: string }> | undefined;
  projectFiles: StorageItem[] | undefined;
  createFileMutation: {
    mutate: (
      vars: { parentPageId: string; title: string; content?: string; skipInvalidation?: boolean; silent?: boolean },
      opts?: { onSettled?: () => void },
    ) => void;
    mutateAsync: (vars: {
      parentPageId: string;
      title: string;
      content?: string;
      skipInvalidation?: boolean;
      silent?: boolean;
    }) => Promise<{ id: string }>;
  };
  uploadFile: {
    mutate: (
      vars: { file: File; projectId: string; pageId: string; parentId?: string; skipInvalidation?: boolean; silent?: boolean },
      opts?: { onSettled?: () => void },
    ) => void;
    mutateAsync: (vars: {
      file: File;
      projectId: string;
      pageId: string;
      parentId?: string;
      skipInvalidation?: boolean;
      silent?: boolean;
    }) => Promise<unknown>;
  };
  updateContentMutation: {
    mutateAsync: (vars: { pageId: string; content: string }) => Promise<unknown>;
  };
  setSearchParams: (params: Record<string, string>) => void;
}

export function useFileUpload({
  parentPageId,
  projectId,
  parentPage,
  files,
  projectFiles,
  createFileMutation,
  uploadFile,
  updateContentMutation,
  setSearchParams,
}: UseFileUploadOptions) {
  const queryClient = useQueryClient();

  const combinedUploadRef = useRef<HTMLInputElement>(null);
  const folderUploadRef = useRef<HTMLInputElement>(null);
  const targetFolderIdRef = useRef<string | null>(null);
  const dragCounterRef = useRef(0);

  const [uploadingCount, setUploadingCount] = useState(0);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [pendingUploads, setPendingUploads] = useState<PendingItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  // Build a set of existing file relative paths for duplicate detection
  const existingNames = useMemo(() => {
    const names = new Set<string>();
    files?.forEach((f) => {
      const clean = normalizeVirtualPath(f.title);
      if (clean) names.add(clean);
    });
    projectFiles?.forEach((f) => {
      if (!f.isFolder) {
        const relPath = normalizeVirtualPath(f.path || f.filename || '');
        if (relPath) names.add(relPath);
      }
    });
    return names;
  }, [files, projectFiles]);

  /** Mark each item as duplicate or not; within-batch duplicates also flagged. */
  const markDuplicates = useCallback(
    (items: { file: File; name: string }[]): PendingItem[] => {
      const seen = new Set<string>();
      return items.map((item) => {
        const cleanName = normalizeVirtualPath(item.name);
        const isDup = existingNames.has(cleanName) || seen.has(cleanName);
        seen.add(cleanName);
        const isZip = cleanName.toLowerCase().endsWith('.zip');
        return {
          ...item,
          conflict: isDup ? 'duplicate' : 'none',
          unpackZip: isZip ? true : undefined,
        };
      });
    },
    [existingNames],
  );

  /** Auto-generate a unique suffix name: file.tex -> file_2.tex, file_3.tex ... */
  const autoSuffix = useCallback(
    (name: string, batchAllocatedNames?: Set<string>): string => {
      const dot = name.lastIndexOf('.');
      const base = dot > 0 ? name.slice(0, dot) : name;
      const ext = dot > 0 ? name.slice(dot) : '';
      let n = 2;
      let candidate = `${base}_${n}${ext}`;
      while (
        existingNames.has(normalizeVirtualPath(candidate)) ||
        batchAllocatedNames?.has(normalizeVirtualPath(candidate))
      ) {
        n++;
        candidate = `${base}_${n}${ext}`;
      }
      batchAllocatedNames?.add(normalizeVirtualPath(candidate));
      return candidate;
    },
    [existingNames],
  );

  const handleUpload = () => combinedUploadRef.current?.click();
  const handleFolderUpload = () => folderUploadRef.current?.click();

  const handleAddFilesPick = useCallback(
    (items: { file: File; name: string }[]) => {
      setPendingUploads(markDuplicates(items));
      setUploadDialogOpen(true);
    },
    [markDuplicates],
  );

  const handleFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = '';
    const targetFolderId = targetFolderIdRef.current;
    targetFolderIdRef.current = null;
    if (!picked.length) return;
    if (targetFolderId) {
      handleUploadToFolder(picked, targetFolderId);
      return;
    }
    setPendingUploads(markDuplicates(picked.map((f) => ({ file: f, name: f.name }))));
    setUploadDialogOpen(true);
  };

  const handleFolderPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (!picked.length) return;
    setPendingUploads(
      markDuplicates(
        picked.map((f) => ({
          file: f,
          name: (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name,
        })),
      ),
    );
    setUploadDialogOpen(true);
  };

  const handleDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      dragCounterRef.current = 0;
      setIsDragging(false);
      if (!parentPageId) return;

      const dtItems = e.dataTransfer.items;
      const allItems: { file: File; name: string }[] = [];
      const folderEntries: FileSystemDirectoryEntry[] = [];
      const plainFiles: File[] = [];

      if (dtItems?.length) {
        for (let i = 0; i < dtItems.length; i++) {
          const entry = dtItems[i].webkitGetAsEntry?.();
          if (entry?.isDirectory) {
            folderEntries.push(entry as FileSystemDirectoryEntry);
          } else if (entry?.isFile) {
            const file = e.dataTransfer.files[i];
            if (file) plainFiles.push(file);
          }
        }
      } else {
        plainFiles.push(...Array.from(e.dataTransfer.files));
      }

      plainFiles.forEach((f) => allItems.push({ file: f, name: f.name }));

      for (const dir of folderEntries) {
        const folderFiles = await readEntriesRecursively(dir, dir.name);
        for (const { file, relativePath } of folderFiles) {
          allItems.push({ file, name: relativePath });
        }
      }

      if (allItems.length > 0) {
        setPendingUploads(markDuplicates(allItems));
        setUploadDialogOpen(true);
      }
    },
    [parentPageId, markDuplicates],
  );

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragCounterRef.current++;
    if (dragCounterRef.current === 1) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleUploadToFolder = useCallback(
    (droppedFiles: File[], folderId: string) => {
      if (!parentPageId) return;
      if (droppedFiles.length === 0) {
        targetFolderIdRef.current = folderId;
        combinedUploadRef.current?.click();
        return;
      }
      const tabProjectId = extractProjectId(parentPage) || projectId || '';
      setUploadingCount((prev) => prev + droppedFiles.length);

      let batchRemaining = droppedFiles.length;
      const settle = () => {
        batchRemaining = Math.max(0, batchRemaining - 1);
        setUploadingCount((prev) => Math.max(0, prev - 1));
        if (batchRemaining === 0 && parentPageId) {
          invalidateFileTreeQueries(queryClient, { parentPageId, includeDeleted: false });
          editorCommandBus.dispatch({ type: 'filetree:updated' });
        }
      };

      let resolvedFolderPath = '';
      let resolvedFolderId: string | undefined = folderId;
      const virtualPath = parseVirtualFolderId(folderId);
      if (virtualPath !== null) {
        resolvedFolderPath = virtualPath;
        const matchingFolder = projectFiles?.find(
          (pf) =>
            pf.isFolder &&
            ((pf.path && normalizeVirtualPath(pf.path).toLowerCase() === resolvedFolderPath.toLowerCase()) ||
              pf.filename.toLowerCase() === resolvedFolderPath.toLowerCase()),
        );
        resolvedFolderId = matchingFolder?.id;
      } else {
        const folderItem = projectFiles?.find((pf) => pf.id === folderId);
        if (folderItem) {
          resolvedFolderPath = normalizeVirtualPath(folderItem.path || folderItem.filename || '');
        }
      }

      droppedFiles.forEach((file) => {
        const ext = '.' + (file.name.split('.').pop() ?? '').toLowerCase();
        if (TEX_EXTS.has(ext)) {
          const reader = new FileReader();
          reader.onload = () => {
            const fullTitle = resolvedFolderPath ? `${resolvedFolderPath}/${file.name}` : file.name;
            createFileMutation.mutate(
              { parentPageId, title: fullTitle, content: reader.result as string, skipInvalidation: true },
              { onSettled: settle },
            );
          };
          reader.readAsText(file);
        } else {
          // Binary asset – pass full relative path so Backend FilestoreRepository.syncFileNode
          // materializes the folder chain atomically via NodePathVo.parse & ensurePrismaFolderChain
          const fileForUpload = resolvedFolderPath
            ? new File([file], `${resolvedFolderPath}/${file.name}`, { type: file.type })
            : file;
          uploadFile.mutate(
            {
              file: fileForUpload,
              projectId: tabProjectId,
              pageId: parentPageId,
              parentId: resolvedFolderId,
              skipInvalidation: true,
            },
            { onSettled: settle },
          );
        }
      });
    },
    [parentPageId, uploadFile, createFileMutation, parentPage, projectId, projectFiles, queryClient],
  );

  const handleConfirmUpload = async () => {
    if (!parentPageId || !pendingUploads.length) return;
    if (pendingUploads.some((p) => p.conflict === 'duplicate' && !p.resolution)) return;
    setUploadDialogOpen(false);

    const batchAllocatedNames = new Set<string>();
    const resolved = pendingUploads.map((p) => {
      if (p.conflict === 'duplicate' && p.resolution === 'suffix') {
        return { ...p, name: autoSuffix(p.name, batchAllocatedNames) };
      }
      batchAllocatedNames.add(p.name.replace(/^\/+/, ''));
      return p;
    });

    const uploads = resolved;
    setPendingUploads([]);

    const zipUnpackItems = uploads.filter(
      (p: PendingItem) => p.name.toLowerCase().endsWith('.zip') && p.unpackZip !== false,
    );
    const nonZipUploads = uploads.filter(
      (p: PendingItem) => !p.name.toLowerCase().endsWith('.zip') || p.unpackZip === false,
    );

    if (zipUnpackItems.length > 0 && parentPageId) {
      void (async () => {
        const tabProjectId = extractProjectId(parentPage) || projectId || '';

        for (const zipItem of zipUnpackItems) {
          try {
            toast.loading(`Unpacking ${zipItem.file.name}...`, { id: `zip-${zipItem.name}` });
            const importRes = await manuscriptService.export.importProjectZip(
              tabProjectId || parentPageId,
              zipItem.file,
            );
            const totalImported =
              (importRes?.totalDocs ?? 0) + (importRes?.totalFiles ?? 0) ||
              importRes?.totalEntries ||
              0;
            toast.success(`Unpacked ${totalImported} files from ${zipItem.file.name}`, {
              id: `zip-${zipItem.name}`,
            });
          } catch (err: unknown) {
            console.error('Failed to unpack zip:', err);
            toast.error(`Failed to unpack ${zipItem.file.name}: ${(err as Error)?.message || 'Unknown error'}`, {
              id: `zip-${zipItem.name}`,
            });
          }
        }
        invalidateFileTreeQueries(queryClient, { parentPageId, includeDeleted: false });
        editorCommandBus.dispatch({ type: 'filetree:updated' });
      })();
    }

    const folderItems = nonZipUploads.filter((p) => p.name.includes('/'));
    const flatItems = nonZipUploads.filter((p) => !p.name.includes('/'));
    const texFlat = flatItems.filter(({ name }) =>
      TEX_EXTS.has('.' + (name.split('.').pop() ?? '').toLowerCase()),
    );
    const assetFlat = flatItems.filter(
      ({ name }) => !TEX_EXTS.has('.' + (name.split('.').pop() ?? '').toLowerCase()),
    );

    const totalFiles = texFlat.length + assetFlat.length + folderItems.length;
    if (totalFiles === 0) return;

    let remaining = totalFiles;
    setUploadingCount(totalFiles);

    const onFileSettled = () => {
      remaining = Math.max(0, remaining - 1);
      setUploadingCount(remaining);
      if (remaining === 0) {
        if (parentPageId) {
          invalidateFileTreeQueries(queryClient, { parentPageId, includeDeleted: false });
          editorCommandBus.dispatch({ type: 'filetree:updated' });
        }
      }
    };

    const upsertTexFile = async (
      file: File,
      targetTitle: string,
      conflict?: string,
      resolution?: string,
    ): Promise<{ id: string; title: string; content: string }> => {
      const content = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsText(file);
      });

      if (conflict === 'duplicate' && resolution === 'overwrite') {
        const cleanTarget = normalizeVirtualPath(targetTitle);
        const existingPage =
          files?.find((f) => normalizeVirtualPath(f.title) === cleanTarget) ||
          projectFiles?.find(
            (pf) =>
              pf.nodeType === 'DOC' &&
              normalizeVirtualPath(pf.path || pf.filename || '') === cleanTarget,
          );
        const existingDocId =
          existingPage && 'docId' in existingPage && existingPage.docId
            ? existingPage.docId
            : existingPage?.id;
        if (existingPage && existingDocId) {
          await updateContentMutation.mutateAsync({
            pageId: existingDocId,
            content,
          });
          lruDocumentCache.updateContent(existingDocId, content, false);
          lruDocumentCache.markClean(existingDocId);
          editorCommandBus.dispatch({
            type: 'editor:set-content',
            fileId: existingDocId,
            content,
          });
          editorCommandBus.dispatch({
            type: 'document:content-updated',
            docId: existingDocId,
            content,
          });
          return { id: existingDocId, title: cleanTarget, content };
        }
      }

      const created = await createFileMutation.mutateAsync({
        parentPageId,
        title: targetTitle,
        content,
        skipInvalidation: true,
      });
      return { id: created.id, title: targetTitle, content };
    };

    if (texFlat.length) {
      const texResults = await Promise.all(
        texFlat.map(async ({ file, name, conflict, resolution }) => {
          try {
            const effectiveTitle = name.trim() || file.name;
            return await upsertTexFile(
              file,
              conflict === 'duplicate' && resolution === 'overwrite' ? file.name : effectiveTitle,
              conflict,
              resolution,
            );
          } catch (err) {
            console.error('Failed to upload tex:', err);
            return null;
          } finally {
            onFileSettled();
          }
        }),
      );
      const lastTexItem = [...texResults].reverse().find(Boolean) ?? null;
      if (lastTexItem) {
        navigationCoordinator.openDocument({
          fileId: lastTexItem.id,
          title: lastTexItem.title,
          content: lastTexItem.content,
        });
        setSearchParams({ file: lastTexItem.id });
      }
    }

    if (assetFlat.length && projectId) {
      await Promise.all(
        assetFlat.map(async ({ file, name }) => {
          try {
            const renamedFile =
              name !== file.name ? new File([file], name, { type: file.type }) : file;
            await uploadFile.mutateAsync({
              file: renamedFile,
              projectId,
              pageId: parentPageId,
              skipInvalidation: true,
            });
          } catch (err) {
            console.error('Failed to upload asset:', err);
          } finally {
            onFileSettled();
          }
        }),
      );
    }

    if (folderItems.length && projectId) {
      void (async () => {
        try {
          await Promise.all(
            folderItems.map(async ({ file, name, conflict, resolution }) => {
              const cleanRelativePath = name.replace(/^\/+/, '');
              const ext = '.' + (cleanRelativePath.split('.').pop() ?? '').toLowerCase();
              const isTex = TEX_EXTS.has(ext);

              if (isTex) {
                try {
                  await upsertTexFile(file, cleanRelativePath, conflict, resolution);
                } catch (err) {
                  console.error('Failed to upload folder tex:', err);
                } finally {
                  onFileSettled();
                }
              } else {
                const fileToUpload =
                  cleanRelativePath !== file.name
                    ? new File([file], cleanRelativePath, { type: file.type })
                    : file;
                try {
                  await uploadFile.mutateAsync({
                    file: fileToUpload,
                    projectId,
                    pageId: parentPageId,
                    skipInvalidation: true,
                  });
                } catch (uploadErr) {
                  console.error('Failed:', uploadErr);
                } finally {
                  onFileSettled();
                }
              }
            }),
          );
        } catch (err) {
          console.error('Fatal error:', err);
          for (let i = 0; i < folderItems.length; i++) onFileSettled();
        }
      })();
    }
  };

  return {
    combinedUploadRef,
    folderUploadRef,
    uploadingCount,
    uploadDialogOpen,
    setUploadDialogOpen,
    pendingUploads,
    setPendingUploads,
    isDragging,
    handleUpload,
    handleFolderUpload,
    handleFilePicked,
    handleFolderPicked,
    handleAddFilesPick,
    handleDrop,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleConfirmUpload,
    handleUploadToFolder,
  };
}
