import React from "react";
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Download,
  Loader2,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";

interface PdfViewerToolbarProps {
  pageNumber: number;
  numPages: number | null;
  zoom: number;
  onPageChange: (page: number) => void;
  onZoomChange: (zoom: number) => void;
  onFitWidth: () => void;
  downloadUrl: string;
  filename: string;
  loading: boolean;
}

export default function PdfViewerToolbar({
  pageNumber,
  numPages,
  zoom,
  onPageChange,
  onZoomChange,
  onFitWidth,
  downloadUrl,
  filename,
  loading,
}: PdfViewerToolbarProps) {
  const handlePageInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      const val = parseInt(e.currentTarget.value);
      if (!isNaN(val) && val >= 1 && numPages && val <= numPages) {
        onPageChange(val);
      } else {
        e.currentTarget.value = String(pageNumber);
      }
    }
  };

  return (
    <div className="flex items-center justify-between border-b border-[#dadce0] dark:border-zinc-700 bg-white dark:bg-zinc-900 h-[53px] px-4 shrink-0 select-none">
      {/* Left: Page navigation */}
      <div className="flex items-center gap-1.5">
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          disabled={pageNumber <= 1 || loading}
          onClick={() => onPageChange(pageNumber - 1)}
        >
          <ChevronLeft className="size-4" />
        </Button>

        <div className="flex items-center gap-1">
          <Input
            key={pageNumber}
            defaultValue={pageNumber}
            onKeyDown={handlePageInput}
            disabled={loading || !numPages}
            className="h-8 w-11 text-center text-xs px-1 font-mono focus-visible:ring-1"
          />
          <span className="text-xs text-muted-foreground font-medium pr-1">
            / {numPages ?? "—"}
          </span>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          disabled={numPages ? pageNumber >= numPages : true || loading}
          onClick={() => onPageChange(pageNumber + 1)}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>

      {/* Center: Zoom and Fit controls */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          disabled={zoom <= 0.5 || loading}
          onClick={() => onZoomChange(Math.max(0.5, zoom - 0.1))}
          title="Zoom Out"
        >
          <ZoomOut className="size-4" />
        </Button>

        <span className="text-xs font-mono font-medium min-w-[3.5rem] text-center">
          {Math.round(zoom * 100)}%
        </span>

        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          disabled={zoom >= 3.0 || loading}
          onClick={() => onZoomChange(Math.min(3.0, zoom + 0.1))}
          title="Zoom In"
        >
          <ZoomIn className="size-4" />
        </Button>

        <div className="h-4 w-px bg-border mx-1" />

        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={onFitWidth}
          disabled={loading}
          title="Fit Width"
        >
          <Maximize2 className="size-4" />
        </Button>
      </div>

      {/* Right: Info / Download */}
      <div className="flex items-center gap-2">
        {loading && (
          <Loader2 className="size-3.5 animate-spin text-muted-foreground mr-1" />
        )}
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs font-medium gap-1.5"
          asChild
        >
          <a
            href={downloadUrl}
            download={filename}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Download className="size-3.5" />
            <span className="hidden sm:inline">Download</span>
          </a>
        </Button>
      </div>
    </div>
  );
}
