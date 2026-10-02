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
export function generateCitationKey(
  paper?: Partial<Item> | null,
  existingKeys?: Set<string> | string[],
): string {
  if (!paper) return 'refpaper';
  if (paper.citationKey && paper.citationKey.trim()) {
    return paper.citationKey.trim().replace(/\s+/g, '');
  }

  const authors = normalizeAuthors(paper.authors, paper.creators);
  let authorPart = 'unknown';
  if (authors.length > 0) {
    const parsed = parseCreatorName(authors[0]);
    authorPart = (parsed.lastName || parsed.fullName || 'author').toLowerCase();
  }
  authorPart = authorPart.replace(/[^a-z0-9]/gi, '');

  const yearPart = paper.year
    ? String(paper.year)
    : (paper.publicationDate || paper.date || '').match(/\b(1[7-9]\d{2}|20\d{2})\b/)?.[1] || '';

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

  // Better BibTeX disambiguation: append 'a', 'b', 'c', ...
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

/**
 * Converts an academic Item into a standard BibTeX string.
 */
export function toBibTeXEntry(item: Partial<Item>): string {
  const citeKey = generateCitationKey(item);
  let authorBibtex = '';
  if (Array.isArray(item.creators) && item.creators.length > 0) {
    authorBibtex = item.creators
      .map((c) => {
        if (c.fieldMode === 1) {
          return `{${c.fullName || c.name}}`;
        }
        if (c.lastName && c.firstName) {
          return `${c.lastName}, ${c.firstName}`;
        }
        return c.fullName || c.name || '';
      })
      .filter(Boolean)
      .join(' and ');
  } else {
    const authors = normalizeAuthors(item.authors, item.creators);
    authorBibtex = authors
      .map((a) => {
        const parsed = parseCreatorName(a);
        if (parsed.isInstitution) return `{${parsed.fullName}}`;
        if (parsed.lastName && parsed.firstName) return `${parsed.lastName}, ${parsed.firstName}`;
        return parsed.fullName;
      })
      .filter(Boolean)
      .join(' and ');
  }

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
  const resolvedYear =
    item.year != null
      ? Number(item.year)
      : (item.publicationDate || item.date || '').match(/\b(1[7-9]\d{2}|20\d{2})\b/)?.[1] ||
        undefined;

  const fields: Array<[string, string | number | undefined]> = [
    ['author', authorBibtex || undefined],
    ['title', item.title],
    ['journal', item.journal || item.publicationTitle],
    ['booktitle', item.bookTitle || item.proceedingsTitle],
    ['year', resolvedYear],
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

/**
 * Normalizes full academic journal or style names into clean, compact
 * toolbar button labels (<= 14 characters) that will not break container layout.
 */
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
