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
import { useParams } from "react-router";
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
  const { chatId } = useParams<{ chatId?: string }>();
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
            const result = await uploadDocument(fileObj, chatId);
            // Register in context — this makes it appear in the sources list
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
    [sources, addSource, setFluxDataEnabled, chatId],
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
      <div className="flex flex-col gap-4">

        {/* ── Section: RAG toggle ── */}
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-0.5">
            Context
          </p>

          <button
            type="button"
            onClick={() => setFluxDataEnabled((v) => !v)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors ${
              fluxDataEnabled
                ? "border-primary/25 bg-accent hover:bg-primary/10"
                : "border-border bg-background hover:bg-muted/60"
            }`}
          >
            <div className={`size-7 rounded-md flex items-center justify-center shrink-0 ${
              fluxDataEnabled ? "bg-primary/10" : "bg-muted"
            }`}>
              <Database className={`size-3.5 ${fluxDataEnabled ? "text-primary" : "text-muted-foreground"}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-xs font-medium ${fluxDataEnabled ? "text-primary" : "text-foreground"}`}>
                Flux Data
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {fluxDataEnabled ? "AI reads your files" : "File context off"}
              </p>
            </div>
            {/* Toggle indicator */}
            <div className={`size-4 rounded-full shrink-0 border-2 transition-colors ${
              fluxDataEnabled ? "bg-primary border-primary" : "bg-transparent border-border"
            }`} />
          </button>
        </div>

        {/* ── Section: Upload ── */}
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-0.5">
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
                ? "border-primary/50 bg-accent"
                : "border-border bg-background hover:border-primary/30 hover:bg-muted/60"
            }`}
          >
            <input ref={inputRef} type="file" multiple accept={ACCEPTED_TYPES} className="hidden"
              onChange={(e) => addFiles(e.target.files)} />
            <div className="size-7 rounded-md bg-muted flex items-center justify-center shrink-0">
              {isDragging
                ? <CloudUpload className="size-3.5 text-primary" />
                : <FileUp className="size-3.5 text-muted-foreground" />
              }
            </div>
            <div>
              <p className="text-xs font-medium text-foreground">
                {isDragging ? "Drop to upload" : "Upload files"}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                PDF · DOCX · MD · CSV · code
              </p>
            </div>
          </div>

          {/* File list */}
          {totalCount > 0 && (
            <div className="flex flex-col gap-1 mt-1">
              {/* Uploading */}
              {uploading.map((u) => (
                <div
                  key={u.tempId}
                  className={`flex items-center gap-2.5 rounded-lg border px-2.5 py-2 transition-colors ${
                    u.error
                      ? "border-destructive/20 bg-destructive/5"
                      : "border-border/70 bg-background"
                  }`}
                >
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted">
                    {getFileIcon(u.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-foreground/80">
                      {u.name}
                    </p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      {u.error ? "Upload failed" : `${formatFileSize(u.size)} · Uploading`}
                    </p>
                  </div>
                  {u.error ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <AlertCircle className="size-3.5 shrink-0 text-destructive/70" />
                      </TooltipTrigger>
                      <TooltipContent side="left">Upload failed</TooltipContent>
                    </Tooltip>
                  ) : (
                    <Loader2 className="size-3.5 shrink-0 animate-spin text-primary/60" />
                  )}
                </div>
              ))}

              {/* Indexed sources */}
              {sources.map((s) => (
                <div
                  key={s.id}
                  onClick={() => toggleSource(s.id)}
                  className={`group flex items-center gap-2.5 rounded-lg border px-2.5 py-2 cursor-pointer transition-colors ${
                    s.enabled
                      ? "border-primary/20 bg-accent hover:bg-primary/10"
                      : "border-transparent hover:border-border hover:bg-muted/60"
                  }`}
                >
                  <div className="relative flex size-7 shrink-0 items-center justify-center rounded-md bg-muted">
                    {getFileIcon(s.name)}
                    <span
                      className={`absolute -right-0.5 -top-0.5 size-2 rounded-full border border-background ${
                        s.enabled ? "bg-primary" : "bg-border"
                      }`}
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p
                      className={`truncate text-xs font-medium transition-colors ${
                        s.enabled ? "text-foreground" : "text-foreground/60"
                      }`}
                    >
                      {s.name || "Indexed document"}
                    </p>
                  </div>

                  {/* Hover actions */}
                  <div
                    className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          className="size-6 flex items-center justify-center rounded-md hover:bg-background text-muted-foreground hover:text-foreground transition-colors"
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
                          className="size-6 flex items-center justify-center rounded-md hover:bg-destructive/10 text-muted-foreground/50 hover:text-destructive transition-colors"
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
            <div className="flex flex-col items-center gap-1.5 rounded-lg border border-dashed border-border py-6 text-center">
              <FileText className="size-6 text-muted-foreground/25" />
              <p className="text-[11px] text-muted-foreground leading-relaxed">
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
