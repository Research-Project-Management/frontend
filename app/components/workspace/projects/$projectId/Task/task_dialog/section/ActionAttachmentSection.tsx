import { useRef, useState, type ChangeEvent, type Dispatch, type SetStateAction } from "react";
import { Paperclip } from "lucide-react";
import { useUpload } from "~/hooks/useUpload";
import {
  createTaskAttachmentFromUpload,
  type TaskAttachment,
} from "~/query/task";
import { Button } from "@/components/ui/button";

type ActionAttachmentSectionProps = {
  actionBtnClass?: string;
  setAttachments?: Dispatch<SetStateAction<TaskAttachment[]>>;
};

export function ActionAttachmentSection({
  actionBtnClass,
  setAttachments,
}: ActionAttachmentSectionProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { uploadFile, isUploading } = useUpload();
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !setAttachments) return;

    setUploadError(null);

    try {
      const url = await uploadFile(file, "tasks");
      const newAttachment = createTaskAttachmentFromUpload(file, url);
      setAttachments((prev) => [...prev, newAttachment]);
    } catch (error) {
      console.error("Upload failed", error);
      setUploadError("Failed to upload file. Please try again.");
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
          "h-10 rounded-[8px] border border-[#d9d9d9] bg-white px-4 text-[15px] font-medium text-[#333] shadow-none transition-colors hover:bg-[#f7f7f7]"
        }
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
      >
        <Paperclip className="mr-2 h-4 w-4" />
        {isUploading ? "Uploading..." : "Attach"}
      </Button>
      {uploadError ? (
        <p className="text-[12px] text-[#c9372c]">{uploadError}</p>
      ) : null}
    </div>
  );
}
