/**
 * Pure Domain Model: Creators & Authors
 * 100% Pure TypeScript - 0% React, 0% DOM dependencies
 */

export const INSTITUTION_KEYWORDS: ReadonlyArray<string> = [
  'organization', 'organizations', 'organisation', 'organisations', 'association', 'associations',
  'institute', 'institutes', 'institution', 'institutions', 'university', 'universities',
  'laboratory', 'laboratories', 'collab', 'collaboration', 'collaborations', 'group', 'team',
  'consortium', 'network', 'department', 'departments', 'agency', 'agencies', 'center', 'centers',
  'centre', 'centres', 'foundation', 'corporation', 'inc', 'llc', 'ltd', 'hospital', 'hospitals',
  'openai', 'google', 'microsoft', 'meta', 'deepmind', 'anthropic', 'mit', 'cern', 'nasa', 'who', 'ieee', 'acm',
];

export const PREFIX_PARTICLES: ReadonlySet<string> = new Set([
  'von', 'van', 'de', 'del', 'der', 'da', 'di', 'du', 'la', 'le',
]);

export interface ParsedCreator {
  firstName: string;
  lastName: string;
  fullName: string;
  isInstitution?: boolean;
}

/**
 * Splits a composite string of authors separated by ';', ' and ', ' & ', or newlines.
 */
export function splitAuthorString(input: string): string[] {
  if (!input || !input.trim()) return [];
  const trimmed = input.trim();
  const lines = trimmed
    .split(/\r?\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const result: string[] = [];

  for (const line of lines) {
    if (line.includes(';')) {
      result.push(...line.split(';').map((s) => s.trim()).filter(Boolean));
    } else if (/\s+and\s+/i.test(line)) {
      result.push(
        ...line.split(/\s+and\s+/i).map((s) => s.trim()).filter(Boolean),
      );
    } else if (/\s+&\s+/.test(line)) {
      result.push(
        ...line.split(/\s+&\s+/).map((s) => s.trim()).filter(Boolean),
      );
    } else if ((line.match(/,/g) || []).length >= 2) {
      result.push(
        ...line.split(',').map((s) => s.trim()).filter(Boolean),
      );
    } else {
      result.push(line);
    }
  }

  return result;
}

/**
 * Parses a single author name into structured fields.
 * Handles institutions, "LastName, FirstName", "FirstName LastName", particles (von/van/de), mononyms.
 */
export function parseCreatorName(rawName: string): ParsedCreator {
  const trimmed = (rawName || '').trim().replace(/\s+/g, ' ');
  if (!trimmed) return { firstName: '', lastName: '', fullName: '', isInstitution: false };

  const lower = trimmed.toLowerCase();
  const isInstitution = INSTITUTION_KEYWORDS.some((kw) =>
    new RegExp(`\\b${kw}\\b`, 'i').test(lower),
  );
  if (isInstitution) {
    return { firstName: '', lastName: trimmed, fullName: trimmed, isInstitution: true };
  }

  // Comma-separated: "LastName, FirstName MiddleName"
  if (trimmed.includes(',')) {
    const parts = trimmed.split(',').map((p) => p.trim());
    const lastName = parts[0] || '';
    const firstName = parts.slice(1).join(' ') || '';
    const fullName = firstName ? `${firstName} ${lastName}` : lastName;
    return { firstName, lastName, fullName, isInstitution: false };
  }

  // Space-separated: "FirstName [Middle...] LastName"
  const tokens = trimmed.split(' ');
  if (tokens.length === 1) {
    return { firstName: '', lastName: tokens[0], fullName: tokens[0], isInstitution: false };
  }

  // Handle prefix particles: "Johann von Neumann"
  let splitIndex = tokens.length - 1;
  if (tokens.length >= 3 && PREFIX_PARTICLES.has(tokens[tokens.length - 2].toLowerCase())) {
    splitIndex = tokens.length - 2;
    if (tokens.length >= 4 && PREFIX_PARTICLES.has(tokens[tokens.length - 3].toLowerCase())) {
      splitIndex = tokens.length - 3;
    }
  }

  const lastName = tokens.slice(splitIndex).join(' ');
  const firstName = tokens.slice(0, splitIndex).join(' ');
  return { firstName, lastName, fullName: trimmed, isInstitution: false };
}

export const parseAuthorName = parseCreatorName;

/**
 * Standardizes raw authors or creators into a clean array of author name strings.
 */
export function normalizeAuthors(
  rawAuthors?: unknown,
  creators?: Array<{ creatorType?: string; name?: string; fullName?: string; firstName?: string | null; lastName?: string | null; [key: string]: any }> | null,
  contributors?: Array<{ creatorType?: string; name?: string; fullName?: string; firstName?: string | null; lastName?: string | null; [key: string]: any }> | null,
): string[] {
  if (rawAuthors && typeof rawAuthors === 'object' && !Array.isArray(rawAuthors)) {
    const candidate = rawAuthors as {
      authors?: unknown;
      creators?: Array<{ creatorType?: string; name?: string; fullName?: string; firstName?: string | null; lastName?: string | null }> | null;
      contributors?: Array<{ creatorType?: string; name?: string; fullName?: string; firstName?: string | null; lastName?: string | null }> | null;
    };
    if (candidate.authors !== undefined || candidate.creators !== undefined || candidate.contributors !== undefined) {
      return normalizeAuthors(
        candidate.authors,
        candidate.creators,
        candidate.contributors,
      );
    }
  }

  if (Array.isArray(rawAuthors) && rawAuthors.length > 0) {
    const result: string[] = [];
    for (const item of rawAuthors) {
      if (!item) continue;
      if (typeof item === 'string') {
        result.push(...splitAuthorString(item));
      } else if (typeof item === 'object') {
        const fullName = (item.fullName || item.name || '').trim();
        if (fullName) {
          result.push(...splitAuthorString(fullName));
        } else if ('firstName' in item || 'lastName' in item || 'family' in item || 'given' in item) {
          const first = (item.firstName || item.given || '').trim();
          const last = (item.lastName || item.family || '').trim();
          const full = [first, last].filter(Boolean).join(' ');
          if (full) result.push(full);
        }
      }
    }
    if (result.length > 0) return result;
  } else if (typeof rawAuthors === 'string' && rawAuthors.trim()) {
    return splitAuthorString(rawAuthors);
  }

  const creatorList = (Array.isArray(creators) && creators.length > 0)
    ? creators
    : (Array.isArray(contributors) && contributors.length > 0)
    ? contributors
    : (rawAuthors && typeof rawAuthors === 'object' && Array.isArray((rawAuthors as { creators?: unknown[] }).creators))
    ? (rawAuthors as { creators: unknown[] }).creators
    : (rawAuthors && typeof rawAuthors === 'object' && Array.isArray((rawAuthors as { contributors?: unknown[] }).contributors))
    ? (rawAuthors as { contributors: unknown[] }).contributors
    : [];

  if (creatorList.length > 0) {
    const fromCreators: string[] = [];
    const hasExplicitAuthors = creatorList.some(
      (c) => c && typeof c === 'object' && 'creatorType' in c && (c as { creatorType: unknown }).creatorType === 'author',
    );

    for (const c of creatorList) {
      if (!c) continue;
      if (typeof c === 'string') {
        fromCreators.push(...splitAuthorString(c));
        continue;
      }
      const creator = c as {
        creatorType?: string;
        fullName?: string;
        name?: string;
        firstName?: string;
        given?: string;
        lastName?: string;
        family?: string;
      };
      if (hasExplicitAuthors && creator.creatorType && creator.creatorType !== 'author') {
        continue;
      }
      const fullName = (creator.fullName || creator.name || '').trim();
      if (fullName) {
        fromCreators.push(...splitAuthorString(fullName));
      } else {
        const first = (creator.firstName || creator.given || '').trim();
        const last = (creator.lastName || creator.family || '').trim();
        const full = [first, last].filter(Boolean).join(' ');
        if (full) fromCreators.push(full);
      }
    }
    if (fromCreators.length > 0) return fromCreators;
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
  const clean = authors.filter(
    (a) => !/^(FOR\s+[A-Z]|BY\s+[A-Z]|Reducing\s+Internal)/i.test(a.trim()),
  );
  if (clean.length === 0) return '—';
  if (clean.length === 1) return clean[0];
  if (clean.length === 2) return `${clean[0]} & ${clean[1]}`;
  return `${clean[0]} et al.`;
}
