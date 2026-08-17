import type { Paper, Collection, Note, ReferenceData } from '../types/library.types';
import { fetchReferenceByDoi, searchReferences } from '../services/reference.service';

// ── 1. ID & Key Resolution ───────────────────────────────────────────────────

/**
 * Extracts a normalized ID from any entity that might carry MongoDB `_id` or PostgreSQL `id`.
 */
export function getLibraryEntityId(
  entity?: { id?: string; _id?: string } | null | undefined
): string {
  if (!entity) return '';
  return entity.id || entity._id || '';
}

/**
 * Extracts the primary PDF or reading file URL from a Paper object.
 */
export function getPaperFileUrl(paper?: Partial<Paper> | null | undefined): string {
  if (!paper) return '';
  return paper.fileUrl || paper.primaryFile?.url || '';
}

/**
 * Generates or extracts a standardized citation key for BibTeX/LaTeX (e.g. "vaswani2017attention").
 */
export function getPaperCitationKey(paper: Partial<Paper>): string {
  if (paper.citationKey && paper.citationKey.trim().length > 0) {
    return paper.citationKey.trim();
  }

  const firstAuthor = paper.authors?.[0];
  const authorKey = firstAuthor
    ? firstAuthor.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12)
    : 'ref';

  const yearKey = paper.year ? String(paper.year).slice(-4) : '2024';

  const titleWord = paper.title
    ? paper.title
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .find((w: string) => !['a', 'an', 'the', 'on', 'in', 'for', 'of', 'and', 'with', 'via'].includes(w)) || 'paper'
    : 'paper';

  return `${authorKey}${yearKey}${titleWord}`;
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
export function normalizeNotes(notes?: Array<string | Note | { _id?: string; id?: string; content?: string }> | null): NormalizedNote[] {
  if (!Array.isArray(notes)) return [];

  return notes.map((note, index) => {
    if (typeof note === 'string') {
      return {
        id: `note-${index}`,
        content: note,
        createdAt: new Date().toISOString(),
      };
    }

    return {
      id: getLibraryEntityId(note) || `note-${index}`,
      content: note.content || '',
      createdAt: (note as Note).createdAt || new Date().toISOString(),
      updatedAt: (note as Note).updatedAt,
    };
  });
}

// ── 3. DOI & Citation Helpers ────────────────────────────────────────────────

export function cleanDoi(doi?: string | null): string {
  if (!doi) return '';
  return doi
    .trim()
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '')
    .replace(/^doi:\s*/i, '')
    .trim();
}

export function buildBibtexEntry(paper: Partial<Paper> | Partial<ReferenceData>): string {
  const citeKey = getPaperCitationKey(paper as Partial<Paper>);
  const title = paper.title || 'Untitled';
  const authors = Array.isArray(paper.authors) ? paper.authors.join(' and ') : '';
  const journal = (paper as any).journal || (paper as any).publisher || (paper as any).publicationTitle || '';
  const year = paper.year || '';
  const doi = paper.doi ? cleanDoi(paper.doi) : '';

  return `@article{${citeKey},
  title = {${title}},
  author = {${authors}},
  journal = {${journal}},
  year = {${year}},
  doi = {${doi}}
}`;
}

// ── 4. Library Filter Engine ─────────────────────────────────────────────────

export interface LibraryFilterOptions {
  searchQuery?: string;
  collectionId?: string | null;
  selectedTags?: string[];
  fromYear?: number;
  toYear?: number;
  itemType?: string;
  isFavorite?: boolean;
  hasAttachment?: boolean;
}

export interface SortOptions {
  field: 'title' | 'year' | 'authors' | 'journal' | 'createdAt' | string;
  direction: 'asc' | 'desc';
}

export class LibraryFilterEngine {
  static filterBySearch(papers: Paper[], query: string): Paper[] {
    if (!query || !query.trim()) return papers;
    const q = query.toLowerCase().trim();

    return papers.filter((paper) => {
      const p = paper as any;
      const inTitle = paper.title?.toLowerCase().includes(q) ?? false;
      const inAuthors = paper.authors?.some((a) => a.toLowerCase().includes(q)) ?? false;
      const inAbstract = paper.abstract?.toLowerCase().includes(q) ?? false;
      const inJournal = (paper.journal || paper.publicationTitle || paper.publisher)?.toLowerCase().includes(q) ?? false;
      const inDoi = paper.doi?.toLowerCase().includes(q) ?? false;
      const rawTags = p.tags || p.keywords || p.labels || [];
      const inTags = rawTags.some((t: any) =>
        (typeof t === 'string' ? t : t.name || '').toLowerCase().includes(q)
      );

      return inTitle || inAuthors || inAbstract || inJournal || inDoi || inTags;
    });
  }

  static filter(papers: Paper[], options: LibraryFilterOptions): Paper[] {
    const { searchQuery, collectionId, selectedTags, fromYear, toYear, itemType, isFavorite, hasAttachment } = options;

    let result = papers;

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
        const rawTags = p.tags || p.keywords || p.labels || [];
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

      // Favorite
      if (isFavorite) {
        if (!paper.isFavorite && !p.starred) return false;
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

  static sort(papers: Paper[], options: SortOptions): Paper[] {
    const { field, direction } = options;
    const modifier = direction === 'desc' ? -1 : 1;

    return [...papers].sort((a, b) => {
      if (field === 'year') {
        const yA = typeof a.year === 'number' ? a.year : parseInt(String(a.year || 0), 10);
        const yB = typeof b.year === 'number' ? b.year : parseInt(String(b.year || 0), 10);
        return (yA - yB) * modifier;
      }

      if (field === 'title') {
        return (a.title || '').localeCompare(b.title || '') * modifier;
      }

      if (field === 'authors') {
        const a1 = a.authors?.[0] || '';
        const b1 = b.authors?.[0] || '';
        return a1.localeCompare(b1) * modifier;
      }

      return 0;
    });
  }

  static isDuplicate(paperA: Paper, paperB: Paper): boolean {
    if (getLibraryEntityId(paperA) === getLibraryEntityId(paperB)) return false;

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

  static findDuplicates(papers: Paper[]): Array<{ original: Paper; duplicates: Paper[] }> {
    const results: Array<{ original: Paper; duplicates: Paper[] }> = [];
    const visited = new Set<string>();

    for (let i = 0; i < papers.length; i++) {
      const current = papers[i];
      const currentId = getLibraryEntityId(current);
      if (visited.has(currentId)) continue;

      const dupes: Paper[] = [];
      for (let j = i + 1; j < papers.length; j++) {
        const other = papers[j];
        const otherId = getLibraryEntityId(other);
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

export function filterPapers(
  papers: Paper[],
  query: string = '',
  collectionId: string | null = null,
  activeTag: string | null = null
): Paper[] {
  return LibraryFilterEngine.filter(papers, {
    searchQuery: query,
    collectionId: collectionId,
    selectedTags: activeTag ? [activeTag] : undefined,
  });
}

export function isPaperInCollection(paper: Paper, collectionId: string): boolean {
  if (!collectionId) return true;

  if (paper.collectionId === collectionId) return true;

  const p = paper as any;
  if (Array.isArray(p.collections)) {
    return p.collections.some((c: any) => {
      if (typeof c === 'string') return c === collectionId;
      return c.id === collectionId || c._id === collectionId;
    });
  }

  if (Array.isArray(p.collectionIds)) {
    return p.collectionIds.includes(collectionId);
  }

  return false;
}

export function getUniqueTags(papers: Paper[]): string[] {
  const tagSet = new Set<string>();
  for (const paper of papers) {
    const p = paper as any;
    const rawTags = p.tags || p.keywords || p.labels || [];
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

export function generateCitationKey(paper: Paper): string {
  if (paper.citationKey && paper.citationKey.trim()) {
    return paper.citationKey.trim().replace(/\s+/g, '');
  }

  let authorPart = 'unknown';
  if (paper.authors && paper.authors.length > 0) {
    const firstAuthor = paper.authors[0].trim();
    const parts = firstAuthor.split(/\s+/);
    if (parts.length > 0) {
      authorPart = parts[parts.length - 1].toLowerCase();
    }
  }
  authorPart = authorPart.replace(/[^a-z0-9]/gi, '');

  const yearPart = paper.year ? String(paper.year) : '';

  let titlePart = '';
  if (paper.title) {
    const titleWords = paper.title.trim().split(/\s+/);
    for (const word of titleWords) {
      const cleanWord = word.replace(/[^a-z0-9]/gi, '').toLowerCase();
      if (cleanWord) {
        titlePart = cleanWord;
        break;
      }
    }
  }

  return `${authorPart}${yearPart}${titlePart}` || `item${getLibraryEntityId(paper) || 'ref'}`;
}

export function getBibTeXEntryType(paper: Partial<Paper>): string {
  const itemType = (paper.itemType || (paper as any).type || '').toLowerCase();
  switch (itemType) {
    case 'book':
    case 'booksection':
      return 'book';
    case 'conferencepaper':
    case 'proceedings':
    case 'inproceedings':
      return 'inproceedings';
    case 'thesis':
    case 'phdthesis':
    case 'mastersthesis':
      return 'phdthesis';
    case 'techreport':
    case 'report':
      return 'techreport';
    case 'webpage':
    case 'website':
    case 'dataset':
    case 'software':
    case 'misc':
      return 'misc';
    case 'journalarticle':
    case 'article':
    case 'preprint':
    default:
      if (itemType && !['journalarticle', 'article', 'preprint'].includes(itemType) && !paper.journal && !paper.publicationTitle) {
        return 'misc';
      }
      return 'article';
  }
}

export function escapeLatexChars(text: string): string {
  if (!text) return '';
  return text
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/&/g, '\\&')
    .replace(/%/g, '\\%')
    .replace(/\$/g, '\\$')
    .replace(/#/g, '\\#')
    .replace(/_/g, '\\_')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/\^/g, '\\textasciicircum{}');
}

export function unescapeLatexChars(text: string): string {
  if (!text) return '';
  return text
    .replace(/\\&/g, '&')
    .replace(/\\%/g, '%')
    .replace(/\\\$/g, '$')
    .replace(/\\#/g, '#')
    .replace(/\\_/g, '_')
    .replace(/\\\{/g, '{')
    .replace(/\\\}/g, '}')
    .replace(/\\textasciitilde\{\}/g, '~')
    .replace(/\\textasciicircum\{\}/g, '^')
    .replace(/\\textbackslash\{\}/g, '\\');
}

export function convertToBibTeX(paper: Paper): string {
  const entryType = getBibTeXEntryType(paper);
  const citationKey = generateCitationKey(paper);

  const fields: [string, string | undefined][] = [
    ['title', paper.title ? `{${escapeLatexChars(paper.title)}}` : undefined],
    ['author', paper.authors && paper.authors.length > 0 ? `{${paper.authors.map(escapeLatexChars).join(' and ')}}` : undefined],
    ['journal', paper.journal || paper.publicationTitle ? `{${escapeLatexChars(paper.journal || paper.publicationTitle || '')}}` : undefined],
    ['year', paper.year ? `{${paper.year}}` : undefined],
    ['volume', paper.volume ? `{${paper.volume}}` : undefined],
    ['number', paper.issue ? `{${paper.issue}}` : undefined],
    ['pages', paper.pages ? `{${paper.pages}}` : undefined],
    ['publisher', paper.publisher ? `{${escapeLatexChars(paper.publisher)}}` : undefined],
    ['doi', paper.doi ? `{${paper.doi}}` : undefined],
    ['url', paper.url ? `{${paper.url}}` : undefined],
    ['abstract', paper.abstract ? `{${escapeLatexChars(paper.abstract)}}` : undefined],
    ['issn', paper.issn ? `{${paper.issn}}` : undefined],
    ['isbn', paper.isbn ? `{${paper.isbn}}` : undefined],
  ];

  const fieldLines = fields
    .filter(([, val]) => val !== undefined && val !== '{}')
    .map(([key, val]) => `  ${key} = ${val}`)
    .join(',\n');

  return `@${entryType}{${citationKey},\n${fieldLines}\n}`;
}

function parseSingleBibTeXEntry(entryBlock: string): Partial<Paper> | null {
  const typeKeyMatch = entryBlock.match(/@(\w+)\s*\{\s*([^,]+),/);
  if (!typeKeyMatch) return null;

  const result: Partial<Paper> = {
    itemType: typeKeyMatch[1].toLowerCase(),
    citationKey: typeKeyMatch[2].trim(),
  };

  const fieldRegex = /(\w+)\s*=\s*(?:\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}|"([^"]*)"|(\d+))/g;
  let match: RegExpExecArray | null;

  while ((match = fieldRegex.exec(entryBlock)) !== null) {
    const key = match[1].toLowerCase();
    const rawVal = match[2] ?? match[3] ?? match[4] ?? '';
    const val = unescapeLatexChars(rawVal.trim());

    switch (key) {
      case 'title':
        result.title = val;
        break;
      case 'author':
        result.authors = val.split(/\s+and\s+/i).map((a) => a.trim()).filter(Boolean);
        break;
      case 'journal':
      case 'journaltitle':
      case 'booktitle':
        result.journal = val;
        result.publicationTitle = val;
        break;
      case 'year':
      case 'date':
        result.year = parseInt(val, 10) || val;
        break;
      case 'volume':
        result.volume = val;
        break;
      case 'number':
      case 'issue':
        result.issue = val;
        break;
      case 'pages':
        result.pages = val;
        break;
      case 'publisher':
        result.publisher = val;
        break;
      case 'doi':
        result.doi = cleanDoi(val);
        break;
      case 'url':
        result.url = val;
        break;
      case 'abstract':
        result.abstract = val;
        break;
      case 'issn':
        result.issn = val;
        break;
      case 'isbn':
        result.isbn = val;
        break;
    }
  }

  return result;
}

export function parseBibTeX(bibtexString: string): Partial<Paper>[] {
  if (!bibtexString || !bibtexString.trim()) return [];

  const rawEntries = bibtexString.split(/(?=@\w+\s*\{)/g);
  const results: Partial<Paper>[] = [];

  for (const raw of rawEntries) {
    if (raw.trim().startsWith('@')) {
      const parsed = parseSingleBibTeXEntry(raw);
      if (parsed) results.push(parsed);
    }
  }

  return results;
}

export function downloadBibTeXFile(paper: Paper, filename?: string): void {
  const content = convertToBibTeX(paper);
  const name = filename || `${generateCitationKey(paper)}.bib`;
  const blob = new Blob([content], { type: 'application/x-bibtex;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export class BibtexEngine {
  static convert(paper: Paper): string {
    return convertToBibTeX(paper);
  }
  static parse(bibtexString: string): Partial<Paper>[] {
    return parseBibTeX(bibtexString);
  }
  static download(paper: Paper, filename?: string): void {
    downloadBibTeXFile(paper, filename);
  }
}

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

export const DOI_REGEX = /\b(10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+)\b/;
export const ARXIV_REGEX = /\b(?:arXiv:\s*)?(\d{4}\.\d{4,5}(?:v\d+)?)\b/i;

export function extractDoiFromText(text: string): string | null {
  if (!text) return null;
  const match = text.match(DOI_REGEX);
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
  const metadata: PdfMetadata = {
    title: file.name.replace(/\.pdf$/i, '').replace(/[-_]/g, ' '),
    extraFields: {},
  };

  const filenameDoi = extractDoiFromText(file.name);
  if (filenameDoi) {
    metadata.doi = filenameDoi;
    try {
      const enriched = await enrichPaperWithCrossref(filenameDoi);
      return { ...metadata, ...enriched };
    } catch {
      return metadata;
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
  } catch (err) {
    console.warn('Crossref enrichment failed:', err);
    return {};
  }
}
