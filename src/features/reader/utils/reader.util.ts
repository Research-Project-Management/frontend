/**
 * reader.util.ts
 *
 * PURE DOMAIN & CITATION UTILITIES FOR READER
 * 100% self-contained within features/reader with zero dependencies on features/library.
 */

import type {
  ReaderAnnotation,
  AnnotationRect,
  ReaderDocument,
  DocumentCreator,
} from '../types/reader.types';

export const ANNOTATION_COLORS = {
  yellow: { id: 'yellow', name: 'Yellow', bg: 'rgba(255, 212, 0, 0.35)', border: '#ffd400' },
  red: { id: 'red', name: 'Red', bg: 'rgba(255, 102, 102, 0.35)', border: '#ff6666' },
  green: { id: 'green', name: 'Green', bg: 'rgba(95, 178, 54, 0.35)', border: '#5fb236' },
  blue: { id: 'blue', name: 'Blue', bg: 'rgba(46, 168, 229, 0.35)', border: '#2ea8e5' },
  purple: { id: 'purple', name: 'Purple', bg: 'rgba(162, 138, 229, 0.35)', border: '#a28ae5' },
  magenta: { id: 'magenta', name: 'Magenta', bg: 'rgba(229, 110, 238, 0.35)', border: '#e56eee' },
  orange: { id: 'orange', name: 'Orange', bg: 'rgba(241, 152, 55, 0.35)', border: '#f19837' },
  gray: { id: 'gray', name: 'Gray', bg: 'rgba(170, 170, 170, 0.35)', border: '#aaaaaa' },
} as const;

export type AnnotationColorId = keyof typeof ANNOTATION_COLORS;

export const PdfAnnotationEngine = {
  sortAnnotations(annotations: ReaderAnnotation[]): ReaderAnnotation[] {
    return [...annotations].sort((a, b) => {
      // 1. Zotero canonical spatial sort index (PPPP|YYYYY|XXXXX) from backend SSOT
      if (a.annotationSortIndex && b.annotationSortIndex && a.annotationSortIndex !== b.annotationSortIndex) {
        return a.annotationSortIndex.localeCompare(b.annotationSortIndex);
      }

      // 2. Page index / page number
      const pageA = a.pageIndex ?? (a.pageNumber !== undefined ? a.pageNumber - 1 : 0);
      const pageB = b.pageIndex ?? (b.pageNumber !== undefined ? b.pageNumber - 1 : 0);
      if (pageA !== pageB) return pageA - pageB;

      // 3. Fallback coordinates (normalized 0..1)
      const rectA = (a.rects?.[0] || a.boundingRect) as (AnnotationRect & { x?: number; y?: number }) | undefined;
      const rectB = (b.rects?.[0] || b.boundingRect) as (AnnotationRect & { x?: number; y?: number }) | undefined;
      const topA = rectA?.y1 ?? rectA?.y ?? 0;
      const topB = rectB?.y1 ?? rectB?.y ?? 0;
      if (Math.abs(topA - topB) > 0.005) return topA - topB;

      const leftA = rectA?.x1 ?? rectA?.x ?? 0;
      const leftB = rectB?.x1 ?? rectB?.x ?? 0;
      if (Math.abs(leftA - leftB) > 0.005) return leftA - leftB;

      // 4. Fallback creation timestamp
      const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tA - tB;
    });
  },

  filterAnnotations(
    annotations: ReaderAnnotation[],
    query?: string,
    colorFilter?: string | null,
  ): ReaderAnnotation[] {
    const q = query?.trim().toLowerCase() || '';
    const color = colorFilter?.trim().toLowerCase();

    return annotations.filter((a) => {
      if (q) {
        const textMatch =
          (a.quoteText || '').toLowerCase().includes(q) ||
          (a.text || '').toLowerCase().includes(q) ||
          (a.comment || '').toLowerCase().includes(q);
        if (!textMatch) return false;
      }

      if (color && color !== 'all') {
        const itemColor = (a.color || '#ffd400').toLowerCase();
        if (color in ANNOTATION_COLORS) {
          const cfg = ANNOTATION_COLORS[color as AnnotationColorId];
          const matches =
            itemColor === color ||
            itemColor === cfg.border.toLowerCase();
          if (!matches) return false;
        } else if (itemColor !== color) {
          return false;
        }
      }

      return true;
    });
  },

  normalizeRect(rect: AnnotationRect | { x: number; y: number; width: number; height: number }): AnnotationRect {
    const r = rect as { x1?: number; y1?: number; x2?: number; y2?: number; x?: number; y?: number; width?: number; height?: number };
    const rawX = r.x1 ?? r.x ?? 0;
    const rawY = r.y1 ?? r.y ?? 0;
    const x = Math.max(0, Math.min(1, rawX));
    const y = Math.max(0, Math.min(1, rawY));
    const width = Math.max(0, Math.min(1 - x, r.width ?? (r.x2 ? r.x2 - rawX : 0)));
    const height = Math.max(0, Math.min(1 - y, r.height ?? (r.y2 ? r.y2 - rawY : 0)));

    return {
      x1: x,
      y1: y,
      x2: x + width,
      y2: y + height,
      width,
      height,
    };
  },

  getColorConfig(colorId?: string): { bg: string; border: string } {
    if (colorId && colorId in ANNOTATION_COLORS) {
      const c = ANNOTATION_COLORS[colorId as AnnotationColorId];
      return { bg: c.bg, border: c.border };
    }
    if (colorId) {
      const found = Object.values(ANNOTATION_COLORS).find(
        (c) => c.border.toLowerCase() === colorId.toLowerCase(),
      );
      if (found) return { bg: found.bg, border: found.border };
    }
    return { bg: ANNOTATION_COLORS.yellow.bg, border: ANNOTATION_COLORS.yellow.border };
  },
};

// ── DOI & Identifiers ────────────────────────────────────────────────────────

export function cleanDoi(doi?: string | null): string | null {
  if (!doi || typeof doi !== 'string') return null;
  let clean = doi.trim();

  // Strip common URL prefixes
  clean = clean.replace(/^(?:https?:\/\/(?:dx\.)?doi\.org\/|doi:\s*)/i, '');

  const match = clean.match(/10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+/);
  return match ? match[0] : (clean.length > 5 ? clean : null);
}

// ── Creators & Authors ───────────────────────────────────────────────────────

export function splitAuthorString(raw: string): string[] {
  if (!raw || typeof raw !== 'string') return [];
  const trimmed = raw.trim();
  if (!trimmed) return [];

  // Split on " and ", ";", or newline
  const parts = trimmed.split(/\s+and\s+|[;\n\r]/i);
  return parts.map((p) => p.trim()).filter((p) => p.length > 0);
}

export function parseCreatorName(raw: string): {
  firstName: string;
  lastName: string;
  fullName: string;
  isInstitution?: boolean;
} {
  if (!raw || typeof raw !== 'string') {
    return { firstName: '', lastName: '', fullName: '' };
  }
  const clean = raw.trim();
  if (clean.includes(',')) {
    const [last, ...firstParts] = clean.split(',');
    const lastName = last?.trim() || '';
    const firstName = firstParts.join(',').trim();
    return {
      firstName,
      lastName,
      fullName: [firstName, lastName].filter(Boolean).join(' '),
    };
  }
  const parts = clean.split(/\s+/);
  if (parts.length === 1) {
    return { firstName: '', lastName: parts[0] || '', fullName: clean };
  }
  const lastName = parts[parts.length - 1] || '';
  const firstName = parts.slice(0, -1).join(' ');
  return { firstName, lastName, fullName: clean };
}

export function normalizeAuthors(
  rawAuthors?: unknown,
  creators?: DocumentCreator[] | null,
): string[] {
  if (Array.isArray(creators) && creators.length > 0) {
    const list: string[] = [];
    for (const c of creators) {
      if (!c) continue;
      const fullName = (c.fullName || c.name || '').trim();
      if (fullName) {
        list.push(fullName);
      } else {
        const full = [c.firstName, c.lastName].filter(Boolean).join(' ').trim();
        if (full) list.push(full);
      }
    }
    if (list.length > 0) return list;
  }

  if (Array.isArray(rawAuthors) && rawAuthors.length > 0) {
    const result: string[] = [];
    for (const item of rawAuthors) {
      if (!item) continue;
      if (typeof item === 'string') {
        result.push(...splitAuthorString(item));
      } else if (typeof item === 'object') {
        const fullName = ((item as any).fullName || (item as any).name || '').trim();
        if (fullName) {
          result.push(fullName);
        } else {
          const first = ((item as any).firstName || (item as any).given || '').trim();
          const last = ((item as any).lastName || (item as any).family || '').trim();
          const full = [first, last].filter(Boolean).join(' ').trim();
          if (full) result.push(full);
        }
      }
    }
    return result;
  }

  if (typeof rawAuthors === 'string' && rawAuthors.trim()) {
    return splitAuthorString(rawAuthors);
  }

  return [];
}

// ── Citations & BibTeX Keys ──────────────────────────────────────────────────

const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'of', 'in', 'on', 'for', 'with', 'at', 'by', 'to', 'from',
]);

export function generateCitationKey(
  paper?: Partial<ReaderDocument> | null,
  existingKeys?: Set<string> | string[],
): string {
  if (!paper) return 'refpaper';
  if (paper.citationKey && paper.citationKey.trim()) {
    return paper.citationKey.trim().replace(/\s+/g, '');
  }

  const authors = normalizeAuthors(paper.authors, paper.creators);
  let authorPart = 'unknown';
  if (authors.length > 0) {
    const parsed = parseCreatorName(authors[0]!);
    authorPart = (parsed.lastName || parsed.fullName || 'author').toLowerCase();
  }
  authorPart = authorPart.replace(/[^a-z0-9]/gi, '');

  const yearPart = paper.year ? String(paper.year) : '';

  let titlePart = '';
  if (paper.title) {
    for (const word of paper.title.trim().split(/\s+/)) {
      const clean = word.replace(/[^a-z0-9]/gi, '').toLowerCase();
      if (clean && !STOPWORDS.has(clean)) {
        titlePart = clean;
        break;
      }
    }
  }

  const baseKey = `${authorPart || 'ref'}${yearPart}${titlePart || 'paper'}`;
  if (!existingKeys) return baseKey;

  const keySet = existingKeys instanceof Set ? existingKeys : new Set(existingKeys);
  if (!keySet.has(baseKey)) return baseKey;

  const letters = 'abcdefghijklmnopqrstuvwxyz';
  for (let i = 0; i < letters.length; i++) {
    const candidate = `${baseKey}${letters[i]}`;
    if (!keySet.has(candidate)) return candidate;
  }
  let counter = 2;
  while (keySet.has(`${baseKey}_${counter}`)) {
    counter++;
  }
  return `${baseKey}_${counter}`;
}

export const getPaperCitationKey = generateCitationKey;

export function formatInTextCitation(paper: ReaderDocument, pageNumber?: number): string {
  const authors = normalizeAuthors(paper.authors, paper.creators);
  let authorStr = 'Unknown';
  if (authors.length === 1) {
    const parts = authors[0]!.trim().split(/\s+/);
    authorStr = parts[parts.length - 1] || authors[0]!;
  } else if (authors.length === 2) {
    const p1 = authors[0]!.trim().split(/\s+/);
    const p2 = authors[1]!.trim().split(/\s+/);
    authorStr = `${p1[p1.length - 1]} & ${p2[p2.length - 1]}`;
  } else if (authors.length > 2) {
    const p1 = authors[0]!.trim().split(/\s+/);
    authorStr = `${p1[p1.length - 1]} et al.`;
  }
  const yearStr = paper.year ? String(paper.year) : 'n.d.';
  const pageStr = pageNumber ? `, p. ${pageNumber}` : '';
  return `(${authorStr}, ${yearStr}${pageStr})`;
}

export function formatAnnotationCitation(
  paper?: ReaderDocument | null,
  attachmentId?: string,
  pageNumber?: number,
  annotationId?: string,
): { label: string; url: string; markdown: string } {
  const creators = paper?.creators || [];
  const firstAuthor =
    creators[0]?.lastName ||
    creators[0]?.fullName?.split(' ').slice(-1)[0] ||
    (paper?.authors && paper.authors[0] ? paper.authors[0].split(' ').slice(-1)[0] : 'Unknown');
  const hasMultipleAuthors = creators.length > 1 || (paper?.authors && paper.authors.length > 1);
  const year = paper?.year || 'n.d.';
  const authorCitation = hasMultipleAuthors ? `${firstAuthor} et al., ${year}` : `${firstAuthor}, ${year}`;
  const pageStr = pageNumber ? `, p. ${pageNumber}` : '';
  const label = `(${authorCitation}${pageStr})`;

  const pageParam = pageNumber ? `page=${pageNumber}` : '';
  const annotParam = annotationId ? `annotation=${annotationId}` : '';
  const queryStr = [pageParam, annotParam].filter(Boolean).join('&');
  const qs = queryStr ? `?${queryStr}` : '';

  const url = attachmentId
    ? `flux://open-pdf/library/items/${attachmentId}${qs}`
    : `flux://open-pdf/library/items${qs}`;

  const markdown = `[${label}](${url})`;

  return { label, url, markdown };
}

export function getCleanStyleLabel(id: string, fullTitle?: string): string {
  if (fullTitle) {
    const clean = fullTitle.replace(/\s*\([^)]*\)/g, '').trim();
    if (clean.length <= 14) return clean;
    const firstWord = clean.split(/\s+/)[0];
    if (firstWord && firstWord.length <= 14) return firstWord;
  }
  const s = id.toLowerCase().trim();
  if (s.startsWith('apa')) return 'APA';
  if (s.startsWith('mla')) return 'MLA';
  if (s === 'ieee') return 'IEEE';
  if (s === 'bibtex') return 'BibTeX';
  if (s === 'ris') return 'RIS';
  const cleanId = id.toUpperCase();
  return cleanId.length <= 10 ? cleanId : id.slice(0, 10);
}

// ── Tags & Metadata ─────────────────────────────────────────────────────────

export function cleanSingleFrontendTag(raw: string): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const str = raw
    .replace(/<[^>]+>/g, '')
    .replace(/^[#"''`([{<•·*—\-\s]+/, '')
    .replace(/(?:\.{2,}|…|[.,;:—\-\s•·*])+$/, '')
    .trim();
  if (str.length < 2) return null;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function normalizeTags(
  paper: Partial<ReaderDocument> | null | undefined,
  maxTags?: number,
): string[] {
  if (!paper) return [];

  const raw: unknown[] = [
    ...(Array.isArray(paper.tags) ? paper.tags : []),
    ...(Array.isArray(paper.labels) ? paper.labels : []),
  ];

  const seen = new Set<string>();
  const result: string[] = [];
  for (const t of raw) {
    const s =
      typeof t === 'string'
        ? t
        : t && typeof t === 'object'
          ? (typeof (t as any).name === 'string'
              ? (t as any).name
              : typeof (t as any).tag === 'string'
                ? (t as any).tag
                : '')
          : '';
    if (!s) continue;
    const parts = s.split(/[,;\n\r|•·]|\s+[/]\s+/).map((p: string) => p.trim()).filter(Boolean);
    for (const part of parts) {
      const lower = part.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        result.push(part);
      }
    }
  }
  return typeof maxTags === 'number' && maxTags > 0 ? result.slice(0, maxTags) : result;
}

// ── Notes Normalization ──────────────────────────────────────────────────────

export interface NormalizedNote {
  id: string;
  title?: string;
  content: string;
  contentMd?: string;
  contentJson?: unknown;
  note?: string;
  createdAt?: string;
  updatedAt?: string;
}

export function normalizeNotes(
  notes?: Array<string | any | { id?: string; title?: string; content?: string; note?: string }> | null,
): NormalizedNote[] {
  if (!Array.isArray(notes)) return [];

  return notes.map((note, index) => {
    if (typeof note === 'string') {
      const contentHash = note.trim().slice(0, 32).replace(/[^a-z0-9]/gi, '').toLowerCase() || index.toString();
      const firstLine = note.trim().split(/\r?\n/).find((l) => l.trim().length > 0)?.trim() || 'Untitled Note';
      return {
        id: `local-${contentHash}`,
        title: firstLine.slice(0, 80),
        content: note,
        createdAt: new Date().toISOString(),
      };
    }

    const noteObj = note as any;
    const rawContent =
      noteObj.content ||
      noteObj.contentMd ||
      noteObj.note ||
      (typeof noteObj.contentJson === 'string' ? noteObj.contentJson : '') ||
      '';
    const cleanPreview = /<\/?[a-z][\s\S]*>/i.test(rawContent)
      ? rawContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      : rawContent;

    const firstLine =
      cleanPreview
        .split(/\r?\n/)
        .find((l: string) => l.trim().length > 0)
        ?.replace(/^#+\s*/, '')
        .replace(/^>\s*/, '')
        .trim() || '';

    const title =
      noteObj.title && noteObj.title.trim()
        ? noteObj.title.trim()
        : firstLine
          ? firstLine.slice(0, 80)
          : 'Untitled Note';

    return {
      id: noteObj.id || `note-${index}`,
      title,
      content: rawContent,
      createdAt: noteObj.createdAt || noteObj.dateAdded,
      updatedAt: noteObj.updatedAt || noteObj.dateModified,
    };
  });
}

export function formatAuditDate(dateStr?: string | Date | null): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString('en-US', {
      month: 'numeric',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  } catch {
    return '';
  }
}

// ── All Creator Roles & Schema Helpers ──────────────────────────────────────

export const ALL_CREATOR_TYPES: Record<string, string> = {
  artist: 'Artist',
  attorneyAgent: 'Attorney/Agent',
  author: 'Author',
  bookAuthor: 'Book Author',
  cartographer: 'Cartographer',
  castMember: 'Cast Member',
  chair: 'Chair',
  commenter: 'Commenter',
  composer: 'Composer',
  contributor: 'Contributor',
  cosponsor: 'Cosponsor',
  counsel: 'Counsel',
  creator: 'Creator',
  director: 'Director',
  editor: 'Editor',
  executiveProducer: 'Executive Producer',
  guest: 'Guest',
  host: 'Host',
  interviewee: 'Interview With',
  interviewer: 'Interviewer',
  inventor: 'Inventor',
  narrator: 'Narrator',
  organizer: 'Organizer',
  originalCreator: 'Original Creator',
  performer: 'Performer',
  podcaster: 'Podcaster',
  presenter: 'Presenter',
  producer: 'Producer',
  programmer: 'Programmer',
  reviewedAuthor: 'Reviewed Author',
  recipient: 'Recipient',
  scriptwriter: 'Scriptwriter',
  seriesEditor: 'Series Editor',
  sponsor: 'Sponsor',
  translator: 'Translator',
  wordsBy: 'Words By',
};

export function getPrimaryCreatorType(itemType?: string): string {
  switch (itemType) {
    case 'book':
    case 'bookSection':
      return 'author';
    case 'film':
    case 'videoRecording':
      return 'director';
    case 'interview':
      return 'interviewee';
    case 'patent':
      return 'inventor';
    case 'podcast':
      return 'podcaster';
    case 'computerProgram':
      return 'programmer';
    case 'radioBroadcast':
    case 'tvBroadcast':
      return 'producer';
    default:
      return 'author';
  }
}

// ── ArXiv Identifiers ────────────────────────────────────────────────────────

export function extractArxivId(input?: string | null): string | null {
  if (!input || typeof input !== 'string') return null;
  const clean = input.trim();
  const match =
    clean.match(/arxiv\.org\/(?:abs|pdf)\/(\d{4}\.\d{4,5}(?:v\d+)?)/i) ||
    clean.match(/arxiv\.(\d{4}\.\d{4,5}(?:v\d+)?)/i) ||
    clean.match(/\b(\d{4}\.\d{4,5}(?:v\d+)?)\b/);
  return match ? match[1] : null;
}

// ── Item Types Schema Definitions & Mappings ─────────────────────────────────

export const DEFAULT_BIBLIOGRAPHIC_FIELDS = [
  { field: 'title', label: 'Title', required: true },
  { field: 'publicationTitle', label: 'Publication' },
  { field: 'volume', label: 'Volume' },
  { field: 'issue', label: 'Issue' },
  { field: 'pages', label: 'Pages' },
  { field: 'date', label: 'Date' },
  { field: 'series', label: 'Series' },
  { field: 'seriesTitle', label: 'Series Title' },
  { field: 'seriesText', label: 'Series Text' },
  { field: 'journalAbbreviation', label: 'Journal Abbr' },
  { field: 'doi', label: 'DOI' },
  { field: 'url', label: 'URL' },
  { field: 'abstractNote', label: 'Abstract' },
  { field: 'extra', label: 'Extra' },
];

export const ITEM_TYPE_LABELS: Record<string, string> = {
  journalArticle: 'Journal Article',
  book: 'Book',
  bookSection: 'Book Section',
  conferencePaper: 'Conference Paper',
  thesis: 'Thesis',
  report: 'Report',
  preprint: 'Preprint',
  webpage: 'Web Page',
  document: 'Document',
  manuscript: 'Manuscript',
  patent: 'Patent',
  dataset: 'Dataset',
};

export const LIBRARY_ITEM_TYPES: Record<string, any> = {
  journalArticle: {
    itemType: 'journalArticle',
    label: 'Journal Article',
    category: 'academic',
    primaryCreatorType: 'author',
    creatorTypes: [
      { creatorType: 'author', label: 'Author', primary: true },
      { creatorType: 'contributor', label: 'Contributor' },
      { creatorType: 'editor', label: 'Editor' },
      { creatorType: 'translator', label: 'Translator' },
    ],
    fields: DEFAULT_BIBLIOGRAPHIC_FIELDS,
    isBibliographic: true,
  },
  book: {
    itemType: 'book',
    label: 'Book',
    category: 'books',
    primaryCreatorType: 'author',
    creatorTypes: [
      { creatorType: 'author', label: 'Author', primary: true },
      { creatorType: 'editor', label: 'Editor' },
      { creatorType: 'translator', label: 'Translator' },
      { creatorType: 'contributor', label: 'Contributor' },
    ],
    fields: DEFAULT_BIBLIOGRAPHIC_FIELDS,
    isBibliographic: true,
  },
  conferencePaper: {
    itemType: 'conferencePaper',
    label: 'Conference Paper',
    category: 'academic',
    primaryCreatorType: 'author',
    creatorTypes: [
      { creatorType: 'author', label: 'Author', primary: true },
      { creatorType: 'contributor', label: 'Contributor' },
      { creatorType: 'editor', label: 'Editor' },
    ],
    fields: DEFAULT_BIBLIOGRAPHIC_FIELDS,
    isBibliographic: true,
  },
  preprint: {
    itemType: 'preprint',
    label: 'Preprint',
    category: 'academic',
    primaryCreatorType: 'author',
    creatorTypes: [
      { creatorType: 'author', label: 'Author', primary: true },
      { creatorType: 'contributor', label: 'Contributor' },
    ],
    fields: DEFAULT_BIBLIOGRAPHIC_FIELDS,
    isBibliographic: true,
  },
};

export function getItemTypeDefinition(itemType?: string | null): any {
  if (!itemType) return null;
  if (LIBRARY_ITEM_TYPES[itemType]) return LIBRARY_ITEM_TYPES[itemType];

  const label = ITEM_TYPE_LABELS[itemType] || itemType.replace(/([A-Z])/g, ' $1').trim();
  const primaryRole = getPrimaryCreatorType(itemType);

  return {
    itemType,
    label,
    category: 'academic',
    primaryCreatorType: primaryRole,
    creatorTypes: [
      { creatorType: primaryRole, label: ALL_CREATOR_TYPES[primaryRole] || 'Author', primary: true },
      { creatorType: 'contributor', label: 'Contributor' },
      { creatorType: 'editor', label: 'Editor' },
      { creatorType: 'translator', label: 'Translator' },
    ],
    fields: DEFAULT_BIBLIOGRAPHIC_FIELDS,
    isBibliographic: true,
  };
}

export function mapRegistryItemTypes(value: unknown): any[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry: any) => {
    if (!entry || typeof entry !== 'object' || !entry.itemType) return [];
    return [
      {
        itemType: entry.itemType,
        label: entry.label || entry.itemType,
        category: entry.category || 'academic',
        primaryCreatorType: entry.primaryCreatorType || getPrimaryCreatorType(entry.itemType),
        creatorTypes: entry.creatorTypes || [
          { creatorType: 'author', label: 'Author', primary: true },
        ],
        fields: entry.fields || DEFAULT_BIBLIOGRAPHIC_FIELDS,
        isBibliographic: entry.isBibliographic !== false,
      },
    ];
  });
}

// ── Academic Text & Authors Formatting ──────────────────────────────────────

export function cleanAcademicText(text?: string | null): string {
  if (!text) return '';
  return text
    .replace(/(\b[A-Za-z0-9]+)\s*[-‐‑‒–—−]\s*([A-Za-z0-9]+\b)/g, '$1-$2')
    .replace(/\s+/g, ' ')
    .trim();
}

export function formatAcademicAuthors(authors: any, maxAuthors = 3): string {
  if (!authors) return '-';
  const rawList = normalizeAuthors(authors);
  if (!rawList || rawList.length === 0) return '-';

  const cleaned = rawList
    .map((name) => {
      const clean = cleanAcademicText(name);
      if (!clean) return '';
      if (clean.includes(',')) {
        const parsed = parseCreatorName(clean);
        return parsed.fullName || clean;
      }
      return clean;
    })
    .filter(Boolean);

  if (cleaned.length === 0) return '-';
  if (cleaned.length <= maxAuthors) return cleaned.join(', ');
  return `${cleaned.slice(0, maxAuthors).join(', ')} et al.`;
}

// ── Paper Title Normalization ────────────────────────────────────────────────

export function cleanPaperTitle(title?: string | null): string {
  if (!title || typeof title !== 'string') return '';
  let s = title.trim();

  // Fix PDF small-caps drop-cap gaps (e.g. "V ERY" -> "VERY", "D EEP" -> "DEEP")
  s = s.replace(/\b([A-Z])\s+([A-Z]{2,})\b/g, '$1$2');

  // Fix spaced hyphens (e.g. "Auto - Encoding" -> "Auto-Encoding")
  s = s.replace(/\b([A-Za-z0-9]+)\s+[-–—]\s+([A-Za-z0-9]+)\b/g, '$1-$2');

  // Fix single letter uppercase gaps: "B Y" -> "BY"
  s = s.replace(/\b([B-HJ-Z])\s+([A-Z])\b/g, '$1$2');

  // Collapse multiple spaces
  s = s.replace(/\s+/g, ' ');

  return s.trim();
}

// ── Standard Item Types (All 37 types flat) ──────────────────────────────────

export const ALL_ITEM_TYPES_FLAT: { value: string; label: string }[] = [
  { value: 'artwork', label: 'Artwork' },
  { value: 'audioRecording', label: 'Audio Recording' },
  { value: 'bill', label: 'Bill' },
  { value: 'blogPost', label: 'Blog Post' },
  { value: 'book', label: 'Book' },
  { value: 'bookSection', label: 'Book Section' },
  { value: 'case', label: 'Case' },
  { value: 'computerProgram', label: 'Software' },
  { value: 'conferencePaper', label: 'Conference Paper' },
  { value: 'dataset', label: 'Dataset' },
  { value: 'dictionaryEntry', label: 'Dictionary Entry' },
  { value: 'document', label: 'Document' },
  { value: 'email', label: 'E-mail' },
  { value: 'encyclopediaArticle', label: 'Encyclopedia Article' },
  { value: 'film', label: 'Film' },
  { value: 'forumPost', label: 'Forum Post' },
  { value: 'hearing', label: 'Hearing' },
  { value: 'instantMessage', label: 'Instant Message' },
  { value: 'interview', label: 'Interview' },
  { value: 'journalArticle', label: 'Journal Article' },
  { value: 'letter', label: 'Letter' },
  { value: 'magazineArticle', label: 'Magazine Article' },
  { value: 'manuscript', label: 'Manuscript' },
  { value: 'map', label: 'Map' },
  { value: 'newspaperArticle', label: 'Newspaper Article' },
  { value: 'patent', label: 'Patent' },
  { value: 'podcast', label: 'Podcast' },
  { value: 'preprint', label: 'Preprint' },
  { value: 'presentation', label: 'Presentation' },
  { value: 'radioBroadcast', label: 'Radio Broadcast' },
  { value: 'report', label: 'Report' },
  { value: 'standard', label: 'Standard' },
  { value: 'statute', label: 'Statute' },
  { value: 'thesis', label: 'Thesis' },
  { value: 'tvBroadcast', label: 'TV Broadcast' },
  { value: 'videoRecording', label: 'Video Recording' },
  { value: 'webpage', label: 'Web Page' },
];

// ── Extra Metadata Formatting & Sanitization ─────────────────────────────────

export function formatAndSanitizeExtraMetadata(
  rawExtraMetadata?: string | null,
  additionalExtraFields?: Record<string, unknown> | null,
  associatedPaperItem?: Partial<ReaderDocument> | null,
): string {
  let textContent = '';

  if (typeof rawExtraMetadata === 'string' && rawExtraMetadata.trim()) {
    const trimmed = rawExtraMetadata.trim();
    if (trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          const record = parsed as Record<string, unknown>;
          if (typeof record._rawExtra === 'string') {
            textContent = record._rawExtra.trim();
          } else {
            const customLines: string[] = [];
            for (const [key, value] of Object.entries(parsed)) {
              const normKey = key.toLowerCase().replace(/[-_\s]/g, '');
              if (value === null || value === undefined) continue;
              if (typeof value === 'object') continue;
              const strVal = String(value).trim();
              if (!strVal) continue;
              if (normKey === 'arxiv' || normKey === 'arxivid' || normKey === 'archiveid') {
                const cleanVal = strVal.replace(/^arxiv:\s*/i, '');
                customLines.push(`arXiv: ${cleanVal}`);
              } else {
                customLines.push(`${key}: ${strVal}`);
              }
            }
            textContent = customLines.join('\n');
          }
        }
      } catch {
        textContent = trimmed;
      }
    } else {
      textContent = trimmed;
    }
  }

  const paperTitle = associatedPaperItem?.title?.trim().toLowerCase();
  const paperUrl = associatedPaperItem?.url?.trim();
  const paperFileUrl = (associatedPaperItem as any)?.fileUrl?.trim();
  const paperOaUrl = (associatedPaperItem as any)?.openAccessPdfUrl?.trim();
  const paperCiteKey = associatedPaperItem?.citationKey?.trim().toLowerCase();
  const paperDoi = cleanDoi((associatedPaperItem as any)?.doi || (associatedPaperItem as any)?.DOI);
  const paperPmid = (associatedPaperItem as any)?.pmid?.trim();
  const paperPmcid = (associatedPaperItem as any)?.pmcid?.trim();
  const paperIsbn = (associatedPaperItem as any)?.isbn?.trim();
  const paperIssn = (associatedPaperItem as any)?.issn?.trim();
  const isPreprint = associatedPaperItem?.itemType === 'preprint';
  const paperArchiveId = (
    (associatedPaperItem as any)?.archiveId ||
    (associatedPaperItem as any)?.archiveID ||
    (associatedPaperItem as any)?.arxivId
  )?.trim();

  const lines = textContent ? textContent.split(/\r?\n/) : [];
  const sanitizedLines: string[] = [];
  let hasArxivLine = false;

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    const titleMatch = trimmedLine.match(/^title:\s*(.+)$/i);
    if (titleMatch) {
      const lineTitle = titleMatch[1].trim().toLowerCase();
      if (!paperTitle || lineTitle === paperTitle) continue;
    }

    const citeKeyMatch = trimmedLine.match(/^(?:citation\s*key|cite\s*key|citekey):\s*(.+)$/i);
    if (citeKeyMatch) {
      const lineKey = citeKeyMatch[1].trim().toLowerCase();
      if (!paperCiteKey || lineKey === paperCiteKey) continue;
    }

    if (/^open\s*access:?/i.test(trimmedLine)) continue;
    if (trimmedLine === paperOaUrl || trimmedLine === paperFileUrl || trimmedLine === paperUrl) continue;

    const urlMatch = trimmedLine.match(/^url:\s*(https?:\/\/.+)$/i);
    if (urlMatch && paperUrl) continue;

    const doiMatch = trimmedLine.match(/^doi:\s*(.+)$/i);
    if (doiMatch && paperDoi) {
      const lineDoi = cleanDoi(doiMatch[1]);
      if (!lineDoi || lineDoi.toLowerCase() === paperDoi.toLowerCase()) continue;
    }

    const pmidMatch = trimmedLine.match(/^(?:pmid|pubmed\s*id):\s*(.+)$/i);
    if (pmidMatch && paperPmid) continue;

    const pmcidMatch = trimmedLine.match(/^(?:pmcid|pmc):\s*(.+)$/i);
    if (pmcidMatch && paperPmcid) continue;

    const isbnMatch = trimmedLine.match(/^isbn:\s*(.+)$/i);
    if (isbnMatch && paperIsbn) continue;

    const issnMatch = trimmedLine.match(/^issn:\s*(.+)$/i);
    if (issnMatch && paperIssn) continue;

    if (/^comments?:\s*/i.test(trimmedLine)) continue;
    if (/^tl;?dr:\s*/i.test(trimmedLine)) continue;
    if (/^(?:number\s*of\s*pages|num\s*pages|page\s*count|total\s*pages):\s*/i.test(trimmedLine)) continue;

    const genericKvMatch = trimmedLine.match(/^([a-zA-Z0-9_\s]+):\s*(.+)$/);
    if (genericKvMatch) {
      const rawKey = genericKvMatch[1].trim();
      const normKey = rawKey.toLowerCase().replace(/[\s_-]+/g, '');
      const dedicatedFormFields = new Set([
        'edition', 'eventplace', 'conferencename', 'proceedingstitle',
        'booktitle', 'websitetitle', 'websitetype', 'blogtitle',
        'university', 'institution', 'repository', 'reportnumber',
        'reporttype', 'thesistype', 'patentnumber', 'issuingauthority',
        'assignee', 'numpages', 'numberofpages', 'pages', 'volume',
        'issue', 'section', 'publisher', 'place', 'series', 'seriestitle',
        'seriesnumber', 'seriestext', 'journalabbr', 'journalabbreviation',
        'publicationtitle', 'date', 'publicationdate', 'accessedat', 'accessdate',
      ]);
      if (dedicatedFormFields.has(normKey)) continue;
    }

    if (/^arxiv:\s*/i.test(trimmedLine)) {
      if (isPreprint && paperArchiveId) continue;
      hasArxivLine = true;
      sanitizedLines.push(trimmedLine);
      continue;
    }

    sanitizedLines.push(trimmedLine);
  }

  if (!hasArxivLine && !isPreprint) {
    const rawArxiv =
      (associatedPaperItem as any)?.arxivId ||
      (typeof additionalExtraFields?.arxivId === 'string' ? additionalExtraFields.arxivId : undefined) ||
      (typeof additionalExtraFields?.archiveId === 'string' ? additionalExtraFields.archiveId : undefined);

    if (rawArxiv) {
      const cleanArxiv = rawArxiv
        .replace(/^arxiv:\s*/i, '')
        .replace(/\s*\[.*?\]\s*$/, '')
        .replace(/v\d+$/i, '')
        .trim();
      sanitizedLines.unshift(`arXiv: ${cleanArxiv}`);
    }
  }

  const structuredKeyValLines: string[] = [];
  const freeTextNotesLines: string[] = [];

  for (const line of sanitizedLines) {
    if (/^[a-zA-Z_][a-zA-Z0-9_\-]*:\s*.+$/.test(line)) {
      structuredKeyValLines.push(line);
    } else {
      freeTextNotesLines.push(line);
    }
  }

  return [...structuredKeyValLines, ...freeTextNotesLines].join('\n');
}

// ── Retraction Status & Info Utilities (Self-contained in reader) ────────────

export interface RetractionInfo {
  nature?: string;
  reason?: string;
  formattedReason?: string;
  title: string;
  noticeUrl?: string;
  date?: string;
}

export function isItemRetracted(item: unknown): boolean {
  if (!item || typeof item !== 'object') return false;
  const i = item as Record<string, any>;
  return Boolean(
    i.isRetracted || i.retractionStatus === 'retracted' || i.is_retracted,
  );
}

export function formatRetractionReason(raw?: string, nature?: string): string {
  if (!raw || typeof raw !== 'string' || !raw.trim()) {
    if (nature === 'expression_of_concern') {
      return 'An expression of concern has been published regarding the integrity of this article.';
    }
    if (nature === 'correction') {
      return 'A publisher correction notice has been issued for this publication.';
    }
    return 'This publication has been flagged as retracted or unreliable by academic integrity audits.';
  }
  let text = raw.replace(/\r?\n+/g, ' ').trim();
  text = text.replace(/\bauthors\s+inability\b/gi, "authors' inability");
  text = text.replace(/\bauthor\s+inability\b/gi, "author's inability");
  if (text.length > 0) {
    text = text.charAt(0).toUpperCase() + text.slice(1);
  }
  if (text.length > 5 && !/[.!?]$/.test(text)) {
    text += '.';
  }
  return text;
}

export function getRetractionInfo(item: unknown): RetractionInfo {
  if (!item || typeof item !== 'object') {
    return { title: 'Retracted Item' };
  }
  const i = item as Record<string, any>;
  const details =
    i.retractionDetails && typeof i.retractionDetails === 'object'
      ? (i.retractionDetails as Record<string, any>)
      : null;

  const nature =
    i.retractionNature ||
    details?.nature ||
    details?.noticeType ||
    details?.retractionNature ||
    (isItemRetracted(item) ? 'retraction' : undefined);

  const rawReason =
    i.retractionReason ||
    details?.reason ||
    details?.retractionReason ||
    details?.notes;

  const formattedReason = formatRetractionReason(rawReason, nature);

  const noticeUrl =
    i.noticeUrl ||
    details?.noticeUrl ||
    details?.url ||
    (i.doi ? `https://doi.org/${i.doi}` : undefined);

  const date =
    i.retractionDate ||
    details?.retractionDate ||
    details?.date ||
    details?.checkedAt;

  return {
    nature,
    reason: rawReason,
    formattedReason,
    title: i.title || 'Retracted Publication',
    noticeUrl,
    date: date ? String(date).slice(0, 10) : undefined,
  };
}



