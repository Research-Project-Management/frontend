/**
 * Presentation Model: Creators & Authors
 *
 * NOTE: The Backend Server (BibliographicUtils, TrustedExtractionService,
 * ItemMapper) is the authoritative single source of truth for author splitting,
 * OCR junk cleaning, institution detection, and creator mapping.
 *
 * This file provides lightweight presentation helpers for splitting user
 * input strings in forms, formatting compact names for tables/cards, and
 * standardizing author display.
 */

export interface ParsedCreator {
  firstName: string;
  lastName: string;
  fullName: string;
  isInstitution?: boolean;
}

/**
 * Splits raw author string by typical delimiter tokens (;, newline, or " and ")
 * when a user pastes multiple authors into a single form input.
 */
export function splitAuthorString(rawInput?: string | null): string[] {
  if (!rawInput || typeof rawInput !== 'string') return [];
  const trimmed = rawInput.trim();
  if (!trimmed) return [];

  // Split by newlines or semicolons first
  if (trimmed.includes('\n') || trimmed.includes(';')) {
    return trimmed
      .split(/[\n;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  // Split by " and " if present
  if (/\s+and\s+/i.test(trimmed)) {
    return trimmed
      .split(/\s+and\s+/i)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  return [trimmed];
}

/**
 * Lightweight helper to parse an author input string into firstName / lastName.
 * Handles "LastName, FirstName" or "FirstName LastName".
 */
export function parseCreatorName(rawName: string): ParsedCreator {
  if (!rawName || typeof rawName !== 'string') {
    return { firstName: '', lastName: '', fullName: '', isInstitution: false };
  }
  const trimmed = rawName.trim();
  if (!trimmed) {
    return { firstName: '', lastName: '', fullName: '', isInstitution: false };
  }

  // If format is "LastName, FirstName"
  if (trimmed.includes(',')) {
    const parts = trimmed.split(',').map((p) => p.trim());
    const lastName = parts[0] || '';
    const firstName = parts.slice(1).join(' ') || '';
    return {
      firstName,
      lastName,
      fullName: firstName ? `${firstName} ${lastName}` : lastName,
      isInstitution: false,
    };
  }

  // If format is "FirstName LastName"
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  if (tokens.length === 1) {
    return { firstName: '', lastName: tokens[0], fullName: tokens[0], isInstitution: false };
  }

  const lastName = tokens.pop() || '';
  const firstName = tokens.join(' ');
  return {
    firstName,
    lastName,
    fullName: `${firstName} ${lastName}`,
    isInstitution: false,
  };
}

export const parseAuthorName = parseCreatorName;

/**
 * Light compatibility helper for input cleaning.
 */
export function cleanAuthorName(raw?: string | null): string {
  if (!raw || typeof raw !== 'string') return '';
  return raw.trim().replace(/\s+/g, ' ');
}

export function isNoiseAuthorName(raw?: string | null): boolean {
  if (!raw || typeof raw !== 'string') return true;
  const s = raw.trim().toLowerCase();
  return s.length <= 1 || s === 'unknown' || s === 'none' || s === 'n/a';
}

/**
 * Extracts and normalizes authors array for UI presentation.
 * Prefers `authors: string[]`, falls back to `creators: CreatorCredit[]`.
 */
export function normalizeAuthors(
  rawAuthors?: unknown,
  creators?: Array<{ creatorType?: string; name?: string; fullName?: string; firstName?: string | null; lastName?: string | null; [key: string]: any }> | null,
  contributors?: Array<{ creatorType?: string; name?: string; fullName?: string; firstName?: string | null; lastName?: string | null; [key: string]: any }> | null,
): string[] {
  // If passed an item-like object
  if (rawAuthors && typeof rawAuthors === 'object' && !Array.isArray(rawAuthors)) {
    const candidate = rawAuthors as {
      authors?: unknown;
      creators?: unknown[];
      contributors?: unknown[];
    };
    if (candidate.authors !== undefined || candidate.creators !== undefined || candidate.contributors !== undefined) {
      return normalizeAuthors(candidate.authors, candidate.creators as any, candidate.contributors as any);
    }
  }

  // 1. Direct string array
  if (Array.isArray(rawAuthors) && rawAuthors.length > 0) {
    const list: string[] = [];
    for (const item of rawAuthors) {
      if (typeof item === 'string' && item.trim()) {
        list.push(item.trim());
      } else if (item && typeof item === 'object') {
        const full = (item.fullName || item.name || '').trim();
        if (full) {
          list.push(full);
        } else if (item.lastName || item.family) {
          const first = (item.firstName || item.given || '').trim();
          const last = (item.lastName || item.family || '').trim();
          list.push([last, first].filter(Boolean).join(', '));
        }
      }
    }
    if (list.length > 0) return list;
  } else if (typeof rawAuthors === 'string' && rawAuthors.trim()) {
    return splitAuthorString(rawAuthors);
  }

  // 2. Structured creators / contributors
  const creatorList = (Array.isArray(creators) && creators.length > 0)
    ? creators
    : (Array.isArray(contributors) && contributors.length > 0)
    ? contributors
    : [];

  if (creatorList.length > 0) {
    const names: string[] = [];
    for (const rawC of creatorList) {
      if (!rawC) continue;
      if (typeof rawC === 'string') {
        names.push((rawC as string).trim());
      } else {
        const c = rawC as Record<string, any>;
        const full = (c.fullName || c.name || '').trim();
        if (full) {
          names.push(full);
        } else if (c.lastName || c.firstName) {
          const first = (c.firstName || '').trim();
          const last = (c.lastName || '').trim();
          names.push([last, first].filter(Boolean).join(', '));
        }
      }
    }
    if (names.length > 0) return names;
  }

  return [];
}

/**
 * Formats authors into a standard compact academic display string.
 * - 0 authors: "—"
 * - 1 author: "Author 1"
 * - 2 authors: "Author 1 & Author 2"
 * - 3+ authors: "Author 1 et al."
 */
export function formatCreatorCompact(authors?: string[] | null): string {
  if (!authors || authors.length === 0) return '—';
  const clean = authors.filter(Boolean);
  if (clean.length === 0) return '—';
  if (clean.length === 1) return clean[0];
  if (clean.length === 2) return `${clean[0]} & ${clean[1]}`;
  return `${clean[0]} et al.`;
}
