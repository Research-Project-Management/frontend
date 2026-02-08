import { useRef } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Download, ExternalLink, FileText, Image as ImageIcon } from "lucide-react";
import type { StorageItem } from "../types";
import { getFileType, formatFileSize } from "../pages/SharedComponents";

interface FilePreviewModalProps {
  item: StorageItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDownload: (item: StorageItem) => void;
}

export default function FilePreviewModal({ 
  item, 
  open, 
  onOpenChange, 
  onDownload 
}: FilePreviewModalProps) {
  if (!item) return null;

  const fileType = getFileType(item);
  const isImage = fileType === "image";
  const isPdf = item.filename.toLowerCase().endsWith(".pdf") || (item.mimeType === "application/pdf");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 pr-8 min-w-0">
              {isImage ? <ImageIcon className="size-5 text-green-500 shrink-0" /> : <FileText className="size-5 text-blue-500 shrink-0" />}
              <DialogTitle className="text-lg font-semibold truncate">
                {item.filename}
              </DialogTitle>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => onDownload(item)}>
                <Download className="size-4 mr-2" />
                Download
              </Button>
              {item.url && (
                <Button size="sm" variant="outline" asChild>
                  <a href={item.url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="size-4 mr-2" />
                    Open in Tab
                  </a>
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 bg-muted/30 overflow-auto flex items-center justify-center min-h-[400px]">
          {isImage && item.url ? (
            <img 
              src={item.url} 
              alt={item.filename} 
              className="max-w-full max-h-full object-contain shadow-lg bg-white" 
            />
          ) : isPdf && item.url ? (
            <iframe 
              src={`${item.url}#toolbar=0`}
              className="w-full h-full min-h-[600px] border-none"
              title={item.filename}
            />
          ) : (
            <div className="text-center p-12">
              <div className="bg-white p-8 rounded-2xl shadow-sm border inline-block mb-4">
                <FileText className="size-24 text-muted-foreground/30 mx-auto" />
              </div>
              <h3 className="text-xl font-medium mb-2">{item.filename}</h3>
              <p className="text-muted-foreground mb-6">
                Preview not available for this file type ({formatFileSize(item.size)})
              </p>
              <Button size="lg" onClick={() => onDownload(item)}>
                <Download className="size-5 mr-2" />
                Download to View
              </Button>
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-3 border-t bg-muted/5 xs:justify-start">
           <div className="text-xs text-muted-foreground">
             File Size: {formatFileSize(item.size)} • Type: {item.mimeType || "Unknown"}
           </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
