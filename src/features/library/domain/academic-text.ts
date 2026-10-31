/**
 * Academic Text & Author Formatting Utilities
 *
 * NOTE: The Backend Server is the authoritative single source of truth for
 * OCR cleanup, artifact filtering, and academic text extraction.
 *
 * This file provides UI presentation helpers for normalizing whitespace in
 * titles and formatting multi-author strings for display.
 */

import { getItemAuthorsSummary } from '@/features/library/domain/creators';
import type { Item } from '@/features/library/domain/types/library.types';

const ASCII_ONLY_RE = /^[\x00-\x7F]*$/;
const SPECIAL_LATIN_FOLD_RE = /[ĐđŁłØøßÆæŒœ]/g;
const COMBINING_DIACRITIC_RE = /[\u0300-\u036f]/g;
const SPECIAL_LATIN_MAP: Readonly<Record<string, string>> = {
  Đ: 'd',
  đ: 'd',
  Ł: 'l',
  ł: 'l',
  Ø: 'o',
  ø: 'o',
  ß: 'ss',
  Æ: 'ae',
  æ: 'ae',
  Œ: 'oe',
  œ: 'oe',
};

const BROKEN_HYPHEN_RE = /(\b[A-Za-z0-9]+)-\s*\r?\n\s*([A-Za-z0-9]+\b)/g;
const MULTI_WHITESPACE_RE = /\s+/g;
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

export const decodeHtmlEntities = decodeXmlEntities;

/**
 * Transliterates and folds Unicode diacritics into lowercase ASCII characters
 * for diacritic-insensitive search and key normalization.
 * Uses an O(1) ASCII fast-path to bypass NFD normalization when no non-ASCII characters exist.
 */
export function foldDiacritics(input?: string | null): string {
  if (!input) return '';
  if (ASCII_ONLY_RE.test(input)) {
    return input.toLowerCase();
  }
  return input
    .replace(SPECIAL_LATIN_FOLD_RE, (m) => SPECIAL_LATIN_MAP[m] ?? m)
    .normalize('NFD')
    .replace(COMBINING_DIACRITIC_RE, '')
    .toLowerCase();
}

/**
 * Normalizes broken hyphens and irregular whitespace in academic titles/venues.
 */
export function cleanAcademicText(text?: string | null): string {
  if (!text) return '';
  return text
    .replace(BROKEN_HYPHEN_RE, '$1-$2')
    .replace(MULTI_WHITESPACE_RE, ' ')
    .trim();
}

/**
 * Formats authors array or string into clean academic citation format.
 * - If 1-3 authors: joins with commas
 * - If 4+ authors: shows first 3 + "et al." (or custom maxAuthors)
 */
export function formatAcademicAuthors(
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
