import { useState } from "react";
import { FolderOpen, ExternalLink, RefreshCcw, Loader2 } from "lucide-react";
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
        <div className="mt-2 flex items-center gap-2 flex-wrap">
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
      </div>

      {/* Metadata */}
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
        {!paper.journal && paper.publisher && (
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

        {paper.keywords?.length > 0 && (
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

        {paper.tags?.length > 0 && (
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
