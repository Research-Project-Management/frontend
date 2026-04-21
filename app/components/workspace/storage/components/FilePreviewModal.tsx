import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import {
  Download,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Film,
  Music,
  Loader2,
} from "lucide-react";
import type { StorageItem } from "../types";
import { getFileType, formatFileSize, formatDate } from "../pages/SharedComponents";
import { useBlobUrl, downloadFileAsBlob } from "~/hooks/useBlobUrl";
import { resolveFileUrl } from "~/lib/api";

interface FilePreviewModalProps {
  item: StorageItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function FilePreviewModal({
  item,
  open,
  onOpenChange,
}: FilePreviewModalProps) {
  if (!item) return null;

  const fileType = getFileType(item);
  const isImage = fileType === "image";
  const isPdf =
    item.filename.toLowerCase().endsWith(".pdf") ||
    item.mimeType === "application/pdf";
  const isVideo = fileType === "video";
  const isAudio = fileType === "audio";
  const isPreviewable = isImage || isPdf || isVideo || isAudio;

  const resolvedUrl = resolveFileUrl(item.url);

  const { blobUrl, loading } = useBlobUrl(open && resolvedUrl ? resolvedUrl : null);

  const handleDownload = async () => {
    if (!resolvedUrl) return;
    try {
      await downloadFileAsBlob(resolvedUrl, item.filename);
    } catch (err) {
      console.error("Download failed:", err);
      // Fallback: open in new tab
      window.open(resolvedUrl, "_blank");
    }
  };

  const typeIcon = isImage ? (
    <ImageIcon className="size-5 text-green-500 shrink-0" />
  ) : isVideo ? (
    <Film className="size-5 text-purple-500 shrink-0" />
  ) : isAudio ? (
    <Music className="size-5 text-amber-500 shrink-0" />
  ) : (
    <FileText className="size-5 text-blue-500 shrink-0" />
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 pr-8 min-w-0">
              {typeIcon}
              <DialogTitle className="text-lg font-semibold truncate">
                {item.filename}
              </DialogTitle>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={handleDownload}>
                <Download className="size-4 mr-2" />
                Download
              </Button>
              {resolvedUrl && (
                <Button size="sm" variant="outline" asChild>
                  <a
                    href={resolvedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="size-4 mr-2" />
                    Open
                  </a>
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Preview Area */}
        <div className="flex-1 bg-muted/30 overflow-auto flex items-center justify-center min-h-[400px]">
          {loading ? (
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <Loader2 className="size-8 animate-spin" />
              <p className="text-sm">Loading preview...</p>
            </div>
          ) : isImage && blobUrl ? (
            <img
              src={blobUrl}
              alt={item.filename}
              className="max-w-full max-h-full object-contain shadow-lg bg-white dark:bg-black/20"
            />
          ) : isPdf && blobUrl ? (
            <iframe
              src={`${blobUrl}#toolbar=0`}
              className="w-full h-full min-h-[600px] border-none"
              title={item.filename}
            />
          ) : isVideo && blobUrl ? (
            <video
              src={blobUrl}
              controls
              className="max-w-full max-h-full rounded-lg shadow-lg"
            >
              Your browser does not support video playback.
            </video>
          ) : isAudio && blobUrl ? (
            <div className="flex flex-col items-center gap-6 p-12">
              <div className="bg-gradient-to-br from-amber-500/20 to-orange-500/20 p-8 rounded-3xl">
                <Music className="size-16 text-amber-500" />
              </div>
              <h3 className="text-lg font-medium">{item.filename}</h3>
              <audio src={blobUrl} controls className="w-full max-w-md">
                Your browser does not support audio playback.
              </audio>
            </div>
          ) : (
            <div className="text-center p-12">
              <div className="bg-white dark:bg-muted p-8 rounded-2xl shadow-sm border inline-block mb-4">
                <FileText className="size-24 text-muted-foreground/30 mx-auto" />
              </div>
              <h3 className="text-xl font-medium mb-2">{item.filename}</h3>
              <p className="text-muted-foreground mb-6">
                Preview not available for this file type (
                {formatFileSize(item.size)})
              </p>
              <Button size="lg" onClick={handleDownload}>
                <Download className="size-5 mr-2" />
                Download to View
              </Button>
            </div>
          )}
        </div>

        {/* Footer with metadata */}
        <DialogFooter className="px-6 py-3 border-t bg-muted/5 xs:justify-start">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground w-full">
            <span>Size: {formatFileSize(item.size)}</span>
            <span>Type: {item.mimeType || "Unknown"}</span>
            {item.author && <span>Owner: {item.author.name}</span>}
            <span>Modified: {formatDate(item.updatedAt)}</span>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
