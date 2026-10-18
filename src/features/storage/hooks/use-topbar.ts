'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from "sonner";
import { uploadFile } from '../services/upload.service';
import { storageKeys } from '../constants/storage.keys';
import { getAllFiles, createFolder, deleteItem } from '../services/file.service';
import type { UploadMode } from '../components/modal/DuplicateModal';
import type { StorageItem } from '../types/storage.types';
import { useStorageUIStore } from '../store/storage-ui.store';

export function useTopbar({
  projectId,
  parentId,
  searchQuery = "",
  onSearchChange
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

  // State for Duplicate Modal Queue
  const [duplicatePrompt, setDuplicatePrompt] = useState<{
    file: File;
    resolve: (mode: UploadMode | "cancel") => void;
  } | null>(null);

  const handleSearchChange = (query: string) => {
    onSearchChange?.(query);
  };

  const handleClearSearch = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSearchChange?.("");
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

  const uploadTriggerCount = useStorageUIStore((s) => s.uploadTriggerCount);
  const prevTriggerRef = useRef(uploadTriggerCount);

  const handleCreateFolder = () => {
    useStorageUIStore.getState().openCreateFolderModal();
  };

  useEffect(() => {
    if (uploadTriggerCount > prevTriggerRef.current) {
      prevTriggerRef.current = uploadTriggerCount;
      fileInputRef.current?.click();
    }
  }, [uploadTriggerCount]);

  const performSingleFileUpload = useCallback(async (file: File, targetFolder: string | null) => {
    const doUpload = async () => {
      const res = await uploadFile(file, {
        projectId,
        parentId: targetFolder,
      });
      await queryClient.invalidateQueries({ queryKey: storageKeys.all });
      return res;
    };

    const uploadPromise = doUpload();

    toast.promise(uploadPromise, {
      loading: `Uploading ${file.name}...`,
      success: `${file.name} uploaded successfully`,
      error: (err: unknown) => (err instanceof Error ? err.message : undefined) || `Failed to upload ${file.name}`,
    });
    
    // Await the single upload promise so sequential uploads in loop wait for completion
    await uploadPromise.catch((err) => console.error(err));
  }, [projectId, queryClient]);

  const handleUploadFiles = useCallback(async (filesToUpload: File[], targetFolder: string | null) => {
    if (filesToUpload.length === 0) return;

    // Fetch existing items once for the target folder instead of N+1 API calls
    let existingItems: StorageItem[] = [];
    try {
      const res = await getAllFiles(scopeId, targetFolder);
      existingItems = res?.files || [];
    } catch {
      existingItems = [];
    }

    // Cache created folder IDs by relative path during folder uploads
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

    for (const file of filesToUpload) {
      try {
        const relPath = (file as File & { webkitRelativePath?: string }).webkitRelativePath || '';
        const pathParts = relPath ? relPath.split('/').filter(Boolean) : [];
        const relDir = pathParts.length > 1 ? pathParts.slice(0, -1).join('/') : '';
        const destFolder = relDir ? await ensureFolderPath(relDir) : targetFolder;

        const existingFile =
          destFolder === targetFolder
            ? existingItems.find((item) => !item.isFolder && item.filename === file.name)
            : undefined;

        if (existingFile) {
          // Pause execution and wait for user response
          const mode = await new Promise<UploadMode | "cancel">((resolve) => {
            setDuplicatePrompt({ file, resolve });
          });
          setDuplicatePrompt(null); // Close modal

          if (mode === "cancel") {
            continue; // Skip this file
          } else if (mode === "replace") {
            await deleteItem(existingFile.id);
            await performSingleFileUpload(file, destFolder);
          } else if (mode === "keep-both") {
            const parts = file.name.split(".");
            const ext = parts.length > 1 ? `.${parts.pop()}` : "";
            const name = parts.join(".");
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
  }, [scopeId, projectId, performSingleFileUpload]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleUploadFiles(Array.from(e.target.files), parentId ?? null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleUploadFiles(Array.from(e.target.files), parentId ?? null);
    }
    if (folderInputRef.current) {
      folderInputRef.current.value = "";
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
