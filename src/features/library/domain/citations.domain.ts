import type { Item, CslStyle } from '@/features/library/types/core.types';
import { parseCreatorName, getItemAuthorsSummary } from './creators.domain';
import { stripLatexMarkup, isValidValue, parseItemExtraField, getItemDisplayTitle, getItemDisplayDate } from './metadata.mapper';
import { foldDiacritics, cleanText } from './metadata-sanitizers.domain';

export { foldDiacritics, cleanText };

/**
 * Presentation Model: Citations & Citation Keys
 *
 * NOTE: The Backend Server (ExportsService, CslEngineService, CitationKeyEngine)
 * is the authoritative single source of truth for citation rendering, export,
 * and key persistence.
 *
 * This module provides purely lightweight presentation helpers for:
 * - Formatting citation keys for UI preview / unpersisted items
 * - Formatting citation style labels for toolbars, dropdowns, and badges
 */


interface CitationKeyInput {
  title?: string | null;
  authors?: Array<string | { name?: string | null; fullName?: string | null; lastName?: string | null; [key: string]: unknown }> | null;
  creators?: Array<{ firstName?: string | null; lastName?: string | null; fullName?: string | null; name?: string | null; creatorType?: string | null; [key: string]: unknown }> | null;
  year?: number | string | null;
  doi?: string | null;
  citationKey?: string | null;
  key?: string | null;
  id?: string | null;
  extra?: string | null;
  extraFields?: Record<string, unknown> | null;
  [key: string]: unknown;
}

/**
 * Transliterates Unicode diacritics (e.g., Đ/đ -> d, Ł/ł -> l, Ø/ø -> o, ß -> ss, NFD combining marks)
 * into clean ASCII lowercase alphanumeric characters for BibTeX keys.
 */
export function toAsciiKeyPart(raw: string): string {
  if (!raw) return '';
  return foldDiacritics(stripLatexMarkup(raw)).replace(/[^a-z0-9]/g, '');
}

const CITATION_KEY_STOP_WORDS: ReadonlySet<string> = new Set([
  'a',
  'an',
  'the',
  'on',
  'in',
  'of',
  'for',
  'and',
  'to',
  'with',
  'by',
  'from',
  'at',
  'as',
  'into',
  'towards',
  'toward',
  'via',
  'using',
  'is',
]);

/**
 * Computes a fallback BibTeX citation key preview for unpersisted items or client UI display.
 * Format: {firstAuthorSurname}{year}{firstSignificantTitleWord}
 *
 * Note: Authoritative key generation and collision avoidance are managed by the
 * backend CitationKeyEngine.
 */
export function generateCitationKey(
  item?: Partial<Item> | CitationKeyInput | null,
  existingKeys?: Set<string> | string[],
): string {
  if (!item) return 'ref';

  const rec = item as Record<string, unknown>;
  const ef = (rec.extraFields as Record<string, unknown> | undefined) || {};
  const parsedExtra = parseItemExtraField(
    (item as CitationKeyInput).extra || (item as CitationKeyInput).extraFields,
  );
  const extraCiteKey = parsedExtra.citationKey || parsedExtra.citekey || (ef.citationKey as string | undefined);

  let baseKey = '';

  let authorPart = '';
  const rawAuthors =
    Array.isArray((item as CitationKeyInput).creators) && (item as CitationKeyInput).creators!.length > 0
      ? (item as CitationKeyInput).creators
      : Array.isArray(item.authors) && item.authors.length > 0
        ? item.authors
        : null;

  if (Array.isArray(rawAuthors) && rawAuthors.length > 0) {
    const firstAuthor = rawAuthors[0];
    const authorObj = typeof firstAuthor === 'object' && firstAuthor ? (firstAuthor as Record<string, unknown>) : null;
    let authorStr = '';
    if (typeof firstAuthor === 'string') {
      const parsed = parseCreatorName(firstAuthor);
      authorStr = parsed.lastName || parsed.fullName;
    } else if (authorObj) {
      if (typeof authorObj.lastName === 'string' && isValidValue(authorObj.lastName)) {
        authorStr = authorObj.lastName;
      } else if (typeof authorObj.family === 'string' && isValidValue(authorObj.family)) {
        authorStr = authorObj.family;
      } else {
        const rawName = String(authorObj.name || authorObj.fullName || '');
        const parsed = parseCreatorName(rawName);
        authorStr = parsed.lastName || parsed.fullName;
      }
    }
    authorPart = toAsciiKeyPart(authorStr);
  }

  let yearPart = '';
  const rawYear =
    item.year ||
    getItemDisplayDate(rec) ||
    parsedExtra.originalDate ||
    parsedExtra.date;
  if (rawYear && isValidValue(rawYear)) {
    const y = String(rawYear).match(/\b\d{4}\b/);
    if (y) yearPart = y[0];
  }

  let titlePart = '';
  const effectiveTitle = getItemDisplayTitle(rec) || item.title;
  if (effectiveTitle && isValidValue(effectiveTitle)) {
    const cleanTitle = stripLatexMarkup(String(effectiveTitle))
      .replace(/[đĐ]/g, 'd')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    const words =
      cleanTitle
        .replace(/[^a-z0-9\s]/g, '')
        .match(/[a-z0-9]{3,}/g) || [];
    titlePart =
      words.find((w) => !CITATION_KEY_STOP_WORDS.has(w)) || words[0] || '';
  }

  if (item.citationKey && isValidValue(item.citationKey)) {
    baseKey = String(item.citationKey).trim().replace(/\s+/g, '');
  } else if (extraCiteKey && isValidValue(extraCiteKey)) {
    baseKey = String(extraCiteKey).trim().replace(/\s+/g, '');
  } else if (authorPart || yearPart || titlePart) {
    baseKey = `${authorPart || 'anon'}${yearPart || 'nd'}${titlePart || 'work'}`;
  } else if (rec.key && isValidValue(rec.key)) {
    baseKey = String(rec.key).trim().replace(/\s+/g, '');
  } else if (item.id) {
    baseKey = `item_${item.id.slice(0, 8)}`;
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

  let counter = 2;
  while (keySet.has(`${baseKey}_${counter}`)) {
    counter++;
  }
  return `${baseKey}_${counter}`;
}

export const CANONICAL_CSL_STYLE_IDS = [
  'apa-7th',
  'ieee',
  'mla-9th',
  'chicago-author-date',
  'harvard',
  'vancouver',
  'nature',
  'tcvn',
  'bibtex',
  'ris',
] as const;

const CORE_CITATION_STYLES = [
  { id: 'apa-7th', label: 'APA (7th Edition)', shortLabel: 'APA' },
  { id: 'ieee', label: 'IEEE Style', shortLabel: 'IEEE' },
  { id: 'mla-9th', label: 'MLA (9th Edition)', shortLabel: 'MLA' },
  { id: 'chicago-author-date', label: 'Chicago (Author-Date)', shortLabel: 'Chicago' },
  { id: 'nature', label: 'Nature', shortLabel: 'Nature' },
  { id: 'harvard', label: 'Harvard', shortLabel: 'Harvard' },
  { id: 'vancouver', label: 'Vancouver', shortLabel: 'Vancouver' },
  { id: 'tcvn', label: 'TCVN (Tiêu chuẩn Việt Nam)', shortLabel: 'TCVN' },
  { id: 'bibtex', label: 'BibTeX', shortLabel: 'BibTeX' },
  { id: 'ris', label: 'RIS', shortLabel: 'RIS' },
] as const;

export const DEFAULT_CITATION_STYLES = CORE_CITATION_STYLES.slice(0, 8);

const CITATION_STYLE_ALIAS_MAP: Readonly<Record<string, string>> = {
  apa: 'apa-7th',
  'apa-7': 'apa-7th',
  'apa-7th': 'apa-7th',
  mla: 'mla-9th',
  'mla-9': 'mla-9th',
  'mla-9th': 'mla-9th',
  chicago: 'chicago-author-date',
  'chicago-author-date': 'chicago-author-date',
  harvard: 'harvard',
  harvard1: 'harvard',
  ieee: 'ieee',
  vancouver: 'vancouver',
  nature: 'nature',
  tcvn: 'tcvn',
  'tcvn-author-date': 'tcvn',
  bibtex: 'bibtex',
  ris: 'ris',
};

const STYLE_SHORT_LABEL_MAP: Readonly<Record<string, string>> = Object.fromEntries(
  CORE_CITATION_STYLES.map((s) => [s.id, s.shortLabel]),
);

const STYLE_FULL_LABEL_MAP: Readonly<Record<string, string>> = {
  ...Object.fromEntries(CORE_CITATION_STYLES.map((s) => [s.id, s.label])),
  'tcvn-numeric': 'TCVN (Đánh số)',
};

const STYLE_PREFIX_SHORT_LABELS: ReadonlyArray<readonly [string, string]> = [
  ['apa', 'APA'],
  ['mla', 'MLA'],
  ['chicago', 'Chicago'],
  ['harvard', 'Harvard'],
  ['vancouver', 'Vancouver'],
  ['nature', 'Nature'],
  ['tcvn', 'TCVN'],
];

/**
 * Normalizes legacy or shorthand citation style identifiers (e.g. `'apa'`, `'mla'`, `'chicago'`, `'harvard1'`)
 * into their canonical style ID (`'apa-7th'`, `'mla-9th'`, `'chicago-author-date'`, `'harvard'`, etc.).
 */
export function normalizeCitationStyleId(styleId?: string | null): CslStyle {
  if (!styleId || typeof styleId !== 'string') return 'apa-7th';
  const cleaned = styleId.trim().toLowerCase();
  if (!cleaned) return 'apa-7th';
  return CITATION_STYLE_ALIAS_MAP[cleaned] ?? styleId.trim();
}

const GENERIC_STYLE_FIRST_WORDS: ReadonlySet<string> = new Set([
  'the',
  'a',
  'an',
  'american',
  'british',
  'royal',
  'international',
  'national',
  'european',
  'canadian',
  'australian',
  'journal',
  'proceedings',
  'transactions',
  'annals',
  'association',
  'society',
  'institute',
  'university',
  'tieu',
  'tiêu',
]);

/**
 * Normalizes full academic journal or style names into clean, compact
 * toolbar button labels (<= 14 characters) that will not break container layout.
 */
export function getCleanStyleLabel(id: string, fullTitle?: string): string {
  const canonical = normalizeCitationStyleId(id).toLowerCase();
  const mappedShort = STYLE_SHORT_LABEL_MAP[canonical];
  if (mappedShort) return mappedShort;

  if (fullTitle) {
    const trimmedTitle = fullTitle.trim();
    if (trimmedTitle.length <= 14 && !trimmedTitle.includes('(')) {
      return trimmedTitle;
    }
    const acronymMatch = trimmedTitle.match(/\(([A-Z][A-Z0-9&-]{1,9})\)/);
    if (acronymMatch?.[1]) {
      return acronymMatch[1];
    }
    const clean = trimmedTitle.replace(/\s*\([^)]*\)/g, '').trim();
    if (clean.length > 0 && clean.length <= 14) return clean;

    const s = id.toLowerCase().trim();
    for (const [prefix, label] of STYLE_PREFIX_SHORT_LABELS) {
      if (s.startsWith(prefix)) return label;
    }

    const words = clean.split(/[\s-]+/).filter(Boolean);
    const firstWord = words[0];
    if (
      firstWord &&
      firstWord.length <= 14 &&
      !GENERIC_STYLE_FIRST_WORDS.has(firstWord.toLowerCase())
    ) {
      return firstWord;
    }
    if (clean.length > 14) {
      return `${clean.slice(0, 12).trim()}…`;
    }
  }

  const s = id.toLowerCase().trim();
  for (const [prefix, label] of STYLE_PREFIX_SHORT_LABELS) {
    if (s.startsWith(prefix)) return label;
  }
  const cleanId = id.toUpperCase();
  return cleanId.length <= 10 ? cleanId : cleanId.slice(0, 10);
}

/**
 * Formats a StyleSummary or style object into a standardized, human-friendly
 * citation style label for dropdown menus and pickers.
 */
export function formatCitationStyleLabel(style: {
  id: string;
  name?: string;
  shortTitle?: string;
} | string): string {
  const rawId = typeof style === 'string' ? style : style.id;
  const canonical = normalizeCitationStyleId(rawId).toLowerCase();
  if (canonical in STYLE_FULL_LABEL_MAP && canonical !== 'bibtex' && canonical !== 'ris') {
    return STYLE_FULL_LABEL_MAP[canonical]!;
  }
  if (typeof style === 'object' && style !== null) {
    return style.shortTitle || style.name || style.id;
  }
  return rawId;
}

/**
 * Academic Text & Author Formatting Utilities
 *
 * NOTE: The Backend Server is the authoritative single source of truth for
 * OCR cleanup, artifact filtering, and academic text extraction.
 *
 * This file provides UI presentation helpers for normalizing whitespace in
 * titles and formatting multi-author strings for display.
 */


const LEADING_EMOJI_RE = /^(\p{Extended_Pictographic}|\p{Emoji_Presentation}|[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}])\s*(.*)$/u;

const NAMED_XML_ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ensp: ' ',
  emsp: ' ',
  thinsp: ' ',
  shy: '',
  ndash: '\u2013',
  mdash: '\u2014',
  minus: '\u2212',
  lsquo: '\u2018',
  rsquo: '\u2019',
  sbquo: '\u201A',
  ldquo: '\u201C',
  rdquo: '\u201D',
  bdquo: '\u201E',
  laquo: '\u00AB',
  raquo: '\u00BB',
  hellip: '\u2026',
  bull: '\u2022',
  middot: '\u00B7',
  prime: '\u2032',
  Prime: '\u2033',
  dagger: '\u2020',
  Dagger: '\u2021',
  permil: '\u2030',
  copy: '\u00A9',
  reg: '\u00AE',
  trade: '\u2122',
  sect: '\u00A7',
  para: '\u00B6',
  euro: '\u20AC',
  pound: '\u00A3',
  yen: '\u00A5',
  cent: '\u00A2',
  deg: '\u00B0',
  plusmn: '\u00B1',
  times: '\u00D7',
  divide: '\u00F7',
  micro: '\u00B5',
  le: '\u2264',
  ge: '\u2265',
  ne: '\u2260',
  asymp: '\u2248',
  equiv: '\u2261',
  infin: '\u221E',
  sum: '\u2211',
  prod: '\u220F',
  radic: '\u221A',
  part: '\u2202',
  nabla: '\u2207',
  isin: '\u2208',
  larr: '\u2190',
  rarr: '\u2192',
  uarr: '\u2191',
  darr: '\u2193',
  harr: '\u2194',
  alpha: '\u03B1',
  beta: '\u03B2',
  gamma: '\u03B3',
  delta: '\u03B4',
  epsilon: '\u03B5',
  zeta: '\u03B6',
  eta: '\u03B7',
  theta: '\u03B8',
  iota: '\u03B9',
  kappa: '\u03BA',
  lambda: '\u03BB',
  mu: '\u03BC',
  nu: '\u03BD',
  xi: '\u03BE',
  omicron: '\u03BF',
  pi: '\u03C0',
  rho: '\u03C1',
  sigma: '\u03C3',
  tau: '\u03C4',
  upsilon: '\u03C5',
  phi: '\u03C6',
  chi: '\u03C7',
  psi: '\u03C8',
  omega: '\u03C9',
  Alpha: '\u0391',
  Beta: '\u0392',
  Gamma: '\u0393',
  Delta: '\u0394',
  Epsilon: '\u0395',
  Theta: '\u0398',
  Lambda: '\u039B',
  Pi: '\u03A0',
  Sigma: '\u03A3',
  Phi: '\u03A6',
  Psi: '\u03A8',
  Omega: '\u03A9',
  agrave: '\u00E0',
  aacute: '\u00E1',
  acirc: '\u00E2',
  atilde: '\u00E3',
  auml: '\u00E4',
  aring: '\u00E5',
  aelig: '\u00E6',
  ccedil: '\u00E7',
  egrave: '\u00E8',
  eacute: '\u00E9',
  ecirc: '\u00EA',
  euml: '\u00EB',
  igrave: '\u00EC',
  iacute: '\u00ED',
  icirc: '\u00EE',
  iuml: '\u00EF',
  ntilde: '\u00F1',
  ograve: '\u00F2',
  oacute: '\u00F3',
  ocirc: '\u00F4',
  otilde: '\u00F5',
  ouml: '\u00F6',
  oslash: '\u00F8',
  ugrave: '\u00F9',
  uacute: '\u00FA',
  ucirc: '\u00FB',
  uuml: '\u00FC',
  yacute: '\u00FD',
  yuml: '\u00FF',
  szlig: '\u00DF',
  oelig: '\u0153',
  Agrave: '\u00C0',
  Aacute: '\u00C1',
  Acirc: '\u00C2',
  Atilde: '\u00C3',
  Auml: '\u00C4',
  Aring: '\u00C5',
  AElig: '\u00C6',
  Ccedil: '\u00C7',
  Egrave: '\u00C8',
  Eacute: '\u00C9',
  Ecirc: '\u00CA',
  Euml: '\u00CB',
  Igrave: '\u00CC',
  Iacute: '\u00CD',
  Icirc: '\u00CE',
  Iuml: '\u00CF',
  Ntilde: '\u00D1',
  Ograve: '\u00D2',
  Oacute: '\u00D3',
  Ocirc: '\u00D4',
  Otilde: '\u00D5',
  Ouml: '\u00D6',
  Oslash: '\u00D8',
  Ugrave: '\u00D9',
  Uacute: '\u00DA',
  Ucirc: '\u00DB',
  Uuml: '\u00DC',
  Yacute: '\u00DD',
  OElig: '\u0152',
};

/**
 * Decodes XML/HTML named entities (including standard academic typography, Greek letters,
 * mathematical operators, and Latin diacritics) as well as decimal (`&#NNN;`) and hex (`&#xHHH;`) entities.
 */
export function decodeXmlEntities(raw?: string | null): string {
  if (!raw || typeof raw !== 'string') return '';
  if (!raw.includes('&')) return raw;

  const decodePass = (input: string): string =>
    input
      .replace(/&#(\d+);/g, (match, dec: string) => {
        const code = Number.parseInt(dec, 10);
        return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
      })
      .replace(/&#x([0-9a-fA-F]+);/g, (match, hex: string) => {
        const code = Number.parseInt(hex, 16);
        return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
      })
      .replace(/&([a-zA-Z0-9]+);/g, (match, name: string) => {
        const mapped = NAMED_XML_ENTITIES[name] ?? NAMED_XML_ENTITIES[name.toLowerCase()];
        return mapped !== undefined ? mapped : match;
      });

  const first = decodePass(raw);
  return first.includes('&') ? decodePass(first) : first;
}

/**
 * Formats authors array or string into clean academic citation format.
 * - If 1-3 authors: joins with commas
 * - If 4+ authors: shows first 3 + "et al." (or custom maxAuthors)
 */
export function formatAuthors(
  authors: unknown,
  maxAuthors = 3,
): string {
  return getItemAuthorsSummary(authors as Partial<Item> | null | undefined, maxAuthors);
}

/**
 * Detects and extracts a leading emoji from a title/label.
 * If present, returns { emoji, label: textWithoutEmoji }.
 */
export function parseEmojiPrefix(text?: string | null): { emoji: string | null; label: string } {
  if (!text) return { emoji: null, label: '' };
  const trimmed = text.trim();
  const match = trimmed.match(LEADING_EMOJI_RE);
  if (match) {
    return {
      emoji: match[1],
      label: match[2].trim() || trimmed,
    };
  }
  return { emoji: null, label: trimmed };
}

export {
  resolveOpenAccessLicenseBadge,
  type OpenAccessLicenseBadge,
} from './system-views.policy';
