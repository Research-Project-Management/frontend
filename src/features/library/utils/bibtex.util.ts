import type { Item } from '../types/library.types';
import { normalizeAuthors } from './author-doi.util';

// ── BibTeX Citation Key Engine ────────────────────────────────────────────────

const STOPWORDS: ReadonlySet<string> = new Set([
  'a', 'an', 'the', 'on', 'in', 'for', 'of', 'and', 'with', 'via', 'to', 'is', 'are',
]);

/**
 * Generates a BibTeX-standard citation key.
 * Format: LastName + Year + FirstSignificantTitleWord (e.g. "he2016deep").
 */
export function generateCitationKey(paper?: Partial<Item> | null): string {
  if (!paper) return 'refpaper';
  if (paper.citationKey && paper.citationKey.trim()) {
    return paper.citationKey.trim().replace(/\s+/g, '');
  }

  const authors = normalizeAuthors(paper.authors, (paper as any)?.creators);
  let authorPart = 'unknown';
  if (authors.length > 0) {
    const firstAuthor = authors[0].trim();
    const parts = firstAuthor.split(/\s+/);
    authorPart = (parts[parts.length - 1] || firstAuthor).toLowerCase();
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

  return `${authorPart || 'ref'}${yearPart}${titlePart || 'paper'}`;
}

export const getPaperCitationKey = generateCitationKey;