/**
 * Attachment File Renamer Utility (Frontend - Zotero 7 Official Standard)
 *
 * Implements Zotero 7 standard pattern-based attachment file renaming based on
 * parent item metadata (FirstCreator, Creators, Year, Title, PublicationTitle, etc.).
 * Supports official Zotero 7 template variables, modifiers (suffix, prefix, truncate, join),
 * and live previews.
 *
 * Official Zotero 7 Reference:
 * Default template: {{ firstCreator suffix=" - " }}{{ year suffix=" - " }}{{ title truncate="100" }}
 */

import type { Item } from '../types/library.types';

export interface RenamerContributor {
  creatorType?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  name?: string | null;
  orderIndex?: number | null;
}

/**
 * Official Zotero 7 Default Renaming Template.
 * @see https://www.zotero.org/support/file_renaming
 */
export const DEFAULT_RENAME_PATTERN =
  '{{ firstCreator suffix=" - " }}{{ year suffix=" - " }}{{ title truncate="100" }}';

export interface RenamePreset {
  id: string;
  name: string;
  pattern: string;
  description: string;
}

export const RENAME_PRESETS: RenamePreset[] = [
  {
    id: 'zotero-default',
    name: 'Zotero 7 Default',
    pattern: '{{ firstCreator suffix=" - " }}{{ year suffix=" - " }}{{ title truncate="100" }}',
    description: 'Vaswani - 2017 - Attention Is All You Need.pdf',
  },
  {
    id: 'authors-et-al',
    name: 'Authors (et al.)',
    pattern: '{{ authors suffix=" - " }}{{ year suffix=" - " }}{{ title truncate="100" }}',
    description: 'Vaswani et al. - 2017 - Attention Is All You Need.pdf',
  },
  {
    id: 'year-first',
    name: 'Year First',
    pattern: '{{ year suffix=" - " }}{{ firstCreator suffix=" - " }}{{ title truncate="100" }}',
    description: '2017 - Vaswani - Attention Is All You Need.pdf',
  },
  {
    id: 'academic-cite',
    name: 'Academic Citation',
    pattern: '{{ firstCreator }} ({{ year }}) {{ title truncate="100" }}',
    description: 'Vaswani (2017) Attention Is All You Need.pdf',
  },
  {
    id: 'citation-key',
    name: 'Citation Key',
    pattern: '{{ citationKey }}',
    description: 'vaswani2017attention.pdf',
  },
];

export const RENAME_TOKENS = [
  { token: '{{ firstCreator suffix=" - " }}', label: 'First Creator', example: 'Vaswani - ' },
  { token: '{{ authors suffix=" - " }}', label: 'Authors (et al.)', example: 'Vaswani et al. - ' },
  { token: '{{ year suffix=" - " }}', label: 'Year', example: '2024 - ' },
  { token: '{{ title truncate="100" }}', label: 'Title (max 100)', example: 'Attention Is All You Need' },
  { token: '{{ publicationTitle }}', label: 'Publication / Journal', example: 'Nature' },
  { token: '{{ citationKey }}', label: 'Citation Key', example: 'vaswani2017' },
  { token: '{{ itemType }}', label: 'Item Type', example: 'journalArticle' },
  { token: '{{ doi }}', label: 'DOI', example: '10.1038/s41586-020-0000-0' },
];

/**
 * Extracts author tokens from contributors.
 */
export function extractAuthorTokens(contributors?: RenamerContributor[] | null): {
  authors: string;
  firstAuthor: string;
  allAuthors: string;
  lastNames: string[];
} {
  if (!contributors || !Array.isArray(contributors) || contributors.length === 0) {
    return { authors: '', firstAuthor: '', allAuthors: '', lastNames: [] };
  }

  const authorList = contributors
    .slice()
    .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));

  const authorsOnly = authorList.filter(
    (c) => !c.creatorType || c.creatorType.toLowerCase() === 'author',
  );
  const targetList = authorsOnly.length > 0 ? authorsOnly : authorList;

  const lastNames = targetList
    .map((c) => {
      if (c.lastName && c.lastName.trim()) return c.lastName.trim();
      const rawName = c.fullName || c.name || '';
      if (rawName.trim()) {
        const parts = rawName.trim().split(/\s+/);
        return parts[parts.length - 1];
      }
      return '';
    })
    .filter(Boolean);

  if (lastNames.length === 0) {
    return { authors: '', firstAuthor: '', allAuthors: '', lastNames: [] };
  }

  const firstAuthor = lastNames[0];
  const allAuthors = lastNames.join(', ');

  let authors = firstAuthor;
  if (lastNames.length === 2) {
    authors = `${lastNames[0]} and ${lastNames[1]}`;
  } else if (lastNames.length > 2) {
    authors = `${lastNames[0]} et al.`;
  }

  return { authors, firstAuthor, allAuthors, lastNames };
}

/**
 * Extracts 4-digit publication year.
 */
export function extractYearToken(item: Partial<Item>): string {
  if (item.year !== undefined && item.year !== null) {
    const numericYear = typeof item.year === 'number' ? item.year : parseInt(String(item.year), 10);
    if (!isNaN(numericYear) && numericYear > 0) {
      return String(numericYear);
    }
  }
  if (item.publicationDate) {
    const match = item.publicationDate.match(/\b(19\d\d|20\d\d)\b/);
    if (match) return match[1];
  }
  return '';
}

/**
 * Sanitizes a filename stem for safe cross-platform storage.
 */
export function sanitizeFilenameStem(stem: string, maxLength = 120): string {
  if (!stem) return 'document';

  let cleaned = stem
    .replace(/[\\/:*?"<>|\r\n\t]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s*-\s*/g, ' - ')
    .replace(/-{2,}/g, '-')
    .trim()
    .replace(/^[\s.\-_]+|[\s.\-_]+$/g, '');

  if (!cleaned) cleaned = 'document';

  if (cleaned.length > maxLength) {
    cleaned = cleaned.slice(0, maxLength).trim().replace(/[\s.\-_]+$/, '');
  }

  return cleaned || 'document';
}

/**
 * Resolves file extension preserving original.
 */
export function resolveFileExtension(currentFilename?: string, fallback = '.pdf'): string {
  if (!currentFilename) return fallback;
  const match = currentFilename.match(/(\.[a-zA-Z0-9]{2,10})$/);
  return match ? match[1].toLowerCase() : fallback;
}

/**
 * Generates the preview / calculated filename for an attachment given an Item.
 */
export function previewAttachmentFilename(
  pattern: string,
  item: Partial<Item>,
  currentFilename?: string,
): string {
  const extension = resolveFileExtension(currentFilename);
  const effectivePattern = (pattern && pattern.trim()) ? pattern.trim() : DEFAULT_RENAME_PATTERN;

  const { authors, firstAuthor, allAuthors, lastNames } = extractAuthorTokens(item.contributors);
  const year = extractYearToken(item);
  const title = (item.title || item.shortTitle || '').trim();
  const journal = (item.publicationTitle || item.journalAbbr || item.publisher || '').trim();
  const citationKey = (item.citationKey || '').trim();
  const itemType = (item.itemType || '').trim();
  const doi = (item.doi || '').replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '').trim();

  let formatted = effectivePattern.replace(
    /\{\{\s*([a-zA-Z0-9_]+)([^}]*)\}\}/g,
    (_fullMatch, tokenName: string, rawAttrs: string) => {
      const lowerToken = tokenName.toLowerCase();
      // Parse attributes like suffix=" - ", prefix="...", truncate="100", join=" & "
      const prefixMatch = rawAttrs.match(/prefix=(?:"([^"]*)"|'([^']*)')/);
      const suffixMatch = rawAttrs.match(/suffix=(?:"([^"]*)"|'([^']*)')/);
      const truncateMatch = rawAttrs.match(/truncate=(?:"(\d+)"|'(\d+)'|(\d+))/);
      const joinMatch = rawAttrs.match(/join=(?:"([^"]*)"|'([^']*)')/);

      const prefix = prefixMatch ? (prefixMatch[1] ?? prefixMatch[2] ?? '') : '';
      const suffix = suffixMatch ? (suffixMatch[1] ?? suffixMatch[2] ?? '') : '';
      const truncate = truncateMatch
        ? parseInt(truncateMatch[1] ?? truncateMatch[2] ?? truncateMatch[3], 10)
        : 0;
      const join = joinMatch ? (joinMatch[1] ?? joinMatch[2] ?? '') : '';

      let value = '';
      if (lowerToken === 'firstcreator') {
        value = firstAuthor;
      } else if (lowerToken === 'authors' || lowerToken === 'creators' || lowerToken === 'creator') {
        if (join && lastNames.length > 0) {
          value = lastNames.join(join);
        } else {
          value = authors;
        }
      } else if (lowerToken === 'allauthors') {
        value = allAuthors;
      } else if (lowerToken === 'year') {
        value = year;
      } else if (lowerToken === 'title') {
        value = title;
      } else if (
        lowerToken === 'publicationtitle' ||
        lowerToken === 'journal' ||
        lowerToken === 'publication'
      ) {
        value = journal;
      } else if (lowerToken === 'citationkey') {
        value = citationKey;
      } else if (lowerToken === 'itemtype') {
        value = itemType;
      } else if (lowerToken === 'doi') {
        value = doi;
      }

      value = value.trim();
      if (!value) return '';

      if (truncate > 0 && value.length > truncate) {
        value = value.slice(0, truncate).trim();
      }

      return `${prefix}${value}${suffix}`;
    },
  );

  formatted = formatted
    .replace(/\s*-\s*-\s*/g, ' - ')
    .replace(/^\s*-\s*|\s*-\s*$/g, '')
    .replace(/\(\s*\)/g, '')
    .replace(/\[\s*\]/g, '')
    .replace(/_\s*_/g, '_')
    .replace(/^_+|_+$/g, '');

  const sanitizedStem = sanitizeFilenameStem(formatted);
  return `${sanitizedStem}${extension}`;
}
