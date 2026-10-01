import { useState, useRef, useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from "sonner";
import { uploadFile } from '../services/upload.service';
import { storageKeys } from '../constants/storage.keys';
import { checkDuplicateFile, deleteItem } from '../services/file.service';
import type { UploadMode } from '../components/modal/DuplicateModal';
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
      error: (err: any) => err?.message || `Failed to upload ${file.name}`,
    });
    
    // Await the single upload promise so sequential uploads in loop wait for completion
    await uploadPromise.catch((err) => console.error(err));
  }, [projectId, queryClient]);

  const handleUploadFiles = useCallback(async (filesToUpload: File[], targetFolder: string | null) => {
    for (const file of filesToUpload) {
      try {
        const check = await checkDuplicateFile(scopeId, file.name, targetFolder);
        
        if (check.exists && check.existingFile) {
          // Pause execution and wait for user response
          const mode = await new Promise<UploadMode | "cancel">((resolve) => {
            setDuplicatePrompt({ file, resolve });
          });
          setDuplicatePrompt(null); // Close modal

          if (mode === "cancel") {
            continue; // Skip this file
          } else if (mode === "replace") {
            // Delete old record
            await deleteItem(check.existingFile.id);
            await performSingleFileUpload(file, targetFolder);
          } else if (mode === "keep-both") {
            // Rename file and upload
            const parts = file.name.split(".");
            const ext = parts.length > 1 ? `.${parts.pop()}` : "";
            const name = parts.join(".");
            const newName = `${name} (${Date.now().toString().slice(-4)})${ext}`;
            const renamedFile = new File([file], newName, { type: file.type });
            await performSingleFileUpload(renamedFile, targetFolder);
          }
        } else {
          // No duplicate, upload normally
          await performSingleFileUpload(file, targetFolder);
        }
      } catch (err) {
        console.error(err);
      }
    }
  }, [scopeId, performSingleFileUpload]);

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
