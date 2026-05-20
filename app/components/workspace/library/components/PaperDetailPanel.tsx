import { useState, useEffect } from "react";
import {
  FolderOpen,
  ExternalLink,
  RefreshCcw,
  Loader2,
  Edit3,
  X,
  Check,
  Trash2,
  Plus,
  Calendar,
  FileText,
} from "lucide-react";
import { Link, useParams } from "react-router";
import { cn } from "~/lib/utils";
import { API_URL } from "~/lib/api";
import { useUpdatePaper } from "~/query/library";
import { lookupDoi } from "~/query/storage";
import type { Paper, Collection } from "~/types/library";

function formatSize(bytes: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatNoteDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (e) {
    return dateStr;
  }
}

function DetailRow({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  if (!children) return null;
  return (
    <div className={cn("flex items-start py-1 text-xs border-b border-border/5 last:border-0", className)}>
      <span className="w-24 shrink-0 font-bold text-[10px] uppercase text-muted-foreground pt-0.5 select-none text-left pr-2">
        {label}
      </span>
      <div className="flex-1 text-foreground/90 break-all leading-normal min-w-0 font-normal">
        {children}
      </div>
    </div>
  );
}

function EditRow({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center py-1 text-xs border-b border-border/5 last:border-0", className)}>
      <span className="w-24 shrink-0 font-bold text-[10px] uppercase text-muted-foreground select-none text-left pr-2">
        {label}
      </span>
      <div className="flex-1 min-w-0">
        {children}
      </div>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="text-[9px] font-bold text-primary/70 tracking-widest mb-1.5 uppercase select-none mt-4 first:mt-1">
      {title}
    </div>
  );
}

function RagBadge({ status }: { status: Paper["ragStatus"] }) {
  if (!status) return null;
  const map = {
    indexed: { label: "Indexed", cls: "bg-green-500/10 text-green-600 border border-green-500/20" },
    pending: { label: "Indexing…", cls: "bg-yellow-500/10 text-yellow-600 border border-yellow-500/20" },
    failed: { label: "Index failed", cls: "bg-destructive/10 text-destructive border border-destructive/20" },
  } as const;
  const s = map[status];
  if (!s) return null;
  return (
    <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded", s.cls)}>
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
  const { workspaceId: workspaceUrl } = useParams();
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
  const [editVolume, setEditVolume] = useState(paper.volume || "");
  const [editIssue, setEditIssue] = useState(paper.issue || "");
  const [editPages, setEditPages] = useState(paper.pages || "");
  const [editIssn, setEditIssn] = useState(paper.issn || "");
  const [editIsbn, setEditIsbn] = useState(paper.isbn || "");
  const [editUrl, setEditUrl] = useState(paper.url || "");
  const [editType, setEditType] = useState(paper.type || "");

  // New states
  const [editLanguage, setEditLanguage] = useState(paper.language || "");
  const [editJournalAbbr, setEditJournalAbbr] = useState(paper.journalAbbr || "");
  const [editShortTitle, setEditShortTitle] = useState(paper.shortTitle || "");
  const [editRights, setEditRights] = useState(paper.rights || "");
  const [editExtra, setEditExtra] = useState(paper.extra || "");

  // Child Notes Local UI States
  const [newNoteContent, setNewNoteContent] = useState("");
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteContent, setEditingNoteContent] = useState("");

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
    setEditVolume(paper.volume || "");
    setEditIssue(paper.issue || "");
    setEditPages(paper.pages || "");
    setEditIssn(paper.issn || "");
    setEditIsbn(paper.isbn || "");
    setEditUrl(paper.url || "");
    setEditType(paper.type || "");

    setEditLanguage(paper.language || "");
    setEditJournalAbbr(paper.journalAbbr || "");
    setEditShortTitle(paper.shortTitle || "");
    setEditRights(paper.rights || "");
    setEditExtra(paper.extra || "");

    setIsEditing(false);
    setNewNoteContent("");
    setIsAddingNote(false);
    setEditingNoteId(null);
    setEditingNoteContent("");
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
        volume: editVolume.trim(),
        issue: editIssue.trim(),
        pages: editPages.trim(),
        issn: editIssn.trim(),
        isbn: editIsbn.trim(),
        url: editUrl.trim(),
        type: editType.trim(),
        language: editLanguage.trim(),
        journalAbbr: editJournalAbbr.trim(),
        shortTitle: editShortTitle.trim(),
        rights: editRights.trim(),
        extra: editExtra.trim(),
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
      const data = await lookupDoi(paper.doi);
      const work = data.work;

      if (!work) {
        throw new Error("No metadata returned from backend");
      }

      updatePaper.mutate({
        paperId: paper._id,
        title: work.title || undefined,
        authors: work.authors && work.authors.length > 0 ? work.authors : undefined,
        year: work.year && !isNaN(Number(work.year)) ? Number(work.year) : undefined,
        journal: work.journal || undefined,
        publisher: work.publisher || undefined,
        volume: work.volume || undefined,
        issue: work.issue || undefined,
        pages: work.pages || undefined,
        issn: work.issn || undefined,
        isbn: work.isbn || undefined,
        url: work.url || undefined,
        type: work.type || undefined,
        language: work.language || undefined,
        journalAbbr: work.journalAbbr || undefined,
        shortTitle: work.shortTitle || undefined,
        rights: work.rights || undefined,
        abstract: work.abstract || undefined,
      });
    } catch (e: any) {
      console.error("Crossref crawl failed:", e);
      if (e?.status === 404) {
        alert("DOI not found in the Crossref registry. Please check the DOI format and values.");
      } else if (e?.status === 400) {
        alert("Invalid DOI format. Please check the DOI identifier.");
      } else {
        alert(`Failed to fetch metadata from Crossref: ${e?.message || e}`);
      }
    } finally {
      setIsCrawling(false);
    }
  };

  const handleAddNote = () => {
    if (!newNoteContent.trim()) return;
    const currentNotes = paper.notes || [];
    const updatedNotes = [
      ...currentNotes.map((n) => ({ _id: n._id, content: n.content })),
      { content: newNoteContent.trim() },
    ];
    updatePaper.mutate(
      {
        paperId: paper._id,
        notes: updatedNotes,
      },
      {
        onSuccess: () => {
          setNewNoteContent("");
          setIsAddingNote(false);
        },
      }
    );
  };

  const handleUpdateNote = (noteId: string) => {
    if (!editingNoteContent.trim()) return;
    const currentNotes = paper.notes || [];
    const updatedNotes = currentNotes.map((n) => {
      if (n._id === noteId) {
        return { _id: n._id, content: editingNoteContent.trim() };
      }
      return { _id: n._id, content: n.content };
    });
    updatePaper.mutate(
      {
        paperId: paper._id,
        notes: updatedNotes,
      },
      {
        onSuccess: () => {
          setEditingNoteId(null);
          setEditingNoteContent("");
        },
      }
    );
  };

  const handleDeleteNote = (noteId: string) => {
    if (!window.confirm("Are you sure you want to delete this note?")) return;
    const currentNotes = paper.notes || [];
    const updatedNotes = currentNotes
      .filter((n) => n._id !== noteId)
      .map((n) => ({ _id: n._id, content: n.content }));
    updatePaper.mutate({
      paperId: paper._id,
      notes: updatedNotes,
    });
  };

  return (
    <div className="w-80 shrink-0 border-l border-border bg-card flex flex-col h-full">
      {/* Header Title Section */}
      <div className="px-4 pt-4 pb-3 border-b border-border bg-background/20">
        <p className="text-sm font-semibold text-foreground leading-snug">
          {paper.title}
        </p>
        <div className="mt-2.5 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <RagBadge status={paper.ragStatus} />
            {paper.mimeType && (
              <span className="text-[10px] text-muted-foreground uppercase font-mono bg-muted px-1 py-0.5 rounded border border-border/30">
                {paper.mimeType.split("/")[1] ?? paper.mimeType}
              </span>
            )}
            {paper.size > 0 && (
              <span className="text-[11px] text-muted-foreground">
                {formatSize(paper.size)}
              </span>
            )}
          </div>
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="flex items-center gap-1 text-[11px] text-primary hover:underline font-bold transition-all"
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

      {/* Main Content Area */}
      {isEditing ? (
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {/* PRIMARY INFO */}
          <div>
            <SectionHeader title="Primary Info" />
            <div className="space-y-1.5 mt-1">
              <EditRow label="Title">
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full text-xs bg-background border border-border px-2 py-1 rounded focus:outline-none focus:border-primary transition-colors text-foreground font-normal"
                />
              </EditRow>
              <EditRow label="Authors">
                <input
                  type="text"
                  value={editAuthors}
                  onChange={(e) => setEditAuthors(e.target.value)}
                  placeholder="Comma separated"
                  className="w-full text-xs bg-background border border-border px-2 py-1 rounded focus:outline-none focus:border-primary transition-colors text-foreground font-normal"
                />
              </EditRow>
              <EditRow label="Short Title">
                <input
                  type="text"
                  value={editShortTitle}
                  onChange={(e) => setEditShortTitle(e.target.value)}
                  className="w-full text-xs bg-background border border-border px-2 py-1 rounded focus:outline-none focus:border-primary transition-colors text-foreground font-normal"
                />
              </EditRow>
              <EditRow label="Doc Type">
                <input
                  type="text"
                  value={editType}
                  onChange={(e) => setEditType(e.target.value)}
                  className="w-full text-xs bg-background border border-border px-2 py-1 rounded focus:outline-none focus:border-primary transition-colors text-foreground font-normal"
                />
              </EditRow>
              <EditRow label="Abstract">
                <textarea
                  value={editAbstract}
                  onChange={(e) => setEditAbstract(e.target.value)}
                  rows={4}
                  className="w-full text-xs bg-background border border-border px-2 py-1.5 rounded resize-none focus:outline-none focus:border-primary transition-colors text-foreground font-normal leading-relaxed"
                />
              </EditRow>
            </div>
          </div>

          {/* PUBLICATION INFO */}
          <div className="border-t border-border/30 pt-3">
            <SectionHeader title="Publication Info" />
            <div className="space-y-1.5 mt-1">
              <EditRow label="Journal">
                <input
                  type="text"
                  value={editJournal}
                  onChange={(e) => setEditJournal(e.target.value)}
                  className="w-full text-xs bg-background border border-border px-2 py-1 rounded focus:outline-none focus:border-primary transition-colors text-foreground font-normal"
                />
              </EditRow>
              <EditRow label="Publisher">
                <input
                  type="text"
                  value={editPublisher}
                  onChange={(e) => setEditPublisher(e.target.value)}
                  className="w-full text-xs bg-background border border-border px-2 py-1 rounded focus:outline-none focus:border-primary transition-colors text-foreground font-normal"
                />
              </EditRow>
              <EditRow label="Journal Abbr">
                <input
                  type="text"
                  value={editJournalAbbr}
                  onChange={(e) => setEditJournalAbbr(e.target.value)}
                  className="w-full text-xs bg-background border border-border px-2 py-1 rounded focus:outline-none focus:border-primary transition-colors text-foreground font-normal"
                />
              </EditRow>
              <EditRow label="Volume">
                <input
                  type="text"
                  value={editVolume}
                  onChange={(e) => setEditVolume(e.target.value)}
                  className="w-full text-xs bg-background border border-border px-2 py-1 rounded focus:outline-none focus:border-primary transition-colors text-foreground font-normal"
                />
              </EditRow>
              <EditRow label="Issue">
                <input
                  type="text"
                  value={editIssue}
                  onChange={(e) => setEditIssue(e.target.value)}
                  className="w-full text-xs bg-background border border-border px-2 py-1 rounded focus:outline-none focus:border-primary transition-colors text-foreground font-normal"
                />
              </EditRow>
              <EditRow label="Pages">
                <input
                  type="text"
                  value={editPages}
                  onChange={(e) => setEditPages(e.target.value)}
                  className="w-full text-xs bg-background border border-border px-2 py-1 rounded focus:outline-none focus:border-primary transition-colors text-foreground font-normal"
                />
              </EditRow>
              <EditRow label="Year">
                <input
                  type="number"
                  value={editYear}
                  onChange={(e) => setEditYear(e.target.value)}
                  className="w-full text-xs bg-background border border-border px-2 py-1 rounded focus:outline-none focus:border-primary transition-colors text-foreground font-normal [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </EditRow>
              <EditRow label="Language">
                <input
                  type="text"
                  value={editLanguage}
                  onChange={(e) => setEditLanguage(e.target.value)}
                  className="w-full text-xs bg-background border border-border px-2 py-1 rounded focus:outline-none focus:border-primary transition-colors text-foreground font-normal"
                />
              </EditRow>
            </div>
          </div>

          {/* IDENTIFIERS & LINKS */}
          <div className="border-t border-border/30 pt-3">
            <SectionHeader title="Identifiers & Links" />
            <div className="space-y-1.5 mt-1">
              <EditRow label="DOI">
                <input
                  type="text"
                  value={editDoi}
                  onChange={(e) => setEditDoi(e.target.value)}
                  className="w-full text-xs bg-background border border-border px-2 py-1 rounded focus:outline-none focus:border-primary transition-colors text-foreground font-normal"
                />
              </EditRow>
              <EditRow label="ISSN">
                <input
                  type="text"
                  value={editIssn}
                  onChange={(e) => setEditIssn(e.target.value)}
                  className="w-full text-xs bg-background border border-border px-2 py-1 rounded focus:outline-none focus:border-primary transition-colors text-foreground font-normal"
                />
              </EditRow>
              <EditRow label="ISBN">
                <input
                  type="text"
                  value={editIsbn}
                  onChange={(e) => setEditIsbn(e.target.value)}
                  className="w-full text-xs bg-background border border-border px-2 py-1 rounded focus:outline-none focus:border-primary transition-colors text-foreground font-normal"
                />
              </EditRow>
              <EditRow label="URL">
                <input
                  type="text"
                  value={editUrl}
                  onChange={(e) => setEditUrl(e.target.value)}
                  className="w-full text-xs bg-background border border-border px-2 py-1 rounded focus:outline-none focus:border-primary transition-colors text-foreground font-normal"
                />
              </EditRow>
              <EditRow label="Rights">
                <input
                  type="text"
                  value={editRights}
                  onChange={(e) => setEditRights(e.target.value)}
                  className="w-full text-xs bg-background border border-border px-2 py-1 rounded focus:outline-none focus:border-primary transition-colors text-foreground font-normal"
                />
              </EditRow>
              <EditRow label="Extra">
                <input
                  type="text"
                  value={editExtra}
                  onChange={(e) => setEditExtra(e.target.value)}
                  className="w-full text-xs bg-background border border-border px-2 py-1 rounded focus:outline-none focus:border-primary transition-colors text-foreground font-normal"
                />
              </EditRow>
              <EditRow label="Keywords">
                <input
                  type="text"
                  value={editKeywords}
                  onChange={(e) => setEditKeywords(e.target.value)}
                  placeholder="Comma separated"
                  className="w-full text-xs bg-background border border-border px-2 py-1 rounded focus:outline-none focus:border-primary transition-colors text-foreground font-normal"
                />
              </EditRow>
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-2">
            <button
              onClick={handleSaveMetadata}
              disabled={updatePaper.isPending || !editTitle.trim()}
              className="flex items-center justify-center gap-1.5 w-full h-9 rounded bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/95 transition-all shadow-sm"
            >
              {updatePaper.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Check className="size-3.5" />
              )}
              Save Details
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {/* PRIMARY INFO */}
          <div>
            <SectionHeader title="Primary Info" />
            <div className="space-y-0.5 mt-1">
              {paper.authors.length > 0 && (
                <DetailRow label="Authors">{paper.authors.join("; ")}</DetailRow>
              )}
              {paper.abstract && (
                <DetailRow label="Abstract">
                  <p className="text-xs leading-relaxed text-muted-foreground hover:text-foreground line-clamp-4 hover:line-clamp-none cursor-pointer transition-all duration-200">
                    {paper.abstract}
                  </p>
                </DetailRow>
              )}
              {paper.shortTitle && (
                <DetailRow label="Short Title">{paper.shortTitle}</DetailRow>
              )}
              {paper.type && (
                <DetailRow label="Doc Type">
                  <span className="capitalize font-mono text-[11px] bg-secondary/50 px-1.5 py-0.5 rounded text-muted-foreground">
                    {paper.type}
                  </span>
                </DetailRow>
              )}
            </div>
          </div>

          {/* PUBLICATION INFO */}
          <div className="border-t border-border/30 pt-3">
            <SectionHeader title="Publication Info" />
            <div className="space-y-0.5 mt-1">
              {paper.journal && (
                <DetailRow label="Journal">
                  <em className="font-medium text-foreground">{paper.journal}</em>
                </DetailRow>
              )}
              {paper.publisher && (
                <DetailRow label="Publisher">{paper.publisher}</DetailRow>
              )}
              {paper.journalAbbr && (
                <DetailRow label="Journal Abbr">{paper.journalAbbr}</DetailRow>
              )}
              {(paper.volume || paper.issue || paper.pages) && (
                <DetailRow label="Vol/Is/Pg">
                  <span className="font-mono text-muted-foreground text-[11px]">
                    {[
                      paper.volume ? `Vol. ${paper.volume}` : "",
                      paper.issue ? `No. ${paper.issue}` : "",
                      paper.pages ? `pp. ${paper.pages}` : "",
                    ]
                      .filter(Boolean)
                      .join(", ")}
                  </span>
                </DetailRow>
              )}
              {paper.year && <DetailRow label="Year">{paper.year}</DetailRow>}
              {paper.language && <DetailRow label="Language">{paper.language}</DetailRow>}
            </div>
          </div>

          {/* IDENTIFIERS & LINKS */}
          <div className="border-t border-border/30 pt-3">
            <SectionHeader title="Identifiers & Links" />
            <div className="space-y-0.5 mt-1">
              {paper.doi && (
                <DetailRow label="DOI">
                  <div className="flex items-center justify-between gap-1.5 min-w-0">
                    <span className="font-mono text-[11px] break-all truncate text-muted-foreground select-all">{paper.doi}</span>
                    <button
                      className="flex items-center justify-center size-5 bg-secondary hover:bg-secondary/80 rounded transition-colors text-muted-foreground shrink-0 border border-border/40"
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
                </DetailRow>
              )}
              {paper.issn && <DetailRow label="ISSN">{paper.issn}</DetailRow>}
              {paper.isbn && <DetailRow label="ISBN">{paper.isbn}</DetailRow>}
              {paper.url && (
                <DetailRow label="URL">
                  <a
                    href={paper.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline flex items-center gap-1 break-all truncate"
                  >
                    <span className="truncate">{paper.url}</span>
                    <ExternalLink className="size-3 shrink-0" />
                  </a>
                </DetailRow>
              )}
              {paper.rights && <DetailRow label="Rights">{paper.rights}</DetailRow>}
              {collection && (
                <DetailRow label="Collection">
                  <span
                    className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded font-medium border border-current/10"
                    style={{
                      backgroundColor: `${collection.color || "#3370ff"}10`,
                      color: collection.color || "#3370ff",
                    }}
                  >
                    <FolderOpen className="size-3" />
                    {collection.name}
                  </span>
                </DetailRow>
              )}
              {paper.filename && (
                <DetailRow label="File">
                  <span className="font-mono text-[11px] text-muted-foreground break-all truncate" title={paper.filename}>
                    {paper.filename}
                  </span>
                </DetailRow>
              )}
              {paper.extra && <DetailRow label="Extra">{paper.extra}</DetailRow>}
            </div>
          </div>

          {/* Keywords & Tags */}
          {(paper.keywords && paper.keywords.length > 0) || (paper.tags && paper.tags.length > 0) ? (
            <div className="border-t border-border/30 pt-3 space-y-2">
              {paper.keywords && paper.keywords.length > 0 && (
                <DetailRow label="Keywords">
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {paper.keywords.map((kw) => (
                      <span
                        key={kw}
                        className="text-[10px] bg-secondary text-muted-foreground px-1.5 py-0.5 rounded border border-border/40"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                </DetailRow>
              )}
              {paper.tags && paper.tags.length > 0 && (
                <DetailRow label="Tags">
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {paper.tags.map((t) => (
                      <span
                        key={t}
                        className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded border border-primary/20 font-medium"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </DetailRow>
              )}
            </div>
          ) : null}

          {/* CHILD NOTES SECTION */}
          <div className="border-t border-border/30 pt-3 mt-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 select-none">
                <FileText className="size-3.5 text-primary" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-foreground">
                  Notes ({paper.notes?.length || 0})
                </span>
              </div>
              <button
                onClick={() => setIsAddingNote(!isAddingNote)}
                className="flex items-center gap-1 text-[10px] text-primary hover:underline font-bold"
              >
                {isAddingNote ? (
                  <>
                    <X className="size-3" />
                    Cancel
                  </>
                ) : (
                  <>
                    <Plus className="size-3" />
                    Add Note
                  </>
                )}
              </button>
            </div>

            {/* Note Adding Form */}
            {isAddingNote && (
              <div className="mb-3 bg-muted/20 border border-border/40 rounded-lg p-2.5 space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                <textarea
                  value={newNoteContent}
                  onChange={(e) => setNewNoteContent(e.target.value)}
                  placeholder="Type a new note..."
                  rows={3}
                  className="w-full text-xs bg-background border border-border px-2 py-1.5 rounded resize-none focus:outline-none focus:border-primary text-foreground leading-relaxed animate-in zoom-in-95 duration-150"
                  autoFocus
                />
                <div className="flex justify-end gap-1.5">
                  <button
                    onClick={() => {
                      setNewNoteContent("");
                      setIsAddingNote(false);
                    }}
                    className="h-7 px-2.5 rounded text-[11px] font-medium text-muted-foreground hover:bg-muted/50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddNote}
                    disabled={updatePaper.isPending || !newNoteContent.trim()}
                    className="h-7 px-3 rounded text-[11px] font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none transition-colors flex items-center gap-1"
                  >
                    {updatePaper.isPending && <Loader2 className="size-3 animate-spin" />}
                    Add Note
                  </button>
                </div>
              </div>
            )}

            {/* Notes List */}
            <div className="space-y-2.5">
              {!paper.notes || paper.notes.length === 0 ? (
                <p className="text-[11px] text-muted-foreground/60 italic py-2 text-center select-none">
                  No notes attached to this paper.
                </p>
              ) : (
                paper.notes.map((note) => (
                  <div
                    key={note._id}
                    className="bg-muted/30 backdrop-blur-sm hover:bg-muted/50 transition-all rounded-lg p-3 border border-border/30 shadow-sm relative group"
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between gap-2 mb-1.5 select-none">
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Calendar className="size-3 text-muted-foreground/70" />
                        <span>{formatNoteDate(note.updatedAt || note.createdAt)}</span>
                      </div>

                      {/* Hover action icons */}
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                        <button
                          onClick={() => {
                            setEditingNoteId(note._id);
                            setEditingNoteContent(note.content);
                          }}
                          className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-background/80 transition-colors"
                          title="Edit note"
                        >
                          <Edit3 className="size-3" />
                        </button>
                        <button
                          onClick={() => handleDeleteNote(note._id)}
                          className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-background/80 transition-colors"
                          title="Delete note"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </div>
                    </div>

                    {/* Content / Edit Form */}
                    {editingNoteId === note._id ? (
                      <div className="space-y-2 mt-1">
                        <textarea
                          value={editingNoteContent}
                          onChange={(e) => setEditingNoteContent(e.target.value)}
                          rows={3}
                          className="w-full text-xs bg-background border border-border px-2 py-1.5 rounded resize-none focus:outline-none focus:border-primary text-foreground leading-relaxed"
                          autoFocus
                        />
                        <div className="flex justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setEditingNoteId(null);
                              setEditingNoteContent("");
                            }}
                            className="h-6 px-2 rounded text-[10px] font-medium text-muted-foreground hover:bg-muted/50 transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleUpdateNote(note._id)}
                            disabled={updatePaper.isPending || !editingNoteContent.trim()}
                            className="h-6 px-2.5 rounded text-[10px] font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-1"
                          >
                            {updatePaper.isPending && <Loader2 className="size-2.5 animate-spin" />}
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-foreground/80 leading-relaxed break-words whitespace-pre-wrap">
                        {note.content}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Open PDF Footer Button */}
      {resolvedUrl && (
        <div className="px-4 pb-4 pt-2 border-t border-border shrink-0 bg-background/20 flex gap-2">
          <Link
            to={`/${workspaceUrl}/library/papers/${paper._id}/reader`}
            className="flex-1 flex items-center justify-center gap-2 h-9 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 shadow-sm transition-all duration-200"
          >
            <FileText className="size-4" />
            Open Reader
          </Link>
          <a
            href={resolvedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center w-9 h-9 rounded-md border border-border bg-background hover:bg-muted/50 transition-all duration-200 text-muted-foreground hover:text-foreground shrink-0"
            title="Open raw PDF in new tab"
          >
            <ExternalLink className="size-4" />
          </a>
        </div>
      )}
    </div>
  );
}
