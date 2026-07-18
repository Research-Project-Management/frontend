import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
  AlertTriangle,
  BookOpen,
  ChevronLeft,
  Download,
  ExternalLink,
  Info,
  Loader2,
  MessageSquare,
  PanelRightClose,
  PanelRightOpen,
  Pencil,
  Plus,
  RefreshCcw,
  StickyNote,
  Trash2,
  X,
  FileJson,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { useWorkspace } from "~/query/workspace";
import { useDocumentTitle } from "~/hooks";
import {
  reindexPaper,
  useAllPapers,
  useCollections,
  useUpdatePaper,
} from "~/query/library";
import { lookupDoi, searchCrossref, type CrossrefWork } from "~/query/storage";
import { resolveFileUrl } from "~/lib/api";
import { cn } from "~/lib/utils";
import type { Collection, Paper } from "~/types/library";
import PdfViewer from "../components/PdfViewer";
import ReaderChatPanel from "../components/ReaderChatPanel";
import PaperBibtexDialog from "../components/PaperBibtexDialog";

type ReaderPanel = "ai" | "details" | "notes";

const MIN_PANEL_WIDTH = 320;
const MAX_PANEL_WIDTH = 560;
const DEFAULT_PANEL_WIDTH = 400;

function formatSize(bytes: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function RagBadge({
  status,
  compact = false,
}: {
  status: Paper["ragStatus"];
  compact?: boolean;
}) {
  const styles = {
    indexed: "border-border bg-muted text-muted-foreground",
    pending: "border-[#f9ab00]/25 bg-[#f9ab00]/10 text-[#9a6700]",
    failed: "border-destructive/20 bg-destructive/10 text-destructive",
    idle: "border-border bg-muted text-muted-foreground",
  };

  const label =
    status === "indexed"
      ? "Indexed"
      : status === "pending"
        ? "Indexing"
        : status === "failed"
          ? "Index failed"
          : "Not indexed";

  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-md border px-2 text-xs font-semibold",
        status === "pending" && "animate-pulse",
        styles[status ?? "idle"],
        compact && "h-5 px-1.5 text-[10px]",
      )}
    >
      {status === "pending" ? <Loader2 className="size-3 animate-spin" /> : null}
      {label}
    </span>
  );
}

function IconTooltip({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

function MetadataField({
  label,
  children,
}: {
  label: string;
  children?: React.ReactNode;
}) {
  if (!children) return null;
  return (
    <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-3 border-b border-border/50 py-2.5 last:border-0">
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="min-w-0 text-xs leading-relaxed text-foreground/85">
        {children}
      </dd>
    </div>
  );
}

function cleanMetadataPayload(work: CrossrefWork) {
  const payload = {
    title: work.title || undefined,
    authors: work.authors?.length ? work.authors : undefined,
    editors: work.editors?.length ? work.editors : undefined,
    year: work.year && !Number.isNaN(Number(work.year)) ? Number(work.year) : undefined,
    doi: work.doi || undefined,
    abstract: work.abstract || undefined,
    keywords: work.keywords?.length ? work.keywords : undefined,
    itemType: work.itemType || work.type || undefined,
    journal: work.journal || work.publicationTitle || undefined,
    publicationTitle: work.publicationTitle || work.journal || undefined,
    publicationDate: work.publicationDate || (work.year ? String(work.year) : undefined),
    publisher: work.publisher || undefined,
    place: work.place || undefined,
    volume: work.volume || undefined,
    issue: work.issue || undefined,
    section: work.section || undefined,
    partNumber: work.partNumber || undefined,
    partTitle: work.partTitle || undefined,
    pages: work.pages || undefined,
    series: work.series || undefined,
    seriesTitle: work.seriesTitle || undefined,
    seriesText: work.seriesText || undefined,
    issn: work.issn || undefined,
    isbn: work.isbn || undefined,
    pmid: work.pmid || undefined,
    pmcid: work.pmcid || undefined,
    url: work.url || undefined,
    type: work.type || undefined,
    language: work.language || undefined,
    journalAbbr: work.journalAbbr || undefined,
    shortTitle: work.shortTitle || undefined,
    rights: work.rights || undefined,
    license: work.license || work.rights || undefined,
    libraryCatalog: work.libraryCatalog || "DOI.org",
    extra: work.extra || undefined,
    accessedAt: new Date().toISOString(),
  };

  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) =>
      Array.isArray(value) ? value.length > 0 : value !== undefined && value !== "",
    ),
  );
}

function ReaderDetails({
  paper,
  collection,
  workspaceId,
}: {
  paper: Paper;
  collection: Collection | null;
  workspaceId: string;
}) {
  const updatePaper = useUpdatePaper(workspaceId, paper.collectionId || "");
  const [isFetchingMetadata, setIsFetchingMetadata] = useState(false);
  const autoFetchedRef = useRef<string | null>(null);
  const fileType = paper.mimeType?.split("/")[1] ?? paper.mimeType;
  const identifiers = [paper.doi, paper.issn, paper.isbn].filter(Boolean);
  const needsMetadataRefresh = Boolean(
    paper.doi &&
      !paper.accessedAt &&
      (!paper.publicationTitle || !paper.abstract || (!paper.issn && !paper.isbn)),
  );

  const fetchAndSaveMetadata = useCallback(
    async (silent = false) => {
      if (!paper.doi && !paper.title) return;
      setIsFetchingMetadata(true);
      try {
        let work: CrossrefWork | null = null;
        if (paper.doi) {
          const result = await lookupDoi(paper.doi);
          work = result.work;
        }
        if (!work && paper.title) {
          const result = await searchCrossref(paper.title, 1);
          work = result.works?.[0] ?? null;
        }
        if (!work) throw new Error("No metadata returned");

        updatePaper.mutate(
          {
            paperId: paper._id,
            ...cleanMetadataPayload(work),
          },
          {
            onSuccess: () => {
              if (!silent) toast.success("Metadata saved");
            },
            onError: () => {
              if (!silent) toast.error("Failed to save metadata");
            },
          },
        );
      } catch (error) {
        console.error("Reader metadata lookup failed:", error);
        if (!silent) toast.error("Could not fetch metadata for this paper");
      } finally {
        setIsFetchingMetadata(false);
      }
    },
    [paper._id, paper.doi, paper.title, updatePaper],
  );

  useEffect(() => {
    const key = paper.doi || paper._id;
    if (!needsMetadataRefresh || autoFetchedRef.current === key) return;
    autoFetchedRef.current = key;
    fetchAndSaveMetadata(true);
  }, [fetchAndSaveMetadata, needsMetadataRefresh, paper._id, paper.doi]);

  return (
    <div className="h-full overflow-y-auto px-4 py-4">
      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold leading-snug text-foreground">
            {paper.title}
          </h2>
          {paper.authors.length > 0 ? (
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {paper.authors.join(", ")}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <RagBadge status={paper.ragStatus} compact />
          <Button
            variant="outline"
            size="sm"
            className="h-6 gap-1.5 px-2 text-[10px]"
            onClick={() => fetchAndSaveMetadata(false)}
            disabled={isFetchingMetadata || updatePaper.isPending || (!paper.doi && !paper.title)}
          >
            {isFetchingMetadata || updatePaper.isPending ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <RefreshCcw className="size-3" />
            )}
            Fetch metadata
          </Button>
          {paper.year ? (
            <span className="rounded-md border border-border bg-muted/50 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              {paper.year}
            </span>
          ) : null}
          {fileType ? (
            <span className="rounded-md border border-border bg-muted/50 px-1.5 py-0.5 text-[10px] font-mono uppercase text-muted-foreground">
              {fileType}
            </span>
          ) : null}
          {paper.size > 0 ? (
            <span className="text-[10px] text-muted-foreground">
              {formatSize(paper.size)}
            </span>
          ) : null}
        </div>
      </section>

      <dl className="mt-5 border-y border-border">
        <MetadataField label="Item Type">{paper.itemType || paper.type}</MetadataField>
        <MetadataField label="Abstract">
          {paper.abstract ? (
            <p className="max-h-48 overflow-y-auto pr-1 text-xs leading-relaxed">
              {paper.abstract}
            </p>
          ) : null}
        </MetadataField>
        <MetadataField label="Journal">
          {paper.publicationTitle || paper.journal ? (
            <span className="font-medium">{paper.publicationTitle || paper.journal}</span>
          ) : null}
        </MetadataField>
        <MetadataField label="Authors">{paper.authors?.join("; ")}</MetadataField>
        <MetadataField label="Editors">{paper.editors?.join("; ")}</MetadataField>
        <MetadataField label="Publisher">{paper.publisher}</MetadataField>
        <MetadataField label="Place">{paper.place}</MetadataField>
        <MetadataField label="Date">{paper.publicationDate || paper.year}</MetadataField>
        <MetadataField label="Volume">
          {[paper.volume && `Vol. ${paper.volume}`, paper.issue && `No. ${paper.issue}`, paper.pages && `pp. ${paper.pages}`]
            .filter(Boolean)
            .join(", ")}
        </MetadataField>
        <MetadataField label="Section">{paper.section}</MetadataField>
        <MetadataField label="Part">{[paper.partNumber, paper.partTitle].filter(Boolean).join(" · ")}</MetadataField>
        <MetadataField label="Series">{[paper.series, paper.seriesTitle, paper.seriesText].filter(Boolean).join(" · ")}</MetadataField>
        <MetadataField label="Collection">
          {collection ? (
            <span
              className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-current/15 px-2 py-1 text-xs font-medium"
              style={{
                backgroundColor: `${collection.color || "#255fdc"}12`,
                color: collection.color || "#255fdc",
              }}
            >
              <BookOpen className="size-3 shrink-0" />
              <span className="truncate">{collection.name}</span>
            </span>
          ) : null}
        </MetadataField>
        <MetadataField label="Identifiers">
          {identifiers.length > 0 ? (
            <div className="space-y-1 font-mono text-[11px] text-muted-foreground">
              {paper.doi ? <div className="break-all">DOI {paper.doi}</div> : null}
              {paper.issn ? <div>ISSN {paper.issn}</div> : null}
              {paper.isbn ? <div>ISBN {paper.isbn}</div> : null}
              {paper.pmid ? <div>PMID {paper.pmid}</div> : null}
              {paper.pmcid ? <div>PMCID {paper.pmcid}</div> : null}
            </div>
          ) : null}
        </MetadataField>
        <MetadataField label="Catalog">{paper.libraryCatalog}</MetadataField>
        <MetadataField label="License">{paper.license || paper.rights}</MetadataField>
        <MetadataField label="Citation Key">{paper.citationKey}</MetadataField>
        <MetadataField label="Archive">{[paper.archive, paper.archiveLocation].filter(Boolean).join(" · ")}</MetadataField>
        <MetadataField label="Call No.">{paper.callNumber}</MetadataField>
        <MetadataField label="Accessed">
          {paper.accessedAt ? formatDate(paper.accessedAt) : null}
        </MetadataField>
        <MetadataField label="Keywords">
          {paper.keywords?.length ? (
            <div className="flex flex-wrap gap-1">
              {paper.keywords.map((keyword) => (
                <span
                  key={keyword}
                  className="rounded-md border border-border bg-muted/50 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                >
                  {keyword}
                </span>
              ))}
            </div>
          ) : null}
        </MetadataField>
        <MetadataField label="File">
          {paper.filename ? (
            <span className="block truncate font-mono text-[11px] text-muted-foreground" title={paper.filename}>
              {paper.filename}
            </span>
          ) : null}
        </MetadataField>
        <MetadataField label="URL">
          {paper.url ? (
            <a
              href={paper.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex max-w-full items-center gap-1 text-primary hover:underline"
            >
              <span className="truncate">{paper.url}</span>
              <ExternalLink className="size-3 shrink-0" />
            </a>
          ) : null}
        </MetadataField>
        <MetadataField label="Extra">
          {paper.extra ? <pre className="whitespace-pre-wrap font-sans text-xs">{paper.extra}</pre> : null}
        </MetadataField>
      </dl>
    </div>
  );
}

function ReaderNotes({
  paper,
  workspaceId,
}: {
  paper: Paper;
  workspaceId: string;
}) {
  const updatePaper = useUpdatePaper(workspaceId, paper.collectionId || "");
  const [newNote, setNewNote] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");

  useEffect(() => {
    setNewNote("");
    setEditingId(null);
    setEditingText("");
  }, [paper._id]);

  const notes = paper.notes ?? [];

  const saveNotes = useCallback(
    (
      nextNotes: Array<{
        _id?: string;
        content: string;
        createdAt?: string;
        updatedAt?: string;
      }>,
      successMessage: string,
    ) => {
      updatePaper.mutate(
        { paperId: paper._id, notes: nextNotes },
        { onSuccess: () => toast.success(successMessage) },
      );
    },
    [paper._id, updatePaper],
  );

  const handleAddNote = () => {
    const content = newNote.trim();
    if (!content) return;
    saveNotes(
      [...notes.map(({ _id, content }) => ({ _id, content })), { content }],
      "Note added",
    );
    setNewNote("");
  };

  const handleSaveEdit = () => {
    const content = editingText.trim();
    if (!editingId || !content) return;
    saveNotes(
      notes.map((note) =>
        note._id === editingId
          ? { _id: note._id, content }
          : { _id: note._id, content: note.content },
      ),
      "Note updated",
    );
    setEditingId(null);
    setEditingText("");
  };

  const handleDelete = (noteId: string) => {
    if (!window.confirm("Delete this note?")) return;
    saveNotes(
      notes
        .filter((note) => note._id !== noteId)
        .map(({ _id, content }) => ({ _id, content })),
      "Note deleted",
    );
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border bg-background/80 p-4">
        <div className="rounded-lg border border-border bg-card p-3">
          <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            New note
          </label>
          <textarea
            value={newNote}
            onChange={(event) => setNewNote(event.target.value)}
            placeholder="Capture a thought while reading..."
            rows={3}
            className="mt-2 w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-xs leading-relaxed outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary"
          />
          <div className="mt-2 flex justify-end">
            <Button
              size="sm"
              onClick={handleAddNote}
              disabled={!newNote.trim() || updatePaper.isPending}
            >
              {updatePaper.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Plus className="size-3.5" />
              )}
              Add note
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {notes.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="flex size-10 items-center justify-center rounded-lg border border-border bg-muted/50">
              <StickyNote className="size-5 text-muted-foreground" />
            </div>
            <p className="mt-3 text-sm font-semibold text-foreground">
              No notes yet
            </p>
            <p className="mt-1 max-w-56 text-xs leading-relaxed text-muted-foreground">
              Notes stay attached to this paper so you can return to the trail of thought.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {notes.map((note) => (
              <article
                key={note._id}
                className="group rounded-lg border border-border bg-card p-3"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-[10px] font-medium text-muted-foreground">
                    {formatDate(note.updatedAt || note.createdAt)}
                  </span>
                  <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(note._id);
                        setEditingText(note.content);
                      }}
                      className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                      title="Edit note"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(note._id)}
                      className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      title="Delete note"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>

                {editingId === note._id ? (
                  <div className="space-y-2">
                    <textarea
                      value={editingText}
                      onChange={(event) => setEditingText(event.target.value)}
                      rows={4}
                      className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-xs leading-relaxed outline-none transition-colors focus:border-primary"
                      autoFocus
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingId(null);
                          setEditingText("");
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleSaveEdit}
                        disabled={!editingText.trim() || updatePaper.isPending}
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-foreground/85">
                    {note.content}
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ReaderPanelButton({
  panel,
  activePanel,
  onClick,
  icon: Icon,
  label,
  count,
}: {
  panel: ReaderPanel;
  activePanel: ReaderPanel | null;
  onClick: (panel: ReaderPanel) => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count?: number;
}) {
  const active = activePanel === panel;
  return (
    <IconTooltip label={label}>
      <button
        type="button"
        onClick={() => onClick(panel)}
        className={cn(
          "relative flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
          active && "bg-accent text-primary",
        )}
        aria-pressed={active}
      >
        <Icon className="size-4" />
        {count ? (
          <span className="absolute -right-1 -top-1 min-w-4 rounded-full border border-background bg-primary px-1 text-[9px] font-semibold leading-4 text-primary-foreground">
            {count}
          </span>
        ) : null}
      </button>
    </IconTooltip>
  );
}

export default function PaperReaderPage() {
  const { workspaceId: workspaceUrl, paperId } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { workspace } = useWorkspace(workspaceUrl!);
  const workspaceId = workspace?._id ?? "";

  const { data: papers, isLoading: isLoadingPapers } = useAllPapers(workspaceId);
  const { data: collections } = useCollections(workspaceId);

  const paper = papers?.find((p) => p._id === paperId) ?? null;
  const updatePaperTitle = useUpdatePaper(workspaceId, paper?.collectionId || "");

  useDocumentTitle(
    paper?.title ? `${paper.title} - Reader` : "Reader"
  );
  const collectionMap = useMemo(
    () => Object.fromEntries((collections ?? []).map((collection) => [collection._id, collection])),
    [collections],
  );
  const paperCollection = paper?.collectionId ? collectionMap[paper.collectionId] ?? null : null;
  const paperUrl = resolveFileUrl(paper?.fileUrl) || "";

  const [activePanel, setActivePanel] = useState<ReaderPanel | null>(() => {
    const saved = localStorage.getItem("flux_reader_active_panel");
    return saved === "ai" || saved === "details" || saved === "notes" ? saved : null;
  });
  const [panelWidth, setPanelWidth] = useState(() => {
    const saved = localStorage.getItem("flux_reader_panel_width");
    return saved ? Number(saved) || DEFAULT_PANEL_WIDTH : DEFAULT_PANEL_WIDTH;
  });
  const [isResizingPanel, setIsResizingPanel] = useState(false);
  const [isReindexing, setIsReindexing] = useState(false);
  const [selectionContext, setSelectionContext] = useState("");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [bibtexOpen, setBibtexOpen] = useState(false);

  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  useEffect(() => {
    if (!paper || paper.ragStatus !== "pending") return;
    const interval = setInterval(() => {
      qc.invalidateQueries({ queryKey: ["library-all-papers", workspaceId] });
    }, 5000);
    return () => clearInterval(interval);
  }, [paper, workspaceId, qc]);

  useEffect(() => {
    setDraftTitle(paper?.title || "");
    setIsEditingTitle(false);
    setBibtexOpen(false);
  }, [paper?._id, paper?.title]);

  useEffect(() => {
    if (activePanel) localStorage.setItem("flux_reader_active_panel", activePanel);
  }, [activePanel]);

  useEffect(() => {
    localStorage.setItem("flux_reader_panel_width", String(panelWidth));
  }, [panelWidth]);

  useEffect(() => {
    if (!isResizingPanel) return;

    const handleMouseMove = (event: MouseEvent) => {
      const deltaX = event.clientX - startXRef.current;
      const width = Math.max(
        MIN_PANEL_WIDTH,
        Math.min(MAX_PANEL_WIDTH, startWidthRef.current - deltaX),
      );
      setPanelWidth(width);
    };

    const handleMouseUp = () => setIsResizingPanel(false);
    const originalUserSelect = document.body.style.userSelect;
    const originalCursor = document.body.style.cursor;

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.userSelect = originalUserSelect;
      document.body.style.cursor = originalCursor;
    };
  }, [isResizingPanel]);

  const handlePanelToggle = (panel: ReaderPanel) => {
    setActivePanel((current) => (current === panel ? null : panel));
  };

  const handleAskAi = (text: string) => {
    setSelectionContext(text);
    setActivePanel("ai");
  };

  const clearSelectionContext = () => setSelectionContext("");

  const handleReindex = async () => {
    if (!workspaceId || !paperId) return;
    setIsReindexing(true);
    try {
      await reindexPaper(workspaceId, paperId);
      toast.success("AI indexing started");
      qc.invalidateQueries({ queryKey: ["library-all-papers", workspaceId] });
      setActivePanel("ai");
    } catch (err) {
      console.error("Reindex failed:", err);
      toast.error("Could not start AI indexing");
    } finally {
      setIsReindexing(false);
    }
  };

  const handleTitleSave = () => {
    if (!paper) return;
    const nextTitle = draftTitle.trim();
    if (!nextTitle || nextTitle === paper.title) {
      setDraftTitle(paper.title);
      setIsEditingTitle(false);
      return;
    }

    updatePaperTitle.mutate(
      { paperId: paper._id, title: nextTitle },
      {
        onSuccess: () => {
          setIsEditingTitle(false);
          toast.success("Paper title updated");
        },
        onError: () => {
          setDraftTitle(paper.title);
          toast.error("Could not update paper title");
        },
      },
    );
  };

  const handleResizeMouseDown = (event: React.MouseEvent) => {
    event.preventDefault();
    startXRef.current = event.clientX;
    startWidthRef.current = panelWidth;
    setIsResizingPanel(true);
  };

  const panelTitle =
    activePanel === "ai"
      ? "Flux AI"
      : activePanel === "details"
        ? "Details"
        : activePanel === "notes"
          ? "Notes"
          : "";

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <header className="flex h-[53px] shrink-0 items-center justify-between border-b border-border bg-background/95 px-3 backdrop-blur">
        <div className="flex min-w-0 flex-1 items-center gap-3 pr-3">
          <IconTooltip label="Back to library">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => navigate(-1)}
              aria-label="Back to library"
            >
              <ChevronLeft className="size-4" />
            </Button>
          </IconTooltip>

          <div className="flex min-w-0 items-center gap-2.5">
            <div className="min-w-0 max-w-[34vw] sm:max-w-[42vw] lg:max-w-[520px] xl:max-w-[640px]">
              {isEditingTitle && paper ? (
                <input
                  value={draftTitle}
                  onChange={(event) => setDraftTitle(event.target.value)}
                  onBlur={handleTitleSave}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") handleTitleSave();
                    if (event.key === "Escape") {
                      setDraftTitle(paper.title);
                      setIsEditingTitle(false);
                    }
                  }}
                  disabled={updatePaperTitle.isPending}
                  className="h-7 w-full rounded-md border border-primary/40 bg-background px-2 text-sm font-semibold leading-tight text-foreground outline-none focus:ring-2 focus:ring-primary/10"
                  autoFocus
                />
              ) : (
                <h1
                  className="truncate text-sm font-semibold leading-tight text-foreground"
                  title={paper?.title ? `${paper.title} - double click to rename` : undefined}
                  onDoubleClick={() => {
                    if (!paper) return;
                    setDraftTitle(paper.title);
                    setIsEditingTitle(true);
                  }}
                >
                  {paper?.title || "Loading paper..."}
                </h1>
              )}
              <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                {paper?.authors?.length
                  ? paper.authors.join(", ")
                  : paper?.year
                    ? String(paper.year)
                    : "Reader"}
              </p>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {paper ? <RagBadge status={paper.ragStatus} /> : null}

          {paper && paper.ragStatus !== "pending" && paper.ragStatus !== "indexed" ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleReindex}
              disabled={isReindexing}
              className="hidden sm:inline-flex"
            >
              {isReindexing ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <RefreshCcw className="size-3.5" />
              )}
              {paper.ragStatus === "failed" ? "Retry index" : "Index"}
            </Button>
          ) : null}

          {paperUrl ? (
            <IconTooltip label="Download PDF">
              <Button variant="ghost" size="icon-sm" asChild>
                <a href={paperUrl} download={paper?.filename || "paper.pdf"}>
                  <Download className="size-4" />
                </a>
              </Button>
            </IconTooltip>
          ) : null}

          {paper ? (
            <IconTooltip label="Export BibTeX">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setBibtexOpen(true)}
                title="Export BibTeX citation"
              >
                <FileJson className="size-4" />
              </Button>
            </IconTooltip>
          ) : null}

          <div className="mx-1 hidden h-5 w-px bg-border sm:block" />

          <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-0.5">
            <ReaderPanelButton
              panel="ai"
              activePanel={activePanel}
              onClick={handlePanelToggle}
              icon={MessageSquare}
              label="Flux AI"
            />
            <ReaderPanelButton
              panel="details"
              activePanel={activePanel}
              onClick={handlePanelToggle}
              icon={Info}
              label="Details"
            />
            <ReaderPanelButton
              panel="notes"
              activePanel={activePanel}
              onClick={handlePanelToggle}
              icon={StickyNote}
              label="Notes"
              count={paper?.notes?.length}
            />
          </div>

          <IconTooltip label={activePanel ? "Close panel" : "Open details"}>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setActivePanel((current) => (current ? null : "details"))}
              aria-label={activePanel ? "Close panel" : "Open details"}
            >
              {activePanel ? (
                <PanelRightClose className="size-4" />
              ) : (
                <PanelRightOpen className="size-4" />
              )}
            </Button>
          </IconTooltip>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1 overflow-hidden bg-muted/45">
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {isLoadingPapers ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3">
              <Loader2 className="size-7 animate-spin text-primary/60" />
              <p className="text-xs text-muted-foreground">Loading paper...</p>
            </div>
          ) : paperUrl ? (
            <PdfViewer
              url={paperUrl}
              filename={paper?.filename || "paper.pdf"}
              onAskAi={handleAskAi}
            />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
              <AlertTriangle className="size-8 text-destructive" />
              <div>
                <p className="text-sm font-semibold text-foreground">
                  File not found
                </p>
                <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
                  The PDF file could not be located. Check that the paper upload finished successfully.
                </p>
              </div>
            </div>
          )}
        </main>

        {activePanel ? (
          <aside
            className="absolute inset-y-0 right-0 z-30 flex w-[min(100%,420px)] flex-col border-l border-border bg-background shadow-lg lg:relative lg:w-auto lg:shadow-none"
            style={{ width: `min(100%, ${panelWidth}px)` }}
          >
            <div
              className={cn(
                "absolute left-[-4px] top-0 z-20 hidden h-full w-2 cursor-col-resize items-center justify-center lg:flex",
                isResizingPanel && "bg-primary/5",
              )}
              onMouseDown={handleResizeMouseDown}
            >
              <div
                className={cn(
                  "h-full w-px transition-colors",
                  isResizingPanel ? "bg-primary" : "bg-transparent hover:bg-primary/40",
                )}
              />
            </div>

            <div className="flex h-[53px] shrink-0 items-center justify-between border-b border-border px-4">
              <div className="flex min-w-0 items-center gap-2">
                {activePanel === "ai" ? (
                  <img src="/Chat.svg" alt="Flux AI" className="size-4" />
                ) : activePanel === "details" ? (
                  <Info className="size-4 text-primary" />
                ) : (
                  <StickyNote className="size-4 text-primary" />
                )}
                <h2 className="truncate text-sm font-semibold text-foreground">
                  {panelTitle}
                </h2>
              </div>
              <div className="flex items-center gap-1">
                {activePanel === "ai" && paper && paper.ragDocId && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => {
                      const confirmClear = window.confirm("Are you sure you want to clear this conversation?");
                      if (confirmClear) {
                        window.dispatchEvent(new CustomEvent("clear-reader-chat"));
                      }
                    }}
                    title="Clear conversation"
                    aria-label="Clear conversation"
                    className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setActivePanel(null)}
                  aria-label="Close panel"
                >
                  <X className="size-4" />
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-hidden">
              <div className={cn("h-full", activePanel !== "ai" && "hidden")}>
                {isLoadingPapers ? (
                  <div className="flex h-full items-center justify-center">
                    <Loader2 className="size-6 animate-spin text-primary/60" />
                  </div>
                ) : paper && paper.ragDocId ? (
                  <ReaderChatPanel
                    ragDocId={paper.ragDocId}
                    paperTitle={paper.title}
                    selectionContext={selectionContext}
                    onClearSelectionContext={clearSelectionContext}
                    showHeader={false}
                    autoFocus={activePanel === "ai"}
                  />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                    <div className="flex size-12 items-center justify-center rounded-xl border border-border bg-card">
                      {paper?.ragStatus === "pending" ? (
                        <Loader2 className="size-6 animate-spin text-primary" />
                      ) : paper?.ragStatus === "failed" ? (
                        <AlertTriangle className="size-6 text-destructive" />
                      ) : (
                        <img src="/Chat.svg" alt="Flux AI" className="size-7" />
                      )}
                    </div>
                    <h3 className="mt-4 text-sm font-semibold text-foreground">
                      {paper?.ragStatus === "pending"
                        ? "Indexing this paper"
                        : paper?.ragStatus === "failed"
                          ? "Indexing failed"
                          : "Index to chat with Flux AI"}
                    </h3>
                    <p className="mt-2 max-w-64 text-xs leading-relaxed text-muted-foreground">
                      {paper?.ragStatus === "pending"
                        ? "Flux AI is preparing the document. This panel will unlock when indexing finishes."
                        : "AI needs an indexed copy of the PDF before it can answer with paper context."}
                    </p>
                    {paper?.ragStatus !== "pending" ? (
                      <Button
                        className="mt-4"
                        size="sm"
                        onClick={handleReindex}
                        disabled={isReindexing}
                      >
                        {isReindexing ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <RefreshCcw className="size-3.5" />
                        )}
                        {paper?.ragStatus === "failed" ? "Retry index" : "Index paper"}
                      </Button>
                    ) : null}
                  </div>
                )}
              </div>
              <div className={cn("h-full", activePanel !== "details" && "hidden")}>
                {paper ? (
                  <ReaderDetails
                    paper={paper}
                    collection={paperCollection}
                    workspaceId={workspaceId}
                  />
                ) : null}
              </div>
              <div className={cn("h-full", activePanel !== "notes" && "hidden")}>
                {paper ? <ReaderNotes paper={paper} workspaceId={workspaceId} /> : null}
              </div>
            </div>
          </aside>
        ) : null}

        {activePanel ? (
          <button
            type="button"
            className="absolute inset-0 z-20 bg-background/60 backdrop-blur-sm lg:hidden"
            onClick={() => setActivePanel(null)}
            aria-label="Close reader panel overlay"
          />
        ) : null}
      </div>
      {paper ? (
        <PaperBibtexDialog
          paper={paper}
          open={bibtexOpen}
          onOpenChange={setBibtexOpen}
        />
      ) : null}
    </div>
  );
}
