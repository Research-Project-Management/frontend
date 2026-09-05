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
 * Extracts the standardized ID from any entity.
 */
export function getLibraryEntityId(
  entity?: { id?: string } | null | undefined
): string {
  if (!entity) return '';
  return entity.id || '';
}

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
 * Generates or extracts a standardized citation key for BibTeX/LaTeX (e.g. "vaswani2017attention").
 */
export function getPaperCitationKey(paper?: Partial<Paper> | null): string {
  if (!paper) return 'refpaper';
  if (paper.citationKey && typeof paper.citationKey === 'string' && paper.citationKey.trim().length > 0) {
    return paper.citationKey.trim();
  }

  const authors = normalizeAuthors(paper.authors, (paper as any)?.creators);
  const firstAuthor = authors[0] || '';
  const authorKey = firstAuthor
    ? firstAuthor.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12)
    : 'ref';

  const yearKey = paper.year ? String(paper.year).slice(-4) : '';

  const titleWord = paper.title && typeof paper.title === 'string'
    ? paper.title
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .find((w: string) => !['a', 'an', 'the', 'on', 'in', 'for', 'of', 'and', 'with', 'via'].includes(w)) || 'paper'
    : 'paper';

  return `${authorKey || 'ref'}${yearKey}${titleWord || 'paper'}`;
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

export function cleanDoi(doi?: string | null): string {
  if (!doi || typeof doi !== 'string') return '';
  return doi
    .trim()
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '')
    .replace(/^doi:\s*/i, '')
    .trim();
}

// ── 4. Library Filter Engine ─────────────────────────────────────────────────

export interface LibraryFilterOptions {
  searchQuery?: string;
  collectionId?: string | null;
  selectedTags?: string[];
  fromYear?: number;
  toYear?: number;
  itemType?: string;
  hasAttachment?: boolean;
}

export interface SortOptions {
  field: 'title' | 'year' | 'authors' | 'journal' | 'createdAt' | string;
  direction: 'asc' | 'desc';
}

export class LibraryFilterEngine {
  static filterBySearch(items: CatalogItem[], query: string): CatalogItem[] {
    if (!query || !query.trim()) return items;
    const q = query.toLowerCase().trim();

    return items.filter((paper) => {
      const p = paper as any;
      const authors = normalizeAuthors(paper.authors, p.creators);
      const inTitle = paper.title?.toLowerCase().includes(q) ?? false;
      const inAuthors = authors.some((a) => a.toLowerCase().includes(q));
      const inAbstract = paper.abstract?.toLowerCase().includes(q) ?? false;
      const inJournal = (paper.journal || paper.publicationTitle || paper.publisher)?.toLowerCase().includes(q) ?? false;
      const inDoi = paper.doi?.toLowerCase().includes(q) ?? false;
      const rawTags = p.tags || p.labels || p.keywords || [];
      const inTags = rawTags.some((t: any) =>
        (typeof t === 'string' ? t : t.name || '').toLowerCase().includes(q)
      );

      return inTitle || inAuthors || inAbstract || inJournal || inDoi || inTags;
    });
  }

  static filter(items: CatalogItem[], options: LibraryFilterOptions): CatalogItem[] {
    const { searchQuery, collectionId, selectedTags, fromYear, toYear, itemType, hasAttachment } = options;

    let result = items;

    if (searchQuery) {
      result = this.filterBySearch(result, searchQuery);
    }

    return result.filter((paper) => {
      const p = paper as any;

      // Collection
      if (collectionId !== undefined && collectionId !== null) {
        if (!isPaperInCollection(paper, collectionId)) {
          return false;
        }
      }

      // Tags
      if (selectedTags && selectedTags.length > 0) {
        const rawTags = p.tags || p.labels || p.keywords || [];
        const paperTags = rawTags.map((t: any) => (typeof t === 'string' ? t.toLowerCase() : t.name?.toLowerCase() || ''));
        const hasAllTags = selectedTags.every((t) => paperTags.includes(t.toLowerCase()));
        if (!hasAllTags) return false;
      }

      // Year Range
      if (fromYear !== undefined && fromYear !== null) {
        const pYear = typeof paper.year === 'number' ? paper.year : parseInt(String(paper.year || 0), 10);
        if (pYear && pYear < fromYear) return false;
      }
      if (toYear !== undefined && toYear !== null) {
        const pYear = typeof paper.year === 'number' ? paper.year : parseInt(String(paper.year || 0), 10);
        if (pYear && pYear > toYear) return false;
      }

      // Item Type
      if (itemType && itemType !== 'all') {
        const pType = (paper.itemType || (paper as any).type || '').toLowerCase();
        if (pType !== itemType.toLowerCase()) return false;
      }

      // Attachment
      if (hasAttachment !== undefined) {
        const hasFile = Boolean(paper.fileUrl || paper.primaryFile?.url || p.hasPdf || (p.attachments && p.attachments.length > 0));
        if (hasAttachment && !hasFile) return false;
        if (!hasAttachment && hasFile) return false;
      }

      return true;
    });
  }

  static sort(items: CatalogItem[], options: SortOptions): CatalogItem[] {
    const { field, direction } = options;
    const modifier = direction === 'desc' ? -1 : 1;

    return [...items].sort((a, b) => {
      if (field === 'year') {
        const yA = typeof a.year === 'number' ? a.year : parseInt(String(a.year || 0), 10);
        const yB = typeof b.year === 'number' ? b.year : parseInt(String(b.year || 0), 10);
        return (yA - yB) * modifier;
      }

      if (field === 'title') {
        return (a.title || '').localeCompare(b.title || '') * modifier;
      }

      if (field === 'authors') {
        const a1 = normalizeAuthors(a.authors, (a as any).creators)[0] || '';
        const b1 = normalizeAuthors(b.authors, (b as any).creators)[0] || '';
        return a1.localeCompare(b1) * modifier;
      }

      return 0;
    });
  }

  static isDuplicate(paperA: CatalogItem, paperB: CatalogItem): boolean {
    if (paperA.id && paperB.id && paperA.id === paperB.id) return false;

    // Exact DOI match
    if (paperA.doi && paperB.doi) {
      const cleanA = cleanDoi(paperA.doi).toLowerCase();
      const cleanB = cleanDoi(paperB.doi).toLowerCase();
      if (cleanA && cleanA === cleanB) return true;
    }

    // Normalized title match
    if (paperA.title && paperB.title) {
      const normA = paperA.title.toLowerCase().replace(/[^a-z0-9]/g, '');
      const normB = paperB.title.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (normA.length > 15 && normA === normB) return true;
    }

    return false;
  }

  static findDuplicates(items: CatalogItem[]): Array<{ original: CatalogItem; duplicates: CatalogItem[] }> {
    const results: Array<{ original: CatalogItem; duplicates: CatalogItem[] }> = [];
    const visited = new Set<string>();

    for (let i = 0; i < items.length; i++) {
      const current = items[i];
      const currentId = current.id;
      if (visited.has(currentId)) continue;

      const dupes: CatalogItem[] = [];
      for (let j = i + 1; j < items.length; j++) {
        const other = items[j];
        const otherId = other.id;
        if (visited.has(otherId)) continue;

        if (this.isDuplicate(current, other)) {
          dupes.push(other);
          visited.add(otherId);
        }
      }

      if (dupes.length > 0) {
        visited.add(currentId);
        results.push({
          original: current,
          duplicates: dupes,
        });
      }
    }

    return results;
  }
}

export function filterItems(
  items: CatalogItem[],
  query: string = '',
  collectionId: string | null = null,
  activeTag: string | null = null
): CatalogItem[] {
  return LibraryFilterEngine.filter(items, {
    searchQuery: query,
    collectionId: collectionId,
    selectedTags: activeTag ? [activeTag] : undefined,
  });
}

export const filterPapers = filterItems;

export function isPaperInCollection(paper: CatalogItem, collectionId: string): boolean {
  if (!collectionId) return true;

  if (paper.collectionId === collectionId) return true;

  const p = paper as any;
  if (Array.isArray(p.collections)) {
    return p.collections.some((c: any) => {
      if (typeof c === 'string') return c === collectionId;
      return c.id === collectionId;
    });
  }

  if (Array.isArray(p.collectionIds)) {
    return p.collectionIds.includes(collectionId);
  }

  return false;
}

export function getUniqueTags(items: CatalogItem[]): string[] {
  const tagSet = new Set<string>();
  for (const paper of items) {
    const p = paper as any;
    const rawTags = p.tags || p.labels || [];
    if (Array.isArray(rawTags)) {
      for (const tag of rawTags) {
        if (typeof tag === 'string' && tag.trim()) {
          tagSet.add(tag.trim());
        } else if (tag && typeof tag === 'object' && 'name' in tag && tag.name) {
          tagSet.add(tag.name.trim());
        }
      }
    }
  }
  return Array.from(tagSet).sort();
}

// ── 5. BibTeX Citation Engine ────────────────────────────────────────────────
export * from './bibtex.util';

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

export const DOI_REGEX = /\b(10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+)\b/;
export const ARXIV_REGEX = /\b(?:arXiv:\s*)?(\d{4}\.\d{4,5}(?:v\d+)?)\b/i;

export function extractDoiFromText(text: string): string | null {
  if (!text) return null;
  const sanitized = text.replace(/\.pdf$/i, '');
  const match = sanitized.match(DOI_REGEX);
  if (!match) return null;
  return match[1].replace(/[.,;:)\]]+$/, '');
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
  }

  const queryCandidate = detectedDoi || detectedArxiv || (cleanTitle.length > 5 ? cleanTitle : '');

  if (queryCandidate) {
    try {
      const res = await resolveAcademicQuery(queryCandidate);
      if (res && res.metadata && res.metadata.title) {
        const ref = res.metadata;
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
    } catch (error) {
      // Provider misses (especially CrossRef 404) must not abort file upload.
      // Try the direct DOI path only when a DOI was actually detected, and
      // always degrade to filename/identifier metadata if it also misses.
      if (detectedDoi) {
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
    const clean = normalizeDoi(doi);
    if (!clean) return {};
    const ref = await fetchReferenceByDoi(clean);
    if (!ref) return {};

    return {
      title: ref.title,
      authors: ref.authors,
      author: ref.authors?.[0],
      journal: ref.journal || ref.publisher,
      publicationTitle: ref.journal || ref.publisher,
      year: ref.year,
      volume: ref.volume,
      issue: ref.issue,
      pages: ref.pages,
      doi: ref.doi,
      url: ref.url,
      abstract: ref.abstract,
      crossrefEnriched: true,
    };
  } catch {
    return {};
  }
}

// ── 7. Formatted Citations (APA, IEEE, LaTeX \cite) ───────────────────────────

/**
 * Returns LaTeX cite command (e.g. \cite{vaswani2017attention})
 */
export function formatCiteCommand(paper: Partial<Paper>): string {
  const key = getPaperCitationKey(paper);
  return `\\cite{${key}}`;
}

/**
 * Formats a paper reference in APA 7th style
 * e.g. "Vaswani, A., Shazeer, N., et al. (2017). Attention is all you need. Journal Name, 30, 45-60. https://doi.org/..."
 */
export function formatApaCitation(paper: Partial<Paper>): string {
  const authors = normalizeAuthors(paper.authors, (paper as any)?.creators);
  let authorStr = 'Unknown Author';
  if (authors.length === 1) {
    authorStr = authors[0];
  } else if (authors.length === 2) {
    authorStr = `${authors[0]} & ${authors[1]}`;
  } else if (authors.length > 2) {
    authorStr = `${authors[0]} et al.`;
  }

  const yearStr = paper.year ? `(${paper.year})` : '(n.d.)';
  const titleStr = paper.title ? `${paper.title.replace(/\.$/, '')}.` : 'Untitled.';
  const venue = paper.journal || paper.publicationTitle || paper.publisher || '';
  // Plain-text APA: italics are conveyed by surrounding spaces, not markdown underscores
  let venueStr = venue ? `${venue}` : '';
  if (paper.volume) venueStr += `, ${paper.volume}`;
  if (paper.issue) venueStr += `(${paper.issue})`;
  if (paper.pages) venueStr += `, ${paper.pages}`;
  if (venueStr) venueStr += '.';

  const doiOrUrl = paper.doi
    ? `https://doi.org/${cleanDoi(paper.doi)}`
    : paper.url || '';

  return [authorStr, yearStr, titleStr, venueStr, doiOrUrl]
    .filter(Boolean)
    .join(' ');
}

/**
 * Formats a paper reference in IEEE style
 * e.g. 'A. Vaswani et al., "Attention is all you need," in Adv. Neural Inf. Process. Syst., vol. 30, 2017.'
 */
export function formatIeeeCitation(paper: Partial<Paper>): string {
  const authors = normalizeAuthors(paper.authors, (paper as any)?.creators);
  let authorStr = 'Unknown Author';
  if (authors.length === 1) {
    authorStr = authors[0];
  } else if (authors.length > 1) {
    authorStr = `${authors[0]} et al.`;
  }

  const titleStr = paper.title ? `"${paper.title.replace(/\.$/, '')},"` : '"Untitled,"';
  const venue = paper.journal || paper.publicationTitle || paper.publisher || '';
  // Plain-text IEEE: no markdown italic; format "in Journal Name"
  const venueStr = venue ? `in ${venue}` : '';
  const volStr = paper.volume ? `vol. ${paper.volume}` : '';
  const yearStr = paper.year ? `${paper.year}` : '';

  const parts = [authorStr, titleStr, venueStr, volStr, yearStr].filter(Boolean);
  let res = parts.join(', ');
  if (!res.endsWith('.')) res += '.';
  return res;
}
