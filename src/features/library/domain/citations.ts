/**
 * Pure Domain Model: Citations & BibTeX Generation
 * 100% Pure TypeScript - 0% React, 0% DOM dependencies
 */

import type { Item } from '../types/library.types';
import { normalizeAuthors, parseCreatorName } from './creators';

const STOPWORDS: ReadonlySet<string> = new Set([
  'a', 'an', 'the', 'on', 'in', 'for', 'of', 'and', 'with', 'via', 'to', 'is', 'are', 'at', 'by',
]);

/**
 * Generates a standard BibTeX citation key.
 * Format: LastName + Year + FirstSignificantTitleWord (e.g. "vaswani2017attention").
 */
export function generateCitationKey(paper?: Partial<Item> | null): string {
  if (!paper) return 'refpaper';
  if (paper.citationKey && paper.citationKey.trim()) {
    return paper.citationKey.trim().replace(/\s+/g, '');
  }

  const authors = normalizeAuthors(paper.authors, (paper as any)?.creators);
  let authorPart = 'unknown';
  if (authors.length > 0) {
    const parsed = parseCreatorName(authors[0]);
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

  return `${authorPart || 'ref'}${yearPart}${titlePart || 'paper'}`;
}

export const getPaperCitationKey = generateCitationKey;

/**
 * Converts an academic Item into a standard BibTeX string.
 */
export function toBibTeXEntry(item: Partial<Item>): string {
  const citeKey = generateCitationKey(item);
  const authors = normalizeAuthors(item.authors, (item as any)?.creators);
  const authorBibtex = authors.join(' and ');

  const typeMap: Record<string, string> = {
    journalArticle: 'article',
    conferencePaper: 'inproceedings',
    book: 'book',
    bookSection: 'incollection',
    thesis: 'phdthesis',
    report: 'techreport',
    preprint: 'misc',
  };

  const entryType = typeMap[item.itemType || ''] || 'article';
  const fields: Array<[string, string | number | undefined]> = [
    ['author', authorBibtex || undefined],
    ['title', item.title],
    ['journal', item.journal || item.publicationTitle],
    ['booktitle', item.bookTitle || item.proceedingsTitle],
    ['year', item.year != null ? Number(item.year) : undefined],
    ['volume', item.volume],
    ['number', item.issue],
    ['pages', item.pages],
    ['publisher', item.publisher],
    ['doi', item.doi],
    ['url', item.url],
    ['abstract', item.abstract],
  ];

  const fieldLines = fields
    .filter(([, val]) => val !== undefined && val !== null && String(val).trim() !== '')
    .map(([key, val]) => `  ${key} = {${String(val).trim()}}`)
    .join(',\n');

  return `@${entryType}{${citeKey},\n${fieldLines}\n}`;
}
