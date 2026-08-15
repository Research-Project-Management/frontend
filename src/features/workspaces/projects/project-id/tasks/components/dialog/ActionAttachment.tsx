'use client';

import { useRef, useState, type ChangeEvent, type Dispatch, type SetStateAction } from "react";
import { Paperclip } from "lucide-react";
import { useUpload } from '@/shared/hooks';
import type { TaskAttachment } from "../../types/task.types";
import { Button } from "@/shared/components/ui";

export function createTaskAttachmentFromUpload(file: File, url: string): TaskAttachment {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    name: file.name,
    type: file.type || "application/octet-stream",
    size: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
    createdAt: new Date().toISOString(),
    url,
  };
}

export interface ActionAttachmentProps {
  actionBtnClass?: string;
  setAttachments?: Dispatch<SetStateAction<TaskAttachment[]>>;
}

export function ActionAttachment({
  actionBtnClass,
  setAttachments,
}: ActionAttachmentProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { uploadFile, isUploading } = useUpload();
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !setAttachments) return;

    setUploadError(null);

    try {
      const url = await uploadFile(file, "project/tasks");
      const newAttachment = createTaskAttachmentFromUpload(file, url);
      setAttachments((prev) => [...prev, newAttachment]);
    } catch (error) {
      console.error("Upload failed", error);
      setUploadError("Upload failed. Please try again.");
    } finally {
      e.target.value = "";
    }
  };

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileSelect}
        disabled={isUploading}
      />
      <Button
        type="button"
        variant="outline"
        className={
          actionBtnClass ??
          "h-10 rounded-sm border border-border bg-background px-4 text-[15px] font-medium text-foreground shadow-none transition-colors hover:bg-muted cursor-pointer"
        }
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
      >
        <Paperclip className="mr-2 h-4 w-4 text-foreground" />
        {isUploading ? "Uploading..." : "Attachment"}
      </Button>
      {uploadError ? (
        <p className="text-[12px] text-destructive">{uploadError}</p>
      ) : null}
    </div>
  );
}

export const ActionAttachmentSection = ActionAttachment;
