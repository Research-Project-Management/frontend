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
 * Accesses or falls back to an item's authoritative citation key.
 * The server computes and persists `citationKey` upon creation/update.
 */
export function generateCitationKey(
  paper?: Partial<Item> | null,
  _existingKeys?: Set<string> | string[],
): string {
  if (!paper) return 'ref';
  if (paper.citationKey && paper.citationKey.trim()) {
    return paper.citationKey.trim().replace(/\s+/g, '');
  }
  if (paper.key && paper.key.trim()) {
    return paper.key.trim().replace(/\s+/g, '');
  }
  return paper.id ? `item_${paper.id.slice(0, 8)}` : 'ref';
}

export const getPaperCitationKey = generateCitationKey;



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
