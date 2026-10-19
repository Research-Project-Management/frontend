'use client';

import { useState, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { uploadFile } from '../services/upload.service';
import { storageKeys } from '../constants/storage.keys';
import {
  getAllFiles,
  createFolder,
  deleteItem,
  uploadNewFileVersion,
} from '../services/drive.service';
import type { UploadMode } from '../components/modal/DuplicateModal';
import type { StorageItem } from '../types/storage.types';
import { useStorageUIStore } from '../store/storage-ui.store';

export function useTopbar({
  projectId,
  parentId,
  onSearchChange,
}: {
  projectId?: string;
  parentId?: string | null;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}) {
  const scopeId = projectId;
  const queryClient = useQueryClient();
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const duplicatePrompt = useStorageUIStore((s) => s.duplicatePrompt);
  const setDuplicatePrompt = useStorageUIStore((s) => s.setDuplicatePrompt);

  const handleSearchChange = (query: string) => {
    onSearchChange?.(query);
  };

  const handleClearSearch = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSearchChange?.('');
    setIsSearchExpanded(false);
  };

  const expandSearch = () => {
    if (!isSearchExpanded) {
      setIsSearchExpanded(true);
    }
  };

  const collapseSearch = (currentQuery: string) => {
    if (!currentQuery) {
      setIsSearchExpanded(false);
    }
  };

  const handleUploadFile = () => {
    fileInputRef.current?.click();
  };

  const handleUploadFolder = () => {
    folderInputRef.current?.click();
  };

  const handleCreateFolder = () => {
    useStorageUIStore.getState().openCreateFolderModal();
  };

  const performSingleFileUpload = useCallback(
    async (file: File, targetFolder: string | null) => {
      const uploadPromise = uploadFile(file, {
        projectId,
        parentId: targetFolder,
      });

      toast.promise(uploadPromise, {
        loading: `Uploading ${file.name}...`,
        success: `${file.name} uploaded successfully`,
        error: (err: unknown) =>
          (err instanceof Error ? err.message : undefined) ||
          `Failed to upload ${file.name}`,
      });

      await uploadPromise.catch((err) => console.error(err));
    },
    [projectId],
  );

  const handleUploadFiles = useCallback(
    async (filesToUpload: File[], targetFolder: string | null) => {
      if (filesToUpload.length === 0) return;

      let existingItems: StorageItem[] = [];
      try {
        const res = await getAllFiles(scopeId, targetFolder);
        existingItems = res?.files || [];
      } catch {
        existingItems = [];
      }

      const folderPathCache = new Map<string, string | null>();
      folderPathCache.set('', targetFolder);

      const ensureFolderPath = async (relDirPath: string): Promise<string | null> => {
        if (!relDirPath) return targetFolder;
        if (folderPathCache.has(relDirPath)) {
          return folderPathCache.get(relDirPath) ?? targetFolder;
        }
        const segments = relDirPath.split('/').filter(Boolean);
        let currentParent = targetFolder;
        let builtPath = '';
        for (const seg of segments) {
          builtPath = builtPath ? `${builtPath}/${seg}` : seg;
          if (folderPathCache.has(builtPath)) {
            currentParent = folderPathCache.get(builtPath) ?? null;
            continue;
          }
          try {
            const created = (await createFolder(seg, {
              projectId,
              parentId: currentParent,
            })) as { id?: string; folder?: { id?: string } };
            const folderId = created?.id || created?.folder?.id || currentParent;
            folderPathCache.set(builtPath, folderId);
            currentParent = folderId;
          } catch {
            folderPathCache.set(builtPath, currentParent);
          }
        }
        return currentParent;
      };

      try {
        for (const file of filesToUpload) {
          try {
            const relPath =
              (file as File & { webkitRelativePath?: string }).webkitRelativePath || '';
            const pathParts = relPath ? relPath.split('/').filter(Boolean) : [];
            const relDir = pathParts.length > 1 ? pathParts.slice(0, -1).join('/') : '';
            const destFolder = relDir ? await ensureFolderPath(relDir) : targetFolder;

            const existingFile =
              destFolder === targetFolder
                ? existingItems.find((item) => !item.isFolder && item.filename === file.name)
                : undefined;

            if (existingFile) {
              const mode = await new Promise<UploadMode | 'cancel'>((resolve) => {
                setDuplicatePrompt({ file, resolve });
              });
              setDuplicatePrompt(null);

              if (mode === 'cancel') {
                continue;
              } else if (mode === 'replace') {
                const versionPromise = uploadNewFileVersion(
                  existingFile.id,
                  file,
                  'Replaced via duplicate upload',
                );
                toast.promise(versionPromise, {
                  loading: `Replacing ${file.name} with new version...`,
                  success: `${file.name} updated to a new version`,
                  error: (err: unknown) =>
                    (err instanceof Error ? err.message : undefined) ||
                    `Failed to replace ${file.name}`,
                });
                await versionPromise.catch(() => {
                  // Fallback only if versioning endpoint is unavailable
                  return deleteItem(existingFile.id).then(() =>
                    performSingleFileUpload(file, destFolder),
                  );
                });
              } else if (mode === 'keep-both') {
                const parts = file.name.split('.');
                const ext = parts.length > 1 ? `.${parts.pop()}` : '';
                const name = parts.join('.');
                const newName = `${name} (${Date.now().toString().slice(-4)})${ext}`;
                const renamedFile = new File([file], newName, { type: file.type });
                await performSingleFileUpload(renamedFile, destFolder);
              }
            } else {
              await performSingleFileUpload(file, destFolder);
            }
          } catch (err) {
            console.error(err);
          }
        }
      } finally {
        await queryClient.invalidateQueries({ queryKey: storageKeys.all });
      }
    },
    [scopeId, projectId, performSingleFileUpload, setDuplicatePrompt, queryClient],
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      void handleUploadFiles(Array.from(e.target.files), parentId ?? null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      void handleUploadFiles(Array.from(e.target.files), parentId ?? null);
    }
    if (folderInputRef.current) {
      folderInputRef.current.value = '';
    }
  };

  return {
    isSearchExpanded,
    inputRef,
    fileInputRef,
    duplicatePrompt,
    expandSearch,
    collapseSearch,
    handleSearchChange,
    handleClearSearch,
    handleUploadFile,
    handleUploadFolder,
    handleUploadFiles,
    handleCreateFolder,
    handleFileSelect,
    handleFolderSelect,
    folderInputRef,
  };
}
