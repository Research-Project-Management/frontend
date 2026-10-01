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

export const GENERATIONAL_SUFFIX_REGEX =
  /^(?:Jr\.?|Sr\.?|II|III|IV|V|Esq\.?)$/i;

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
 * Validates if an extracted author name token is actually section noise, OCR artifact,
 * or academic affiliation header rather than a genuine author name.
 */
export function isNoiseAuthorName(raw?: string | null): boolean {
  if (!raw || typeof raw !== 'string') return true;
  const trimmed = raw.trim();
  if (!trimmed) return true;

  // Single non-word character or too short non-alphabetic
  if (trimmed.length <= 1 && !/[a-zA-Z]/.test(trimmed)) return true;

  // Collapse non-alpha characters to match against known noise blacklist
  // Handles letter-spaced headers: "A B S T R A C T", "A BSTRACT", "I N T R O D U C T I O N"
  const collapsed = trimmed.toLowerCase().replace(/[^a-z]/g, '');
  if (NOISE_AUTHOR_WORDS.has(collapsed)) return true;

  const lower = trimmed.toLowerCase();

  // Academic affiliations/departments mistakenly extracted as author names
  if (
    /^(?:department|faculty|school|division|college)\s+of\s+/i.test(lower) ||
    /^(?:lab|laboratory)\s+of\s+/i.test(lower) ||
    /^(?:centre|center)\s+for\s+/i.test(lower) ||
    /^(?:institute|university)\s+of\s+[a-z\s]+,\s*(?:department|faculty|school|division)/i.test(lower)
  ) {
    return true;
  }

  // Reject emails or URLs mistakenly passed as author names
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

  // Strip emails: e.g. <user@domain.com> or user@domain.com
  cleaned = cleaned.replace(/<[^>]+@[^>]+>/g, ' ');
  cleaned = cleaned.replace(
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    ' ',
  );

  // Strip leading list numbering, bullets, or prefix: e.g. "1. ", "[1] ", "- ", "By: "
  cleaned = cleaned.replace(
    /^(?:(?:\[?\d+\]?[\.\)]?|[-•*])\s+|(?:by|author|authors):\s*)/i,
    '',
  );

  // Strip parenthetical roles/annotations: e.g. "(corresponding author)", "(equal contribution)", "(author)"
  cleaned = cleaned.replace(
    /\s*\((?:corresponding(?:\s*author)?|equal\s*contribution|author|lead\s*author|co-author|presenter|speaker|advisor|mentor|first\s*author)[^)]*\)/gi,
    '',
  );

  // Strip leading honorifics / academic titles: e.g. "Prof. Dr.", "Prof.", "Dr.", "Mr.", "Mrs.", "Ms."
  cleaned = cleaned.replace(
    /^(?:(?:Prof(?:essor)?|Dr|Doctor|Mr|Mrs|Ms)\.?\s+)+/i,
    '',
  );

  // Strip trailing professional degrees / fellowships: e.g. ", PhD", " PhD", " M.D.", " FRS"
  cleaned = cleaned.replace(
    /[,\s]+(?:PhD|M\.?D\.?|M\.?S\.?|B\.?S\.?|OBE|FRS|FRSE|FIEEE|CBE)\b/gi,
    '',
  );

  // Strip trailing footnote markers, superscripts, and affiliation numbers:
  // e.g. "1,2*", "*", "1", "†", "‡", "§", "1*", "*1"
  cleaned = cleaned.replace(
    /(?:[\s,]*[*†‡§^#~]+[\s,]*\d*|[\s,]*\d+[*†‡§^#~]*)+$/,
    '',
  );

  // Normalize excessive internal whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  // Remove trailing comma or semicolon if leftover
  cleaned = cleaned.replace(/[,;]+$/, '').trim();

  if (isNoiseAuthorName(cleaned)) {
    return '';
  }

  return cleaned;
}

/**
 * Splits a composite string of authors separated by ';', ' and ', ' & ', or commas.
 * Handles both "LastName, FirstName" pairs and forward names without mangling.
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
    // 1. Semicolons are unequivocal delimiters in academic metadata
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

    // 2. "and" / "&" conjunctions (e.g. "A, B, and C" or "A and B" or "A & B")
    if (/\s+and\s+/i.test(line) || /\s+&\s+/.test(line)) {
      const parts = line
        .split(/(?:,\s*(?:and|&)\s*|\s+(?:and|&)\s+)/i)
        .map((s) => s.trim())
        .filter(Boolean);
      for (const p of parts) {
        result.push(...splitAuthorString(p));
      }
      continue;
    }

    // 3. Comma-separated lists
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
        // Disambiguate: Is it "LastName, FirstName" (1 author) OR "FirstName1 LastName1, FirstName2 LastName2" (2 authors)?
        const firstHasSpace = rawTokens[0].includes(' ');
        const secondHasSpace = rawTokens[1].includes(' ');
        const isSuffix = GENERATIONAL_SUFFIX_REGEX.test(rawTokens[1]);

        if (isSuffix) {
          result.push(line.trim());
        } else if (firstHasSpace && secondHasSpace) {
          result.push(rawTokens[0], rawTokens[1]);
        } else {
          result.push(line.trim());
        }
        continue;
      }

      // rawTokens.length >= 3:
      const isEven = rawTokens.length % 2 === 0;
      let looksLikeInvertedPairs = isEven;

      if (isEven) {
        for (let i = 0; i < rawTokens.length; i += 2) {
          const surname = rawTokens[i];
          if (
            surname.includes(' ') &&
            !/^(?:van|von|de|del|der|da|di|du|la|le)\s+/i.test(surname)
          ) {
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
 * Parses a single author name into structured fields.
 * Handles institutions, "LastName, FirstName", "FirstName LastName", generational suffixes, particles (von/van/de), mononyms.
 */
export function parseCreatorName(rawName: string): ParsedCreator {
  const cleaned = cleanAuthorName(rawName);
  if (!cleaned) return { firstName: '', lastName: '', fullName: '', isInstitution: false };

  const lower = cleaned.toLowerCase();
  const isInstitution = INSTITUTION_KEYWORDS.some((kw) =>
    new RegExp(`\\b${kw}\\b`, 'i').test(lower),
  );
  if (isInstitution) {
    return { firstName: '', lastName: cleaned, fullName: cleaned, isInstitution: true };
  }

  let workingName = cleaned;

  // Comma-separated: "LastName, FirstName MiddleName" OR "Name, Jr."
  if (workingName.includes(',')) {
    const parts = workingName.split(',').map((p) => p.trim());
    if (parts.length === 2 && GENERATIONAL_SUFFIX_REGEX.test(parts[1])) {
      workingName = `${parts[0]} ${parts[1]}`;
    } else {
      const lastName = parts[0] || '';
      const firstName = parts.slice(1).join(' ') || '';
      const fullName = firstName ? `${firstName} ${lastName}` : lastName;
      return { firstName, lastName, fullName, isInstitution: false };
    }
  }

  // Space-separated: "FirstName [Middle...] LastName [Suffix]"
  const tokens = workingName.split(' ');
  if (tokens.length === 1) {
    return { firstName: '', lastName: tokens[0], fullName: tokens[0], isInstitution: false };
  }

  // Check generational suffix
  let splitIndex = tokens.length - 1;
  if (
    tokens.length >= 3 &&
    GENERATIONAL_SUFFIX_REGEX.test(tokens[tokens.length - 1])
  ) {
    splitIndex = tokens.length - 2;
  } else if (
    tokens.length >= 3 &&
    PREFIX_PARTICLES.has(tokens[tokens.length - 2].toLowerCase())
  ) {
    splitIndex = tokens.length - 2;
    if (
      tokens.length >= 4 &&
      PREFIX_PARTICLES.has(tokens[tokens.length - 3].toLowerCase())
    ) {
      splitIndex = tokens.length - 3;
    }
  }

  const lastName = tokens.slice(splitIndex).join(' ');
  const firstName = tokens.slice(0, splitIndex).join(' ');
  const fullName = firstName ? `${firstName} ${lastName}` : lastName;
  return { firstName, lastName, fullName, isInstitution: false };
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
        if (full) {
          const cleaned = cleanAuthorName(full);
          if (cleaned && !isNoiseAuthorName(cleaned)) {
            fromCreators.push(cleaned);
          }
        }
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
