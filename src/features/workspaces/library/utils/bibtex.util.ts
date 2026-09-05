import type { Paper, CatalogItem } from '../types/library.types';
import { normalizeAuthors, getPaperCitationKey, cleanDoi } from './library.util';

// ── BibTeX Citation Engine ────────────────────────────────────────────────────

/**
 * Generates a BibTeX-standard citation key.
 * Format: LastName + Year + FirstSignificantTitleWord (e.g. "he2016deep").
 */
export function generateCitationKey(paper: Partial<Paper> | CatalogItem): string {
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

  const STOPWORDS = new Set(['a','an','the','on','in','for','of','and','with','via','to','is','are']);
  let titlePart = '';
  if (paper.title) {
    for (const word of paper.title.trim().split(/\s+/)) {
      const clean = word.replace(/[^a-z0-9]/gi, '').toLowerCase();
      if (clean && !STOPWORDS.has(clean)) { titlePart = clean; break; }
    }
  }

  return `${authorPart || 'ref'}${yearPart}${titlePart || 'paper'}`;
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

export function convertToBibTeX(paper: CatalogItem): string {
  const entryType = getBibTeXEntryType(paper);
  const citationKey = generateCitationKey(paper);
  const authors = normalizeAuthors(paper.authors, (paper as any)?.creators);

  const fields: [string, string | undefined][] = [
    ['title', paper.title ? `{${escapeLatexChars(paper.title)}}` : undefined],
    ['author', authors.length > 0 ? `{${authors.map(escapeLatexChars).join(' and ')}}` : undefined],
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
      case 'title': result.title = val; break;
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
      case 'date': result.year = parseInt(val, 10) || val; break;
      case 'volume': result.volume = val; break;
      case 'number':
      case 'issue': result.issue = val; break;
      case 'pages': result.pages = val; break;
      case 'publisher': result.publisher = val; break;
      case 'doi': result.doi = cleanDoi(val); break;
      case 'url': result.url = val; break;
      case 'abstract': result.abstract = val; break;
      case 'issn': result.issn = val; break;
      case 'isbn': result.isbn = val; break;
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

export function downloadBibTeXFile(paper: CatalogItem, filename?: string): void {
  const content = convertToBibTeX(paper);
  const name = filename || `${getPaperCitationKey(paper)}.bib`;
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
  static convert(paper: CatalogItem): string {
    return convertToBibTeX(paper);
  }
  static parse(bibtexString: string): Partial<Paper>[] {
    return parseBibTeX(bibtexString);
  }
  static download(paper: CatalogItem, filename?: string): void {
    downloadBibTeXFile(paper, filename);
  }
}