import type { Paper, Item, Collection, Note, ReferenceData } from '../types/library.types';
import { resolveAcademicQuery, fetchReferenceByDoi } from '../services/citation.service';
import {
  INSTITUTION_KEYWORDS,
  PREFIX_PARTICLES,
  splitAuthorString,
  parseCreatorName,
  normalizeAuthors,
  formatCreatorCompact,
  trimUnmatchedClosingBrackets,
  cleanDoi,
} from './author-doi.util';

export {
  INSTITUTION_KEYWORDS,
  PREFIX_PARTICLES,
  splitAuthorString,
  parseCreatorName,
  normalizeAuthors,
  formatCreatorCompact,
  trimUnmatchedClosingBrackets,
  cleanDoi,
};

// ── 1. ID & Key Resolution ───────────────────────────────────────────────────


/**
 * Extracts the primary PDF or reading file URL from a Paper object.
 * Strictly resolves canonical binary content URLs (/api/files/:fileId/content)
 * and avoids falling back to DOI landing page URLs.
 */
export function getPaperFileUrl(
  paper?: Partial<Paper> | null | undefined,
  workspaceId?: string,
): string {
  if (!paper) return '';

  const wsId = workspaceId || (paper as any)?.workspaceId;

  const normalizeUrl = (url?: string | null, fileId?: string | null): string => {
    if (fileId) {
      if (wsId) {
        return `/api/v1/workspaces/${encodeURIComponent(wsId)}/library/files/${encodeURIComponent(fileId)}/content`;
      }
      return `/api/files/${fileId}/content`;
    }
    if (!url || typeof url !== 'string') return '';
    const trimmed = url.trim();
    if (!trimmed) return '';
    if (
      trimmed.startsWith('/api/files/') &&
      !trimmed.includes('/r2/') &&
      !trimmed.endsWith('/content')
    ) {
      return `${trimmed}/content`;
    }
    return trimmed;
  };

  // 1. Primary file / attachment (priority order: primary_pdf -> application/pdf -> .pdf filename)
  const attachments = Array.isArray(paper.attachments)
    ? paper.attachments
    : [];

  const primaryPdfAttachment =
    attachments.find(
      (a) =>
        a?.attachmentType === 'primary_pdf',
    ) ||
    attachments.find(
      (a) => a?.mimeType === 'application/pdf',
    ) ||
    attachments.find(
      (a) =>
        Boolean(a?.fileId) &&
        typeof a?.filename === 'string' &&
        a.filename.toLowerCase().endsWith('.pdf'),
    );

  if (primaryPdfAttachment) {
    const url = normalizeUrl(
      primaryPdfAttachment.url,
      primaryPdfAttachment.fileId,
    );
    if (url) return url;
  }

  // 2. Direct fileId on paper
  if (paper.fileId) {
    if (wsId) {
      return `/api/v1/workspaces/${encodeURIComponent(wsId)}/library/files/${encodeURIComponent(paper.fileId)}/content`;
    }
    return `/api/files/${paper.fileId}/content`;
  }

  // 3. PrimaryFile object
  if (paper.primaryFile) {
    const url = normalizeUrl(
      paper.primaryFile.url,
      paper.primaryFile.fileId,
    );
    if (url) return url;
  }

  // 4. Direct fileUrl on paper
  if (paper.fileUrl) {
    const url = normalizeUrl(paper.fileUrl, paper.fileId);
    if (url) return url;
  }

  // 4b. Direct openAccessPdfUrl on paper
  if (paper.openAccessPdfUrl) {
    const oaUrl = normalizeUrl(paper.openAccessPdfUrl);
    if (oaUrl) return oaUrl;
  }

  // 5. arXiv fallback: If paper has arxivId, arXiv DOI, arXiv URL, or arXiv filename
  const arxivMatch =
    paper.arxivId ||
    paper.doi?.match(/arxiv\.(\d{4}\.\d{4,5}(?:v\d+)?)/i)?.[1] ||
    paper.url?.match(/arxiv\.org\/(?:abs|pdf)\/(\d{4}\.\d{4,5}(?:v\d+)?)/i)?.[1] ||
    paper.filename?.match(/^(\d{4}\.\d{4,5}(?:v\d+)?)(?:\.pdf)?$/i)?.[1];

  if (arxivMatch) {
    return `https://arxiv.org/pdf/${arxivMatch.replace(/\.pdf$/i, '')}.pdf`;
  }

  return '';
}

// ── Academic Tag Normalizer Constants ───────────────────────────────────────
const ARXIV_CATEGORY_MAP: Record<string, string> = {
  'cs.ai': 'Computer Science - Artificial Intelligence',
  'cs.cl': 'Computer Science - Computation and Language',
  'cs.cv': 'Computer Science - Computer Vision and Pattern Recognition',
  'cs.lg': 'Computer Science - Machine Learning',
  'cs.ne': 'Computer Science - Neural and Evolutionary Computing',
  'cs.ro': 'Computer Science - Robotics',
  'stat.ml': 'Statistics - Machine Learning',
  'math.oc': 'Mathematics - Optimization and Control',
};

const SCIENTIFIC_ACRONYMS = new Set([
  'AI', 'ML', 'NLP', 'CV', 'CNN', 'RNN', 'LSTM', 'GAN', 'BERT', 'LLM', 'COCO',
  'YOLO', 'RESNET', 'VGG', 'SVM', 'RL', 'API', 'GPU', 'CPU', 'TPU', 'DNA', 'RNA', 'SGD', 'ADAM',
]);

const NOISE_TAG_WORDS = new Set([
  'undefined', 'null', 'n/a', 'na', 'none', 'unknown',
  'introduction', 'conclusion', 'background', 'paper', 'article',
]);

function cleanSingleFrontendTag(raw: string): string | null {
  if (!raw || typeof raw !== 'string') return null;
  let str = raw
    .replace(/â€“|â€”/g, '-')
    .replace(/â€™|â€˜/g, "'")
    .replace(/â€œ|â€ /g, '"')
    .replace(/\uFFFD/g, '')
    .trim();

  const lower = str.toLowerCase();
  if (ARXIV_CATEGORY_MAP[lower]) return ARXIV_CATEGORY_MAP[lower];
  if (NOISE_TAG_WORDS.has(lower)) return null;

  str = str
    .replace(/\s*\([^)]*(?:\)|$)/g, '')
    .replace(/^(?:keywords?|index terms|categories|subject)[:—\-\s]+/i, '')
    .replace(/^#+/, '')
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/\.$/, '')
    .trim();

  if (str.length < 2 || str.length > 60 || /^\d+$/.test(str)) return null;
  if (NOISE_TAG_WORDS.has(str.toLowerCase())) return null;

  return str
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      const upper = word.toUpperCase();
      if (SCIENTIFIC_ACRONYMS.has(upper)) return upper;
      if (word.includes('-')) {
        return word
          .split('-')
          .map((part) => {
            const partUpper = part.toUpperCase();
            if (SCIENTIFIC_ACRONYMS.has(partUpper)) return partUpper;
            return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
          })
          .join('-');
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

/**
 * Normalizes all tag-like fields on a paper into a deduped, trimmed, clean
 * academic string array.
 * Cleans mojibake, strips Wikipedia disambiguation suffixes, maps arXiv taxonomy codes,
 * and formats with Title Case and preserved acronyms.
 */
export function normalizeTags(paper: Partial<Item> | null | undefined): string[] {
  if (!paper) return [];
  const raw: unknown[] = [
    ...(Array.isArray(paper.tags) ? paper.tags : []),
    ...(Array.isArray(paper.labels) ? paper.labels : []),
    ...(Array.isArray(paper.keywords) ? paper.keywords : []),
    ...(Array.isArray(paper.itemTags)
      ? paper.itemTags.map((it) => it?.tag?.name ?? '')
      : []),
  ];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const t of raw) {
    const s =
      typeof t === 'string'
        ? t
        : t && typeof t === 'object' && 'name' in t && typeof (t as { name?: unknown }).name === 'string'
          ? String((t as { name: string }).name)
          : '';
    if (!s) continue;
    const parts = s.split(/[,;\n\r|•·]/).map((p: string) => p.trim()).filter(Boolean);
    for (const part of parts) {
      const cleaned = cleanSingleFrontendTag(part);
      if (cleaned) {
        const lowerKey = cleaned.toLowerCase();
        if (!seen.has(lowerKey)) {
          seen.add(lowerKey);
          result.push(cleaned);
        }
      }
    }
  }
  return result;
}

// ── 2. Notes Normalization ───────────────────────────────────────────────────

export interface NormalizedNote {
  id: string;
  content: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Normalizes raw notes array into strongly-typed NormalizedNote objects.
 */
export function normalizeNotes(notes?: Array<string | Note | { id?: string; content?: string }> | null): NormalizedNote[] {
  if (!Array.isArray(notes)) return [];

  return notes.map((note, index) => {
    if (typeof note === 'string') {
      // String-only notes have no server-assigned ID; use a deterministic
      // content-based hash to avoid collisions across re-renders.
      const contentHash = note.trim().slice(0, 32).replace(/[^a-z0-9]/gi, '').toLowerCase() || index.toString();
      return {
        id: `local-${contentHash}`,
        content: note,
        createdAt: new Date().toISOString(),
      };
    }

    const noteObj = note as any;
    const rawContent =
      noteObj.content ||
      noteObj.contentMd ||
      (typeof noteObj.contentJson === 'string' ? noteObj.contentJson : '') ||
      '';
    // Strip HTML tags for clean card preview if note originated from Zotero HTML (<p>...</p>)
    const cleanPreview = /<\/?[a-z][\s\S]*>/i.test(rawContent)
      ? rawContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      : rawContent;

    return {
      id: note.id || `note-${index}`,
      content: cleanPreview,
      contentMd: noteObj.contentMd || rawContent,
      contentJson: noteObj.contentJson,
      createdAt: (note as Note).createdAt || new Date().toISOString(),
      updatedAt: (note as Note).updatedAt,
    };
  });
}

// ── 4. Library Filter Engine ─────────────────────────────────────────────────

export {
  LibraryFilterEngine,
  filterItems,
  filterPapers,
  isPaperInCollection,
  type LibraryFilterOptions,
  type SortOptions,
} from './filter.util';

export function getUniqueTags(items: Item[]): string[] {
  const tagSet = new Set<string>();
  for (const paper of items) {
    for (const tag of normalizeTags(paper)) {
      tagSet.add(tag);
    }
  }
  return Array.from(tagSet).sort();
}

// ── 5. BibTeX Citation Engine ────────────────────────────────────────────────
export {
  generateCitationKey,
  getPaperCitationKey,
  getBibTeXEntryType,
  escapeLatexChars,
  unescapeLatexChars,
  convertToBibTeX,
  parseBibTeX,
  downloadBibTeXFile,
  BibtexEngine,
  formatCiteCommand,
  formatApaCitation,
  formatIeeeCitation,
} from './bibtex.util';

// ── 6. DOI & CrossRef Metadata Engine ────────────────────────────────────────

export type PdfMetadata = {
  title?: string;
  author?: string;
  subject?: string;
  creator?: string;
  producer?: string;
  creationDate?: string;
  modDate?: string;
  pageCount?: number;
  keywords?: string[];
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

export const DOI_REGEX = /\b(10\.\d{4,9}\/[-._;()/:A-Za-z0-9<>+=[\]~]+)\b/;
export const ARXIV_REGEX = /\b(?:arXiv:\s*)?(\d{4}\.\d{4,5}(?:v\d+)?)\b/i;

export function extractDoiFromText(text: string): string | null {
  if (!text) return null;
  const sanitized = text.replace(/\.pdf$/i, '');

  const match = sanitized.match(DOI_REGEX);
  if (!match) {
    const cleaned = cleanDoi(sanitized);
    return cleaned || null;
  }
  let s = match[1].replace(/[.,;:]+$/, '');
  return trimUnmatchedClosingBrackets(s).replace(/[.,;:]+$/, '');
}

export function normalizeDoi(doi?: string | null): string | null {
  if (!doi || !doi.trim()) return null;
  const cleaned = cleanDoi(doi);
  return cleaned || null;
}

export function extractArxivId(text: string): string | null {
  if (!text) return null;
  const match = text.match(ARXIV_REGEX);
  return match ? match[1] : null;
}

export class DoiMetadataEngine {
  static extractDoi(text: string): string | null {
    return extractDoiFromText(text);
  }
  static normalize(doi: string): string | null {
    return normalizeDoi(doi);
  }
  static extractArxiv(text: string): string | null {
    return extractArxivId(text);
  }
}

export async function extractMetadata(file: File): Promise<PdfMetadata> {
  let detectedDoi = extractDoiFromText(file.name);
  let detectedArxiv = extractArxivId(file.name);
  const rawTitle = file.name.replace(/\.pdf$/i, '').trim();
  const cleanTitle = detectedDoi && rawTitle.includes(detectedDoi)
    ? rawTitle
    : rawTitle.replace(/[-_]/g, ' ').trim();
  const metadata: PdfMetadata = {
    title: cleanTitle,
    doi: detectedDoi ? normalizeDoi(detectedDoi) ?? undefined : undefined,
    extraFields: {},
  };

  // If no identifier in filename, inspect first 128KB of PDF buffer to find embedded DOI or arXiv ID
  if (!detectedDoi && !detectedArxiv && file.size > 0) {
    try {
      const slice = file.slice(0, Math.min(file.size, 128 * 1024));
      const text = await slice.text();
      detectedDoi = extractDoiFromText(text);
      detectedArxiv = extractArxivId(text);
    } catch {
      // ignore
    }

    if (!detectedDoi && !detectedArxiv && typeof window !== 'undefined') {
      try {
        const { previewServices } = await import('@/features/workspaces/storage/services/preview.service');
        const arrayBuffer = await file.arrayBuffer();
        const previewRes = await previewServices.extractMetadata(arrayBuffer);
        if (previewRes?.doi) {
          detectedDoi = previewRes.doi;
        }
        if (
          previewRes?.metadata?.title &&
          (!cleanTitle ||
            cleanTitle.length < 5 ||
            /^(document|paper|untitled)/i.test(cleanTitle))
        ) {
          metadata.title = previewRes.metadata.title;
        }
        if (
          previewRes?.metadata?.author &&
          (!metadata.authors || metadata.authors.length === 0)
        ) {
          metadata.authors = [previewRes.metadata.author];
          metadata.author = previewRes.metadata.author;
        }
      } catch {
        // ignore preview extraction errors
      }
    }
  }

  const queryCandidate = detectedDoi || detectedArxiv || (cleanTitle.length > 5 ? cleanTitle : '');

  if (queryCandidate) {
    try {
      const res = await resolveAcademicQuery(queryCandidate);
      const ref = res?.metadata || (res as any)?.work || (res as any)?.data;
      if (ref && ref.title) {
        return {
          // Keep the provider record intact; only add aliases used by the
          // upload form so metadata fields are not silently discarded.
          ...ref,
          title: ref.title || cleanTitle,
          authors: ref.authors?.length ? ref.authors : metadata.authors,
          author: ref.authors?.[0] || metadata.author,
          keywords: ref.keywords,
          journal: ref.journal || ref.publicationTitle || ref.publisher,
          publicationTitle:
            ref.publicationTitle || ref.journal || ref.publisher,
          doi: ref.doi || (detectedDoi ? normalizeDoi(detectedDoi) ?? undefined : undefined),
          url: ref.url || (ref.doi ? `https://doi.org/${ref.doi}` : undefined),
          type: ref.itemType || ref.type || 'journalArticle',
          itemType: ref.itemType || ref.type || 'journalArticle',
          crossrefEnriched: true,
          extraFields: {
            ...(metadata.extraFields || {}),
            ...(ref.extraFields || {}),
            provider: res.provider,
            queryType: res.queryType,
          },
        };
      }
    } catch {
      // Provider misses (especially CrossRef 404) must not abort file upload.
      // Try the direct DOI path only when a DOI was detected and differed from queryCandidate.
      if (detectedDoi && queryCandidate !== detectedDoi) {
        const enriched = await enrichPaperWithCrossref(detectedDoi).catch(
          () => ({}),
        );
        return { ...metadata, ...enriched };
      }
    }
  }

  return metadata;
}

export async function enrichPaperWithCrossref(doi: string): Promise<Partial<PdfMetadata>> {
  try {
    const clean = normalizeDoi(doi) || doi.trim();
    if (!clean) return {};
    const res = await resolveAcademicQuery(clean);
    const ref = res?.metadata || (res as any)?.work || (res as any)?.data;
    if (ref && ref.title) {
      return {
        ...ref,
        title: ref.title,
        authors: ref.authors,
        author: ref.authors?.[0],
        journal: ref.journal || ref.publicationTitle || ref.publisher,
        publicationTitle: ref.publicationTitle || ref.journal || ref.publisher,
        year: ref.year,
        volume: ref.volume,
        issue: ref.issue,
        pages: ref.pages,
        doi: ref.doi || clean,
        url: ref.url,
        abstract: ref.abstract,
        crossrefEnriched: true,
      };
    }
    const fallback = await fetchReferenceByDoi(clean);
    if (!fallback) return {};

    return {
      title: fallback.title,
      authors: fallback.authors,
      author: fallback.authors?.[0],
      journal: fallback.journal || fallback.publisher,
      publicationTitle: fallback.journal || fallback.publisher,
      year: fallback.year,
      volume: fallback.volume,
      issue: fallback.issue,
      pages: fallback.pages,
      doi: fallback.doi,
      url: fallback.url,
      abstract: fallback.abstract,
      crossrefEnriched: true,
    };
  } catch {
    return {};
  }
}

// ── 4. Extra Metadata Sanitization & Zotero Formatting ────────────────────────

/**
 * Internal keys, duplicate fields, and telemetry flags that should never be displayed in the user-facing Extra field.
 * Items like citation count, arXiv ID, repository, and comments are already displayed in dedicated schema fields or the Notes tab.
 */
const EXCLUDED_EXTRA_TELEMETRY_KEYS: ReadonlySet<string> = new Set([
  'provider',
  'querytype',
  'provenance',
  'crossrefenriched',
  'crossref_enriched',
  'author',
  'authors',
  'creators',
  'contributors',
  'title',
  'doi',
  'url',
  'abstract',
  'abstractnote',
  'rawextra',
  '_rawextra',
  'fileurl',
  'pdfurl',
  'storageid',
  'citationcount',
  'citations',
  'repository',
  'comment',
  'comments',
  'tldr',
  'referencecount',
  'references',
  'influentialcitationcount',
  'influentialcitations',
  'corpusid',
  's2paperid',
  'openaccesspdfurl',
  'openaccess',
]);

/**
 * Sanitizes and formats Extra metadata for display.
 * In Zotero, the Extra field contains pure text / custom variables without
 * artificial headings or redundant labels prepended.
 *
 * For arXiv preprints, native Zotero formats the Extra field as:
 *   arXiv:<id> [<primary_category>]
 * (e.g. "arXiv:1406.2661 [stat.ML]" or "arXiv:1512.03385 [cs.CV]").
 *
 * This function preserves genuine user content, strips out redundant duplicate fields
 * (such as Title which is already displayed in the main Title field, Cite Key, Open Access URLs),
 * and eliminates internal telemetry while guaranteeing official Zotero arXiv syntax.
 */
export function formatAndSanitizeExtraMetadata(
  rawExtraMetadata?: string | null,
  additionalExtraFields?: Record<string, unknown> | null,
  associatedPaperItem?: Partial<Item> | null,
): string {
  let textContent = '';

  if (typeof rawExtraMetadata === 'string' && rawExtraMetadata.trim()) {
    const trimmed = rawExtraMetadata.trim();

    // If rawExtraMetadata is a JSON object string (e.g. from backend serialization)
    if (trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          const record = parsed as Record<string, unknown>;
          if (typeof record._rawExtra === 'string') {
            textContent = record._rawExtra.trim();
          } else {
            // If JSON contains genuine unmapped custom user properties (not telemetry or schema fields)
            const customLines: string[] = [];
            for (const [key, value] of Object.entries(parsed)) {
              const normKey = key.toLowerCase().replace(/[-_\s]/g, '');
              if (EXCLUDED_EXTRA_TELEMETRY_KEYS.has(normKey)) continue;
              if (value === null || value === undefined) continue;
              if (typeof value === 'object') continue;
              const strVal = String(value).trim();
              if (!strVal) continue;
              if (normKey === 'arxiv' || normKey === 'arxivid' || normKey === 'archiveid') {
                const cleanVal = strVal.replace(/^arxiv:\s*/i, '');
                customLines.push(`arXiv:${cleanVal}`);
              } else {
                customLines.push(`${key}: ${strVal}`);
              }
            }
            textContent = customLines.join('\n');
          }
        }
      } catch {
        // Not valid JSON, process as plain text directly
        textContent = trimmed;
      }
    } else {
      textContent = trimmed;
    }
  }

  const paperTitle = associatedPaperItem?.title?.trim().toLowerCase();
  const paperUrl = associatedPaperItem?.url?.trim();
  const paperFileUrl = associatedPaperItem?.fileUrl?.trim();
  const paperOaUrl = associatedPaperItem?.openAccessPdfUrl?.trim();
  const paperCiteKey = associatedPaperItem?.citationKey?.trim().toLowerCase();

  const lines = textContent ? textContent.split(/\r?\n/) : [];
  const sanitizedLines: string[] = [];
  let hasArxivLine = false;

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    // 1. Filter out redundant title lines (Title is already shown at the top of the form)
    const titleMatch = trimmedLine.match(/^title:\s*(.+)$/i);
    if (titleMatch) {
      const lineTitle = titleMatch[1].trim().toLowerCase();
      if (!paperTitle || lineTitle === paperTitle) {
        continue;
      }
    }

    // 2. Filter out duplicate citation key lines (Citation Key has its own dedicated field)
    const citeKeyMatch = trimmedLine.match(/^(?:citation\s*key|cite\s*key|citekey):\s*(.+)$/i);
    if (citeKeyMatch) {
      const lineKey = citeKeyMatch[1].trim().toLowerCase();
      if (!paperCiteKey || lineKey === paperCiteKey) {
        continue;
      }
    }

    // 3. Filter out Open Access notices / PDF download URLs (managed under Attachments)
    if (/^open\s*access:?/i.test(trimmedLine)) {
      continue;
    }
    if (
      trimmedLine === paperOaUrl ||
      trimmedLine === paperFileUrl ||
      trimmedLine === paperUrl
    ) {
      continue;
    }

    // 4. Filter out Comments (managed in Notes tab)
    if (/^comments?:\s*/i.test(trimmedLine)) {
      continue;
    }

    // 5. Filter out TLDR (Semantic Scholar AI summary removed)
    if (/^tl;?dr:\s*/i.test(trimmedLine)) {
      continue;
    }

    // Check for native Zotero arXiv syntax (e.g. arXiv:1406.2661 [stat.ML])
    if (/^arxiv:\s*/i.test(trimmedLine)) {
      hasArxivLine = true;
      // Standardize spacing: "arXiv:<id> [<category>]" with space before category and clean ID
      const normalizedLine = trimmedLine.replace(
        /^arxiv:\s*([^\s\[]+)(?:v\d+)?\s*(\[[^\]]+\])?/i,
        (_, id, cat) => (cat ? `arXiv:${id} ${cat.trim()}` : `arXiv:${id}`),
      );
      sanitizedLines.push(normalizedLine);
      continue;
    }

    // 6. Filter out internal telemetry keys
    const colonIdx = trimmedLine.indexOf(':');
    if (colonIdx > 0 && !trimmedLine.startsWith('http://') && !trimmedLine.startsWith('https://')) {
      const k = trimmedLine.slice(0, colonIdx).trim().toLowerCase().replace(/[-_\s]/g, '');
      if (EXCLUDED_EXTRA_TELEMETRY_KEYS.has(k)) {
        continue;
      }
    }

    // Preserve the clean content line as-is (no artificial label/title prepended!)
    sanitizedLines.push(trimmedLine);
  }

  // Fallback: If paper has an arXiv ID but no arXiv line in Extra, synthesize standard Zotero line
  if (!hasArxivLine) {
    const rawArxiv =
      associatedPaperItem?.arxivId ||
      (typeof additionalExtraFields?.arxivId === 'string' ? additionalExtraFields.arxivId : undefined) ||
      (typeof additionalExtraFields?.archiveId === 'string' ? additionalExtraFields.archiveId : undefined) ||
      (associatedPaperItem?.callNumber?.startsWith('arXiv:') ? associatedPaperItem.callNumber.replace(/^arXiv:/i, '').trim() : undefined);

    if (rawArxiv) {
      const cleanArxiv = rawArxiv
        .replace(/^arxiv:\s*/i, '')
        .replace(/\s*\[.*?\]\s*$/, '')
        .replace(/v\d+$/i, '')
        .trim();
      // Look for primary category if available
      let primaryCategory =
        typeof additionalExtraFields?.primaryCategory === 'string'
          ? additionalExtraFields.primaryCategory.trim()
          : '';

      if (!primaryCategory && Array.isArray(associatedPaperItem?.keywords)) {
        // e.g. ["stat.ML", "cs.LG"]
        const catMatch = associatedPaperItem.keywords.find((k) =>
          /^[a-z\-]+(\.[a-z\-]+)?$/i.test(String(k).trim()),
        );
        if (catMatch) primaryCategory = String(catMatch).trim();
      }

      const formattedArxivLine = primaryCategory
        ? `arXiv:${cleanArxiv} [${primaryCategory}]`
        : `arXiv:${cleanArxiv}`;

      sanitizedLines.unshift(formattedArxivLine);
    }
  }

  return sanitizedLines.join('\n');
}

/**
 * Sanitizes and normalizes an academic paper abstract for display and storage.
 * 1. Decodes HTML entities and strips XML/HTML tags.
 * 2. Strips leading "Abstract", "ABSTRACT", "Summary" prefixes.
 * 3. Removes repeated year extraction artifacts (e.g. "(2012)(2013)(2014)(2015)(2016)(2017).").
 * 4. Removes trailing author contribution, copyright, and index terms noise.
 * 5. Unwraps single hard line-breaks within paragraphs while preserving double-newline paragraph separation.
 * 6. Fixes hyphenated words broken across line wraps ("stochas- tic" -> "stochastic").
 */
export function cleanAbstractText(text?: string | null): string {
  if (!text || typeof text !== 'string') return '';

  let cleaned = text.replace(/<[^>]+>/g, ' ');
  // Decode common HTML entities
  cleaned = cleaned
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');

  // Strip stray LaTeX braces
  cleaned = cleaned.replace(/\\(?:textbf|textit|emph|underline|text)\{([^}]+)\}/g, '$1');

  // 1. Remove leading "Abstract" or "ABSTRACT" headings
  cleaned = cleaned.replace(/^(?:abstract|summary|résumé)\s*[:.—\-–\u2014\u2013]?\s*/i, '');
  cleaned = cleaned.replace(/^(?:abstract|summary|résumé)\s*\r?\n+/i, '');

  // 2. Remove repeated parenthesized / bracketed year-chain extraction artifacts
  // e.g. "(2012)(2013)(2014)(2015)(2016)(2017)."
  cleaned = cleaned.replace(/(?:\((?:19|20)\d{2}\)\s*){2,}\.?/g, '');
  cleaned = cleaned.replace(/(?:\[(?:19|20)\d{2}\]\s*){2,}\.?/g, '');
  cleaned = cleaned.replace(/\((?:(?:19|20)\d{2}[,\s;]*){3,}\)\.?/g, '');

  // 3. Remove trailing author contribution / footnote noise
  cleaned = cleaned.replace(
    /(?:(?:\n\s*|\.\s+|\s+)[*†‡§\d]*\s*(?:Equal contribution|Corresponding author|Correspondence to|Author ordering|Listing order|These authors contributed equally|Work performed while|Supported in part by|This work was supported by)[\s\S]*$)/i,
    '.',
  );

  // 4. Remove trailing publication metadata or index terms
  cleaned = cleaned.replace(
    /(?:\n\s*|\s+)(?:ACM Reference [Ff]ormat|Index Terms|Keywords|Key words|Additional Key Words and Phrases)[—:\-\s]+[\s\S]*$/i,
    '',
  );

  // 5. Remove trailing IEEE/ACM copyright banners
  cleaned = cleaned.replace(
    /(?:\n\s*|\.\s+|\s+)(?:Copyright\s*(?:\(c\)|©)?\s*(?:19|20)\d{2}|©\s*(?:19|20)\d{2}\s*IEEE)[\s\S]*$/i,
    '',
  );
  cleaned = cleaned.replace(
    /(?:\n\s*|\s+)\b\d{4}-\d{3}[\dX]\s*(?:\(c\)|©)?\s*\d{4}\s*IEEE[\s\S]*$/i,
    '',
  );

  // 6. Normalize paragraphs & unwrap hard line-breaks within each paragraph
  const rawParagraphs = cleaned.split(/\r?\n\s*\r?\n/);
  const normalizedParagraphs = rawParagraphs
    .map((paragraph) => {
      // Fix hyphenation across breaks (e.g., "stochas- tic" -> "stochastic")
      let p = paragraph.replace(/([a-zA-Z]{2,})-\s*\r?\n\s*([a-zA-Z]{2,})/g, '$1$2');
      // Collapse single newlines into a single space
      p = p.replace(/\r?\n/g, ' ');
      // Collapse multiple whitespace
      p = p.replace(/\s+/g, ' ').trim();
      // Clean spacing before punctuation
      p = p.replace(/\s+([.,;:!?])/g, '$1');
      // Clean duplicate periods (excluding ellipsis)
      p = p.replace(/\.\s*\.(?!\.)/g, '.');
      return p;
    })
    .filter((p) => p.length > 0);

  return normalizedParagraphs.join('\n\n').trim();
}


