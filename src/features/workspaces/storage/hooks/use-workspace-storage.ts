import { useState, useCallback, useRef } from "react";
import { 
  checkDuplicate as workspaceCheckDuplicate, 
  deleteFile as workspaceDeleteFile, 
} from "@/features/workspaces/storage/services/file.services";
import { useUploadFile as useWorkspaceUploadMutation } from "@/features/workspaces/storage/hooks/use-file";

import { toast } from "sonner";
import { 
  MAX_STORAGE_FILE_SIZE_BYTES, 
  MAX_FILES_PER_BATCH, 
  UPLOAD_ERROR_MESSAGES 
} from "@/config/file.config";

export type DuplicateAction = "overwrite" | "keep-both" | "cancel";

export interface StorageUploadItem {
  id: string;
  file: File;
  progress: number;
  status: "pending" | "duplicate-check" | "uploading" | "success" | "error" | "skipped";
  targetFolder: string | null;
}

export function useWorkspaceStorage(workspaceId: string) {
  const [queue, setQueue] = useState<StorageUploadItem[]>([]);
  const [duplicateFile, setDuplicateFile] = useState<StorageUploadItem | null>(null);
  
  // We use the existing mutations to ensure cache invalidation happens properly.
  const workspaceUpload = useWorkspaceUploadMutation();
  
  // Ref to store the resolve function for the duplicate prompt
  const duplicateResolveRef = useRef<((action: DuplicateAction) => void) | null>(null);

  const addFilesToQueue = useCallback((files: File[], targetFolder: string | null = null) => {
    if (files.length > MAX_FILES_PER_BATCH) {
      toast.error(UPLOAD_ERROR_MESSAGES.TOO_MANY_FILES);
      return;
    }

    const validFiles: StorageUploadItem[] = [];
    files.forEach(file => {
      if (file.size > MAX_STORAGE_FILE_SIZE_BYTES) {
        toast.error(UPLOAD_ERROR_MESSAGES.FILE_TOO_LARGE(file.name));
      } else {
        validFiles.push({
          id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(7),
          file,
          progress: 0,
          status: "pending",
          targetFolder
        });
      }
    });

    if (validFiles.length > 0) {
      setQueue(prev => [...prev, ...validFiles]);
    }
  }, []);

  const updateQueueItem = useCallback((id: string, updates: Partial<StorageUploadItem>) => {
    setQueue(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  }, []);

  const generateUniqueName = useCallback((filename: string, existingNames: Set<string>): string => {
    const dotIndex = filename.lastIndexOf(".");
    const name = dotIndex !== -1 ? filename.substring(0, dotIndex) : filename;
    const ext = dotIndex !== -1 ? filename.substring(dotIndex) : "";

    let count = 1;
    let newName = `${name} (${count})${ext}`;
    while (existingNames.has(newName)) {
      count++;
      newName = `${name} (${count})${ext}`;
    }
    return newName;
  }, []);

  const promptDuplicate = useCallback((item: StorageUploadItem): Promise<DuplicateAction> => {
    return new Promise((resolve) => {
      setDuplicateFile(item);
      duplicateResolveRef.current = resolve;
    });
  }, []);

  const resolveDuplicate = useCallback((action: DuplicateAction) => {
    if (duplicateResolveRef.current) {
      duplicateResolveRef.current(action);
      duplicateResolveRef.current = null;
    }
    setDuplicateFile(null);
  }, []);

  const processQueue = useCallback(async () => {
    // Collect existing names for this batch to prevent generating the same name twice
    const existingNames = new Set<string>();

    for (let i = 0; i < queue.length; i++) {
      const item = queue[i];
      if (item.status !== "pending") continue;

      updateQueueItem(item.id, { status: "duplicate-check" });

      let fileToUpload = item.file;
      let shouldUpload = true;

      try {
        const existsRes = await workspaceCheckDuplicate(fileToUpload.name, item.targetFolder, { workspaceId });
          
        if (existsRes.exists) {
          const action = await promptDuplicate(item);

          if (action === "cancel") {
            updateQueueItem(item.id, { status: "skipped" });
            shouldUpload = false;
          } else if (action === "overwrite" && existsRes.existingFile?._id) {
            try {
              await workspaceDeleteFile(existsRes.existingFile._id);
            } catch {
              // Best effort delete
            }
          } else if (action === "keep-both") {
            const newName = generateUniqueName(fileToUpload.name, existingNames);
            fileToUpload = new File([fileToUpload], newName, { type: fileToUpload.type });
          }
        }
      } catch (err) {
        // Proceed with upload if duplicate check fails
      }

      if (!shouldUpload) continue;

      updateQueueItem(item.id, { status: "uploading", progress: 0 });

      try {
        await workspaceUpload.mutateAsync({
          file: fileToUpload,
          workspaceId,
          parentId: item.targetFolder ?? undefined,
          onProgress: (progress: number) => {
            updateQueueItem(item.id, { progress });
          }
        });

        existingNames.add(fileToUpload.name);
        updateQueueItem(item.id, { status: "success", progress: 100 });
      } catch (error) {
        updateQueueItem(item.id, { status: "error", progress: 0 });
      }
    }
  }, [queue, workspaceId, promptDuplicate, generateUniqueName, workspaceUpload, updateQueueItem]);

  return {
    queue,
    addFilesToQueue,
    processQueue,
    duplicateFile,
    resolveDuplicate,
    setQueue, // Allow clear
  };
}
