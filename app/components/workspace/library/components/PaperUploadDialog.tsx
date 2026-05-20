import { useState, useRef } from "react";
import { Upload, X, FileText, Loader2, Sparkles, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { cn } from "~/lib/utils";
import { uploadFile, fetchWorkspaceFiles, createFolder } from "~/query/storage";
import { extractPdfMetadataFromFile } from "~/lib/pdf";

interface PaperUploadData {
  title: string;
  authors: string[];
  year: number | null;
  doi: string;
  abstract: string;
  fileUrl: string;
  filename: string;
  mimeType: string;
  size: number;
  journal?: string;
  publisher?: string;
  keywords?: string[];
  volume?: string;
  issue?: string;
  pages?: string;
  issn?: string;
  isbn?: string;
  url?: string;
  type?: string;
  language?: string;
  journalAbbr?: string;
  shortTitle?: string;
  rights?: string;
  extra?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: PaperUploadData) => void;
  isPending?: boolean;
  workspaceId: string;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type ExtractStatus = "idle" | "extracting" | "done" | "failed";

export default function PaperUploadDialog({
  open,
  onOpenChange,
  onSubmit,
  isPending,
  workspaceId,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [authors, setAuthors] = useState("");
  const [year, setYear] = useState("");
  const [doi, setDoi] = useState("");
  const [abstract, setAbstract] = useState("");
  const [journal, setJournal] = useState("");
  const [publisher, setPublisher] = useState("");
  const [keywords, setKeywords] = useState("");
  const [volume, setVolume] = useState("");
  const [issue, setIssue] = useState("");
  const [pages, setPages] = useState("");
  const [issn, setIssn] = useState("");
  const [isbn, setIsbn] = useState("");
  const [url, setUrl] = useState("");
  const [type, setType] = useState("");
  const [language, setLanguage] = useState("");
  const [journalAbbr, setJournalAbbr] = useState("");
  const [shortTitle, setShortTitle] = useState("");
  const [rights, setRights] = useState("");
  const [extra, setExtra] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [extractStatus, setExtractStatus] = useState<ExtractStatus>("idle");

  const reset = () => {
    setFile(null);
    setUploading(false);
    setUploadedUrl(null);
    setTitle("");
    setAuthors("");
    setYear("");
    setDoi("");
    setAbstract("");
    setJournal("");
    setPublisher("");
    setKeywords("");
    setVolume("");
    setIssue("");
    setPages("");
    setIssn("");
    setIsbn("");
    setUrl("");
    setType("");
    setLanguage("");
    setJournalAbbr("");
    setShortTitle("");
    setRights("");
    setExtra("");
    setDragOver(false);
    setExtractStatus("idle");
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  // Upload the file to workspace storage inside a "Paper Upload" folder
  const uploadToStorage = async (f: File): Promise<string> => {
    let folderId = null;
    try {
      const data = (await fetchWorkspaceFiles(workspaceId, null)) as any;
      const files = data?.files || [];
      const existingFolder = files.find(
        (item: any) => item.isFolder && item.filename === "Paper Upload",
      );
      if (existingFolder) {
        folderId = existingFolder._id;
      } else {
        const newFolder = (await createFolder("Paper Upload", {
          scope: "workspace",
          workspaceId,
        })) as any;
        folderId = newFolder?.folder?._id || newFolder?._id;
      }
    } catch (e) {
      console.error("Failed to setup library upload folder:", e);
    }

    const res = (await uploadFile(f, {
      scope: "workspace",
      workspaceId,
      parentId: folderId,
    })) as any;

    const fileUrl = res?.file?.url || res?.url;
    if (!fileUrl) throw new Error("Upload failed: missing url");
    return fileUrl;
  };

  const handleFileSelected = async (f: File) => {
    setFile(f);
    // Set filename as fallback title immediately
    setTitle(f.name.replace(/\.[^/.]+$/, ""));

    // Run upload & metadata extraction in parallel
    const uploadPromise = (async () => {
      try {
        setUploading(true);
        const url = await uploadToStorage(f);
        setUploadedUrl(url);
      } catch (e) {
        console.error("Upload error", e);
        setFile(null);
      } finally {
        setUploading(false);
      }
    })();

    const extractPromise = (async () => {
      const isPdf =
        f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
      if (!isPdf) return;

      try {
        setExtractStatus("extracting");
        const meta = await extractPdfMetadataFromFile(f);
        if (meta) {
          // Auto-fill form fields from extracted metadata
          if (meta.title) setTitle(meta.title);
          if (meta.authors?.length) {
            setAuthors(meta.authors.join(", "));
          } else if (meta.author) {
            setAuthors(meta.author);
          }
          if (meta.year) setYear(String(meta.year));
          if (meta.doi) setDoi(meta.doi);
          if (meta.abstract) setAbstract(meta.abstract);
          if (meta.journal) setJournal(meta.journal);
          if (meta.publisher) setPublisher(meta.publisher);
          if (meta.volume) setVolume(meta.volume);
          if (meta.issue) setIssue(meta.issue);
          if (meta.pages) setPages(meta.pages);
          if (meta.issn) setIssn(meta.issn);
          if (meta.isbn) setIsbn(meta.isbn);
          if (meta.url) setUrl(meta.url);
          if (meta.type) setType(meta.type);
          if (meta.language) setLanguage(meta.language);
          if (meta.journalAbbr) setJournalAbbr(meta.journalAbbr);
          if (meta.shortTitle) setShortTitle(meta.shortTitle);
          if (meta.rights) setRights(meta.rights);
          if (meta.keywords) {
            setKeywords(
              Array.isArray(meta.keywords)
                ? meta.keywords.join(", ")
                : String(meta.keywords)
            );
          }
          setExtractStatus("done");
        } else {
          setExtractStatus("failed");
        }
      } catch (e) {
        console.error("Metadata extraction error:", e);
        setExtractStatus("failed");
      }
    })();

    await Promise.allSettled([uploadPromise, extractPromise]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFileSelected(dropped);
  };

  const handleSubmit = () => {
    if (!uploadedUrl || !title.trim() || !file) return;
    onSubmit({
      title: title.trim(),
      authors: authors
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean),
      year: year ? parseInt(year) : null,
      doi: doi.trim(),
      abstract: abstract.trim(),
      fileUrl: uploadedUrl,
      filename: file.name,
      mimeType: file.type || "application/pdf",
      size: file.size,
      journal: journal.trim() || undefined,
      publisher: publisher.trim() || undefined,
      keywords: keywords
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean),
      volume: volume.trim() || undefined,
      issue: issue.trim() || undefined,
      pages: pages.trim() || undefined,
      issn: issn.trim() || undefined,
      isbn: isbn.trim() || undefined,
      url: url.trim() || undefined,
      type: type.trim() || undefined,
      language: language.trim() || undefined,
      journalAbbr: journalAbbr.trim() || undefined,
      shortTitle: shortTitle.trim() || undefined,
      rights: rights.trim() || undefined,
      extra: extra.trim() || undefined,
    });
    reset();
  };

  const canSubmit =
    !!uploadedUrl && !!title.trim() && !uploading && !isPending;

  const extractLabel =
    extractStatus === "extracting"
      ? "Extracting metadata…"
      : extractStatus === "done"
        ? "Metadata extracted"
        : extractStatus === "failed"
          ? "Could not extract metadata"
          : null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="size-4" />
            Upload Paper
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Drop zone */}
          {!file ? (
            <div
              className={cn(
                "flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 transition-colors cursor-pointer",
                dragOver
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/40 hover:bg-accent/30",
              )}
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10">
                <FileText className="size-6 text-primary" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">
                  Drop PDF here or click to browse
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  PDF, max 50 MB
                </p>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFileSelected(f);
                  e.target.value = "";
                }}
              />
            </div>
          ) : (
            <div className="space-y-2">
              {/* File info */}
              <div className="flex items-center gap-3 rounded-lg border border-border bg-accent/30 px-3 py-2.5">
                {uploading ? (
                  <Loader2 className="size-5 text-primary animate-spin shrink-0" />
                ) : (
                  <FileText className="size-5 text-primary shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {uploading
                      ? "Uploading…"
                      : `${formatBytes(file.size)} · Uploaded`}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setFile(null);
                    setUploadedUrl(null);
                    setExtractStatus("idle");
                  }}
                  className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <X className="size-4" />
                </button>
              </div>

              {/* Metadata extraction status */}
              {extractLabel && (
                <div
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-1.5 text-xs",
                    extractStatus === "extracting" &&
                      "bg-primary/5 text-primary",
                    extractStatus === "done" &&
                      "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                    extractStatus === "failed" &&
                      "bg-amber-500/10 text-amber-600 dark:text-amber-400",
                  )}
                >
                  {extractStatus === "extracting" && (
                    <Sparkles className="size-3.5 animate-pulse" />
                  )}
                  {extractStatus === "done" && (
                    <Check className="size-3.5" />
                  )}
                  {extractLabel}
                </div>
              )}
            </div>
          )}

          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="paper-title">Title *</Label>
            <Input
              id="paper-title"
              placeholder="Paper title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Authors */}
          <div className="space-y-1.5">
            <Label htmlFor="paper-authors">
              Authors{" "}
              <span className="text-muted-foreground font-normal">
                (comma separated)
              </span>
            </Label>
            <Input
              id="paper-authors"
              placeholder="e.g. John Doe, Jane Smith"
              value={authors}
              onChange={(e) => setAuthors(e.target.value)}
            />
          </div>

          {/* Year + DOI */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="paper-year">Year</Label>
              <Input
                id="paper-year"
                type="number"
                placeholder="2024"
                min={1900}
                max={new Date().getFullYear() + 1}
                value={year}
                onChange={(e) => setYear(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="paper-doi">DOI</Label>
              <Input
                id="paper-doi"
                placeholder="10.1234/example"
                value={doi}
                onChange={(e) => setDoi(e.target.value)}
              />
            </div>
          </div>

          {/* Journal + Publisher */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="paper-journal">Journal</Label>
              <Input
                id="paper-journal"
                placeholder="e.g. Nature"
                value={journal}
                onChange={(e) => setJournal(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="paper-publisher">Publisher</Label>
              <Input
                id="paper-publisher"
                placeholder="e.g. Springer"
                value={publisher}
                onChange={(e) => setPublisher(e.target.value)}
              />
            </div>
          </div>

          {/* Volume + Issue + Pages */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="paper-volume">Volume</Label>
              <Input
                id="paper-volume"
                placeholder="e.g. 15"
                value={volume}
                onChange={(e) => setVolume(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="paper-issue">Issue</Label>
              <Input
                id="paper-issue"
                placeholder="e.g. 3"
                value={issue}
                onChange={(e) => setIssue(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="paper-pages">Pages</Label>
              <Input
                id="paper-pages"
                placeholder="e.g. 101-115"
                value={pages}
                onChange={(e) => setPages(e.target.value)}
              />
            </div>
          </div>

          {/* ISSN + ISBN */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="paper-issn">ISSN</Label>
              <Input
                id="paper-issn"
                placeholder="e.g. 2041-1723"
                value={issn}
                onChange={(e) => setIssn(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="paper-isbn">ISBN</Label>
              <Input
                id="paper-isbn"
                placeholder="e.g. 978-3-16..."
                value={isbn}
                onChange={(e) => setIsbn(e.target.value)}
              />
            </div>
          </div>

          {/* URL + Type */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="paper-url">URL</Label>
              <Input
                id="paper-url"
                placeholder="e.g. https://..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="paper-type">Document Type</Label>
              <Input
                id="paper-type"
                placeholder="e.g. journal-article"
                value={type}
                onChange={(e) => setType(e.target.value)}
              />
            </div>
          </div>

          {/* Language + Journal Abbr */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="paper-language">Language</Label>
              <Input
                id="paper-language"
                placeholder="e.g. en"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="paper-journalAbbr">Journal Abbreviation</Label>
              <Input
                id="paper-journalAbbr"
                placeholder="e.g. Nat. Commun."
                value={journalAbbr}
                onChange={(e) => setJournalAbbr(e.target.value)}
              />
            </div>
          </div>

          {/* Short Title + Rights */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="paper-shortTitle">Short Title</Label>
              <Input
                id="paper-shortTitle"
                placeholder="e.g. Zotero Integration"
                value={shortTitle}
                onChange={(e) => setShortTitle(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="paper-rights">Rights / License</Label>
              <Input
                id="paper-rights"
                placeholder="e.g. CC BY 4.0"
                value={rights}
                onChange={(e) => setRights(e.target.value)}
              />
            </div>
          </div>

          {/* Extra */}
          <div className="space-y-1.5">
            <Label htmlFor="paper-extra">Extra</Label>
            <Input
              id="paper-extra"
              placeholder="e.g. Citation Key: doe2024"
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
            />
          </div>

          {/* Keywords */}
          <div className="space-y-1.5">
            <Label htmlFor="paper-keywords">
              Keywords{" "}
              <span className="text-muted-foreground font-normal">
                (comma separated)
              </span>
            </Label>
            <Input
              id="paper-keywords"
              placeholder="e.g. deep learning, neural networks"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
            />
          </div>

          {/* Abstract */}
          <div className="space-y-1.5">
            <Label htmlFor="paper-abstract">Abstract</Label>
            <Textarea
              id="paper-abstract"
              placeholder="Paste the abstract here…"
              value={abstract}
              onChange={(e) => setAbstract(e.target.value)}
              rows={4}
              className="resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isPending || uploading}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Add Paper"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
