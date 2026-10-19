'use client';

import { useState, useRef, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { filesQuery, pageKeys } from '@/features/editor/ui/hooks/document.queries';
import { editorCommandBus } from '@/features/editor/core';
import { lruDocumentCache } from '@/features/editor/domain/document/lru-document-cache';
import { navigationCoordinator } from '@/features/editor/subsystems/navigation';
import type { EditorStorageItem as StorageItem } from '@/features/editor/domain/types/storage-item.types';
import { TEX_EXTS, type PendingUploadItem as PendingItem } from '@/features/editor/subsystems/explorer/ui/modals/UploadConflictDialog';
import { parseZipArchive, extractAndImportZipToProject } from '@/features/editor/sdk/archive/archive-import';
import { extractProjectId } from '@/features/editor/domain/types/core.types';
import { readEntriesRecursively } from '../modals/directory-reader';

export interface UseFileUploadOptions {
  parentPageId: string | null;
  projectId: string;
  parentPage: Parameters<typeof extractProjectId>[0];
  files: Array<{ id: string; title: string }> | undefined;
  projectFiles: StorageItem[] | undefined;
  createFileMutation: {
    mutate: (vars: { parentPageId: string; title: string; content?: string }, opts?: { onSettled?: () => void }) => void;
    mutateAsync: (vars: { parentPageId: string; title: string; content?: string }) => Promise<{ id: string }>;
  };
  uploadFile: {
    mutate: (vars: { file: File; projectId: string; pageId: string; parentId?: string }, opts?: { onSettled?: () => void }) => void;
    mutateAsync: (vars: { file: File; projectId: string; pageId: string; parentId?: string }) => Promise<unknown>;
  };
  createFolder: {
    mutateAsync: (vars: { name: string; projectId: string; parentId?: string; pageId: string }) => Promise<unknown>;
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
  createFolder,
  updateContentMutation,
  setSearchParams,
}: UseFileUploadOptions) {
  const queryClient = useQueryClient();

  const combinedUploadRef = useRef<HTMLInputElement>(null);
  const folderUploadRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);

  const [uploadingCount, setUploadingCount] = useState(0);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [pendingUploads, setPendingUploads] = useState<PendingItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  // Build a set of existing file names for duplicate detection (case-insensitive)
  const existingNames = useMemo(() => {
    const names = new Set<string>();
    files?.forEach((f) => names.add(f.title.toLowerCase()));
    projectFiles?.forEach((f) => {
      if (!f.isFolder) names.add(f.filename.toLowerCase());
    });
    return names;
  }, [files, projectFiles]);

  /** Mark each item as duplicate or not; within-batch duplicates also flagged. */
  const markDuplicates = useCallback(
    (items: { file: File; name: string }[]): PendingItem[] => {
      const seen = new Set<string>();
      return items.map((item) => {
        const lower = item.name.toLowerCase();
        const isDup = existingNames.has(lower) || seen.has(lower);
        seen.add(lower);
        const isZip = lower.endsWith('.zip');
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
    (name: string): string => {
      const dot = name.lastIndexOf('.');
      const base = dot > 0 ? name.slice(0, dot) : name;
      const ext = dot > 0 ? name.slice(dot) : '';
      let n = 2;
      let candidate = `${base}_${n}${ext}`;
      while (existingNames.has(candidate.toLowerCase())) {
        n++;
        candidate = `${base}_${n}${ext}`;
      }
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
    if (!picked.length) return;
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
      const tabProjectId = extractProjectId(parentPage) || projectId || '';
      setUploadingCount((prev) => prev + droppedFiles.length);

      const settle = () => setUploadingCount((prev) => Math.max(0, prev - 1));

      droppedFiles.forEach((file) => {
        const ext = '.' + (file.name.split('.').pop() ?? '').toLowerCase();
        if (TEX_EXTS.has(ext)) {
          const reader = new FileReader();
          reader.onload = () => {
            createFileMutation.mutate(
              { parentPageId, title: file.name, content: reader.result as string },
              { onSettled: settle },
            );
          };
          reader.readAsText(file);
        } else {
          // Binary asset – upload to storage
          uploadFile.mutate(
            { file, projectId: tabProjectId, pageId: parentPageId, parentId: folderId },
            { onSettled: settle },
          );
        }
      });
    },
    [parentPageId, uploadFile, createFileMutation, parentPage, projectId],
  );

  const handleConfirmUpload = async () => {
    if (!parentPageId || !pendingUploads.length) return;
    if (pendingUploads.some((p) => p.conflict === 'duplicate' && !p.resolution)) return;
    setUploadDialogOpen(false);

    const resolved = pendingUploads.map((p) => {
      if (p.conflict === 'duplicate' && p.resolution === 'suffix') {
        return { ...p, name: autoSuffix(p.name) };
      }
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
            const parsed = await parseZipArchive(zipItem.file);
            await extractAndImportZipToProject({
              extracted: parsed,
              zipFile: zipItem.file,
              projectId: tabProjectId,
              parentPageId,
            });
            toast.success(`Unpacked ${parsed.totalFiles} files from ${zipItem.file.name}`, {
              id: `zip-${zipItem.name}`,
            });
          } catch (err: unknown) {
            console.error('Failed to unpack zip:', err);
            toast.error(`Failed to unpack ${zipItem.file.name}: ${(err as Error)?.message || 'Unknown error'}`, {
              id: `zip-${zipItem.name}`,
            });
          }
        }
        queryClient.invalidateQueries({ queryKey: pageKeys.all });
        queryClient.invalidateQueries({ queryKey: ['editor-storage-files'] });
        queryClient.invalidateQueries({ queryKey: ['projects'] });
        queryClient.invalidateQueries({
          queryKey: filesQuery(parentPageId).queryKey,
        });
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
          queryClient.invalidateQueries({ queryKey: pageKeys.all });
          queryClient.invalidateQueries({ queryKey: ['editor-storage-files'] });
          queryClient.invalidateQueries({ queryKey: ['projects'] });
          queryClient.invalidateQueries({
            queryKey: filesQuery(parentPageId).queryKey,
          });
          editorCommandBus.dispatch({ type: 'filetree:updated' });
        }
      }
    };

    let lastTexItem: { id: string; title: string; content: string } | null = null;
    if (texFlat.length) {
      for (const { file, name, conflict, resolution } of texFlat) {
        try {
          const content = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsText(file);
          });

          if (conflict === 'duplicate' && resolution === 'overwrite') {
            const existingPage = files?.find(
              (f) => f.title.toLowerCase() === file.name.toLowerCase(),
            );
            if (existingPage) {
              await updateContentMutation.mutateAsync({
                pageId: existingPage.id,
                content,
              });
              lruDocumentCache.updateContent(existingPage.id, content, false);
              editorCommandBus.dispatch({
                type: 'document:content-updated',
                docId: existingPage.id,
                content,
              });
              lastTexItem = { id: existingPage.id, title: existingPage.title, content };
              continue;
            }
          }

          const effectiveTitle = name.trim() || file.name;
          const created = await createFileMutation.mutateAsync({
            parentPageId,
            title: effectiveTitle,
            content,
          });
          lastTexItem = { id: created.id, title: effectiveTitle, content };
        } catch (err) {
          console.error('Failed to upload tex:', err);
        } finally {
          onFileSettled();
        }
      }
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
      for (const { file, name } of assetFlat) {
        try {
          const renamedFile =
            name !== file.name ? new File([file], name, { type: file.type }) : file;
          await uploadFile.mutateAsync({
            file: renamedFile,
            projectId,
            pageId: parentPageId,
          });
        } catch (err) {
          console.error('Failed to upload asset:', err);
        } finally {
          onFileSettled();
        }
      }
    }

    if (folderItems.length && projectId) {
      void (async () => {
        try {
          const assetFolderItems = folderItems.filter(
            (p) => !TEX_EXTS.has('.' + (p.name.split('.').pop() ?? '').toLowerCase()),
          );
          const folderPaths = new Set<string>();
          for (const { name } of assetFolderItems) {
            const parts = name.split('/');
            for (let i = 1; i < parts.length; i++) {
              folderPaths.add(parts.slice(0, i).join('/'));
            }
          }

          const sortedPaths = Array.from(folderPaths).sort();
          const folderIdMap: Record<string, string> = {};

          for (const folderPath of sortedPaths) {
            const parts = folderPath.split('/');
            const folderName = parts[parts.length - 1];
            const parentPath = parts.slice(0, -1).join('/');
            const folderParentId = parentPath ? folderIdMap[parentPath] : null;

            const created = await createFolder.mutateAsync({
              name: folderName,
              projectId,
              parentId: folderParentId ?? undefined,
              pageId: parentPageId,
            });
            const folderId = (created as { folder?: { id: string }; id?: string })?.folder?.id ?? (created as { id?: string })?.id ?? '';
            folderIdMap[folderPath] = folderId;
          }

          for (const { file, name, conflict, resolution } of folderItems) {
            const parts = name.split('/');
            const rawFileName = parts[parts.length - 1];
            const folderPath = parts.slice(0, -1).join('/');

            const effectiveFileName =
              conflict === 'duplicate' && resolution === 'suffix'
                ? autoSuffix(rawFileName)
                : rawFileName;

            const ext = '.' + (rawFileName.split('.').pop() ?? '').toLowerCase();
            const isTex = TEX_EXTS.has(ext);

            if (isTex) {
              try {
                const content = await new Promise<string>((resolve, reject) => {
                  const reader = new FileReader();
                  reader.onload = () => resolve(reader.result as string);
                  reader.onerror = reject;
                  reader.readAsText(file);
                });

                const fullTitle = folderPath
                  ? `${folderPath}/${effectiveFileName}`
                  : effectiveFileName;

                if (conflict === 'duplicate' && resolution === 'overwrite') {
                  const existingPage = files?.find(
                    (f) => f.title.toLowerCase() === fullTitle.toLowerCase(),
                  );
                  if (existingPage) {
                    await updateContentMutation.mutateAsync({
                      pageId: existingPage.id,
                      content,
                    });
                    lruDocumentCache.updateContent(existingPage.id, content, false);
                    editorCommandBus.dispatch({
                      type: 'document:content-updated',
                      docId: existingPage.id,
                      content,
                    });
                    continue;
                  }
                }
                await createFileMutation.mutateAsync({
                  parentPageId,
                  title: fullTitle,
                  content,
                });
              } catch (err) {
                console.error('Failed to upload folder tex:', err);
              } finally {
                onFileSettled();
              }
            } else {
              const folderParentId = folderPath ? folderIdMap[folderPath] : null;
              const fileToUpload =
                effectiveFileName !== file.name
                  ? new File([file], effectiveFileName, { type: file.type })
                  : file;
              try {
                await uploadFile.mutateAsync({
                  file: fileToUpload,
                  projectId,
                  pageId: parentPageId,
                  parentId: folderParentId ?? undefined,
                });
              } catch (uploadErr) {
                console.error('Failed:', uploadErr);
              } finally {
                onFileSettled();
              }
            }
          }
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
