import { useState, useEffect } from "react";
import {
  X, Download, ExternalLink, FileText, Calendar, User, Hash,
  BookOpen, GraduationCap, Globe, Layers, FileDigit, Building2,
  BookMarked, ScrollText, Fingerprint,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import type { StorageItem } from "../types";
import { getFileType, getFileIcon, getFileColor, formatFileSize, formatDate } from "../pages/SharedComponents";

interface FilePreviewSidebarProps {
  item: StorageItem | null;
  onClose: () => void;
  onDownload: (item: StorageItem) => void;
}

type PdfMetadata = {
  // Standard PDF Info
  title?: string;
  author?: string;
  subject?: string;
  creator?: string;
  producer?: string;
  creationDate?: string;
  modDate?: string;
  pageCount?: number;
  keywords?: string;
  // XMP / Extended metadata
  doi?: string;
  journal?: string;
  publisher?: string;
  issn?: string;
  isbn?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  publicationDate?: string;
  abstract?: string;
  language?: string;
  copyright?: string;
  // Raw extra fields
  extraFields?: Record<string, string>;
};

function usePdfData(item: StorageItem | null) {
  const [metadata, setMetadata] = useState<PdfMetadata | null>(null);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!item || !item.url) {
      setMetadata(null);
      setPreviewDataUrl(null);
      return;
    }

    const isPdf = item.filename.toLowerCase().endsWith(".pdf") || item.mimeType === "application/pdf";
    if (!isPdf) {
      setMetadata(null);
      setPreviewDataUrl(null);
      return;
    }

    setLoading(true);
    setMetadata(null);
    setPreviewDataUrl(null);

    let cancelled = false;

    (async () => {
      try {
        const response = await fetch(item.url!, { credentials: "include" });
        if (!response.ok) throw new Error("Failed to fetch PDF");
        const arrayBuffer = await response.arrayBuffer();
        if (cancelled) return;

        const pdfjsLib = await import("pdfjs-dist");
        const workerModule = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
        pdfjsLib.GlobalWorkerOptions.workerSrc = workerModule.default;

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

        if (cancelled) return;

        setMetadata({
          title: info.Title || xmpFields.title || undefined,
          author: info.Author || xmpFields.creator || undefined,
          subject: info.Subject || xmpFields.description || undefined,
          creator: info.Creator || undefined,
          producer: info.Producer || undefined,
          creationDate: info.CreationDate || undefined,
          modDate: info.ModDate || undefined,
          pageCount: pdf.numPages,
          keywords: info.Keywords || xmpFields.keywords || undefined,
          doi: xmpFields.doi || undefined,
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
        });

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

  return { metadata, previewDataUrl, loading };
}

/** Parse XMP metadata XML for scholarly fields */
function parseXmpMetadata(xml: string): Record<string, string> {
  if (!xml) return {};
  const fields: Record<string, string> = {};
  const get = (tag: string): string | undefined => {
    // Try <tag>value</tag> and <rdf:li>value</rdf:li> patterns
    const patterns = [
      new RegExp(`<${tag}[^>]*>([^<]+)</${tag}>`, "i"),
      new RegExp(`<${tag}[^>]*>\\s*<rdf:(?:Alt|Seq|Bag)>\\s*<rdf:li[^>]*>([^<]+)</rdf:li>`, "i"),
    ];
    for (const p of patterns) {
      const m = xml.match(p);
      if (m?.[1]?.trim()) return m[1].trim();
    }
    return undefined;
  };

  // Dublin Core
  fields.title = get("dc:title") || "";
  fields.creator = get("dc:creator") || "";
  fields.description = get("dc:description") || "";
  fields.date = get("dc:date") || "";
  fields.rights = get("dc:rights") || "";
  fields.language = get("dc:language") || "";
  fields.publisher = get("dc:publisher") || "";

  // CrossRef / PRISM (Publishing Requirements for Industry Standard Metadata)
  fields.doi = get("prism:doi") || get("pdfx:doi") || get("crossmark:DOI") || "";
  fields.journal = get("prism:publicationName") || get("prism:aggregationType") || "";
  fields.publicationName = get("prism:publicationName") || "";
  fields.volume = get("prism:volume") || "";
  fields.number = get("prism:number") || "";
  fields.issue = get("prism:issueIdentifier") || "";
  fields.issn = get("prism:issn") || get("prism:eIssn") || "";
  fields.isbn = get("prism:isbn") || "";
  fields.startPage = get("prism:startingPage") || "";
  fields.endPage = get("prism:endingPage") || "";
  fields.pages = get("prism:pageRange") || "";
  fields.publicationDate = get("prism:coverDate") || get("prism:coverDisplayDate") || "";
  fields.keywords = get("pdf:Keywords") || get("prism:keyword") || "";

  // CrossMark
  if (!fields.doi) {
    const doiMatch = xml.match(/doi[>"'\s:]+([^<"'\s]+10\.\d{4,}\/[^\s<"']+)/i);
    if (doiMatch) fields.doi = doiMatch[1];
  }

  // Abstract from various sources
  fields.abstract = get("dc:description") || get("pdfx:Abstract") || "";

  // Clean empty strings
  for (const k of Object.keys(fields)) {
    if (!fields[k]) delete fields[k];
  }

  return fields;
}

function parsePdfDate(raw?: string): string | null {
  if (!raw) return null;
  const m = raw.match(/D:(\d{4})(\d{2})(\d{2})(\d{2})?(\d{2})?(\d{2})?/);
  if (!m) return null;
  const date = new Date(
    parseInt(m[1]),
    parseInt(m[2]) - 1,
    parseInt(m[3]),
    parseInt(m[4] || "0"),
    parseInt(m[5] || "0"),
    parseInt(m[6] || "0"),
  );
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function FilePreviewSidebar({ item, onClose, onDownload }: FilePreviewSidebarProps) {
  const { metadata, previewDataUrl, loading: pdfLoading } = usePdfData(item);

  if (!item) return null;

  const fileType = getFileType(item);
  const isImage = fileType === "image";
  const isPdf = item.filename.toLowerCase().endsWith(".pdf") || item.mimeType === "application/pdf";

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
            {isImage && item.url ? (
              <img
                src={item.url}
                alt={item.filename}
                className="w-full h-48 object-contain bg-white dark:bg-black/20"
              />
            ) : isPdf ? (
              pdfLoading ? (
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
          <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => onDownload(item)}>
            <Download className="size-3 mr-1.5" />
            Download
          </Button>
          {item.url && (
            <Button size="sm" variant="outline" className="text-xs" asChild>
              <a href={item.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-3 mr-1.5" />
                Open
              </a>
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
              {pdfLoading ? (
                <LoadingSkeleton />
              ) : metadata ? (
                <div className="space-y-2.5">
                  {metadata.title && <MetaRow icon={BookOpen} label="Title" value={metadata.title} />}
                  {metadata.author && <MetaRow icon={User} label="Authors" value={metadata.author} />}
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
                  {metadata.publicationDate && (
                    <MetaRow icon={Calendar} label="Published" value={metadata.publicationDate} />
                  )}
                  {metadata.issn && <MetaRow icon={FileDigit} label="ISSN" value={metadata.issn} />}
                  {metadata.isbn && <MetaRow icon={FileDigit} label="ISBN" value={metadata.isbn} />}
                  {metadata.language && <MetaRow icon={Globe} label="Language" value={metadata.language} />}
                  {!metadata.title && !metadata.doi && !metadata.journal && (
                    <p className="text-xs text-muted-foreground italic">No citation metadata embedded in this PDF</p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Failed to read metadata</p>
              )}
            </Section>

            {/* Abstract */}
            {metadata?.abstract && metadata.abstract !== metadata.subject && (
              <Section title="Abstract">
                <p className="text-xs text-foreground leading-relaxed">{metadata.abstract}</p>
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
                    <div className="flex flex-wrap gap-1 pl-[18px]">
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
              {pdfLoading ? (
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
      <span className="text-xs text-foreground text-right break-words max-w-[180px]" title={value}>
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
          className="text-xs text-primary hover:underline pl-[18px] break-all leading-snug block"
        >
          {value}
        </a>
      ) : (
        <p className="text-xs text-foreground pl-[18px] break-words leading-snug">{value}</p>
      )}
    </div>
  );
}
