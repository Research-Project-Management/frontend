import type { Paper, CatalogItem, Collection, Note, ReferenceData } from '../types/library.types';
import { fetchReferenceByDoi, searchReferences, resolveAcademicQuery } from '../services/citation.service';

// ── Institution keyword list (mirrored from backend creator-parser.util.ts) ───
const INSTITUTION_KEYWORDS = [
  'organization','organizations','organisation','organisations','association','associations',
  'institute','institutes','institution','institutions','university','universities',
  'laboratory','laboratories','collab','collaboration','collaborations','group','team',
  'consortium','network','department','departments','agency','agencies','center','centers',
  'centre','centres','foundation','corporation','inc','llc','ltd','hospital','hospitals',
  'openai','google','microsoft','meta','deepmind','anthropic','mit','cern','nasa','who','ieee','acm',
];

const PREFIX_PARTICLES = new Set(['von','van','de','del','der','da','di','du','la','le']);

// ── 1. ID & Key Resolution ───────────────────────────────────────────────────


/**
 * Extracts the primary PDF or reading file URL from a Paper object.
 * Strictly resolves canonical binary content URLs (/api/files/:fileId/content)
 * and avoids falling back to DOI landing page URLs.
 */
export function getPaperFileUrl(paper?: Partial<Paper> | null | undefined): string {
  if (!paper) return '';

  const normalizeUrl = (url?: string | null, fileId?: string | null): string => {
    if (fileId) {
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
  const attachments: any[] = Array.isArray((paper as any)?.attachments)
    ? (paper as any).attachments
    : [];

  const primaryPdfAttachment =
    attachments.find(
      (a: any) =>
        a?.attachmentType === 'primary_pdf' ||
        a?.type === 'primary_pdf',
    ) ||
    attachments.find(
      (a: any) => a?.mimeType === 'application/pdf',
    ) ||
    attachments.find(
      (a: any) =>
        a?.fileId &&
        typeof a?.filename === 'string' &&
        a.filename.toLowerCase().endsWith('.pdf'),
    );

  if (primaryPdfAttachment) {
    const url = normalizeUrl(
      primaryPdfAttachment.url || primaryPdfAttachment.fileUrl,
      primaryPdfAttachment.fileId,
    );
    if (url) return url;
  }

  // 2. Direct fileId on paper
  if ((paper as any)?.fileId) {
    return `/api/files/${(paper as any).fileId}/content`;
  }

  // 3. PrimaryFile object
  if (paper.primaryFile) {
    const url = normalizeUrl(
      paper.primaryFile.url,
      (paper.primaryFile as any).fileId || (paper.primaryFile as any).id,
    );
    if (url) return url;
  }

  // 4. Direct fileUrl on paper
  if (paper.fileUrl) {
    const url = normalizeUrl(paper.fileUrl, (paper as any).fileId);
    if (url) return url;
  }

  // 5. arXiv fallback: If paper has arxivId, arXiv DOI, arXiv URL, or arXiv filename
  const arxivMatch =
    (paper as any)?.arxivId ||
    paper.doi?.match(/arxiv\.(\d{4}\.\d{4,5}(?:v\d+)?)/i)?.[1] ||
    paper.url?.match(/arxiv\.org\/(?:abs|pdf)\/(\d{4}\.\d{4,5}(?:v\d+)?)/i)?.[1] ||
    (paper as any)?.filename?.match(/^(\d{4}\.\d{4,5}(?:v\d+)?)(?:\.pdf)?$/i)?.[1];

  if (arxivMatch) {
    return `https://arxiv.org/pdf/${arxivMatch.replace(/\.pdf$/i, '')}.pdf`;
  }

  return '';
}

/**
 * Splits a composite string of authors separated by ';', ' and ', ' & ', or newlines.
 * Logic is canonical with backend creator-parser.util.ts#splitAuthorString.
 */
export function splitAuthorString(input: string): string[] {
  if (!input || !input.trim()) return [];
  const trimmed = input.trim();
  const lines = trimmed
    .split(/\r?\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const result: string[] = [];

  for (const line of lines) {
    if (line.includes(';')) {
      result.push(...line.split(';').map((s) => s.trim()).filter(Boolean));
    } else if (/\s+and\s+/i.test(line)) {
      result.push(
        ...line.split(/\s+and\s+/i).map((s) => s.trim()).filter(Boolean),
      );
    } else if (/\s+&\s+/.test(line)) {
      result.push(
        ...line.split(/\s+&\s+/).map((s) => s.trim()).filter(Boolean),
      );
    } else if ((line.match(/,/g) || []).length >= 2) {
      // Multiple commas → treat as a list of names (e.g. "Smith, J., Jones, M.")
      result.push(
        ...line.split(',').map((s) => s.trim()).filter(Boolean),
      );
    } else {
      result.push(line);
    }
  }

  return result;
}

/**
 * Parses a single author name into structured fields.
 * Handles institutions, "LastName, FirstName", "FirstName LastName", particles (von/van/de), mononyms.
 * Canonical with backend creator-parser.util.ts#parseCreatorString.
 */
export function parseCreatorName(rawName: string): { firstName: string; lastName: string; fullName: string } {
  const trimmed = (rawName || '').trim().replace(/\s+/g, ' ');
  if (!trimmed) return { firstName: '', lastName: '', fullName: '' };

  const lower = trimmed.toLowerCase();
  const isInstitution = INSTITUTION_KEYWORDS.some((kw) =>
    new RegExp(`\\b${kw}\\b`, 'i').test(lower),
  );
  if (isInstitution) return { firstName: '', lastName: trimmed, fullName: trimmed };

  // Comma-separated: "LastName, FirstName MiddleName"
  if (trimmed.includes(',')) {
    const parts = trimmed.split(',').map((p) => p.trim());
    const lastName = parts[0] || '';
    const firstName = parts.slice(1).join(' ') || '';
    const fullName = firstName ? `${firstName} ${lastName}` : lastName;
    return { firstName, lastName, fullName };
  }

  // Space-separated: "FirstName [Middle...] LastName"
  const tokens = trimmed.split(' ');
  if (tokens.length === 1) return { firstName: '', lastName: tokens[0], fullName: tokens[0] };

  // Handle prefix particles: "Johann von Neumann"
  let splitIndex = tokens.length - 1;
  if (tokens.length >= 3 && PREFIX_PARTICLES.has(tokens[tokens.length - 2].toLowerCase())) {
    splitIndex = tokens.length - 2;
    if (tokens.length >= 4 && PREFIX_PARTICLES.has(tokens[tokens.length - 3].toLowerCase())) {
      splitIndex = tokens.length - 3;
    }
  }

  const lastName = tokens.slice(splitIndex).join(' ');
  const firstName = tokens.slice(0, splitIndex).join(' ');
  return { firstName, lastName, fullName: trimmed };
}

/**
 * Standardizes raw authors or creators into a clean array of author name strings.
 * Handles string[], delimited strings ("Author A; Author B" / "Author A and Author B"),
 * object arrays ([{ name: '...' }] or [{ firstName: '...', lastName: '...' }]),
 * and fallback to creators ([{ creatorType: 'author', name: '...' }]).
 */
export function normalizeAuthors(
  rawAuthors?: any,
  creators?: Array<{ creatorType?: string; name?: string; fullName?: string; firstName?: string; lastName?: string }> | null,
  contributors?: any[] | null,
): string[] {
  // If first argument is an object that looks like a paper (has authors/creators/contributors), extract from it
  if (rawAuthors && typeof rawAuthors === 'object' && !Array.isArray(rawAuthors)) {
    if ('authors' in rawAuthors || 'creators' in rawAuthors || 'contributors' in rawAuthors) {
      return normalizeAuthors(
        rawAuthors.authors,
        rawAuthors.creators,
        rawAuthors.contributors,
      );
    }
  }

  // 1. Check rawAuthors array
  if (Array.isArray(rawAuthors) && rawAuthors.length > 0) {
    const result: string[] = [];
    for (const item of rawAuthors) {
      if (!item) continue;
      if (typeof item === 'string') {
        result.push(...splitAuthorString(item));
      } else if (typeof item === 'object') {
        const fullName = (item.fullName || item.name || '').trim();
        if (fullName) {
          result.push(...splitAuthorString(fullName));
        } else if ('firstName' in item || 'lastName' in item || 'family' in item || 'given' in item) {
          const first = (item.firstName || item.given || '').trim();
          const last = (item.lastName || item.family || '').trim();
          const full = [first, last].filter(Boolean).join(' ');
          if (full) result.push(full);
        }
      }
    }
    if (result.length > 0) return result;
  } else if (typeof rawAuthors === 'string' && rawAuthors.trim()) {
    return splitAuthorString(rawAuthors);
  }

  // 2. Fallback to creators or contributors array
  const creatorList = (Array.isArray(creators) && creators.length > 0)
    ? creators
    : (Array.isArray(contributors) && contributors.length > 0)
    ? contributors
    : (rawAuthors && typeof rawAuthors === 'object' && Array.isArray((rawAuthors as any).creators))
    ? (rawAuthors as any).creators
    : (rawAuthors && typeof rawAuthors === 'object' && Array.isArray((rawAuthors as any).contributors))
    ? (rawAuthors as any).contributors
    : [];

  if (creatorList.length > 0) {
    const fromCreators: string[] = [];
    for (const c of creatorList) {
      if (!c) continue;
      if (typeof c === 'string') {
        fromCreators.push(...splitAuthorString(c));
        continue;
      }
      if (c.creatorType && c.creatorType !== 'author' && c.creatorType !== 'editor' && c.creatorType !== 'contributor') {
        continue;
      }
      const fullName = (c.fullName || c.name || '').trim();
      if (fullName) {
        fromCreators.push(...splitAuthorString(fullName));
      } else {
        const first = (c.firstName || c.given || '').trim();
        const last = (c.lastName || c.family || '').trim();
        const full = [first, last].filter(Boolean).join(' ');
        if (full) fromCreators.push(full);
      }
    }
    if (fromCreators.length > 0) return fromCreators;
  }

  return [];
}

/**
 * Formats a list of author names into a standard compact academic display string.
 * - 0 authors: "—"
 * - 1 author: "Author 1"
 * - 2 authors: "Author 1 & Author 2"
 * - 3+ authors: "Author 1 et al."
 */
export function formatCreatorCompact(authors?: string[] | null): string {
  if (!authors || authors.length === 0) return '—';
  if (authors.length === 1) return authors[0];
  if (authors.length === 2) return `${authors[0]} & ${authors[1]}`;
  return `${authors[0]} et al.`;
}

/**
 * Normalizes all tag-like fields on a paper into a deduped, trimmed string array.
 * Merges: tags, labels, keywords, itemTags (Zotero-style join table).
 * Use this everywhere instead of duplicating the 4-source merge pattern.
 */
export function normalizeTags(paper: Partial<CatalogItem> | null | undefined): string[] {
  if (!paper) return [];
  const raw: unknown[] = [
    ...(Array.isArray(paper.tags) ? paper.tags : []),
    ...(Array.isArray((paper as any).labels) ? (paper as any).labels : []),
    ...(Array.isArray(paper.keywords) ? paper.keywords : []),
    ...(Array.isArray((paper as any).itemTags)
      ? (paper as any).itemTags.map((it: any) => it?.tag?.name ?? it?.name ?? '')
      : []),
  ];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const t of raw) {
    const s = (typeof t === 'string' ? t : (t as any)?.name ?? '').trim();
    if (s && !seen.has(s)) { seen.add(s); result.push(s); }
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
    const contentText =
      noteObj.content ||
      noteObj.contentMd ||
      (typeof noteObj.contentJson === 'string' ? noteObj.contentJson : '') ||
      '';

    return {
      id: note.id || `note-${index}`,
      content: contentText,
      contentMd: noteObj.contentMd || contentText,
      contentJson: noteObj.contentJson,
      createdAt: (note as Note).createdAt || new Date().toISOString(),
      updatedAt: (note as Note).updatedAt,
    };
  });
}

// ── 3. DOI & Citation Helpers ────────────────────────────────────────────────

export function trimUnmatchedClosingBrackets(str: string): string {
  let s = str;
  const pairs: Array<[string, string]> = [[')', '('], [']', '['], ['}', '{'], ['>', '<']];
  for (const [closeChar, openChar] of pairs) {
    while (
      s.endsWith(closeChar) &&
      (s.match(new RegExp(`\\${closeChar}`, 'g')) || []).length >
      (s.match(new RegExp(`\\${openChar}`, 'g')) || []).length
    ) {
      s = s.slice(0, -1);
    }
  }
  return s;
}

export function cleanDoi(doi?: string | null): string {
  if (!doi || typeof doi !== 'string') return '';
  let clean = doi.trim();

  // Nature article URL: nature.com/articles/<slug>
  const natureMatch = clean.match(
    /^https?:\/\/(?:www\.)?nature\.com\/articles\/([a-z0-9._-]+)(?:[?#].*)?$/i,
  );
  if (natureMatch && natureMatch[1]) return `10.1038/${natureMatch[1]}`;

  // Zenodo record URL: zenodo.org/records/<id>
  const zenodoMatch = clean.match(
    /^https?:\/\/zenodo\.org\/records?\/(\d+)(?:[?#].*)?$/i,
  );
  if (zenodoMatch && zenodoMatch[1]) return `10.5281/zenodo.${zenodoMatch[1]}`;

  // BioRxiv / MedRxiv preprint URL
  const biorxivMatch = clean.match(
    /^https?:\/\/(?:www\.)?(?:biorxiv|medrxiv)\.org\/content\/(10\.\d{4,9}\/[^?#\s]+?)(?:v\d+)?(?:\.full|\.abstract|\.pdf)?(?:[?#].*)?$/i,
  );
  if (biorxivMatch && biorxivMatch[1]) return biorxivMatch[1].replace(/v\d+$/, '');

  // PLOS article URL
  const plosMatch = clean.match(
    /^https?:\/\/journals\.plos\.org\/[^/]+\/article\?(?:[^#]*&)?id=(10\.\d{4,9}\/[^&#\s]+)/i,
  );
  if (plosMatch && plosMatch[1]) return decodeURIComponent(plosMatch[1]);

  // Embedded /doi/ or /article/ in publisher URLs
  const embeddedMatch = clean.match(
    /^https?:\/\/[^/]+(?:\/[^/]+)*\/(?:doi\/|article\/)(?:abs\/|full\/|epdf\/|pdf\/)?(10\.\d{4,9}\/[-._;()/:A-Za-z0-9<>+=[\]~]+)(?:[?#].*)?$/i,
  );
  if (embeddedMatch && embeddedMatch[1]) {
    clean = embeddedMatch[1];
  } else {
    clean = clean.replace(/^(?:https?:\/\/(?:dx\.)?doi\.org\/|doi:\s*)/i, '');
  }

  const embedded = clean.match(/10\.\d{4,9}\/[-._;()/:A-Za-z0-9<>+=[\]~]+/);
  let s = (embedded ? embedded[0] : clean).replace(/[.,;:]+$/, '');
  s = trimUnmatchedClosingBrackets(s).replace(/[.,;:]+$/, '');
  return s.startsWith('10.') ? s : '';
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

export function getUniqueTags(items: CatalogItem[]): string[] {
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
  'archiveid',
  'arxivid',
  'arxiv',
  'repository',
  'comment',
  'comments',
]);

/**
 * Canonical key mappings to standard human-readable academic labels (Zotero Extra style).
 */
const CANONICAL_EXTRA_LABEL_MAP: Readonly<Record<string, string>> = {
  pmid: 'PMID',
  pmcid: 'PMCID',
  mrnumber: 'MR Number',
  zblnumber: 'Zbl Number',
};

/**
 * Formats and sanitizes raw extra metadata into clean, human-readable Zotero-style lines (Key: Value).
 * Strips out internal system telemetry, pipeline provenance, duplicate fields that are already displayed
 * in standard fields (such as Citations and arXiv ID), author comments (which are displayed in the Notes tab),
 * and removes redundant "Open Access:" label prefix leaving direct URLs clean for user reading.
 */
export function formatAndSanitizeExtraMetadata(
  rawExtraMetadata?: string | null,
  additionalExtraFields?: Record<string, unknown> | null,
  associatedPaperItem?: Partial<CatalogItem> | null,
): string {
  const mergedMetadataRecord: Record<string, unknown> = {};

  if (rawExtraMetadata && typeof rawExtraMetadata === 'string') {
    const trimmedExtraMetadata = rawExtraMetadata.trim();
    if (trimmedExtraMetadata.startsWith('{')) {
      try {
        const parsedMetadataRecord: unknown = JSON.parse(trimmedExtraMetadata);
        if (
          typeof parsedMetadataRecord === 'object' &&
          parsedMetadataRecord !== null &&
          !Array.isArray(parsedMetadataRecord)
        ) {
          Object.assign(
            mergedMetadataRecord,
            parsedMetadataRecord as Record<string, unknown>,
          );
        }
      } catch (caughtError) {
        // Not valid JSON, process as plain text lines below
      }
    } else if (trimmedExtraMetadata) {
      // Plain text multi-line (e.g. Zotero style "Key: Value")
      const rawLines = trimmedExtraMetadata.split(/\r?\n/);
      for (const singleLine of rawLines) {
        let trimmedLine = singleLine.trim();
        if (!trimmedLine) {
          continue;
        }

        // If line is a Comment line, discard it as it is already displayed in the Notes tab
        if (/^comments?:\s*/i.test(trimmedLine)) {
          continue;
        }

        // If line is just "Open Access:" or "Open Access", discard it
        if (/^open\s*access:?$/i.test(trimmedLine)) {
          continue;
        }

        // If line starts with "Open Access: <url>", strip the prefix and keep the url directly
        if (/^open\s*access:\s*https?:\/\//i.test(trimmedLine)) {
          trimmedLine = trimmedLine.replace(/^open\s*access:\s*/i, '');
        }

        const colonIndex = trimmedLine.indexOf(':');
        // Handle "Key: Value" lines, but avoid splitting URLs like "https://..."
        if (colonIndex > 0 && !trimmedLine.startsWith('http://') && !trimmedLine.startsWith('https://')) {
          const lineKey = trimmedLine.slice(0, colonIndex).trim();
          const lineValue = trimmedLine.slice(colonIndex + 1).trim();
          mergedMetadataRecord[lineKey] = lineValue;
        } else {
          mergedMetadataRecord[trimmedLine] = true;
        }
      }
    }
  }

  if (
    additionalExtraFields &&
    typeof additionalExtraFields === 'object' &&
    !Array.isArray(additionalExtraFields)
  ) {
    for (const [metadataKey, metadataValue] of Object.entries(
      additionalExtraFields,
    )) {
      if (
        metadataValue !== null &&
        metadataValue !== undefined &&
        mergedMetadataRecord[metadataKey] === undefined
      ) {
        mergedMetadataRecord[metadataKey] = metadataValue;
      }
    }
  }

  const paperUrl = associatedPaperItem?.url?.trim();
  const paperFileUrl = associatedPaperItem?.fileUrl?.trim();
  const formattedMetadataLines: string[] = [];

  for (const [metadataKey, metadataValue] of Object.entries(
    mergedMetadataRecord,
  )) {
    if (metadataValue === null || metadataValue === undefined) {
      continue;
    }

    const normalizedKey = metadataKey.toLowerCase().replace(/[-_]/g, '');

    // Skip telemetry or fields already displayed in dedicated inputs (Citations, arXiv, etc.)
    if (EXCLUDED_EXTRA_TELEMETRY_KEYS.has(normalizedKey)) {
      continue;
    }

    // Ignore nested complex objects
    if (typeof metadataValue === 'object') {
      continue;
    }

    // Open Access PDF URL: do not repeat "Open Access:", just output the URL directly
    if (normalizedKey === 'openaccesspdfurl' || normalizedKey === 'openaccess') {
      const openAccessUrl = String(metadataValue).trim();
      if (
        openAccessUrl &&
        openAccessUrl !== paperUrl &&
        openAccessUrl !== paperFileUrl
      ) {
        formattedMetadataLines.push(openAccessUrl);
      }
      continue;
    }

    // If boolean flag from plain line (e.g. standalone URL or standalone line)
    if (typeof metadataValue === 'boolean' && metadataValue) {
      // Discard dangling "Open Access:" lines
      if (/^open\s*access:?$/i.test(metadataKey)) {
        continue;
      }
      const cleanedKey = metadataKey.replace(/^open\s*access:\s*/i, '').trim();
      if (cleanedKey && cleanedKey !== paperUrl && cleanedKey !== paperFileUrl) {
        formattedMetadataLines.push(cleanedKey);
      }
      continue;
    }

    const stringValue = String(metadataValue).trim();
    if (!stringValue) {
      continue;
    }

    // If string value is already the same as paper url or file url, avoid duplicating
    if (stringValue === paperUrl || stringValue === paperFileUrl) {
      continue;
    }

    const displayLabel =
      CANONICAL_EXTRA_LABEL_MAP[normalizedKey] || metadataKey;

    formattedMetadataLines.push(`${displayLabel}: ${stringValue}`);
  }

  return formattedMetadataLines.join('\n');
}

