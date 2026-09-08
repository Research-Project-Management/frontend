// ── Institution keyword list (mirrored from backend creator-parser.util.ts) ───
export const INSTITUTION_KEYWORDS = [
  'organization','organizations','organisation','organisations','association','associations',
  'institute','institutes','institution','institutions','university','universities',
  'laboratory','laboratories','collab','collaboration','collaborations','group','team',
  'consortium','network','department','departments','agency','agencies','center','centers',
  'centre','centres','foundation','corporation','inc','llc','ltd','hospital','hospitals',
  'openai','google','microsoft','meta','deepmind','anthropic','mit','cern','nasa','who','ieee','acm',
];

export const PREFIX_PARTICLES = new Set(['von','van','de','del','der','da','di','du','la','le']);

/**
 * Splits a composite string of authors separated by ';', ' and ', ' & ', or newlines.
 * Logic is canonical with backend creator-parser.util.ts#splitAuthorString.
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
      // Multiple commas → treat as a list of names (e.g. "Smith, J., Jones, M.")
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
 * Canonical with backend creator-parser.util.ts#parseCreatorString.
 */
export function parseCreatorName(rawName: string): { firstName: string; lastName: string; fullName: string } {
  const trimmed = (rawName || '').trim().replace(/\s+/g, ' ');
  if (!trimmed) return { firstName: '', lastName: '', fullName: '' };

  const lower = trimmed.toLowerCase();
  const isInstitution = INSTITUTION_KEYWORDS.some((kw) =>
    new RegExp(`\\b${kw}\\b`, 'i').test(lower),
  );
  if (isInstitution) return { firstName: '', lastName: trimmed, fullName: trimmed };

  // Comma-separated: "LastName, FirstName MiddleName"
  if (trimmed.includes(',')) {
    const parts = trimmed.split(',').map((p) => p.trim());
    const lastName = parts[0] || '';
    const firstName = parts.slice(1).join(' ') || '';
    const fullName = firstName ? `${firstName} ${lastName}` : lastName;
    return { firstName, lastName, fullName };
  }

  // Space-separated: "FirstName [Middle...] LastName"
  const tokens = trimmed.split(' ');
  if (tokens.length === 1) return { firstName: '', lastName: tokens[0], fullName: tokens[0] };

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
  return { firstName, lastName, fullName: trimmed };
}

/**
 * Standardizes raw authors or creators into a clean array of author name strings.
 * Handles string[], delimited strings ("Author A; Author B" / "Author A and Author B"),
 * object arrays ([{ name: '...' }] or [{ firstName: '...', lastName: '...' }]),
 * and fallback to creators ([{ creatorType: 'author', name: '...' }]).
 */
export function normalizeAuthors(
  rawAuthors?: any,
  creators?: Array<{ creatorType?: string; name?: string; fullName?: string; firstName?: string; lastName?: string }> | null,
  contributors?: any[] | null,
): string[] {
  // If first argument is an object that looks like a paper (has authors/creators/contributors), extract from it
  if (rawAuthors && typeof rawAuthors === 'object' && !Array.isArray(rawAuthors)) {
    if ('authors' in rawAuthors || 'creators' in rawAuthors || 'contributors' in rawAuthors) {
      return normalizeAuthors(
        rawAuthors.authors,
        rawAuthors.creators,
        rawAuthors.contributors,
      );
    }
  }

  // 1. Check rawAuthors array
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

  // 2. Fallback to creators or contributors array
  const creatorList = (Array.isArray(creators) && creators.length > 0)
    ? creators
    : (Array.isArray(contributors) && contributors.length > 0)
    ? contributors
    : (rawAuthors && typeof rawAuthors === 'object' && Array.isArray((rawAuthors as any).creators))
    ? (rawAuthors as any).creators
    : (rawAuthors && typeof rawAuthors === 'object' && Array.isArray((rawAuthors as any).contributors))
    ? (rawAuthors as any).contributors
    : [];

  if (creatorList.length > 0) {
    const fromCreators: string[] = [];
    for (const c of creatorList) {
      if (!c) continue;
      if (typeof c === 'string') {
        fromCreators.push(...splitAuthorString(c));
        continue;
      }
      if (c.creatorType && c.creatorType !== 'author' && c.creatorType !== 'editor' && c.creatorType !== 'contributor') {
        continue;
      }
      const fullName = (c.fullName || c.name || '').trim();
      if (fullName) {
        fromCreators.push(...splitAuthorString(fullName));
      } else {
        const first = (c.firstName || c.given || '').trim();
        const last = (c.lastName || c.family || '').trim();
        const full = [first, last].filter(Boolean).join(' ');
        if (full) fromCreators.push(full);
      }
    }
    if (fromCreators.length > 0) return fromCreators;
  }

  return [];
}

/**
 * Formats a list of author names into a standard compact academic display string.
 * - 0 authors: "—"
 * - 1 author: "Author 1"
 * - 2 authors: "Author 1 & Author 2"
 * - 3+ authors: "Author 1 et al."
 */
export function formatCreatorCompact(authors?: string[] | null): string {
  if (!authors || authors.length === 0) return '—';
  if (authors.length === 1) return authors[0];
  if (authors.length === 2) return `${authors[0]} & ${authors[1]}`;
  return `${authors[0]} et al.`;
}

export function trimUnmatchedClosingBrackets(str: string): string {
  let s = str;
  const pairs: Array<[string, string]> = [[')', '('], [']', '['], ['}', '{'], ['>', '<']];
  for (const [closeChar, openChar] of pairs) {
    while (
      s.endsWith(closeChar) &&
      (s.match(new RegExp(`\\${closeChar}`, 'g')) || []).length >
      (s.match(new RegExp(`\\${openChar}`, 'g')) || []).length
    ) {
      s = s.slice(0, -1);
    }
  }
  return s;
}

export function cleanDoi(doi?: string | null): string {
  if (!doi || typeof doi !== 'string') return '';
  let clean = doi.trim();

  // Nature article URL: nature.com/articles/<slug>
  const natureMatch = clean.match(
    /^https?:\/\/(?:www\.)?nature\.com\/articles\/([a-z0-9._-]+)(?:[?#].*)?$/i,
  );
  if (natureMatch && natureMatch[1]) return `10.1038/${natureMatch[1]}`;

  // Zenodo record URL: zenodo.org/records/<id>
  const zenodoMatch = clean.match(
    /^https?:\/\/zenodo\.org\/records?\/(\d+)(?:[?#].*)?$/i,
  );
  if (zenodoMatch && zenodoMatch[1]) return `10.5281/zenodo.${zenodoMatch[1]}`;

  // BioRxiv / MedRxiv preprint URL
  const biorxivMatch = clean.match(
    /^https?:\/\/(?:www\.)?(?:biorxiv|medrxiv)\.org\/content\/(10\.\d{4,9}\/[^?#\s]+?)(?:v\d+)?(?:\.full|\.abstract|\.pdf)?(?:[?#].*)?$/i,
  );
  if (biorxivMatch && biorxivMatch[1]) return biorxivMatch[1].replace(/v\d+$/, '');

  // PLOS article URL
  const plosMatch = clean.match(
    /^https?:\/\/journals\.plos\.org\/[^/]+\/article\?(?:[^#]*&)?id=(10\.\d{4,9}\/[^&#\s]+)/i,
  );
  if (plosMatch && plosMatch[1]) return decodeURIComponent(plosMatch[1]);

  // Embedded /doi/ or /article/ in publisher URLs
  const embeddedMatch = clean.match(
    /^https?:\/\/[^/]+(?:\/[^/]+)*\/(?:doi\/|article\/)(?:abs\/|full\/|epdf\/|pdf\/)?(10\.\d{4,9}\/[-._;()/:A-Za-z0-9<>+=[\]~]+)(?:[?#].*)?$/i,
  );
  if (embeddedMatch && embeddedMatch[1]) {
    clean = embeddedMatch[1];
  }

  // Strip standard resolver prefixes (doi.org, dx.doi.org, http, https)
  clean = clean
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '')
    .replace(/^doi:\s*/i, '')
    .replace(/^doi\//i, '')
    .trim();

  // Strip trailing punctuation often caught in copy-paste
  clean = clean.replace(/[.,;:\s]+$/, '');
  clean = trimUnmatchedClosingBrackets(clean);

  // Canonical DOI format: starts with 10.NNNN/
  const doiRegex = /\b(10\.\d{4,9}\/[-._;()/:A-Za-z0-9<>+=[\]~]+)/;
  const match = clean.match(doiRegex);
  if (match) {
    let extracted = match[1].replace(/[.,;:\s]+$/, '');
    extracted = trimUnmatchedClosingBrackets(extracted);
    return extracted;
  }

  return clean.startsWith('10.') ? clean : '';
}
