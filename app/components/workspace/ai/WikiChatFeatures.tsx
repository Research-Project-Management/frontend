import {
  FileText,
  Trash2,
  FileUp,
  Database,
  FileImage,
  FileCode,
  File,
  CloudUpload,
  Loader2,
  AlertCircle,
  Eye,
} from "lucide-react";
import {
  useState,
  useRef,
  useCallback,
  useEffect,
  type DragEvent,
} from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { useChatMode } from "~/contexts/ChatModeContext";
import {
  uploadDocument,
  fetchDocumentsBulk,
  fetchDocumentContent,
} from "~/query/chat-ai";

type UploadingEntry = {
  tempId: string;
  name: string;
  size: number;
  error?: boolean;
};

const ACCEPTED_TYPES =
  ".pdf,.doc,.docx,.txt,.md,.csv,.xls,.xlsx,.png,.jpg,.jpeg,.ts,.tsx,.js,.json";

function getFileIcon(name: string) {
  const n = (name || "").toLowerCase();
  if (/\.(png|jpg|jpeg|gif|webp)$/.test(n))
    return <FileImage className="size-3.5 shrink-0 text-violet-400" />;
  if (/\.(pdf|doc|docx)$/.test(n))
    return <FileText className="size-3.5 shrink-0 text-rose-400" />;
  if (/\.(xls|xlsx|csv)$/.test(n))
    return <FileText className="size-3.5 shrink-0 text-emerald-400" />;
  if (/\.(ts|tsx|js|jsx|json)$/.test(n))
    return <FileCode className="size-3.5 shrink-0 text-sky-400" />;
  if (/\.(md|txt)$/.test(n))
    return <FileText className="size-3.5 shrink-0 text-amber-400" />;
  return <File className="size-3.5 shrink-0 text-muted-foreground/40" />;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

export default function WikiChatFeatures() {
  const {
    sources,
    addSource,
    removeSource,
    toggleSource,
    fluxDataEnabled,
    setFluxDataEnabled,
    updateSourceName,
  } = useChatMode();

  const [uploading, setUploading] = useState<UploadingEntry[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [viewingDoc, setViewingDoc] = useState<{
    id: string;
    title: string;
    type: string;
    content: string;
  } | null>(null);
  const [loadingDocId, setLoadingDocId] = useState<string | null>(null);

  // Auto-resolve names for history-restored sources
  useEffect(() => {
    const nameless = sources.filter((s) => !s.name);
    if (!nameless.length) return;
    fetchDocumentsBulk(nameless.map((s) => s.id))
      .then((docs) => docs.forEach((doc) => updateSourceName(doc.id, doc.title)))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sources.map((s) => s.id).join(",")]);

  const handleView = useCallback(async (id: string, name: string) => {
    setLoadingDocId(id);
    try {
      const doc = await fetchDocumentContent(id);
      setViewingDoc({ ...doc, title: doc.title || name });
    } catch {
      /* silent */
    } finally {
      setLoadingDocId(null);
    }
  }, []);

  const addFiles = useCallback(
    async (incoming: FileList | null) => {
      if (!incoming) return;
      const toUpload = Array.from(incoming).filter(
        (f) => !sources.some((s) => s.name === f.name),
      );
      if (!toUpload.length) return;

      const entries: UploadingEntry[] = toUpload.map((f) => ({
        tempId: `${Date.now()}-${Math.random()}`,
        name: f.name,
        size: f.size,
      }));
      setUploading((prev) => [...prev, ...entries]);

      await Promise.all(
        toUpload.map(async (fileObj, i) => {
          const { tempId } = entries[i];
          try {
            const result = await uploadDocument(fileObj);
            addSource(result.id, fileObj.name);
            setFluxDataEnabled(true);
            setUploading((prev) => prev.filter((e) => e.tempId !== tempId));
          } catch {
            setUploading((prev) =>
              prev.map((e) => (e.tempId === tempId ? { ...e, error: true } : e)),
            );
            setTimeout(
              () => setUploading((prev) => prev.filter((e) => e.tempId !== tempId)),
              3000,
            );
          }
        }),
      );
    },
    [sources, addSource, setFluxDataEnabled],
  );

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const totalCount = sources.length + uploading.length;

  return (
    <>
      <div className="flex flex-col gap-5">

        {/* ── Section: RAG toggle ── */}
        <div className="flex flex-col gap-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40 px-0.5">
            Context
          </p>

          <button
            type="button"
            onClick={() => setFluxDataEnabled((v) => !v)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
              fluxDataEnabled
                ? "bg-[#3370ff]/10 hover:bg-[#3370ff]/15"
                : "bg-secondary/40 hover:bg-secondary/70"
            }`}
          >
            <div className={`size-7 rounded-md flex items-center justify-center shrink-0 ${
              fluxDataEnabled ? "bg-[#3370ff]/15" : "bg-secondary"
            }`}>
              <Database className={`size-3.5 ${fluxDataEnabled ? "text-[#3370ff]" : "text-muted-foreground/50"}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-xs font-medium ${fluxDataEnabled ? "text-[#3370ff]" : "text-foreground/70"}`}>
                Flux Data
              </p>
              <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                {fluxDataEnabled ? "AI reads your files" : "File context off"}
              </p>
            </div>
            {/* Toggle indicator */}
            <div className={`size-4 rounded-full shrink-0 border-2 transition-colors ${
              fluxDataEnabled ? "bg-[#3370ff] border-[#3370ff]" : "bg-transparent border-border/50"
            }`} />
          </button>
        </div>

        {/* ── Section: Upload ── */}
        <div className="flex flex-col gap-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40 px-0.5">
            Files
          </p>

          {/* Upload button */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border border-dashed cursor-pointer transition-all select-none ${
              isDragging
                ? "border-[#3370ff]/50 bg-[#3370ff]/5"
                : "border-border/40 hover:border-border/70 hover:bg-secondary/20"
            }`}
          >
            <input ref={inputRef} type="file" multiple accept={ACCEPTED_TYPES} className="hidden"
              onChange={(e) => addFiles(e.target.files)} />
            <div className="size-7 rounded-md bg-secondary/60 flex items-center justify-center shrink-0">
              {isDragging
                ? <CloudUpload className="size-3.5 text-[#3370ff]" />
                : <FileUp className="size-3.5 text-muted-foreground/50" />
              }
            </div>
            <div>
              <p className="text-xs font-medium text-foreground/60">
                {isDragging ? "Drop to upload" : "Upload files"}
              </p>
              <p className="text-[10px] text-muted-foreground/40 mt-0.5">
                PDF · DOCX · MD · CSV · code
              </p>
            </div>
          </div>

          {/* File list */}
          {totalCount > 0 && (
            <div className="flex flex-col gap-0.5 mt-1">
              {/* Uploading */}
              {uploading.map((u) => (
                <div key={u.tempId}
                  className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-secondary/30"
                >
                  {getFileIcon(u.name)}
                  <p className="flex-1 text-[11px] text-foreground/50 truncate">{u.name}</p>
                  <span className="text-[10px] text-muted-foreground/40 shrink-0">
                    {formatFileSize(u.size)}
                  </span>
                  {u.error
                    ? <Tooltip>
                        <TooltipTrigger asChild>
                          <AlertCircle className="size-3.5 text-destructive/60 shrink-0" />
                        </TooltipTrigger>
                        <TooltipContent side="left">Upload failed</TooltipContent>
                      </Tooltip>
                    : <Loader2 className="size-3.5 text-muted-foreground/40 animate-spin shrink-0" />
                  }
                </div>
              ))}

              {/* Indexed sources */}
              {sources.map((s) => (
                <div
                  key={s.id}
                  onClick={() => toggleSource(s.id)}
                  className={`group flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer transition-colors ${
                    s.enabled
                      ? "bg-[#3370ff]/8 hover:bg-[#3370ff]/12"
                      : "hover:bg-secondary/40"
                  }`}
                >
                  {/* Active dot */}
                  <div className={`size-1.5 rounded-full shrink-0 transition-colors ${
                    s.enabled ? "bg-[#3370ff]" : "bg-border"
                  }`} />

                  {getFileIcon(s.name)}

                  <p className={`flex-1 text-[11px] font-medium truncate transition-colors ${
                    s.enabled ? "text-foreground/80" : "text-foreground/45"
                  }`}>
                    {s.name || "Indexed document"}
                  </p>

                  {/* Hover actions */}
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => e.stopPropagation()}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          className="size-6 flex items-center justify-center rounded hover:bg-secondary/80 text-muted-foreground/50 hover:text-foreground/70 transition-colors"
                          onClick={() => handleView(s.id, s.name)}
                        >
                          {loadingDocId === s.id
                            ? <Loader2 className="size-3 animate-spin" />
                            : <Eye className="size-3" />
                          }
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="left">Preview</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          className="size-6 flex items-center justify-center rounded hover:bg-destructive/10 text-muted-foreground/50 hover:text-destructive transition-colors"
                          onClick={() => removeSource(s.id)}
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="left">Remove</TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {totalCount === 0 && (
            <div className="flex flex-col items-center gap-1.5 py-6 text-center">
              <FileText className="size-6 text-muted-foreground/15" />
              <p className="text-[10px] text-muted-foreground/35 leading-relaxed">
                No files yet.<br />Upload to enhance AI answers.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Document viewer dialog */}
      <Dialog open={!!viewingDoc} onOpenChange={(open) => !open && setViewingDoc(null)}>
        <DialogContent className="max-w-2xl h-[75vh] flex flex-col gap-0 p-0 overflow-hidden">
          <DialogHeader className="px-5 py-4 border-b border-border/60 shrink-0">
            <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
              {getFileIcon(viewingDoc?.title ?? "")}
              <span className="truncate">{viewingDoc?.title ?? "Document"}</span>
              <span className="ml-auto text-[10px] font-normal text-muted-foreground/50 uppercase tracking-wide shrink-0">
                {viewingDoc?.type}
              </span>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-5 py-4">
            <pre className="text-[11px] text-foreground/70 whitespace-pre-wrap font-mono leading-relaxed">
              {viewingDoc?.content ?? ""}
            </pre>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
