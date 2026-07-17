import { apiGet } from "~/lib/api";
import type { CrossrefWork } from "~/query/storage";

async function fetchLookupDoi(doi: string) {
  return apiGet<{ work: CrossrefWork }>(`/api/files/crossref/doi/${encodeURIComponent(doi)}`);
}

async function fetchSearchCrossref(query: string, rows = 1) {
  return apiGet<{ works: CrossrefWork[]; totalResults: number }>(
    `/api/files/crossref/search?query=${encodeURIComponent(query)}&rows=${rows}`
  );
}

export type PdfMetadata = {
  title?: string;
  author?: string;
  subject?: string;
  creator?: string;
  producer?: string;
  creationDate?: string;
  modDate?: string;
  pageCount?: number;
  keywords?: string;
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
  year?: number | string;
  authors?: string[];
  editors?: string[];
  type?: string;
  itemType?: string;
  url?: string;
  crossrefEnriched?: boolean;
  extraFields?: Record<string, string>;
  journalAbbr?: string;
  shortTitle?: string;
  rights?: string;
  license?: string;
  publicationTitle?: string;
  place?: string;
  keywordsList?: string[];
};

const DOI_REGEX = /\b(10\.\d{4,}(?:\.\d+)*\/[^\s<>"{}|\\^`[\]]+)/g;

export function extractDoiFromText(text: string): string | null {
  const matches = text.match(DOI_REGEX);
  if (!matches || !matches[0]) return null;
  let doi = matches[0].trim();
  
  // Strip standard trailing punctuation EXCEPT parentheses/brackets first
  doi = doi.replace(/[.,;:!?\s]+$/, "");

  // Balance parentheses (strip trailing ')' only if unmatched)
  if (doi.endsWith(")")) {
    const openCount = (doi.match(/\(/g) || []).length;
    const closeCount = (doi.match(/\)/g) || []).length;
    if (closeCount > openCount) {
      doi = doi.slice(0, -1).trim();
    }
  }

  // Balance square brackets
  if (doi.endsWith("]")) {
    const openCount = (doi.match(/\[/g) || []).length;
    const closeCount = (doi.match(/\]/g) || []).length;
    if (closeCount > openCount) {
      doi = doi.slice(0, -1).trim();
    }
  }

  // Strip surrounding matching wrapper symbols
  if (doi.startsWith("(") && doi.endsWith(")")) {
    doi = doi.slice(1, -1).trim();
  }
  if (doi.startsWith("[") && doi.endsWith("]")) {
    doi = doi.slice(1, -1).trim();
  }
  doi = doi.replace(/[.,;:!?\s]+$/, "");

  return doi || null;
}

export function parseXmpMetadata(xml: string): Record<string, string> {
  if (!xml) return {};
  const fields: Record<string, string> = {};
  const get = (tag: string): string | undefined => {
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

  fields.title = get("dc:title") || "";
  fields.creator = get("dc:creator") || "";
  fields.description = get("dc:description") || "";
  fields.date = get("dc:date") || "";
  fields.rights = get("dc:rights") || "";
  fields.language = get("dc:language") || "";
  fields.publisher = get("dc:publisher") || "";

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

  if (!fields.doi) {
    const doiMatch = xml.match(/doi[>"'\s:]+([^<"'\s]+10\.\d{4,}\/[^\s<"']+)/i);
    if (doiMatch) fields.doi = doiMatch[1];
  }

  fields.abstract = get("dc:description") || get("pdfx:Abstract") || "";

  for (const k of Object.keys(fields)) {
    if (!fields[k]) delete fields[k];
  }

  return fields;
}

export function mergeCrossrefMetadata(base: PdfMetadata, work: CrossrefWork): PdfMetadata {
  return {
    ...base,
    title: base.title || work.title || base.title,
    author: base.author || work.authors?.join(", ") || base.author,
    authors: work.authors?.length ? work.authors : base.authors,
    editors: work.editors?.length ? work.editors : base.editors,
    doi: base.doi || work.doi || base.doi,
    journal: base.journal || work.journal || base.journal,
    publicationTitle: base.publicationTitle || work.publicationTitle || work.journal || base.publicationTitle,
    publicationDate: base.publicationDate || work.publicationDate || (work.year ? String(work.year) : undefined) || base.publicationDate,
    publisher: base.publisher || work.publisher || base.publisher,
    place: base.place || work.place || base.place,
    issn: base.issn || work.issn || base.issn,
    isbn: base.isbn || work.isbn || base.isbn,
    volume: base.volume || work.volume || base.volume,
    issue: base.issue || work.issue || base.issue,
    pages: base.pages || work.pages || base.pages,
    year: base.year || work.year || base.year,
    abstract: base.abstract || work.abstract || base.abstract,
    type: base.type || work.type || base.type,
    itemType: base.itemType || work.itemType || work.type || base.itemType,
    url: base.url || work.url || base.url,
    language: base.language || work.language || base.language,
    journalAbbr: base.journalAbbr || work.journalAbbr || base.journalAbbr,
    shortTitle: base.shortTitle || work.shortTitle || base.shortTitle,
    rights: base.copyright || work.rights || base.copyright,
    license: base.license || work.license || work.rights || base.license,
    keywordsList: work.keywords?.length ? work.keywords : base.keywordsList,
    crossrefEnriched: true,
  };
}

export async function extractPdfMetadataFromFile(file: File): Promise<PdfMetadata | null> {
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return null;
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdfjsLib = await import("pdfjs-dist");
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const meta = await pdf.getMetadata();
    const info = (meta?.info || {}) as Record<string, any>;
    const xmpRaw = (meta?.metadata as any)?.getRaw?.() || "";

    const xmpFields = parseXmpMetadata(xmpRaw);

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

    let baseMeta: PdfMetadata = {
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

    // Auto-enrich via Crossref
    let crossrefWork: CrossrefWork | null = null;
    if (doi) {
      try {
        const result = await fetchLookupDoi(doi);
        crossrefWork = result.work;
      } catch (err) {
        console.warn("[PDF Metadata] Local DOI lookup failed:", err);
      }
    }
    if (!crossrefWork && baseMeta.title) {
      try {
        const result = await fetchSearchCrossref(baseMeta.title, 1);
        if (result.works.length > 0 && result.works[0].score > 10) {
          crossrefWork = result.works[0];
        }
      } catch (err) {
        console.warn("[PDF Metadata] Local Crossref title search failed:", err);
      }
    }

    if (crossrefWork) {
      baseMeta = mergeCrossrefMetadata(baseMeta, crossrefWork);
    }

    return baseMeta;
  } catch (err) {
    console.error("Failed to extract PDF metadata:", err);
    return null;
  }
}

/**
 * Parses standard PDF date string format: "D:YYYYMMDDHHmmssOHH'mm'"
 * and returns a readable locale date string.
 */
export function parsePdfDate(dateStr: string): string {
  if (!dateStr) return "";
  
  let cleanStr = dateStr.startsWith("D:") ? dateStr.substring(2) : dateStr;
  
  const match = cleanStr.match(/^(\d{4})(\d{2})(\d{2})(\d{2})?(\d{2})?(\d{2})?/);
  if (!match) {
    try {
      const parsed = new Date(dateStr);
      if (!isNaN(parsed.getTime())) {
        return parsed.toLocaleDateString();
      }
    } catch {}
    return dateStr;
  }
  
  const [_, year, month, day, hour = "00", minute = "00", second = "00"] = match;
  
  try {
    const date = new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hour),
      parseInt(minute),
      parseInt(second)
    );
    if (!isNaN(date.getTime())) {
      return date.toLocaleDateString();
    }
  } catch {}
  
  return `${year}-${month}-${day}`;
}
