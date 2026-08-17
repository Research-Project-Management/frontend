'use client';

import { useState, useRef, useEffect } from "react";
import { Upload, X, FileText, Loader2, Sparkles, Check, Link2, Globe, Search, FolderUp, Folder } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/shared/components/ui";
import { Button } from "@/shared/components/ui";
import { Input } from "@/shared/components/ui";
import { Label } from "@/shared/components/ui";
import { Textarea } from "@/shared/components/ui";
import { cn } from "@/shared/lib/utils";
import { useUpload } from '@/shared/hooks';
import { extractMetadata, extractDoiFromText } from '@/features/workspaces/library/utils/metadata';
import { fetchReferenceByDoi } from '@/features/workspaces/library/services/reference.service';
import { toast } from 'sonner';

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
  initialMode?: "file" | "folder" | "link";
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
  initialMode = "file",
}: Props) {
  const [mode, setMode] = useState<"file" | "folder" | "link">(initialMode);
  const fileRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  
  // Single file state
  const [file, setFile] = useState<File | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const { uploadFile, isUploading: uploading, clearAll: resetUpload } = useUpload();
  
  // Folder upload state
  const [folderFiles, setFolderFiles] = useState<File[]>([]);
  const [folderName, setFolderName] = useState("");
  const [isFolderUploading, setIsFolderUploading] = useState(false);
  const [folderProgress, setFolderProgress] = useState({ current: 0, total: 0 });

  // Link state
  const [linkUrl, setLinkUrl] = useState("");
  const [isResolvingLink, setIsResolvingLink] = useState(false);

  // Metadata form state
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

  useEffect(() => {
    if (open) {
      setMode(initialMode || "file");
    }
  }, [open, initialMode]);

  const reset = () => {
    setFile(null);
    setUploadedUrl(null);
    setFolderFiles([]);
    setFolderName("");
    setIsFolderUploading(false);
    setFolderProgress({ current: 0, total: 0 });
    setLinkUrl("");
    setIsResolvingLink(false);
    resetUpload();
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

  const handleFileSelected = async (f: File) => {
    setFile(f);
    setTitle(f.name.replace(/\.[^/.]+$/, ""));

    const uploadPromise = (async () => {
      try {
        const resultUrl = await uploadFile(f, {
          prefix: `workspace/${workspaceId}`,
          allowedTypes: ['application/pdf'],
        });
        setUploadedUrl(resultUrl);
      } catch (e: any) {
        console.error("Upload error", e);
        toast.error(e?.message || "Failed to upload file to storage");
        setFile(null);
        setUploadedUrl(null);
      }
    })();

    const extractPromise = (async () => {
      const isPdf =
        f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
      if (!isPdf) return;

      try {
        setExtractStatus("extracting");
        const meta = await extractMetadata(f);
        if (meta) {
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

  const handleFolderSelected = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const allFiles = Array.from(fileList);
    const pdfFiles = allFiles.filter(
      (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
    );

    if (pdfFiles.length === 0) {
      toast.error("No PDF files found in the selected folder.");
      return;
    }

    // Extract folder name from the first file's webkitRelativePath
    const firstPath = pdfFiles[0]?.webkitRelativePath || '';
    const extractedFolderName = firstPath ? firstPath.split('/')[0] : 'Uploaded Folder';
    setFolderName(extractedFolderName);
    setFolderFiles(pdfFiles);
    toast.success(`Found ${pdfFiles.length} PDF files in folder "${extractedFolderName}"`);
  };

  const handleBatchFolderUpload = async () => {
    if (folderFiles.length === 0) return;
    setIsFolderUploading(true);
    setFolderProgress({ current: 0, total: folderFiles.length });

    let successCount = 0;
    for (let i = 0; i < folderFiles.length; i++) {
      const f = folderFiles[i];
      setFolderProgress({ current: i + 1, total: folderFiles.length });
      try {
        const uploadedFileUrl = await uploadFile(f, {
          prefix: `workspace/${workspaceId}`,
        });

        // Fast metadata extraction
        let metaTitle = f.name.replace(/\.[^/.]+$/, "");
        let metaAuthors: string[] = [];
        let metaYear: number | null = null;
        let metaDoi = "";
        let metaAbstract = "";
        let metaJournal = "";

        try {
          const meta = await extractMetadata(f);
          if (meta) {
            if (meta.title) metaTitle = meta.title;
            if (meta.authors?.length) metaAuthors = meta.authors;
            if (meta.year) metaYear = typeof meta.year === 'number' ? meta.year : parseInt(String(meta.year), 10) || null;
            if (meta.doi) metaDoi = meta.doi;
            if (meta.abstract) metaAbstract = meta.abstract;
            if (meta.journal) metaJournal = meta.journal;
          }
        } catch {
          // ignore extraction error on batch
        }

        await onSubmit({
          title: metaTitle,
          authors: metaAuthors,
          year: metaYear,
          doi: metaDoi,
          abstract: metaAbstract,
          fileUrl: uploadedFileUrl,
          filename: f.name,
          mimeType: f.type || "application/pdf",
          size: f.size,
          journal: metaJournal || undefined,
        });
        successCount++;
      } catch (err) {
        console.error(`Failed to upload ${f.name}:`, err);
      }
    }

    setIsFolderUploading(false);
    if (successCount > 0) {
      toast.success(`Successfully uploaded ${successCount}/${folderFiles.length} documents from "${folderName}"!`);
      reset();
      onOpenChange(false);
    } else {
      toast.error(`Failed to upload documents from "${folderName}".`);
    }
  };

  const handleResolveLink = async () => {
    const trimmed = linkUrl.trim();
    if (!trimmed) {
      toast.error("Please enter a link URL or DOI");
      return;
    }

    setIsResolvingLink(true);
    try {
      setUrl(trimmed);
      const extractedDoi = extractDoiFromText(trimmed) || (trimmed.startsWith("10.") ? trimmed : "");
      if (extractedDoi) {
        setDoi(extractedDoi);
        const meta = await fetchReferenceByDoi(extractedDoi);
        if (meta) {
          if (meta.title) setTitle(meta.title);
          if (meta.authors?.length) setAuthors(meta.authors.join(", "));
          if (meta.year) setYear(String(meta.year));
          if (meta.journal) setJournal(meta.journal);
          if (meta.publisher) setPublisher(meta.publisher);
          if (meta.abstract) setAbstract(meta.abstract);
          if (meta.volume) setVolume(meta.volume);
          if (meta.issue) setIssue(meta.issue);
          if (meta.pages) setPages(meta.pages);
          if (meta.url) setUrl(meta.url);
          toast.success("Metadata resolved from CrossRef!");
        }
      } else {
        const filename = trimmed.split("/").pop()?.split("?")[0] || "";
        if (filename && !title) {
          setTitle(decodeURIComponent(filename).replace(/\.[^/.]+$/, ""));
        }
        toast.info("Link set. Please review details.");
      }
    } catch (err) {
      console.warn("Link resolve error:", err);
      toast.error("Could not fetch metadata for this link. You can enter details manually.");
    } finally {
      setIsResolvingLink(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFileSelected(dropped);
  };

  const handleSubmit = async () => {
    if (mode === "file") {
      if (!uploadedUrl || !title.trim() || !file) return;
      await onSubmit({
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
      onOpenChange(false);
    } else if (mode === "link") {
      const finalUrl = linkUrl.trim() || url.trim();
      if (!title.trim() || !finalUrl) return;
      const derivedName = finalUrl.split("/").pop()?.split("?")[0] || "linked-document.pdf";

      await onSubmit({
        title: title.trim(),
        authors: authors
          .split(",")
          .map((a) => a.trim())
          .filter(Boolean),
        year: year ? parseInt(year) : null,
        doi: doi.trim(),
        abstract: abstract.trim(),
        fileUrl: finalUrl,
        filename: derivedName.endsWith(".pdf") ? derivedName : `${derivedName}.pdf`,
        mimeType: "application/pdf",
        size: 0,
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
        url: finalUrl,
        type: type.trim() || undefined,
        language: language.trim() || undefined,
        journalAbbr: journalAbbr.trim() || undefined,
        shortTitle: shortTitle.trim() || undefined,
        rights: rights.trim() || undefined,
        extra: extra.trim() || undefined,
      });
      reset();
      onOpenChange(false);
    }
  };

  const canSubmit =
    mode === "file"
      ? !!uploadedUrl && !!title.trim() && !uploading && !isPending
      : mode === "folder"
        ? folderFiles.length > 0 && !isFolderUploading
        : !!title.trim() && (!!linkUrl.trim() || !!url.trim()) && !isPending;

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
      <DialogContent
        onCloseAutoFocus={(e) => e.preventDefault()}
        className="sm:max-w-lg max-h-[90vh] overflow-y-auto bg-popover"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            {mode === "file" ? (
              <>
                <Upload className="size-4 text-foreground" />
                <span>Add File</span>
              </>
            ) : mode === "folder" ? (
              <>
                <FolderUp className="size-4 text-foreground" />
                <span>Add Folder (Batch Upload)</span>
              </>
            ) : (
              <>
                <Link2 className="size-4 text-foreground" />
                <span>Add Link to File</span>
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Mode Selector Tabs */}
        <div className="flex items-center p-1 bg-muted/50 rounded-lg border border-border/50 gap-1 text-xs">
          <button
            type="button"
            onClick={() => setMode("file")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md font-medium transition-all cursor-pointer",
              mode === "file"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <FileText className="size-3.5 text-foreground" />
            <span>Add File</span>
          </button>
          <button
            type="button"
            onClick={() => setMode("folder")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md font-medium transition-all cursor-pointer",
              mode === "folder"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <FolderUp className="size-3.5 text-foreground" />
            <span>Add Folder</span>
          </button>
          <button
            type="button"
            onClick={() => setMode("link")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md font-medium transition-all cursor-pointer",
              mode === "link"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Link2 className="size-3.5 text-foreground" />
            <span>Add Link</span>
          </button>
        </div>

        <div className="space-y-4 py-1">
          {/* File Upload Mode */}
          {mode === "file" && (
            <>
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
                  <div className="flex size-12 items-center justify-center rounded-lg bg-muted">
                    <FileText className="size-6 text-foreground" />
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
                      <Loader2 className="size-5 text-foreground animate-spin shrink-0" />
                    ) : (
                      <FileText className="size-5 text-foreground shrink-0" />
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
                        resetUpload();
                        setExtractStatus("idle");
                      }}
                      className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                    >
                      <X className="size-4 text-foreground" />
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
                    placeholder="e.g. 4"
                    value={issue}
                    onChange={(e) => setIssue(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="paper-pages">Pages</Label>
                  <Input
                    id="paper-pages"
                    placeholder="e.g. 123-145"
                    value={pages}
                    onChange={(e) => setPages(e.target.value)}
                  />
                </div>
              </div>

              {/* Abstract */}
              <div className="space-y-1.5">
                <Label htmlFor="paper-abstract">Abstract</Label>
                <Textarea
                  id="paper-abstract"
                  placeholder="Paper abstract or summary..."
                  rows={3}
                  value={abstract}
                  onChange={(e) => setAbstract(e.target.value)}
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
                  placeholder="e.g. machine learning, NLP, transformers"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                />
              </div>
            </>
          )}

          {/* Folder Upload Mode */}
          {mode === "folder" && (
            <div className="space-y-3">
              {folderFiles.length === 0 ? (
                <div
                  className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 transition-colors cursor-pointer border-border hover:border-primary/40 hover:bg-accent/30"
                  onClick={() => folderRef.current?.click()}
                >
                  <div className="flex size-12 items-center justify-center rounded-lg bg-muted">
                    <FolderUp className="size-6 text-foreground" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-foreground">
                      Click to choose folder from your drive
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Uploads all PDF documents found in the selected directory
                    </p>
                  </div>
                  <input
                    ref={folderRef}
                    type="file"
                    {...({ webkitdirectory: "", directory: "" } as any)}
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      handleFolderSelected(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-accent/30">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Folder className="size-5 text-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold truncate">{folderName}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {folderFiles.length} PDF files ready to import
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setFolderFiles([])}
                      className="size-7 p-0 cursor-pointer"
                    >
                      <X className="size-4 text-foreground" />
                    </Button>
                  </div>

                  {/* List preview of files */}
                  <div className="max-h-48 overflow-y-auto border border-border/50 rounded-md divide-y divide-border/40 text-xs">
                    {folderFiles.map((f, i) => (
                      <div key={i} className="px-3 py-2 flex items-center justify-between gap-2 hover:bg-muted/40">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="size-3.5 text-foreground shrink-0" />
                          <span className="truncate">{f.name}</span>
                        </div>
                        <span className="text-[11px] text-muted-foreground shrink-0">{formatBytes(f.size)}</span>
                      </div>
                    ))}
                  </div>

                  {isFolderUploading && (
                    <div className="p-3 bg-muted/30 rounded-lg space-y-1.5">
                      <div className="flex justify-between text-xs font-medium">
                        <span>Uploading files...</span>
                        <span>{folderProgress.current} / {folderProgress.total}</span>
                      </div>
                      <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all duration-300"
                          style={{
                            width: `${(folderProgress.current / Math.max(1, folderProgress.total)) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Link to File Mode */}
          {mode === "link" && (
            <>
              <div className="space-y-2 p-3 bg-muted/20 border border-border/50 rounded-lg">
                <Label htmlFor="link-url" className="text-xs font-semibold">
                  Link URL or DOI *
                </Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Globe className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      id="link-url"
                      placeholder="e.g. https://arxiv.org/pdf/... or 10.1145/..."
                      value={linkUrl}
                      onChange={(e) => setLinkUrl(e.target.value)}
                      className="pl-8 text-xs"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleResolveLink}
                    disabled={!linkUrl.trim() || isResolvingLink}
                    className="gap-1.5 text-xs shrink-0 cursor-pointer"
                  >
                    {isResolvingLink ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Search className="size-3.5" />
                    )}
                    <span>Fetch Info</span>
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Paste a web link to a PDF, ArXiv paper, or DOI to automatically populate metadata.
                </p>
              </div>

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

              {/* Journal */}
              <div className="space-y-1.5">
                <Label htmlFor="paper-journal">Journal</Label>
                <Input
                  id="paper-journal"
                  placeholder="e.g. Nature"
                  value={journal}
                  onChange={(e) => setJournal(e.target.value)}
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={uploading || isPending || isFolderUploading}
            className="cursor-pointer"
          >
            Cancel
          </Button>
          {mode === "folder" ? (
            <Button
              onClick={handleBatchFolderUpload}
              disabled={!canSubmit}
              className="cursor-pointer"
            >
              {isFolderUploading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Importing Folder…
                </>
              ) : (
                `Import ${folderFiles.length > 0 ? `${folderFiles.length} ` : ''}Documents`
              )}
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="cursor-pointer"
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Saving…
                </>
              ) : mode === "file" ? (
                "Add to Library"
              ) : (
                "Add Link to Library"
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
