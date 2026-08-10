'use client';

import { useState } from "react";
import { uploadGenericFile } from "../services/storage.services";

export function useUpload() {
  const [isUploading, setIsUploading] = useState(false);

  const uploadFile = async (file: File, prefix = "tasks"): Promise<string> => {
    setIsUploading(true);
    try {
      return await uploadGenericFile(file, prefix);
    } finally {
      setIsUploading(false);
    }
  };

  // Backward-compatible alias used by workspace avatar flows.
  const uploadAvatar = (file: File): Promise<string> => uploadFile(file, "workspace/avatars");

  return { uploadFile, uploadAvatar, isUploading };
}
