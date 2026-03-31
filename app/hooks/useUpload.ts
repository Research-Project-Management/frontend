import { useState } from "react";
import { apiPost } from "~/lib/api";

export function useUpload() {
  const [isUploading, setIsUploading] = useState(false);

  const uploadAvatar = async (file: File): Promise<string> => {
    setIsUploading(true);
    try {
      // 1. Get presigned URL
      const { url: presignedUrl, path } = await apiPost<{ url: string; path: string }>(
        "/api/files/presign",
        { fileName: `avatars/${Date.now()}-${file.name}` }
      );

      // 2. Upload to R2
      const uploadResponse = await fetch(presignedUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!uploadResponse.ok) throw new Error("Failed to upload file to storage");

      // 3. Return the proxy URL
      // We use the same API_URL base as defined in lib/api.ts via the endpoint
      // But since lib/api.ts doesn't export a getter for the full URL easily,
      // and we need the public URL for the avatar:
      return `/api/files/${path}`;
    } finally {
      setIsUploading(false);
    }
  };

  return { uploadAvatar, isUploading };
}
