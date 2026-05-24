import { useState, useEffect, useCallback } from "react";
import {
  X, Download, ExternalLink, FileText, Calendar, User, Hash,
  BookOpen, GraduationCap, Globe, Layers, FileDigit, Building2,
  BookMarked, ScrollText, Fingerprint, Maximize2, Search, Save,
  Loader2, RefreshCw, CheckCircle2, ChevronDown, ChevronUp,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import type { StorageItem } from "../types";
import { getFileType, getFileIcon, getFileColor, formatFileSize, formatDate } from "../pages/SharedComponents";
import { useBlobUrl, downloadFileAsBlob } from "~/hooks/useBlobUrl";
import { resolveFileUrl } from "~/lib/api";
import {
  searchCrossref, lookupDoi, useUpdateFileMetadata,
  type CrossrefWork,
} from "~/query/storage";
import {
  type PdfMetadata,
  extractDoiFromText,
  parseXmpMetadata,
  mergeCrossrefMetadata,
  parsePdfDate,
} from "~/lib/pdf";
import AddToLibraryPopover from "./AddToLibraryPopover";

interface FilePreviewSidebarProps {
  item: StorageItem | null;
  workspaceId?: string;
  onClose: () => void;
  onDownload: (item: StorageItem) => void;
  onPreview?: (item: StorageItem) => void;
}

// ── PDF data hook with Crossref auto-enrichment ──────────────────────────────

function usePdfData(item: StorageItem | null) {
  const [metadata, setMetadata] = useState<PdfMetadata | null>(null);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [crossrefLoading, setCrossrefLoading] = useState(false);
  const [crossrefStatus, setCrossrefStatus] = useState<"idle" | "found" | "not-found" | "error">("idle");

  useEffect(() => {
    if (!item || !item.url) {
      setMetadata(null);
      setPreviewDataUrl(null);
      setCrossrefStatus("idle");
      return;
    }

    const isPdf = item.filename.toLowerCase().endsWith(".pdf") || item.mimeType === "application/pdf";
    if (!isPdf) {
      setMetadata(null);
      setPreviewDataUrl(null);
      return;
    }

    // If saved metadata exists, use it directly
    if (item.metaData && Object.keys(item.metaData).length > 0) {
      setMetadata(item.metaData as PdfMetadata);
      setCrossrefStatus(item.metaData.crossrefEnriched ? "found" : "idle");
      // still render the preview
      renderPdfPreview(item);
      return;
    }

    setLoading(true);
    setMetadata(null);
    setPreviewDataUrl(null);
    setCrossrefStatus("idle");

    let cancelled = false;

    (async () => {
      try {
        const resolvedUrl = resolveFileUrl(item.url);
        const response = await fetch(resolvedUrl!, { credentials: "include" });
        if (!response.ok) throw new Error("Failed to fetch PDF");
        const arrayBuffer = await response.arrayBuffer();
        if (cancelled) return;

        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        if (cancelled) return;

        // Extract all metadata
        const meta = await pdf.getMetadata();
        const info = (meta?.info || {}) as Record<string, any>;
        const xmpRaw = (meta?.metadata as any)?.getRaw?.() || "";

        // Parse XMP for scholarly fields
        const xmpFields = parseXmpMetadata(xmpRaw);

        // Collect extra/custom PDF info fields
        const standardKeys = new Set([
          "Title", "Author", "Subject", "Keywords", "Creator", "Producer",
          "CreationDate", "ModDate", "PDFFormatVersion", "IsLinearized",
          "IsAcroFormPresent", "IsXFAPresent", "IsCollectionPresent",
          "MarkInfo", "Tagged",
        ]);
        const extraFields: Record<string, string> = {};
        for (const [k, v] of Object.entries(info)) {
          if (!standardKeys.has(k) && v && typeof v === "string" && v.trim()) {
            extraFields[k] = v;
          }
        }

        // Try to extract DOI from text if not in XMP
        let doi = xmpFields.doi || undefined;
        if (!doi) {
          try {
            for (let i = 1; i <= Math.min(pdf.numPages, 2); i++) {
              const page = await pdf.getPage(i);
              const textContent = await page.getTextContent();
              const text = textContent.items.map((t: any) => t.str).join(" ");
              const found = extractDoiFromText(text);
              if (found) { doi = found; break; }
            }
          } catch { /* ignore text extraction errors */ }
        }

        if (cancelled) return;

        const baseMeta: PdfMetadata = {
          title: info.Title || xmpFields.title || undefined,
          author: info.Author || xmpFields.creator || undefined,
          subject: info.Subject || xmpFields.description || undefined,
          creator: info.Creator || undefined,
          producer: info.Producer || undefined,
          creationDate: info.CreationDate || undefined,
          modDate: info.ModDate || undefined,
          pageCount: pdf.numPages,
          keywords: info.Keywords || xmpFields.keywords || undefined,
          doi,
          journal: xmpFields.journal || xmpFields.publicationName || undefined,
          publisher: xmpFields.publisher || undefined,
          issn: xmpFields.issn || undefined,
          isbn: xmpFields.isbn || undefined,
          volume: xmpFields.volume || undefined,
          issue: xmpFields.issue || xmpFields.number || undefined,
          pages: xmpFields.pages || xmpFields.startPage
            ? (xmpFields.startPage && xmpFields.endPage
              ? `${xmpFields.startPage}–${xmpFields.endPage}`
              : xmpFields.startPage || xmpFields.pages)
            : undefined,
          publicationDate: xmpFields.date || xmpFields.publicationDate || undefined,
          abstract: xmpFields.abstract || xmpFields.description || undefined,
          language: xmpFields.language || undefined,
          copyright: xmpFields.rights || undefined,
          extraFields: Object.keys(extraFields).length > 0 ? extraFields : undefined,
        };

        setMetadata(baseMeta);

        // Render first page as preview
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 1 });
        const scale = 280 / viewport.width;
        const scaledViewport = page.getViewport({ scale });

        const canvas = document.createElement("canvas");
        canvas.width = scaledViewport.width;
        canvas.height = scaledViewport.height;
        const ctx = canvas.getContext("2d")!;

        await page.render({ canvasContext: ctx, viewport: scaledViewport, canvas } as any).promise;
        if (!cancelled) {
          setPreviewDataUrl(canvas.toDataURL("image/png"));
        }

        // Auto-enrich via Crossref
        if (!cancelled) {
          setCrossrefLoading(true);
          try {
            let crossrefWork: CrossrefWork | null = null;

            if (doi) {
              try {
                const result = await lookupDoi(doi);
                crossrefWork = result.work;
              } catch { /* DOI not found on Crossref */ }
            }

            if (!crossrefWork && baseMeta.title) {
              try {
                const result = await searchCrossref(baseMeta.title, 1);
                if (result.works.length > 0 && result.works[0].score > 10) {
                  crossrefWork = result.works[0];
                }
              } catch { /* search failed */ }
            }

            if (crossrefWork && !cancelled) {
              setMetadata((prev) => prev ? mergeCrossrefMetadata(prev, crossrefWork!) : prev);
              setCrossrefStatus("found");
            } else if (!cancelled) {
              setCrossrefStatus("not-found");
            }
          } catch {
            if (!cancelled) setCrossrefStatus("error");
          } finally {
            if (!cancelled) setCrossrefLoading(false);
          }
        }
      } catch (err) {
        console.error("Failed to process PDF:", err);
        if (!cancelled) {
          setMetadata(null);
          setPreviewDataUrl(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [item?._id, item?.url]);

  // Just render preview for already-saved metadata
  const renderPdfPreview = useCallback(async (fileItem: StorageItem) => {
      const resolvedUrl = resolveFileUrl(fileItem.url);
      if (!resolvedUrl) return;
      try {
        const response = await fetch(resolvedUrl, { credentials: "include" });
      if (!response.ok) return;
      const arrayBuffer = await response.arrayBuffer();

      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 1 });
      const scale = 280 / viewport.width;
      const scaledViewport = page.getViewport({ scale });

      const canvas = document.createElement("canvas");
      canvas.width = scaledViewport.width;
      canvas.height = scaledViewport.height;
      const ctx = canvas.getContext("2d")!;

      await page.render({ canvasContext: ctx, viewport: scaledViewport, canvas } as any).promise;
      setPreviewDataUrl(canvas.toDataURL("image/png"));
    } catch { /* ignore */ }
  }, []);

  return { metadata, setMetadata, previewDataUrl, loading, crossrefLoading, crossrefStatus, setCrossrefStatus, setCrossrefLoading };
}

// ── Main component ───────────────────────────────────────────────────────────

export default function FilePreviewSidebar({ item, workspaceId, onClose, onDownload, onPreview }: FilePreviewSidebarProps) {
  const {
    metadata, setMetadata, previewDataUrl, loading: pdfLoading,
    crossrefLoading, crossrefStatus, setCrossrefStatus, setCrossrefLoading,
  } = usePdfData(item);

  const isImage = item ? getFileType(item) === "image" : false;
  const resolvedItemUrl = resolveFileUrl(item?.url);
  const { blobUrl: imageBlobUrl, loading: imageLoading } = useBlobUrl(
    item && isImage && resolvedItemUrl ? resolvedItemUrl : null,
  );

  // Crossref search state
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<CrossrefWork[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Save metadata
  const saveMetadataMutation = useUpdateFileMetadata();
  const [saved, setSaved] = useState(false);

  // Abstract expand
  const [abstractExpanded, setAbstractExpanded] = useState(false);

  if (!item) return null;

  const fileType = getFileType(item);
  const isPdf = item.filename.toLowerCase().endsWith(".pdf") || item.mimeType === "application/pdf";

  const handleDownload = async () => {
    if (!resolvedItemUrl) return;
    try {
      await downloadFileAsBlob(resolvedItemUrl, item.filename);
    } catch {
      onDownload(item);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    try {
      const result = await searchCrossref(searchQuery, 5);
      setSearchResults(result.works);
    } catch {
      toast.error("Failed to search Crossref");
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSelectCrossref = (work: CrossrefWork) => {
    if (metadata) {
      setMetadata(mergeCrossrefMetadata(metadata, work));
    } else {
      setMetadata({
        title: work.title,
        author: work.authors?.join(", "),
        authors: work.authors,
        doi: work.doi,
        journal: work.journal,
        publisher: work.publisher,
        issn: work.issn,
        isbn: work.isbn,
        volume: work.volume,
        issue: work.issue,
        pages: work.pages,
        year: work.year,
        publicationDate: work.year ? String(work.year) : undefined,
        abstract: work.abstract,
        type: work.type,
        url: work.url,
        crossrefEnriched: true,
      });
    }
    setCrossrefStatus("found");
    setSearchOpen(false);
    setSaved(false);
  };

  const handleRetryLookup = async () => {
    if (!metadata?.title) return;
    setCrossrefLoading(true);
    setCrossrefStatus("idle");
    try {
      let work: CrossrefWork | null = null;
      if (metadata.doi) {
        try {
          const r = await lookupDoi(metadata.doi);
          work = r.work;
        } catch { /* not found */ }
      }
      if (!work && metadata.title) {
        const r = await searchCrossref(metadata.title, 1);
        if (r.works.length > 0 && r.works[0].score > 10) {
          work = r.works[0];
        }
      }
      if (work) {
        setMetadata((prev) => prev ? mergeCrossrefMetadata(prev, work!) : prev);
        setCrossrefStatus("found");
        setSaved(false);
      } else {
        setCrossrefStatus("not-found");
      }
    } catch {
      setCrossrefStatus("error");
    } finally {
      setCrossrefLoading(false);
    }
  };

  const handleSaveMetadata = () => {
    if (!metadata || !item) return;
    saveMetadataMutation.mutate(
      { fileId: item._id, metaData: metadata },
      {
        onSuccess: () => {
          toast.success("Metadata saved");
          setSaved(true);
        },
        onError: () => toast.error("Failed to save metadata"),
      },
    );
  };

  return (
    <div className="w-80 h-full border-l border-border bg-background flex flex-col animate-in slide-in-from-right-4 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground truncate flex-1 mr-2">
          Preview
        </h3>
        <button
          onClick={onClose}
          className="size-6 flex items-center justify-center rounded-md hover:bg-muted transition-colors text-muted-foreground"
        >
          <X className="size-3.5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Preview thumbnail */}
        <div className="p-4">
          <div className="rounded-lg overflow-hidden bg-muted/30 border border-border/50">
            {isImage ? (
              imageLoading ? (
                <div className="h-48 flex items-center justify-center">
                  <div className="size-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <img
                  src={imageBlobUrl || resolvedItemUrl || ""}
                  alt={item.filename}
                  className="w-full h-48 object-contain bg-white dark:bg-black/20 cursor-pointer"
                  onClick={() => onPreview?.(item)}
                />
              )
            ) : isPdf ? (
              pdfLoading && !previewDataUrl ? (
                <div className="h-48 flex items-center justify-center">
                  <div className="size-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : previewDataUrl ? (
                <img
                  src={previewDataUrl}
                  alt={`${item.filename} preview`}
                  className="w-full object-contain bg-white dark:bg-neutral-900"
                />
              ) : (
                <div className="h-48 flex items-center justify-center">
                  <div className="text-red-500">{getFileIcon(fileType, 12)}</div>
                </div>
              )
            ) : (
              <div className="h-36 flex items-center justify-center">
                <div className={getFileColor(fileType)}>{getFileIcon(fileType, 12)}</div>
              </div>
            )}
          </div>
        </div>

        {/* File name */}
        <div className="px-4 pb-3">
          <h4 className="text-sm font-medium text-foreground break-all leading-snug">
            {item.filename}
          </h4>
        </div>

        {/* Actions */}
        <div className="px-4 pb-4 flex gap-2">
          <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={handleDownload}>
            <Download className="size-3 mr-1.5" />
            Download
          </Button>
          {isPdf && workspaceId && (
            <AddToLibraryPopover
              item={item}
              workspaceId={workspaceId}
              metadata={metadata}
              trigger={
                <Button size="sm" variant="outline" className="text-xs">
                  <BookOpen className="size-3 mr-1.5" />
                  Library
                </Button>
              }
            />
          )}
          {onPreview && (
            <Button size="sm" variant="outline" className="text-xs" onClick={() => onPreview(item)}>
              <Maximize2 className="size-3 mr-1.5" />
              Preview
            </Button>
          )}
        </div>

        {/* File Details */}
        <Section title="File Details">
          <InfoRow label="Type" value={item.mimeType || "Unknown"} />
          <InfoRow label="Size" value={formatFileSize(item.size)} />
          <InfoRow label="Modified" value={formatDate(item.updatedAt)} />
          <InfoRow label="Created" value={formatDate(item.createdAt)} />
          {item.author && <InfoRow label="Owner" value={item.author.name} />}
        </Section>

        {/* PDF Scholarly Metadata */}
        {isPdf && (
          <>
            {/* Citation / Bibliographic Info */}
            <Section title="Citation Info">
              {pdfLoading && !metadata ? (
                <LoadingSkeleton />
              ) : metadata ? (
                <div className="space-y-2.5">
                  {metadata.title && <MetaRow icon={BookOpen} label="Title" value={metadata.title} />}
                  {(metadata.authors?.length ? metadata.authors.join(", ") : metadata.author) && (
                    <MetaRow
                      icon={User}
                      label="Authors"
                      value={metadata.authors?.length ? metadata.authors.join(", ") : metadata.author!}
                    />
                  )}
                  {metadata.doi && (
                    <MetaRow
                      icon={Fingerprint}
                      label="DOI"
                      value={metadata.doi}
                      href={metadata.doi.startsWith("http") ? metadata.doi : `https://doi.org/${metadata.doi}`}
                    />
                  )}
                  {metadata.journal && <MetaRow icon={BookMarked} label="Journal" value={metadata.journal} />}
                  {metadata.publisher && <MetaRow icon={Building2} label="Publisher" value={metadata.publisher} />}
                  {(metadata.volume || metadata.issue || metadata.pages) && (
                    <MetaRow
                      icon={Layers}
                      label="Volume / Issue"
                      value={[
                        metadata.volume && `Vol. ${metadata.volume}`,
                        metadata.issue && `No. ${metadata.issue}`,
                        metadata.pages && `pp. ${metadata.pages}`,
                      ].filter(Boolean).join(", ")}
                    />
                  )}
                  {(metadata.publicationDate || metadata.year) && (
                    <MetaRow icon={Calendar} label="Published" value={String(metadata.publicationDate || metadata.year)} />
                  )}
                  {metadata.type && <MetaRow icon={FileText} label="Type" value={metadata.type.replace(/-/g, " ")} />}
                  {metadata.issn && <MetaRow icon={FileDigit} label="ISSN" value={metadata.issn} />}
                  {metadata.isbn && <MetaRow icon={FileDigit} label="ISBN" value={metadata.isbn} />}
                  {metadata.language && <MetaRow icon={Globe} label="Language" value={metadata.language} />}
                  {!metadata.title && !metadata.doi && !metadata.journal && (
                    <p className="text-xs text-muted-foreground italic">No citation metadata found</p>
                  )}

                  {/* Crossref status badge */}
                  <div className="flex items-center gap-1.5 pt-1">
                    {crossrefLoading && (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Loader2 className="size-3 animate-spin" />
                        Looking up Crossref…
                      </span>
                    )}
                    {crossrefStatus === "found" && !crossrefLoading && (
                      <span className="text-[10px] text-green-600 dark:text-green-400 flex items-center gap-1">
                        <CheckCircle2 className="size-3" />
                        Enriched via Crossref
                      </span>
                    )}
                    {crossrefStatus === "not-found" && !crossrefLoading && (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        Not found on Crossref
                        <button
                          onClick={handleRetryLookup}
                          className="text-primary hover:underline ml-1"
                        >
                          Retry
                        </button>
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Failed to read metadata</p>
              )}
            </Section>

            {/* Crossref actions */}
            <div className="px-4 pb-2 flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1 text-xs"
                onClick={() => {
                  setSearchOpen(!searchOpen);
                  setSearchQuery(metadata?.title || item.filename.replace(/\.pdf$/i, ""));
                  setSearchResults([]);
                }}
              >
                <Search className="size-3 mr-1.5" />
                Search Crossref
              </Button>
              {metadata && (
                <Button
                  size="sm"
                  variant={saved ? "outline" : "default"}
                  className="text-xs"
                  onClick={handleSaveMetadata}
                  disabled={saveMetadataMutation.isPending || saved}
                >
                  {saveMetadataMutation.isPending ? (
                    <Loader2 className="size-3 mr-1.5 animate-spin" />
                  ) : saved ? (
                    <CheckCircle2 className="size-3 mr-1.5" />
                  ) : (
                    <Save className="size-3 mr-1.5" />
                  )}
                  {saved ? "Saved" : "Save"}
                </Button>
              )}
            </div>

            {/* Crossref search panel */}
            {searchOpen && (
              <div className="px-4 pb-3 space-y-2">
                <div className="flex gap-1.5">
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    placeholder="Search by title, author, DOI…"
                    className="text-xs h-8"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 px-2 shrink-0"
                    onClick={handleSearch}
                    disabled={searchLoading}
                  >
                    {searchLoading ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <Search className="size-3" />
                    )}
                  </Button>
                </div>

                {searchResults.length > 0 && (
                  <div className="space-y-1.5 max-h-60 overflow-y-auto">
                    {searchResults.map((work, i) => (
                      <button
                        key={`${work.doi}-${i}`}
                        onClick={() => handleSelectCrossref(work)}
                        className="w-full text-left p-2 rounded-md border border-border/50 hover:border-primary/40 hover:bg-primary/5 transition-colors"
                      >
                        <p className="text-xs font-medium text-foreground leading-snug line-clamp-2">
                          {work.title || "Untitled"}
                        </p>
                        {work.authors.length > 0 && (
                          <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                            {work.authors.slice(0, 3).join(", ")}
                            {work.authors.length > 3 && ` +${work.authors.length - 3}`}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          {work.journal && (
                            <span className="text-[10px] text-primary/70 truncate">{work.journal}</span>
                          )}
                          {work.year && (
                            <span className="text-[10px] text-muted-foreground shrink-0">{work.year}</span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {searchResults.length === 0 && !searchLoading && searchQuery && (
                  <p className="text-[10px] text-muted-foreground text-center py-2">
                    Press Enter or click search to find papers
                  </p>
                )}
              </div>
            )}

            {/* Abstract */}
            {metadata?.abstract && metadata.abstract !== metadata.subject && (
              <Section title="Abstract">
                <div className="relative">
                  <p className={`text-xs text-foreground leading-relaxed ${!abstractExpanded ? "line-clamp-4" : ""}`}>
                    {metadata.abstract}
                  </p>
                  {metadata.abstract.length > 200 && (
                    <button
                      onClick={() => setAbstractExpanded(!abstractExpanded)}
                      className="text-[10px] text-primary hover:underline mt-1 flex items-center gap-0.5"
                    >
                      {abstractExpanded ? (
                        <><ChevronUp className="size-3" /> Show less</>
                      ) : (
                        <><ChevronDown className="size-3" /> Show more</>
                      )}
                    </button>
                  )}
                </div>
              </Section>
            )}

            {/* Subject & Keywords */}
            {(metadata?.subject || metadata?.keywords) && (
              <Section title="Subject & Keywords">
                {metadata.subject && <MetaRow icon={GraduationCap} label="Subject" value={metadata.subject} />}
                {metadata.keywords && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <Hash className="size-3 text-muted-foreground/60" />
                      <span className="text-[10px] font-medium text-muted-foreground uppercase">Keywords</span>
                    </div>
                    <div className="flex flex-wrap gap-1 pl-4.5">
                      {metadata.keywords.split(/[,;]+/).map((kw, i) => (
                        <span
                          key={i}
                          className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground"
                        >
                          {kw.trim()}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </Section>
            )}

            {/* Document Properties */}
            <Section title="Document Properties">
              {pdfLoading && !metadata ? (
                <LoadingSkeleton />
              ) : metadata ? (
                <div className="space-y-2">
                  {metadata.pageCount && <InfoRow label="Pages" value={`${metadata.pageCount}`} />}
                  {metadata.creationDate && (
                    <InfoRow label="PDF Created" value={parsePdfDate(metadata.creationDate) || metadata.creationDate} />
                  )}
                  {metadata.modDate && (
                    <InfoRow label="PDF Modified" value={parsePdfDate(metadata.modDate) || metadata.modDate} />
                  )}
                  {metadata.creator && <InfoRow label="Creator App" value={metadata.creator} />}
                  {metadata.producer && <InfoRow label="PDF Producer" value={metadata.producer} />}
                  {metadata.copyright && <InfoRow label="Copyright" value={metadata.copyright} />}
                  {metadata.extraFields && Object.entries(metadata.extraFields).map(([k, v]) => (
                    <InfoRow key={k} label={k} value={v} />
                  ))}
                </div>
              ) : null}
            </Section>
          </>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <div className="border-t border-border mx-4" />
      <div className="px-4 py-3 space-y-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
          {title}
        </p>
        {children}
      </div>
    </>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-4 bg-muted/50 rounded animate-pulse" />
      ))}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start gap-2">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className="text-xs text-foreground text-right wrap-break-word max-w-45" title={value}>
        {value}
      </span>
    </div>
  );
}

function MetaRow({ icon: Icon, label, value, href }: { icon: any; label: string; value: string; href?: string }) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-1.5">
        <Icon className="size-3 text-muted-foreground/60" />
        <span className="text-[10px] font-medium text-muted-foreground uppercase">{label}</span>
      </div>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary hover:underline pl-4.5 break-all leading-snug block"
        >
          {value}
        </a>
      ) : (
        <p className="text-xs text-foreground pl-4.5 wrap-break-word leading-snug">{value}</p>
      )}
    </div>
  );
}
