/**
 * Presentation Model: Citations & Citation Keys
 *
 * NOTE: The Backend Server (ItemValidatorService & CSL Citation Engine) is the
 * authoritative single source of truth for citationKey generation, CSL rendering,
 * and BibTeX export.
 *
 * This file provides lightweight presentation helpers for displaying citation
 * keys in UI badges, copy-to-clipboard buttons, and toolbar style labels.
 */

import type { Item } from '../types/library.types';

/**
 * Computes or accesses a BibTeX-compliant citation key.
 * Format: {firstAuthorSurname}{year}{firstSignificantTitleWord}
 * Supports disambiguation suffixes (a, b, c...) when collisions exist.
 */
export function generateCitationKey(
  paper?: Partial<Item> | { title?: string; authors?: any[]; year?: number | string | null; citationKey?: string | null; key?: string; id?: string; doi?: string | null; [key: string]: any } | null,
  existingKeys?: Set<string> | string[],
): string {
  if (!paper) return 'ref';

  let baseKey = '';

  let authorPart = '';
  const rawAuthors = (paper as any).authors;
  if (Array.isArray(rawAuthors) && rawAuthors.length > 0) {
    const firstAuthor = rawAuthors[0];
    let authorStr = typeof firstAuthor === 'string' ? firstAuthor : (firstAuthor?.lastName || firstAuthor?.name || firstAuthor?.fullName || '');
    if (authorStr.includes(',')) {
      authorStr = authorStr.split(',')[0].trim();
    } else {
      const tokens = authorStr.trim().split(/\s+/);
      authorStr = tokens[tokens.length - 1] || '';
    }
    authorPart = authorStr.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  let yearPart = '';
  if (paper.year) {
    const y = String(paper.year).match(/\b\d{4}\b/);
    if (y) yearPart = y[0];
  }

  let titlePart = '';
  if (paper.title) {
    const stopWords = new Set(['a', 'an', 'the', 'on', 'of', 'for', 'in', 'to', 'is', 'and', 'with', 'by', 'as', 'at']);
    const words = paper.title.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);
    for (const w of words) {
      if (!stopWords.has(w)) {
        titlePart = w;
        break;
      }
    }
  }

  if (authorPart || yearPart || titlePart) {
    baseKey = `${authorPart || 'ref'}${yearPart}${titlePart}`;
  } else if (paper.citationKey && paper.citationKey.trim()) {
    baseKey = paper.citationKey.trim().replace(/\s+/g, '');
  } else if (paper.key && paper.key.trim()) {
    baseKey = paper.key.trim().replace(/\s+/g, '');
  } else if (paper.id) {
    baseKey = `item_${paper.id.slice(0, 8)}`;
  } else {
    baseKey = 'ref';
  }

  baseKey = baseKey.toLowerCase().replace(/[^a-z0-9_:-]/g, '');

  if (!existingKeys) {
    return baseKey;
  }

  const keySet = existingKeys instanceof Set ? existingKeys : new Set(existingKeys);
  if (!keySet.has(baseKey)) {
    return baseKey;
  }

  const suffixes = 'abcdefghijklmnopqrstuvwxyz';
  for (let i = 0; i < suffixes.length; i++) {
    const candidate = `${baseKey}${suffixes[i]}`;
    if (!keySet.has(candidate)) {
      return candidate;
    }
  }

  return `${baseKey}_${Date.now()}`;
}

export const getPaperCitationKey = generateCitationKey;

/**
 * Exports a bibliographic item to a standard BibTeX entry string.
 */
export function toBibTeXEntry(item: {
  title: string;
  authors?: string[];
  year?: number | string | null;
  doi?: string | null;
  itemType?: string;
  journal?: string | null;
  booktitle?: string | null;
  citationKey?: string | null;
}): string {
  let entryType = 'article';
  const t = (item.itemType || '').toLowerCase();
  if (t === 'conferencepaper' || t === 'paper-conference' || t === 'inproceedings') {
    entryType = 'inproceedings';
  } else if (t === 'book') {
    entryType = 'book';
  } else if (t === 'thesis' || t === 'phdthesis') {
    entryType = 'phdthesis';
  }

  const citeKey = item.citationKey || generateCitationKey(item);
  const lines = [`@${entryType}{${citeKey},`];
  lines.push(`  title = {${item.title}},`);
  if (Array.isArray(item.authors) && item.authors.length > 0) {
    lines.push(`  author = {${item.authors.join(' and ')}},`);
  }
  if (item.year) {
    lines.push(`  year = {${item.year}},`);
  }
  if (item.doi) {
    lines.push(`  doi = {${item.doi}},`);
  }
  if (item.journal) {
    lines.push(`  journal = {${item.journal}},`);
  }
  // Trim trailing comma on last attribute
  const lastIdx = lines.length - 1;
  if (lines[lastIdx].endsWith(',')) {
    lines[lastIdx] = lines[lastIdx].slice(0, -1);
  }
  lines.push('}');
  return lines.join('\n');
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
