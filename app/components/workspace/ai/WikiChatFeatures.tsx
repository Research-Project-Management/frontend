import {
  FileText,
  Trash2,
  FileUp,
  Database,
  FileImage,
  FileCode,
  File,
  CloudUpload,
  CheckCircle2,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { useState, useRef, useCallback, type DragEvent } from "react";
import { Switch } from "~/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { useChatMode } from "~/contexts/ChatModeContext";
import { uploadDocument } from "~/query/chat-ai";

type UploadStatus = "uploading" | "done" | "error";

type UploadedFile = {
  id: string;
  name: string;
  size: number;
  type: string;
  status: UploadStatus;
  docId?: string; // ID returned by Flux-AI after ingestion
};

const ACCEPTED_TYPES =
  ".pdf,.doc,.docx,.txt,.md,.csv,.xls,.xlsx,.png,.jpg,.jpeg,.ts,.tsx,.js,.json";

function getFileIcon(type: string, name: string) {
  if (type.startsWith("image/"))
    return <FileImage className="size-4 text-violet-500" />;
  if (
    type.includes("pdf") ||
    type.includes("word") ||
    name.endsWith(".docx") ||
    name.endsWith(".doc")
  )
    return <FileText className="size-4 text-red-500" />;
  if (type.includes("sheet") || name.endsWith(".xlsx") || name.endsWith(".csv"))
    return <FileText className="size-4 text-emerald-500" />;
  if (
    type.includes("javascript") ||
    type.includes("typescript") ||
    name.match(/\.(ts|tsx|js|jsx|json)$/)
  )
    return <FileCode className="size-4 text-blue-500" />;
  if (name.endsWith(".md") || name.endsWith(".txt"))
    return <FileText className="size-4 text-amber-500" />;
  return <File className="size-4 text-muted-foreground" />;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

export default function WikiChatFeatures() {
  const { setDocumentIds } = useChatMode();
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [useFluxData, setUseFluxData] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback(
    async (incoming: FileList | null) => {
      if (!incoming) return;
      const newEntries: UploadedFile[] = Array.from(incoming)
        .filter((file) => !files.some((f) => f.name === file.name))
        .map((file) => ({
          id: `${Date.now()}-${Math.random()}`,
          name: file.name,
          size: file.size,
          type: file.type,
          status: "uploading" as UploadStatus,
        }));

      if (newEntries.length === 0) return;
      setFiles((prev) => [...prev, ...newEntries]);

      // Upload each file and update status
      await Promise.all(
        newEntries.map(async (entry) => {
          const fileObj = Array.from(incoming).find(
            (f) => f.name === entry.name,
          )!;
          try {
            const result = await uploadDocument(fileObj);
            setFiles((prev) =>
              prev.map((f) =>
                f.id === entry.id
                  ? { ...f, status: "done", docId: result.id }
                  : f,
              ),
            );
            setDocumentIds((prev) => [...prev, result.id]);
          } catch {
            setFiles((prev) =>
              prev.map((f) =>
                f.id === entry.id ? { ...f, status: "error" } : f,
              ),
            );
          }
        }),
      );
    },
    [files, setDocumentIds],
  );

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const handleRemove = (file: UploadedFile) => {
    setFiles((prev) => prev.filter((f) => f.id !== file.id));
    if (file.docId) {
      setDocumentIds((prev) => prev.filter((id) => id !== file.docId));
    }
  };

  return (
    <div className="space-y-5">
      {/* Flux Data Toggle */}
      <div
        className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer group ${
          useFluxData ? "bg-primary/8 " : "bg-secondary/20 "
        }`}
        onClick={() => setUseFluxData((v) => !v)}
      >
        <div className="flex items-center gap-2.5">
          <div
            className={`p-1.5 rounded-lg transition-colors ${
              useFluxData
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground"
            }`}
          >
            <Database className="size-3.5" />
          </div>
          <div>
            <Tooltip>
              <TooltipTrigger asChild>
                <p className="text-xs font-semibold text-foreground">
                  Flux Data
                </p>
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-52">
                Allow the AI to access your Flux project data for more informed
                responses.
              </TooltipContent>
            </Tooltip>
            <p className="text-[10px] text-muted-foreground/70 mt-0.5">
              {useFluxData ? "Active" : "Disabled"}
            </p>
          </div>
        </div>
        <Switch
          checked={useFluxData}
          onCheckedChange={setUseFluxData}
          className="data-[state=checked]:bg-primary scale-[0.8] shrink-0"
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`relative flex flex-col items-center justify-center gap-2 py-7 px-4 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200 text-center select-none ${
          isDragging
            ? "border-primary bg-primary/8 scale-[0.99]"
            : "border-border/60 hover:border-primary/50 bg-secondary/20 hover:bg-secondary/40"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED_TYPES}
          className="hidden"
          onChange={(e) => addFiles(e.target.files)}
        />
        <div
          className={`p-2.5 rounded-xl transition-colors ${isDragging ? "bg-primary/15" : "bg-secondary"}`}
        >
          {isDragging ? (
            <CloudUpload className="size-5 text-primary" />
          ) : (
            <FileUp className="size-5 text-muted-foreground" />
          )}
        </div>
        <div>
          <p className="text-xs font-semibold text-foreground/80">
            {isDragging ? "Drop files here" : "Upload sources"}
          </p>
          <p className="text-[10px] text-muted-foreground/60 mt-0.5">
            PDF, DOCX, MD, TXT, CSV, images, code
          </p>
        </div>
        {!isDragging && (
          <p className="text-[10px] text-muted-foreground/40">
            Click or drag & drop
          </p>
        )}
      </div>

      {/* File list */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-0.5">
          <span className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">
            Sources
          </span>
          <span className="text-[10px] text-muted-foreground/50 font-medium">
            {files.length} file{files.length !== 1 ? "s" : ""}
          </span>
        </div>

        {files.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 rounded-xl bg-secondary/10 border border-dashed border-border/40 text-center">
            <FileText className="size-6 text-muted-foreground/20 mb-2" />
            <p className="text-[10px] text-muted-foreground/50">
              No files uploaded yet
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {files.map((f) => (
              <div
                key={f.id}
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg border border-border/50 bg-background hover:border-primary/30 hover:bg-secondary/30 transition-all group"
              >
                <div className="shrink-0 size-7 rounded-md bg-secondary flex items-center justify-center border border-border/50">
                  {getFileIcon(f.type, f.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate text-foreground/90 group-hover:text-primary transition-colors leading-snug">
                    {f.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                    {formatFileSize(f.size)}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {f.status === "uploading" && (
                    <Loader2 className="size-3.5 text-primary animate-spin" />
                  )}
                  {f.status === "done" && (
                    <CheckCircle2 className="size-3.5 text-emerald-500 opacity-70" />
                  )}
                  {f.status === "error" && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <AlertCircle className="size-3.5 text-destructive" />
                      </TooltipTrigger>
                      <TooltipContent side="left">Upload failed</TooltipContent>
                    </Tooltip>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemove(f)}
                    className="size-6 opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="size-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
