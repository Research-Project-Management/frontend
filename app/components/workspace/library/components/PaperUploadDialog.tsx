import { useState, useRef } from "react";
import { Upload, X, FileText, Loader2 } from "lucide-react";
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
import { apiPost } from "~/lib/api";

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
  const [dragOver, setDragOver] = useState(false);

  const reset = () => {
    setFile(null);
    setUploading(false);
    setUploadedUrl(null);
    setTitle("");
    setAuthors("");
    setYear("");
    setDoi("");
    setAbstract("");
    setDragOver(false);
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  // Upload the file to R2 via presign then return the URL
  const uploadToR2 = async (f: File): Promise<string> => {
    const timestamp = Date.now();
    const fileName = `workspace/${workspaceId}/library/${timestamp}-${f.name}`;
    const { url: presignedUrl, path } = await apiPost<{
      url: string;
      path: string;
    }>("/api/files/presign", { fileName });
    const res = await fetch(presignedUrl, {
      method: "PUT",
      headers: { "Content-Type": f.type || "application/pdf" },
      body: f,
    });
    if (!res.ok) throw new Error("Upload failed");
    return `/api/files/${path}`;
  };

  const handleFileSelected = async (f: File) => {
    setFile(f);
    // Use filename as default title (strip extension)
    if (!title) {
      setTitle(f.name.replace(/\.[^/.]+$/, ""));
    }
    try {
      setUploading(true);
      const url = await uploadToR2(f);
      setUploadedUrl(url);
    } catch (e) {
      console.error("Upload error", e);
      setFile(null);
    } finally {
      setUploading(false);
    }
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
    });
    reset();
  };

  const canSubmit = !!uploadedUrl && !!title.trim() && !uploading && !isPending;

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
            <div className="flex items-center gap-3 rounded-lg border border-border bg-accent/30 px-3 py-2.5">
              {uploading ? (
                <Loader2 className="size-5 text-primary animate-spin shrink-0" />
              ) : (
                <FileText className="size-5 text-primary shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {uploading ? "Uploading…" : `${formatBytes(file.size)} · Uploaded`}
                </p>
              </div>
              <button
                onClick={() => {
                  setFile(null);
                  setUploadedUrl(null);
                }}
                className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              >
                <X className="size-4" />
              </button>
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
