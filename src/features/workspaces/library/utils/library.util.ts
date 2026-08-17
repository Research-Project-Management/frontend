import type { Paper, Collection, Note, ReferenceData } from '../types/library.types';

// ── ID & Key Resolution ───────────────────────────────────────────────────────

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
        .find((w) => !['a', 'an', 'the', 'on', 'in', 'for', 'of', 'and', 'with', 'via'].includes(w)) || 'paper'
    : 'paper';

  return `${authorKey}${yearKey}${titleWord}`;
}

// ── Notes Normalization ───────────────────────────────────────────────────────

export interface NormalizedNote {
  id: string;
  content: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Normalizes raw notes array (which may contain legacy strings or Note objects) into strongly-typed Note objects.
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

// ── DOI & Citation Utilities ──────────────────────────────────────────────────

/**
 * Cleans and standardizes a DOI string (removes `https://doi.org/`, `doi:`, or trailing spaces).
 */
export function cleanDoi(doi?: string | null): string {
  if (!doi) return '';
  return doi
    .trim()
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '')
    .replace(/^doi:\s*/i, '')
    .trim();
}

/**
 * Builds a standardized BibTeX string from paper metadata.
 */
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
