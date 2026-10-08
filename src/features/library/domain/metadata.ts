/**
 * Presentation Model: Academic Metadata Formatting, Display Labels & Notes/Tags
 *
 * NOTE: The Backend Server is the authoritative single source of truth for
 * metadata normalization, abstract cleaning, CSL validation, and noise filtering.
 *
 * This file provides UI presentation helpers for rendering item types, venue
 * badges, notes, and tags.
 */

import type { Item, Note } from '../types/library.types';
import { getVenueFieldForType } from '../types';

/** Strips LaTeX macros and escaped symbols common in BibTeX keywords */
export function stripLatexMarkup(str: string): string {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/\\([&%$#_{}])/g, '$1')
    .replace(/\\(?:textbf|textit|textsf|texttt|textsc|emph|text|mathrm|mathbf|mathit)\s*\{([^}]+)\}/gi, '$1')
    .replace(/\\(?:bf|it|em|rm|sf|tt|large|Large|small|tiny)\b\s*/gi, '')
    .replace(/[{}]/g, '')
    .trim();
}

/**
 * Lightweight helper to clean a single user-typed tag in the frontend UI.
 */
export function cleanSingleFrontendTag(raw: string): string | null {
  if (!raw || typeof raw !== 'string') return null;
  let str = raw
    .replace(/[\uFFFD]/g, '')
    .replace(/^[#"''`([{<•·*—\-\s]+/, '')
    .replace(/["''`)\]}>.,;:—\-\s•·*]+$/, '')
    .trim();

  str = stripLatexMarkup(str);
  str = str.replace(/<[^>]+>/g, '').trim();

  if (!str || str.length < 2) return null;
  return str;
}

/**
 * Normalizes tags from an Item for inspector display.
 */
export function normalizeTags(
  rawItem?: { tags?: unknown; keywords?: unknown; labels?: unknown } | unknown[] | string | null,
): string[] {
  if (!rawItem) return [];

  const candidates: unknown[] = [];
  if (Array.isArray(rawItem)) {
    candidates.push(...rawItem);
  } else if (typeof rawItem === 'object') {
    const obj = rawItem as Record<string, unknown>;
    if (Array.isArray(obj.tags)) candidates.push(...obj.tags);
    if (Array.isArray(obj.keywords)) candidates.push(...obj.keywords);
    if (Array.isArray(obj.labels)) candidates.push(...obj.labels);
    if (typeof obj.tags === 'string') candidates.push(obj.tags);
    if (typeof obj.keywords === 'string') candidates.push(obj.keywords);
    if (typeof obj.labels === 'string') candidates.push(obj.labels);
  } else if (typeof rawItem === 'string') {
    candidates.push(rawItem);
  }

  const tagSet = new Set<string>();
  for (const item of candidates) {
    if (typeof item === 'string') {
      const parts = item.includes(';') || item.includes(',') ? item.split(/[,;]+/) : [item];
      for (const part of parts) {
        const cleaned = cleanSingleFrontendTag(part);
        if (cleaned) tagSet.add(cleaned);
      }
    } else if (item && typeof item === 'object') {
      const tagObj = item as Record<string, unknown>;
      const name = typeof tagObj.name === 'string' ? tagObj.name : typeof tagObj.tag === 'string' ? tagObj.tag : '';
      if (name) {
        const cleaned = cleanSingleFrontendTag(name);
        if (cleaned) tagSet.add(cleaned);
      }
    }
  }

  return Array.from(tagSet);
}

export interface NormalizedNote {
  id: string;
  note?: string;
  content: string;
  title?: string;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
  dateModified?: string;
}

/**
 * Normalizes an array of notes from an Item for inspector display.
 */
export function normalizeNotes(rawNotes?: unknown): NormalizedNote[] {
  if (!rawNotes) return [];
  if (!Array.isArray(rawNotes)) {
    if (typeof rawNotes === 'string' && rawNotes.trim()) {
      return [{ id: 'note-0', note: rawNotes.trim(), content: rawNotes.trim() }];
    }
    return [];
  }

  const results: NormalizedNote[] = [];
  let index = 0;
  for (const n of rawNotes) {
    if (!n) continue;
    if (typeof n === 'string' && n.trim()) {
      results.push({ id: `note-${index++}`, note: n.trim(), content: n.trim() });
    } else if (typeof n === 'object') {
      const obj = n as Record<string, unknown>;
      const text = typeof obj.content === 'string' ? obj.content : typeof obj.note === 'string' ? obj.note : '';
      if (text.trim()) {
        results.push({
          id: typeof obj.id === 'string' && obj.id ? obj.id : `note-${index++}`,
          note: text.trim(),
          content: text.trim(),
          title: typeof obj.title === 'string' ? obj.title : undefined,
          tags: Array.isArray(obj.tags) ? obj.tags.filter((t): t is string => typeof t === 'string') : undefined,
          createdAt: typeof obj.createdAt === 'string' ? obj.createdAt : undefined,
          updatedAt: typeof obj.updatedAt === 'string' ? obj.updatedAt : undefined,
          dateModified: typeof obj.dateModified === 'string' ? obj.dateModified : undefined,
        });
      }
    }
  }

  return results;
}

/**
 * Fallback abstract text cleaner for UI presentation.
 * Server TrustedExtractionService performs authoritative cleaning.
 */
export function cleanAbstractText(text?: string | null): string {
  if (!text || typeof text !== 'string') return '';
  return text.trim();
}

/**
 * Extracts publication venue (journal, conference, publisher) for UI cards and tables.
 */
export function getPublicationVenue(
  item?: Partial<Item> | Record<string, unknown> | null,
): string {
  if (!item || typeof item !== 'object') return '';

  const clean = (val: unknown): string => {
    if (val === null || val === undefined) return '';
    const str = String(val).trim();
    if (!str || str.toLowerCase() === 'null' || str.toLowerCase() === 'undefined') return '';
    return str;
  };

  const itemType = (item as Item).itemType;
  const preferredField = getVenueFieldForType(itemType);
  if (preferredField && preferredField in item) {
    const val = clean((item as Record<string, unknown>)[preferredField]);
    if (val) return val;
  }

  const fallbackFields = [
    'journal',
    'publicationTitle',
    'bookTitle',
    'proceedingsTitle',
    'conferenceName',
    'publisher',
    'distributor',
    'institution',
    'university',
    'websiteTitle',
  ];

  for (const field of fallbackFields) {
    if (field in item) {
      const val = clean((item as Record<string, unknown>)[field]);
      if (val) return val;
    }
  }

  const extra = item.extraFields as Record<string, unknown> | undefined;
  if (extra && typeof extra === 'object') {
    for (const field of fallbackFields) {
      if (field in extra) {
        const val = clean(extra[field]);
        if (val) return val;
      }
    }
  }

  return '';
}

/**
 * Formats an academic itemType into a user-friendly label ("Journal Article", "Conference Paper").
 */
export function formatItemTypeLabel(rawType?: string | null): string {
  if (!rawType) return '—';
  const str = String(rawType).trim();
  const withSpaces = str
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ');
  return withSpaces
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Formats the extra metadata field for inspector display.
 */
export function formatExtraDisplay(paper: Item): string {
  if (typeof paper.extra === 'string' && paper.extra.trim()) {
    const trimmed = paper.extra.trim();
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
      return trimmed.replace(/\r?\n+/g, ', ');
    }
  }

  const fields = paper.extraFields;
  if (fields && typeof fields === 'object') {
    const parts: string[] = [];
    for (const [k, v] of Object.entries(fields)) {
      if (v !== null && v !== undefined && v !== '' && v !== 0 && v !== '0') {
        const valStr = typeof v === 'object' ? JSON.stringify(v) : String(v);
        const keyLabel = k
          .replace(/([a-z])([A-Z])/g, '$1 $2')
          .replace(/[_-]+/g, ' ');
        parts.push(`${keyLabel}: ${valStr}`);
      }
    }
    if (parts.length > 0) return parts.join(', ');
  }

  return '—';
}

/**
 * Formats and cleans extra metadata text for the Inspector's Extra tab.
 */
export function formatAndSanitizeExtraMetadata(
  rawExtraMetadata?: string | null,
  additionalExtraFields?: Record<string, unknown> | null,
  associatedPaperItem?: Partial<Item> | null,
): string {
  const lines: string[] = [];

  if (typeof rawExtraMetadata === 'string' && rawExtraMetadata.trim()) {
    const trimmed = rawExtraMetadata.trim();
    if (trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === 'object') {
          for (const [key, value] of Object.entries(parsed)) {
            if (value !== null && value !== undefined && value !== '') {
              lines.push(`${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`);
            }
          }
        }
      } catch {
        lines.push(trimmed);
      }
    } else {
      lines.push(trimmed);
    }
  }

  if (additionalExtraFields && typeof additionalExtraFields === 'object') {
    for (const [key, value] of Object.entries(additionalExtraFields)) {
      if (value !== null && value !== undefined && value !== '') {
        const line = `${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`;
        if (!lines.includes(line)) {
          lines.push(line);
        }
      }
    }
  }

  return lines.join('\n').trim();
}
