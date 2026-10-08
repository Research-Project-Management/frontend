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

export const INSTITUTION_KEYWORDS = [
  'university',
  'universities',
  'institute',
  'institutes',
  'institution',
  'institutions',
  'consortium',
  'consortia',
  'collaboration',
  'collaborations',
  'committee',
  'committees',
  'organization',
  'organizations',
  'organisation',
  'organisations',
  'association',
  'associations',
  'society',
  'societies',
  'foundation',
  'group',
  'groups',
  'team',
  'council',
  'agency',
  'agencies',
  'department',
  'departments',
  'ministry',
  'laboratory',
  'laboratories',
  'center',
  'centers',
  'centre',
  'centres',
  'network',
  'initiative',
  'working party',
  'investigators',
  'commission',
  'corporation',
  'hospital',
  'hospitals',
  'inc',
  'llc',
  'ltd',
  'openai',
  'deepmind',
  'anthropic',
  'google',
  'microsoft',
  'cern',
  'nasa',
  'ieee',
];

const INSTITUTION_REGEX = new RegExp(
  `(?:^|[^\\p{L}\\p{N}])(?:${INSTITUTION_KEYWORDS.map((kw) =>
    kw.replace(/\s+/g, '\\s+'),
  ).join('|')})(?=$|[^\\p{L}\\p{N}])`,
  'iu',
);

export function isInstitutionName(name?: string | null): boolean {
  if (!name || typeof name !== 'string') return false;
  return INSTITUTION_REGEX.test(name);
}

export const NOISE_AUTHOR_WORDS = new Set([
  'abstract',
  'introduction',
  'indexterms',
  'keywords',
  'keyword',
  'references',
  'reference',
  'bibliography',
  'contents',
  'tableofcontents',
  'acknowledgments',
  'acknowledgements',
  'correspondence',
  'correspondingauthor',
  'allrightsreserved',
  'copyright',
  'unknown',
  'none',
  'na',
  'nil',
  'etal',
  'andothers',
  'visualgeometrygroup',
]);

/**
 * Validates if an author name token is actually section noise, OCR artifact,
 * or academic affiliation header rather than a genuine author name.
 */
export function isNoiseAuthorName(raw?: string | null): boolean {
  if (!raw || typeof raw !== 'string') return true;
  const trimmed = raw.trim();
  if (!trimmed) return true;

  if (trimmed.length <= 1 && !/[a-zA-Z]/.test(trimmed)) return true;

  const collapsed = trimmed.toLowerCase().replace(/[^a-z]/g, '');
  if (NOISE_AUTHOR_WORDS.has(collapsed)) return true;

  const lower = trimmed.toLowerCase();
  if (
    /^(?:department|faculty|school|division|college)\s+of\s+/i.test(lower) ||
    /^(?:lab|laboratory)\s+of\s+/i.test(lower) ||
    /^(?:centre|center)\s+for\s+/i.test(lower) ||
    /department of/i.test(lower) ||
    /university of .+, department of/i.test(lower) ||
    /^(?:institute|university)\s+of\s+[a-z\s]+,\s*(?:department|faculty|school|division)/i.test(
      lower,
    )
  ) {
    return true;
  }

  if (/@/.test(trimmed) || /^https?:\/\//i.test(trimmed)) {
    return true;
  }

  return false;
}

/**
 * Strips OCR junk, footnote markers, email addresses, affiliations,
 * and academic titles from a single author string token.
 */
export function cleanAuthorName(raw?: string | null): string {
  if (!raw || typeof raw !== 'string') return '';
  let cleaned = raw.trim();

  // Strip emails: e.g. <user@domain.com>
  cleaned = cleaned.replace(/<[^>]+@[^>]+>/g, ' ');
  cleaned = cleaned.replace(
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    ' ',
  );

  // Strip leading list numbering, bullets, prefix: e.g. "1. ", "[1] ", "- ", "By: ", "Author: "
  cleaned = cleaned.replace(
    /^(?:(?:\[?\d+\]?[\.\)]?|[-•*])\s+|(?:by|author|authors):\s*)/i,
    '',
  );

  // Strip parenthetical roles/annotations: e.g. "(corresponding author)"
  cleaned = cleaned.replace(/\s*\([^)]*\)/gi, '');

  // Strip leading honorifics / academic titles: e.g. "Prof. Dr.", "Prof.", "Dr.", "Mr.", "Mrs.", "Ms."
  cleaned = cleaned.replace(
    /^(?:(?:Prof(?:essor)?|Dr|Doctor|Mr|Mrs|Ms)\.?\s+)+/i,
    '',
  );

  // Strip trailing comma-delimited professional degrees: e.g. ", PhD", ", MD"
  cleaned = cleaned.replace(
    /,\s*(?:Ph\.?\s?D\.?|PHD|M\.?D\.?|M\.?Sc\.?|MSc|M\.?S\.?|B\.?Sc\.?|BSc|B\.?S\.?|MBA|MPH|D\.?Phil\.?|DPhil|FRS|FRSE|FIEEE|OBE|CBE)\s*$/i,
    '',
  );

  // Strip trailing footnote markers, superscripts, affiliation numbers:
  // e.g. " 1,2*", " *†", " 1", " 1,2", " *"
  cleaned = cleaned.replace(
    /(?:[\s,]*[*†‡§^#~]+[\s,]*\d*|[\s,]*\d+[*†‡§^#~,\d]*)+$/,
    '',
  );

  // Normalize excessive internal whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  cleaned = cleaned.replace(/[,;]+$/, '').trim();

  if (isNoiseAuthorName(cleaned)) {
    return '';
  }

  return cleaned;
}

const GENERATIONAL_SUFFIX_REGEX = /^(?:Jr\.?|Sr\.?|II|III|IV|V|Esq\.?)$/i;

/**
 * Splits raw author string by typical delimiter tokens (;, newline, or " and ", " & ")
 * and handles both forward and inverted names cleanly.
 */
export function splitAuthorString(rawInput?: string | null): string[] {
  if (!rawInput || typeof rawInput !== 'string') return [];
  const trimmed = rawInput.trim();
  if (!trimmed) return [];

  const lines = trimmed
    .split(/[\r\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const result: string[] = [];

  for (const line of lines) {
    // 1. Semicolons
    if (line.includes(';')) {
      const parts = line
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean);
      for (const p of parts) {
        result.push(...splitAuthorString(p));
      }
      continue;
    }

    // 2. Conjunctions: ", and ", " and ", " & "
    if (
      (/\s+and\s+/i.test(line) || /\s*,\s*and\s+/i.test(line) || /\s+&\s+/.test(line)) &&
      !(isInstitutionName(line) && !line.includes(','))
    ) {
      const parts = line
        .split(/(?:,\s*and\s+|\s+and\s+|\s+&\s+)/i)
        .map((s) => s.trim())
        .filter(Boolean);
      for (const p of parts) {
        result.push(...splitAuthorString(p));
      }
      continue;
    }

    // 3. Commas
    if (line.includes(',')) {
      const rawTokens = line
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (rawTokens.length <= 1) {
        result.push(line.trim());
        continue;
      }

      if (rawTokens.length === 2) {
        const isSuffix = GENERATIONAL_SUFFIX_REGEX.test(rawTokens[1]);
        const firstHasSpace = rawTokens[0].includes(' ');
        const secondHasSpace = rawTokens[1].includes(' ');

        if (isSuffix) {
          result.push(line.trim());
        } else if (firstHasSpace && secondHasSpace) {
          // "Karen Simonyan, Andrew Zisserman" -> two authors
          result.push(rawTokens[0], rawTokens[1]);
        } else {
          // "Simonyan, Karen" -> single inverted author
          result.push(line.trim());
        }
        continue;
      }

      // rawTokens.length >= 3
      // Check for inverted pairs with initials: "Vaswani, A., Shazeer, N., Parmar, N."
      const isEven = rawTokens.length % 2 === 0;
      let looksLikeInvertedPairs = isEven;

      if (isEven) {
        for (let i = 0; i < rawTokens.length; i += 2) {
          const surname = rawTokens[i];
          const initial = rawTokens[i + 1];
          if (surname.includes(' ') || !initial) {
            looksLikeInvertedPairs = false;
            break;
          }
        }
      }

      if (looksLikeInvertedPairs) {
        for (let i = 0; i < rawTokens.length; i += 2) {
          result.push(`${rawTokens[i]}, ${rawTokens[i + 1]}`);
        }
      } else {
        for (const t of rawTokens) {
          result.push(t);
        }
      }
      continue;
    }

    result.push(line.trim());
  }

  return result.map(cleanAuthorName).filter(Boolean);
}

/**
 * Lightweight helper to parse an author input string into firstName / lastName.
 * Handles "LastName, FirstName" or "FirstName LastName", generational suffixes, and institutions.
 */
export function parseCreatorName(rawName: string): ParsedCreator {
  if (!rawName || typeof rawName !== 'string') {
    return { firstName: '', lastName: '', fullName: '', isInstitution: false };
  }
  const trimmed = rawName.trim();
  if (!trimmed) {
    return { firstName: '', lastName: '', fullName: '', isInstitution: false };
  }

  if (isInstitutionName(trimmed)) {
    return {
      firstName: '',
      lastName: '',
      fullName: trimmed,
      isInstitution: true,
    };
  }

  // Generational suffix: "Martin Luther King, Jr."
  const genMatch = trimmed.match(/^(.*?),\s*(Jr\.?|Sr\.?|II|III|IV|V|Esq\.?)$/i);
  if (genMatch) {
    const coreName = genMatch[1].trim();
    const suffix = genMatch[2].trim();
    const tokens = coreName.split(/\s+/);
    const lastToken = tokens.pop() || '';
    const last = `${lastToken} ${suffix}`.trim();
    const first = tokens.join(' ');
    return {
      firstName: first,
      lastName: last,
      fullName: `${coreName} ${suffix}`,
      isInstitution: false,
    };
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
 * Extracts and normalizes authors array for UI presentation.
 * Supports string arrays and structured creator objects.
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

  // 1. Direct string or object array
  if (Array.isArray(rawAuthors) && rawAuthors.length > 0) {
    const list: string[] = [];
    for (const item of rawAuthors) {
      if (typeof item === 'string' && item.trim()) {
        list.push(item.trim());
      } else if (item && typeof item === 'object') {
        if (item.firstName || item.lastName || item.given || item.family) {
          const first = (item.firstName || item.given || '').trim();
          const last = (item.lastName || item.family || '').trim();
          list.push([first, last].filter(Boolean).join(' '));
        } else {
          const full = (item.fullName || item.name || '').trim();
          if (full) list.push(full);
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
        if (c.firstName || c.lastName || c.given || c.family) {
          const first = (c.firstName || c.given || '').trim();
          const last = (c.lastName || c.family || '').trim();
          names.push([first, last].filter(Boolean).join(' '));
        } else {
          const full = (c.fullName || c.name || '').trim();
          if (full) names.push(full);
        }
      }
    }
    if (names.length > 0) return names;
  }

  return [];
}

/**
 * Formats authors into a standard compact academic display string.
 * - 0 authors: ""
 * - 1 author: "Author 1"
 * - 2 authors: "Author 1 & Author 2"
 * - 3+ authors: "Author 1 et al."
 */
export function formatCreatorCompact(authors?: string[] | null): string {
  if (!authors || !Array.isArray(authors) || authors.length === 0) return '';
  const clean = authors.filter(Boolean);
  if (clean.length === 0) return '';
  if (clean.length === 1) return clean[0];
  if (clean.length === 2) return `${clean[0]} & ${clean[1]}`;
  return `${clean[0]} et al.`;
}
