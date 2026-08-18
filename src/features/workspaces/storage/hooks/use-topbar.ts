import { useState, useRef, useCallback } from 'react';
import { useUpload } from '@/shared/hooks/use-upload';
import { useCreateFileRecord } from "./use-storage";
import { toast } from "sonner";
import { checkDuplicateFile, deleteItem } from '../services/file.service';
import type { UploadMode } from '../components/modal/DuplicateModal';

export function useTopbar({
  workspaceId,
  parentId,
  searchQuery = "",
  onSearchChange
}: {
  workspaceId?: string;
  parentId?: string | null;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}) {
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const { uploadFile } = useUpload();
  const { mutateAsync: createFileRecord } = useCreateFileRecord();

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

  const handleCreateFolder = () => {
    const event = new CustomEvent('open-create-folder');
    window.dispatchEvent(event);
  };

  const performSingleFileUpload = async (file: File, targetFolder: string | null) => {
    if (!workspaceId) return;
    const uploadPromise = async () => {
      const url = await uploadFile(file, {
        prefix: `workspace/${workspaceId}`,
      });
      
      await createFileRecord({
        workspaceId: workspaceId,
        filename: file.name,
        size: file.size,
        mimeType: file.type,
        url,
        parentId: targetFolder,
      });
    };

    toast.promise(uploadPromise(), {
      loading: `Uploading ${file.name}...`,
      success: `${file.name} uploaded successfully`,
      error: `Failed to upload ${file.name}`,
    });
    
    // Await the toast promise execution so the loop waits for this to finish
    await uploadPromise().catch((err) => console.error(err));
  };

  const handleUploadFiles = useCallback(async (filesToUpload: File[], targetFolder: string | null) => {
    if (!workspaceId) return;

    for (const file of filesToUpload) {
      try {
        const check = await checkDuplicateFile(workspaceId, file.name, targetFolder);
        
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
  }, [uploadFile, workspaceId, createFileRecord]);

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
    handleCreateFolder,
    handleFileSelect,
    handleFolderSelect,
    folderInputRef,
  };
}
