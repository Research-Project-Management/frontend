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
import { Button } from "~/components/ui/button";
import {
  useState,
  useRef,
  useCallback,
  useEffect,
  type DragEvent,
} from "react";
import { Switch } from "~/components/ui/switch";
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

/** Temporary entry — only exists while a file is being uploaded. */
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
    return <FileImage className="size-4 text-violet-500" />;
  if (/\.(pdf|doc|docx)$/.test(n))
    return <FileText className="size-4 text-red-500" />;
  if (/\.(xls|xlsx|csv)$/.test(n))
    return <FileText className="size-4 text-emerald-500" />;
  if (/\.(ts|tsx|js|jsx|json)$/.test(n))
    return <FileCode className="size-4 text-blue-500" />;
  if (/\.(md|txt)$/.test(n))
    return <FileText className="size-4 text-amber-500" />;
  return <File className="size-4 text-muted-foreground" />;
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

  // `uploading` tracks files currently in flight. Once the upload resolves the
  // entry is removed and the resulting source appears in the context `sources`
  // list. This means `sources` is always the canonical display list — it works
  // both for freshly-uploaded files and for sources restored from saved sessions.
  const [uploading, setUploading] = useState<UploadingEntry[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Content viewer state
  const [viewingDoc, setViewingDoc] = useState<{
    id: string;
    title: string;
    type: string;
    content: string;
  } | null>(null);
  const [loadingDocId, setLoadingDocId] = useState<string | null>(null);

  // Auto-resolve names for sources that were restored from history with an
  // empty name (restoreSourceIds only has IDs, not titles).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const nameless = sources.filter((s) => !s.name);
    if (!nameless.length) return;
    fetchDocumentsBulk(nameless.map((s) => s.id))
      .then((docs) =>
        docs.forEach((doc) => updateSourceName(doc.id, doc.title)),
      )
      .catch(() => {});
    // Only re-run when the set of source IDs changes (not on name updates to avoid loops)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sources.map((s) => s.id).join(",")]);

  const handleView = useCallback(async (id: string, name: string) => {
    setLoadingDocId(id);
    try {
      const doc = await fetchDocumentContent(id);
      setViewingDoc({ ...doc, title: doc.title || name });
    } catch {
      // silently fail — no content available
    } finally {
      setLoadingDocId(null);
    }
  }, []);

  const addFiles = useCallback(
    async (incoming: FileList | null) => {
      if (!incoming) return;
      // Skip files already indexed in this session
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
            // Register in context — this makes it appear in the sources list
            addSource(result.id, fileObj.name);
            setFluxDataEnabled(true);
            setUploading((prev) => prev.filter((e) => e.tempId !== tempId));
          } catch {
            // Show error badge for 3 s then remove
            setUploading((prev) =>
              prev.map((e) =>
                e.tempId === tempId ? { ...e, error: true } : e,
              ),
            );
            setTimeout(
              () =>
                setUploading((prev) => prev.filter((e) => e.tempId !== tempId)),
              3000,
            );
          }
        }),
      );
    },
    [sources, addSource, setFluxDataEnabled],
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

  const activeCount = sources.filter((s) => s.enabled).length;
  const totalCount = sources.length + uploading.length;

  return (
    <>
      <div className="space-y-5">
        {/* ── Flux Data master toggle ── */}
        <div
          className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer group ${
            fluxDataEnabled ? "bg-primary/8 " : "bg-secondary/20 "
          }`}
          onClick={() => setFluxDataEnabled((v) => !v)}
        >
          <div className="flex items-center gap-2.5">
            <div
              className={`p-1.5 rounded-lg transition-colors ${
                fluxDataEnabled
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
                  Allow the AI to access your uploaded source documents for
                  grounded answers.
                </TooltipContent>
              </Tooltip>
              <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                {fluxDataEnabled ? "Active" : "Disabled"}
              </p>
            </div>
          </div>
          <Switch
            checked={fluxDataEnabled}
            onCheckedChange={setFluxDataEnabled}
            className="data-[state=checked]:bg-primary scale-[0.8] shrink-0"
            onClick={(e) => e.stopPropagation()}
          />
        </div>

        {/* ── Drop zone ── */}
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

        {/* ── Source list ── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-0.5">
            <span className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">
              Sources
            </span>
            <span className="text-[10px] text-muted-foreground/50 font-medium">
              {activeCount}/{totalCount} active
            </span>
          </div>

          {totalCount === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 rounded-xl bg-secondary/10 border border-dashed border-border/40 text-center">
              <FileText className="size-6 text-muted-foreground/20 mb-2" />
              <p className="text-[10px] text-muted-foreground/50">
                No files uploaded yet
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {/* In-progress uploads — shown until the server acknowledges */}
              {uploading.map((u) => (
                <div
                  key={u.tempId}
                  className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg border border-border/50 bg-background"
                >
                  <div className="shrink-0 size-7 rounded-md bg-secondary flex items-center justify-center border border-border/50">
                    {getFileIcon(u.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate text-foreground/90 leading-snug">
                      {u.name}
                    </p>
                    <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                      {formatFileSize(u.size)}
                    </p>
                  </div>
                  <div className="shrink-0">
                    {u.error ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <AlertCircle className="size-3.5 text-destructive" />
                        </TooltipTrigger>
                        <TooltipContent side="left">
                          Upload failed
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <Loader2 className="size-3.5 text-primary animate-spin" />
                    )}
                  </div>
                </div>
              ))}

              {/* Indexed sources from context — includes history-restored entries */}
              {sources.map((s) => (
                <div
                  key={s.id}
                  className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg border transition-all group ${
                    s.enabled
                      ? "border-primary/30 bg-primary/5"
                      : "border-border/50 bg-background"
                  }`}
                >
                  <div className="shrink-0 size-7 rounded-md bg-secondary flex items-center justify-center border border-border/50">
                    {getFileIcon(s.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate text-foreground/90 leading-snug">
                      {s.name || "Indexed document"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Switch
                      checked={s.enabled}
                      onCheckedChange={() => toggleSource(s.id)}
                      className="data-[state=checked]:bg-primary scale-[0.7]"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleView(s.id, s.name)}
                      className="size-6 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-secondary/80"
                    >
                      {loadingDocId === s.id ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <Eye className="size-3" />
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeSource(s.id)}
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

      {/* ── Document content viewer dialog ── */}
      <Dialog
        open={!!viewingDoc}
        onOpenChange={(open) => !open && setViewingDoc(null)}
      >
        <DialogContent className="max-w-2xl h-[75vh] flex flex-col gap-3 p-0 overflow-hidden">
          <DialogHeader className="px-5 pt-5 shrink-0">
            <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
              {getFileIcon(viewingDoc?.title ?? "")}
              <span className="truncate">
                {viewingDoc?.title ?? "Document"}
              </span>
              <span className="ml-auto text-[10px] font-normal text-muted-foreground/60 uppercase tracking-wide shrink-0">
                {viewingDoc?.type}
              </span>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-5 pb-5">
            <pre className="text-xs text-foreground/80 whitespace-pre-wrap font-mono leading-relaxed">
              {viewingDoc?.content ?? ""}
            </pre>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
