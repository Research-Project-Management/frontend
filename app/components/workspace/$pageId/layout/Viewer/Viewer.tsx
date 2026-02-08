import React, { useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  Maximize2,
  Minus,
  Play,
  Plus,
  RefreshCw,
  Save,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { Switch } from "~/components/ui/switch";
import { Label } from "~/components/ui/label";
import { Separator } from "~/components/ui/separator";
import { cn } from "~/lib/utils";

import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// Mock PDF URL for demo
const MOCK_PDF_URL =
  "https://ontheline.trincoll.edu/images/bookdown/sample-local-pdf.pdf";

interface ToolbarButtonProps {
  icon: React.ElementType;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  title?: string | null;
  variant?: "default" | "primary";
}

function ToolbarButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  loading,
  title = null,
  variant = "default",
}: ToolbarButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          disabled={disabled || loading}
          className={cn(
            "p-1.5 px-2 rounded transition-colors disabled:opacity-50 flex items-center gap-2",
            variant === "default" &&
              "text-muted-foreground hover:text-primary hover:bg-primary/10",
            variant === "primary" &&
              "bg-primary text-primary-foreground hover:bg-primary/90"
          )}
        >
          {loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <>
              <Icon className="size-4" strokeWidth={2} />
            </>
          )}
          {title && <span className="text-sm font-medium">{title}</span>}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

export default function Viewer() {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [isCompiling, setIsCompiling] = useState(false);
  const [autoSave, setAutoSave] = useState(true);
  const [lastCompiled, setLastCompiled] = useState<Date | null>(null);
  const [pdfError, setPdfError] = useState(false);
  const [scrollMode, setScrollMode] = useState(true);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setPdfError(false);
  };

  const onDocumentLoadError = () => {
    setPdfError(true);
  };

  const handleCompile = async () => {
    setIsCompiling(true);
    // Mock compile delay
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setLastCompiled(new Date());
    setIsCompiling(false);
  };

  const handleZoomIn = () => setScale((prev) => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setScale((prev) => Math.max(prev - 0.25, 0.5));
  const handleResetZoom = () => setScale(1.0);

  const handlePrevPage = () => setPageNumber((prev) => Math.max(prev - 1, 1));
  const handleNextPage = () =>
    setPageNumber((prev) => Math.min(prev + 1, numPages));

  return (
    <div className="h-full w-full flex flex-col bg-background">
      {/* Viewer Toolbar */}
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-1.5 bg-secondary">
        <div className="flex items-center gap-1">
          {/* Compile controls */}
          <ToolbarButton
            icon={Play}
            label="Compile (Ctrl+Enter)"
            onClick={handleCompile}
            loading={isCompiling}
            variant="primary"
            title={"Compile"}
          />
          <ToolbarButton
            icon={RefreshCw}
            label="Recompile"
            onClick={handleCompile}
            disabled={isCompiling}
          />

          <Separator orientation="vertical" className="h-5 mx-1" />

          {/* Auto-save toggle */}
          <div className="flex items-center gap-2 px-2">
            <Switch
              id="auto-save"
              checked={autoSave}
              onCheckedChange={setAutoSave}
              className="scale-75"
            />
            <Label
              htmlFor="auto-save"
              className="text-xs text-muted-foreground cursor-pointer"
            >
              Auto-save
            </Label>
          </div>

          <Separator orientation="vertical" className="h-5 mx-1" />

          {!autoSave && (
            <ToolbarButton icon={Save} label="Save" onClick={() => {}} />
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Zoom controls */}
          <ToolbarButton
            icon={ZoomOut}
            label="Zoom Out"
            onClick={handleZoomOut}
          />
          <button
            onClick={handleResetZoom}
            className="px-2 py-1 text-xs text-muted-foreground hover:text-primary min-w-[3rem] text-center"
          >
            {Math.round(scale * 100)}%
          </button>
          <ToolbarButton icon={ZoomIn} label="Zoom In" onClick={handleZoomIn} />

          <Separator orientation="vertical" className="h-5 mx-1" />

          {/* Page navigation */}
          <ToolbarButton
            icon={ChevronLeft}
            label="Previous Page"
            onClick={handlePrevPage}
            disabled={pageNumber <= 1}
          />
          <span className="text-xs text-muted-foreground px-1 min-w-[4rem] text-center">
            {numPages > 0 ? `${pageNumber} / ${numPages}` : "- / -"}
          </span>
          <ToolbarButton
            icon={ChevronRight}
            label="Next Page"
            onClick={handleNextPage}
            disabled={pageNumber >= numPages}
          />

          <Separator orientation="vertical" className="h-5 mx-1" />

          <ToolbarButton
            icon={Maximize2}
            label="Fullscreen"
            onClick={() => {}}
          />
          <ToolbarButton
            icon={Download}
            label="Download PDF"
            onClick={() => {}}
          />
        </div>
      </div>

      {/* PDF Viewer */}
      <div className="flex-1 overflow-auto bg-muted/30 flex justify-center p-4">
        {pdfError ? (
          <div className="flex flex-col items-center justify-center text-muted-foreground gap-4">
            <div className="text-center">
              <p className="text-sm font-medium">No PDF available</p>
              <p className="text-xs mt-1">
                Click "Compile" to generate the PDF preview
              </p>
            </div>
            <button
              onClick={handleCompile}
              disabled={isCompiling}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {isCompiling ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Play className="size-4" />
              )}
              {isCompiling ? "Compiling..." : "Compile"}
            </button>
          </div>
        ) : (
          <Document
            file={MOCK_PDF_URL}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={
              <div className="flex items-center justify-center h-full">
                <Loader2 className="size-8 animate-spin text-muted-foreground" />
              </div>
            }
          >
            {scrollMode ? (
              <div className="flex flex-col gap-4">
                {Array.from(new Array(numPages), (_, index) => (
                  <Page
                    key={`page_${index + 1}`}
                    pageNumber={index + 1}
                    scale={scale}
                    className="shadow-lg"
                    renderTextLayer={true}
                    renderAnnotationLayer={true}
                  />
                ))}
              </div>
            ) : (
              <Page
                pageNumber={pageNumber}
                scale={scale}
                className="shadow-lg"
                renderTextLayer={true}
                renderAnnotationLayer={true}
              />
            )}
          </Document>
        )}
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-3 py-1 border-t border-border bg-secondary text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          {isCompiling && (
            <span className="flex items-center gap-1">
              <Loader2 className="size-3 animate-spin" />
              Compiling...
            </span>
          )}
          {!isCompiling && lastCompiled && (
            <span>Last compiled: {lastCompiled.toLocaleTimeString()}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {autoSave && (
            <span className="text-green-600">● Auto-save enabled</span>
          )}
        </div>
      </div>
    </div>
  );
}
