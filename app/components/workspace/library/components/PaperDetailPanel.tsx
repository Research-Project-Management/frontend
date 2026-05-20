import { useState, useEffect } from "react";
import { FolderOpen, ExternalLink, RefreshCcw, Loader2, Edit3, X, Check } from "lucide-react";
import { cn } from "~/lib/utils";
import { API_URL } from "~/lib/api";
import { useUpdatePaper } from "~/query/library";
import type { Paper, Collection } from "~/types/library";

function formatSize(bytes: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
        {label}
      </p>
      <div className="text-sm text-foreground/80 leading-relaxed">{children}</div>
    </div>
  );
}

function RagBadge({ status }: { status: Paper["ragStatus"] }) {
  if (!status) return null;
  const map = {
    indexed: { label: "Indexed", cls: "bg-green-500/10 text-green-600" },
    pending: { label: "Indexing…", cls: "bg-yellow-500/10 text-yellow-600" },
    failed: { label: "Index failed", cls: "bg-destructive/10 text-destructive" },
  } as const;
  const s = map[status];
  if (!s) return null;
  return (
    <span className={cn("text-xs font-medium px-1.5 py-0.5 rounded", s.cls)}>
      {s.label}
    </span>
  );
}

export function PaperDetailPanel({
  paper,
  collection,
  workspaceId,
}: {
  paper: Paper;
  collection: Collection | null;
  workspaceId: string;
}) {
  const resolvedUrl = paper.fileUrl?.startsWith("/api/files/")
    ? `${API_URL}${paper.fileUrl}`
    : paper.fileUrl;

  const updatePaper = useUpdatePaper(workspaceId, paper.collection || "");
  const [isCrawling, setIsCrawling] = useState(false);

  // Manual Edit States
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(paper.title);
  const [editAuthors, setEditAuthors] = useState(paper.authors.join(", "));
  const [editYear, setEditYear] = useState(paper.year ? String(paper.year) : "");
  const [editDoi, setEditDoi] = useState(paper.doi);
  const [editJournal, setEditJournal] = useState(paper.journal);
  const [editPublisher, setEditPublisher] = useState(paper.publisher);
  const [editKeywords, setEditKeywords] = useState(paper.keywords?.join(", ") || "");
  const [editAbstract, setEditAbstract] = useState(paper.abstract);

  // Sync edit states when paper changes
  useEffect(() => {
    setEditTitle(paper.title);
    setEditAuthors(paper.authors.join(", "));
    setEditYear(paper.year ? String(paper.year) : "");
    setEditDoi(paper.doi);
    setEditJournal(paper.journal);
    setEditPublisher(paper.publisher);
    setEditKeywords(paper.keywords?.join(", ") || "");
    setEditAbstract(paper.abstract);
    setIsEditing(false);
  }, [paper]);

  const handleSaveMetadata = () => {
    if (!editTitle.trim()) return;
    updatePaper.mutate(
      {
        paperId: paper._id,
        title: editTitle.trim(),
        authors: editAuthors
          .split(",")
          .map((a) => a.trim())
          .filter(Boolean),
        year: editYear ? parseInt(editYear) : null,
        doi: editDoi.trim(),
        journal: editJournal.trim(),
        publisher: editPublisher.trim(),
        keywords: editKeywords
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean),
        abstract: editAbstract.trim(),
      },
      {
        onSuccess: () => {
          setIsEditing(false);
        },
      }
    );
  };

  const handleCrawlDOI = async () => {
    if (!paper.doi) return;
    setIsCrawling(true);
    try {
      let cleanDoi = paper.doi.trim();
      if (cleanDoi.startsWith("http")) {
        const url = new URL(cleanDoi);
        cleanDoi = url.pathname.replace(/^\/+/, "");
      }
      const res = await fetch(`https://api.crossref.org/works/${cleanDoi}`);
      if (!res.ok) throw new Error("Crossref fetch failed");
      const data = await res.json();
      const msg = data.message;

      const authors = msg.author
        ? msg.author.map((a: any) => `${a.given} ${a.family}`.trim())
        : undefined;
      const year =
        msg["published-print"]?.["date-parts"]?.[0]?.[0] ||
        msg["published-online"]?.["date-parts"]?.[0]?.[0] ||
        msg["issued"]?.["date-parts"]?.[0]?.[0];
      const journal = msg["container-title"]?.[0];
      const publisher = msg.publisher;
      const title = msg.title?.[0];

      updatePaper.mutate({
        paperId: paper._id,
        ...(title && { title }),
        ...(authors && authors.length > 0 && { authors }),
        ...(year && { year }),
        ...(journal && { journal }),
        ...(publisher && { publisher }),
      });
    } catch (e) {
      console.error(e);
      alert("Failed to fetch metadata from Crossref.");
    } finally {
      setIsCrawling(false);
    }
  };

  return (
    <div className="w-72 shrink-0 border-l border-border bg-card flex flex-col">
      {/* Title */}
      <div className="px-4 pt-4 pb-3 border-b border-border">
        <p className="text-sm font-semibold text-foreground leading-snug">
          {paper.title}
        </p>
        <div className="mt-2 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <RagBadge status={paper.ragStatus} />
            {paper.mimeType && (
              <span className="text-xs text-muted-foreground uppercase font-mono">
                {paper.mimeType.split("/")[1] ?? paper.mimeType}
              </span>
            )}
            {paper.size > 0 && (
              <span className="text-xs text-muted-foreground">
                {formatSize(paper.size)}
              </span>
            )}
          </div>
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="flex items-center gap-1 text-[11px] text-primary hover:underline font-medium"
            title={isEditing ? "Cancel editing" : "Edit paper details"}
          >
            {isEditing ? (
              <>
                <X className="size-3" />
                Cancel
              </>
            ) : (
              <>
                <Edit3 className="size-3" />
                Edit Details
              </>
            )}
          </button>
        </div>
      </div>

      {/* Metadata */}
      {isEditing ? (
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Title</label>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full text-sm bg-background border border-border px-2 py-1.5 rounded focus:outline-none focus:border-primary"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Authors (comma separated)</label>
            <input
              type="text"
              value={editAuthors}
              onChange={(e) => setEditAuthors(e.target.value)}
              className="w-full text-sm bg-background border border-border px-2 py-1.5 rounded focus:outline-none focus:border-primary"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Year</label>
              <input
                type="number"
                value={editYear}
                onChange={(e) => setEditYear(e.target.value)}
                className="w-full text-sm bg-background border border-border px-2 py-1.5 rounded focus:outline-none focus:border-primary"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">DOI</label>
              <input
                type="text"
                value={editDoi}
                onChange={(e) => setEditDoi(e.target.value)}
                className="w-full text-sm bg-background border border-border px-2 py-1.5 rounded focus:outline-none focus:border-primary"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Journal</label>
              <input
                type="text"
                value={editJournal}
                onChange={(e) => setEditJournal(e.target.value)}
                className="w-full text-sm bg-background border border-border px-2 py-1.5 rounded focus:outline-none focus:border-primary"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Publisher</label>
              <input
                type="text"
                value={editPublisher}
                onChange={(e) => setEditPublisher(e.target.value)}
                className="w-full text-sm bg-background border border-border px-2 py-1.5 rounded focus:outline-none focus:border-primary"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Keywords (comma separated)</label>
            <input
              type="text"
              value={editKeywords}
              onChange={(e) => setEditKeywords(e.target.value)}
              className="w-full text-sm bg-background border border-border px-2 py-1.5 rounded focus:outline-none focus:border-primary"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Abstract</label>
            <textarea
              value={editAbstract}
              onChange={(e) => setEditAbstract(e.target.value)}
              rows={4}
              className="w-full text-xs bg-background border border-border px-2 py-1.5 rounded resize-none focus:outline-none focus:border-primary"
            />
          </div>
          <button
            onClick={handleSaveMetadata}
            disabled={updatePaper.isPending || !editTitle.trim()}
            className="flex items-center justify-center gap-1.5 w-full h-8 rounded bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/95 transition-colors mt-2"
          >
            {updatePaper.isPending ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
            Save Details
          </button>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {paper.authors.length > 0 && (
            <MetaRow label="Authors">{paper.authors.join("; ")}</MetaRow>
          )}

          <div className="grid grid-cols-2 gap-3">
            {paper.year && <MetaRow label="Year">{paper.year}</MetaRow>}
            {paper.doi && (
              <MetaRow label="DOI">
                <div className="flex items-start justify-between gap-1">
                  <span className="font-mono text-xs break-all">{paper.doi}</span>
                  <button
                    className="flex items-center text-[10px] bg-secondary/50 hover:bg-secondary px-1.5 py-0.5 rounded transition-colors text-muted-foreground shrink-0"
                    onClick={handleCrawlDOI}
                    disabled={isCrawling || updatePaper.isPending}
                    title="Auto fetch from Crossref"
                  >
                    {isCrawling ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <RefreshCcw className="size-3" />
                    )}
                  </button>
                </div>
              </MetaRow>
            )}
          </div>

          {paper.journal && (
            <MetaRow label="Journal">
              <em>{paper.journal}</em>
            </MetaRow>
          )}
          {paper.publisher && (
            <MetaRow label="Publisher">{paper.publisher}</MetaRow>
          )}

          {collection && (
            <MetaRow label="Collection">
              <span
                className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded font-medium"
                style={{
                  backgroundColor: `${collection.color || "#3370ff"}15`,
                  color: collection.color || "#3370ff",
                }}
              >
                <FolderOpen className="size-3" />
                {collection.name}
              </span>
            </MetaRow>
          )}

          {paper.abstract && (
            <MetaRow label="Abstract">
              <p className="text-sm leading-relaxed line-clamp-10">
                {paper.abstract}
              </p>
            </MetaRow>
          )}

          {paper.keywords && paper.keywords.length > 0 && (
            <MetaRow label="Keywords">
              <div className="flex flex-wrap gap-1 mt-1">
                {paper.keywords.map((kw) => (
                  <span
                    key={kw}
                    className="text-xs bg-accent text-muted-foreground px-1.5 py-0.5 rounded"
                  >
                    {kw}
                  </span>
                ))}
              </div>
            </MetaRow>
          )}

          {paper.tags && paper.tags.length > 0 && (
            <MetaRow label="Tags">
              <div className="flex flex-wrap gap-1 mt-1">
                {paper.tags.map((t) => (
                  <span
                    key={t}
                    className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </MetaRow>
          )}

          {paper.filename && (
            <MetaRow label="File">
              <span className="font-mono text-xs text-muted-foreground break-all">
                {paper.filename}
              </span>
            </MetaRow>
          )}
        </div>
      )}

      {/* Open PDF */}
      {resolvedUrl && (
        <div className="px-4 pb-4 pt-2 border-t border-border shrink-0">
          <a
            href={resolvedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full h-9 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <ExternalLink className="size-4" />
            Open PDF
          </a>
        </div>
      )}
    </div>
  );
}
