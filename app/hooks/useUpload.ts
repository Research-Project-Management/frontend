import { useState } from "react";
import { apiPost } from "~/lib/api";
import { API_URL } from "~/lib/api";

export function useUpload() {
  const [isUploading, setIsUploading] = useState(false);

  const uploadFile = async (file: File, prefix = "tasks"): Promise<string> => {
    setIsUploading(true);
    try {
      // 1. Get presigned URL
      const { url: presignedUrl, path } = await apiPost<{ url: string; path: string }>(
        "/api/files/presign",
        { fileName: `${prefix}/${Date.now()}-${file.name}` }
      );

      // 2. Upload to R2
      const uploadResponse = await fetch(presignedUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!uploadResponse.ok) throw new Error("Failed to upload file to storage");

      return `${API_URL}/api/files/${path}`;
    } finally {
      setIsUploading(false);
    }
  };

  // Backward-compatible alias used by workspace avatar flows.
  const uploadAvatar = (file: File): Promise<string> => uploadFile(file, "workspace/avatars");

  return { uploadFile, uploadAvatar, isUploading };
}
