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

import { stripLatexMarkup } from './metadata';
import { cleanAcademicText } from './academic-text';
import type { Item } from './types/library.types';

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
  'null',
  'undefined',
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

  if (trimmed.length <= 1 && !/\p{L}/u.test(trimmed)) return true;

  const lower = trimmed.toLowerCase();
  if (lower === 'n/a' || lower === 'n.a.' || lower === 'n.a') return true;

  const collapsed = lower.replace(/[^a-z]/g, '');
  if (collapsed && NOISE_AUTHOR_WORDS.has(collapsed)) return true;

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
  let cleaned = stripLatexMarkup(raw.trim());

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

  // Strip trailing comma-delimited professional degrees / fellowships:
  // e.g. "John Smith, PhD", "Smith, J. A., MD". Only stripped when the text
  // before the comma already contains a full name (space or comma) or when the
  // degree token is unambiguously a degree (never a 2-letter initial like "M.D."),
  // so that inverted initials like "Wong, M.D." are NOT mistaken for a degree.
  const TRAILING_DEGREE_REGEX =
    /,\s*(?:Ph\.?\s?D\.?|PHD|Pharm\.?\s?D\.?|M\.?D\.?|M\.?Sc\.?|MSc|M\.?S\.?|M\.?A\.?|B\.?Sc\.?|BSc|B\.?S\.?|B\.?A\.?|MBA|MPH|D\.?Phil\.?|DPhil|F\.?R\.?C\.?S\.?|FAAN|FACP|FRS|FRSE|FIEEE|OBE|CBE)\s*$/i;
  const UNAMBIGUOUS_DEGREE_REGEX =
    /^,\s*(?:Ph\.?\s?D\.?|PHD|Pharm\.?\s?D\.?|M\.?Sc\.?|MSc|B\.?Sc\.?|BSc|MBA|MPH|D\.?Phil\.?|DPhil|F\.?R\.?C\.?S\.?|FAAN|FACP|FRS|FRSE|FIEEE|OBE|CBE)\s*$/i;
  for (let guard = 0; guard < 4; guard++) {
    const m = cleaned.match(TRAILING_DEGREE_REGEX);
    if (!m || m.index === undefined) break;
    const prefix = cleaned.slice(0, m.index).trim();
    if (!/[\s,]/.test(prefix) && !UNAMBIGUOUS_DEGREE_REGEX.test(m[0])) break;
    cleaned = prefix;
  }

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

const VIETNAMESE_DIACRITICS_REGEX =
  /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸỴĐ]/u;

const VIETNAMESE_FAMILY_NAMES = new Set([
  'nguyễn', 'trần', 'lê', 'phạm', 'hoàng', 'huỳnh', 'phan', 'vũ', 'võ', 'đặng',
  'bùi', 'đỗ', 'hồ', 'ngô', 'dương', 'lý', 'đinh', 'đoàn', 'lâm', 'trịnh',
  'mai', 'đào', 'cao', 'hà', 'lưu', 'lương', 'thái', 'phùng', 'tô', 'vương',
  'tạ', 'tống', 'quách', 'nông', 'diệp', 'triệu', 'tiêu', 'khổng', 'nghiêm',
  'la', 'tăng', 'trương', 'chu', 'châu', 'tôn', 'vi', 'lục', 'ma', 'bành',
  'cù', 'cấn', 'thạch', 'bạch', 'sầm', 'lại', 'hứa', 'kiều', 'mạc', 'cáp',
  'thân', 'tào', 'nhan', 'mã', 'chử', 'doãn', 'ân', 'bàng', 'quản', 'đậu', 'phí',
  'nguyen', 'tran', 'le', 'pham', 'hoang', 'huynh', 'phan', 'vu', 'vo', 'dang',
  'bui', 'do', 'ho', 'ngo', 'duong', 'ly', 'dinh', 'doan', 'lam', 'trinh',
  'dao', 'ha', 'luu', 'luong', 'thai', 'phung', 'to', 'vuong', 'ta', 'tong',
  'quach', 'nong', 'diep', 'trieu', 'tieu', 'khong', 'nghiem', 'tang', 'truong',
  'chau', 'ton', 'luc', 'banh', 'cu', 'can', 'thach', 'bach', 'sam', 'lai',
  'hua', 'kieu', 'mac', 'cap', 'than', 'tao', 'quan', 'dau', 'phi',
]);

const VIETNAMESE_MIDDLE_NAMES = new Set([
  'văn', 'thị', 'hữu', 'đình', 'đức', 'ngọc', 'xuân', 'thanh', 'quang', 'trọng',
  'minh', 'hoàng', 'anh', 'hải', 'quốc', 'công', 'kim', 'bảo', 'thu', 'phương',
  'hồng', 'thùy', 'thảo', 'mạnh', 'tiến', 'đắc', 'tuấn', 'hùng', 'bá', 'chí',
  'van', 'thi', 'huu', 'dinh', 'duc', 'ngoc', 'xuan', 'trong', 'hoang', 'hai',
  'quoc', 'cong', 'bao', 'phuong', 'hong', 'thuy', 'thao', 'manh', 'tien',
  'dac', 'tuan', 'hung', 'ba', 'chi',
]);

const VIETNAMESE_COMPOUND_SURNAMES = new Set([
  'nguyễn phúc', 'nguyen phuc',
  'tôn thất', 'ton that',
  'tôn nữ', 'ton nu',
  'âu dương', 'au duong',
  'hoàng lê', 'hoang le',
  'trần đình', 'tran dinh',
  'đặng trần', 'dang tran',
  'hồ đắc', 'ho dac',
  'lương thế', 'luong the',
  'nguyễn đình', 'nguyen dinh',
  'nguyễn khoa', 'nguyen khoa',
  'phan huy', 'trần huy', 'tran huy',
  'vũ đình', 'vu dinh',
]);

export const AMBIGUOUS_UNACCENTED_VN_SURNAMES = new Set([
  'le', 'mai', 'ha', 'do', 'la', 'to', 'ma', 'ho', 'ly', 'chu', 'can', 'vi',
  'an', 'ta', 'cu', 'ba', 'ca', 'vo', 'vu', 'au', 'lo', 'no', 'ro', 'so', 'po',
]);

export const VN_SYLLABLE_REGEX =
  /^(?:ng|nh|tr|ch|gh|gi|kh|ph|qu|th|[bcdghklmnpstvx])?[aeiouy]+(?:ng|nh|ch|[cmnpt])?$/i;

export function isVietnameseName(raw?: string | null): boolean {
  if (!raw || typeof raw !== 'string') return false;
  const normalized = raw.trim().normalize('NFC');
  if (normalized.includes(',')) return false;

  const tokens = normalized.split(/\s+/).filter(Boolean);
  if (tokens.length < 2 || tokens.length > 5) return false;

  const firstLower = tokens[0]!.toLowerCase();
  if (!VIETNAMESE_FAMILY_NAMES.has(firstLower)) return false;

  if (VIETNAMESE_DIACRITICS_REGEX.test(normalized)) {
    return true;
  }

  // Unaccented 2-token names: reject ambiguous 2-3 letter non-diacritic surnames (e.g. "Ma Smith", "Can Yaman", "Ho Lee", "Vi Kim", "An Lee")
  // and require both tokens to follow valid Vietnamese syllable phonotactics
  if (tokens.length === 2) {
    if (AMBIGUOUS_UNACCENTED_VN_SURNAMES.has(firstLower)) {
      return false;
    }
    return VN_SYLLABLE_REGEX.test(tokens[0]!) && VN_SYLLABLE_REGEX.test(tokens[1]!);
  }

  // If unaccented >= 3 tokens with an ambiguous short surname, require a known Vietnamese middle name
  if (AMBIGUOUS_UNACCENTED_VN_SURNAMES.has(firstLower)) {
    if (!VIETNAMESE_MIDDLE_NAMES.has(tokens[1]!.toLowerCase())) {
      return false;
    }
  }

  return tokens.every((tok) => VN_SYLLABLE_REGEX.test(tok));
}

export const SURNAME_PARTICLES = new Set([
  'van',
  'von',
  'zu',
  'de',
  'del',
  'della',
  'der',
  'den',
  'des',
  'do',
  'het',
  'ter',
  'ten',
  'la',
  'le',
  'las',
  'los',
  'du',
  'di',
  'da',
  'dos',
  'das',
  'bin',
  'ibn',
  'al',
  'el',
  'vander',
  'vanden',
]);

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
        const firstWords = rawTokens[0].split(/\s+/).filter(Boolean);
        const startsWithParticle =
          firstWords.length >= 2 && SURNAME_PARTICLES.has(firstWords[0]!.toLowerCase());
        // Check if first token is a compound surname ("van der Maaten", "de la Fuente", "García Márquez", "Nguyễn Văn")
        const secondIsSingleGivenOrInitials =
          !secondHasSpace || /^[A-Z]\.?\s+[A-Z]\.?$/.test(rawTokens[1]);

        if (isSuffix || startsWithParticle) {
          result.push(line.trim());
        } else if (firstHasSpace && secondHasSpace && !secondIsSingleGivenOrInitials) {
          // "Karen Simonyan, Andrew Zisserman" -> two authors
          result.push(rawTokens[0], rawTokens[1]);
        } else {
          // "Simonyan, Karen" or "van der Maaten, Laurens" -> single inverted author
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
 * Handles "LastName, FirstName" or "FirstName LastName", nobiliary particles ("van der Maaten"),
 * generational suffixes, and institutions.
 */
export function parseCreatorName(rawName: string): ParsedCreator {
  if (!rawName || typeof rawName !== 'string') {
    return { firstName: '', lastName: '', fullName: '', isInstitution: false };
  }
  const trimmed = stripLatexMarkup(rawName.trim());
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

  // Vancouver / Medline style: "Smith JA" -> lastName: "Smith", firstName: "J. A."
  const vTokens = trimmed.split(/\s+/);
  if (
    !trimmed.includes(',') &&
    vTokens.length >= 2 &&
    /^[A-Z]{1,3}$/.test(vTokens[vTokens.length - 1]!) &&
    !/^(?:II|III|IV)$/.test(vTokens[vTokens.length - 1]!) &&
    vTokens.slice(0, -1).some((t) => !SURNAME_PARTICLES.has(t.toLowerCase()) && /^\p{Lu}[\p{L}'’-]*$/u.test(t) && /\p{Ll}/u.test(t))
  ) {
    const initials = vTokens[vTokens.length - 1]!;
    const lastName = vTokens.slice(0, -1).join(' ');
    const firstName = initials
      .split('')
      .map((c) => `${c}.`)
      .join(' ');
    return {
      firstName,
      lastName,
      fullName: `${firstName} ${lastName}`,
      isInstitution: false,
    };
  }

  // Vietnamese naming order (Family Name First): e.g. "Nguyễn Văn An" -> lastName: "Nguyễn", firstName: "Văn An"
  if (!trimmed.includes(',') && isVietnameseName(trimmed)) {
    const vnTokens = trimmed.split(/\s+/).filter(Boolean);
    if (vnTokens.length >= 3) {
      const potentialCompound = `${vnTokens[0]} ${vnTokens[1]}`.toLowerCase();
      if (VIETNAMESE_COMPOUND_SURNAMES.has(potentialCompound)) {
        return {
          firstName: vnTokens.slice(2).join(' '),
          lastName: `${vnTokens[0]} ${vnTokens[1]}`,
          fullName: trimmed,
          isInstitution: false,
        };
      }
    }
    const lastName = vnTokens[0] || '';
    const firstName = vnTokens.slice(1).join(' ');
    return {
      firstName,
      lastName,
      fullName: trimmed,
      isInstitution: false,
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

  const lastParts = [tokens.pop() || ''];
  while (tokens.length > 1 && SURNAME_PARTICLES.has(tokens[tokens.length - 1].toLowerCase())) {
    lastParts.unshift(tokens.pop()!);
  }
  const lastName = lastParts.join(' ');
  const firstName = tokens.join(' ');
  return {
    firstName,
    lastName,
    fullName: `${firstName} ${lastName}`,
    isInstitution: false,
  };
}

export const parseAuthorName = parseCreatorName;

export interface RawCreatorLike {
  creatorType?: string;
  name?: string;
  fullName?: string;
  firstName?: string | null;
  lastName?: string | null;
  given?: string | null;
  family?: string | null;
  fieldMode?: number;
  [key: string]: unknown;
}

function extractCreatorDisplayName(c: RawCreatorLike): string {
  if (c.fieldMode === 1) {
    return stripLatexMarkup((c.name || c.fullName || c.lastName || c.family || '').trim());
  }
  if (c.firstName || c.lastName || c.given || c.family) {
    const first = stripLatexMarkup((c.firstName || c.given || '').trim());
    const last = stripLatexMarkup((c.lastName || c.family || '').trim());
    const explicitFull = stripLatexMarkup((c.fullName || c.name || '').trim());
    if (explicitFull && !explicitFull.includes(',') && first && last && explicitFull.includes(first) && explicitFull.includes(last)) {
      return explicitFull;
    }
    const vnCandidate = [last, first].filter(Boolean).join(' ');
    if (
      first &&
      last &&
      (VIETNAMESE_DIACRITICS_REGEX.test(vnCandidate) || isVietnameseName(vnCandidate)) &&
      VIETNAMESE_FAMILY_NAMES.has(last.split(/\s+/)[0]?.toLowerCase() || '')
    ) {
      return vnCandidate;
    }
    return [first, last].filter(Boolean).join(' ');
  }
  return stripLatexMarkup((c.fullName || c.name || '').trim());
}

function appendNormalizedCreatorEntries(entries: readonly unknown[], target: string[]): void {
  for (const entry of entries) {
    if (!entry) continue;
    if (typeof entry === 'string') {
      if (!entry.trim()) continue;
      for (const s of splitAuthorString(entry)) {
        const parsed = parseCreatorName(s);
        const full = (parsed.fullName || s).trim();
        if (full && !isNoiseAuthorName(full)) target.push(full);
      }
    } else if (typeof entry === 'object') {
      const extracted = extractCreatorDisplayName(entry as RawCreatorLike);
      if (extracted && !isNoiseAuthorName(extracted)) target.push(extracted);
    }
  }
}

/**
 * Extracts and normalizes authors array for UI presentation.
 * Supports string arrays and structured creator objects (Zotero, CSL-JSON, Mendeley).
 */
export function normalizeAuthors(
  rawAuthors?: unknown,
  creators?: Array<RawCreatorLike> | null,
  contributors?: Array<RawCreatorLike> | null,
): string[] {
  // If passed an item-like object
  if (rawAuthors && typeof rawAuthors === 'object' && !Array.isArray(rawAuthors)) {
    const candidate = rawAuthors as {
      authors?: unknown;
      creators?: RawCreatorLike[];
      contributors?: RawCreatorLike[];
    };
    if (
      candidate.authors !== undefined ||
      candidate.creators !== undefined ||
      candidate.contributors !== undefined
    ) {
      return normalizeAuthors(candidate.authors, candidate.creators, candidate.contributors);
    }
  }

  // 1. Direct string or object array
  if (Array.isArray(rawAuthors) && rawAuthors.length > 0) {
    const list: string[] = [];
    appendNormalizedCreatorEntries(rawAuthors, list);
    if (list.length > 0) return list;
  } else if (typeof rawAuthors === 'string' && rawAuthors.trim()) {
    return splitAuthorString(rawAuthors).map((s) => parseCreatorName(s).fullName || s);
  }

  // 2. Structured creators / contributors
  const creatorList =
    Array.isArray(creators) && creators.length > 0
      ? creators
      : Array.isArray(contributors) && contributors.length > 0
        ? contributors
        : [];

  if (creatorList.length > 0) {
    const names: string[] = [];
    appendNormalizedCreatorEntries(creatorList, names);
    if (names.length > 0) return names;
  }

  return [];
}

/**
 * Formats authors into a display string with an optional maxAuthors truncation threshold.
 */
export function formatAuthorsText(
  rawAuthors?: unknown,
  maxAuthors = 3,
): string {
  const list = normalizeAuthors(rawAuthors);
  if (list.length === 0) return '';
  if (list.length <= maxAuthors) return list.join(', ');
  return `${list.slice(0, maxAuthors).join(', ')} et al.`;
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

/**
 * Canonical helper to extract and format authors summary from a `LibraryItem`,
 * uniformly handling `creators`, `contributors`, and `authors`.
 */
export function getItemAuthorsSummary(
  item: Partial<Item> | unknown | null | undefined,
  maxAuthors = 3,
): string {
  if (!item) return '—';
  const rawList = normalizeAuthors(item);
  if (!rawList || rawList.length === 0) return '—';

  const cleaned = rawList
    .map((name) => {
      const clean = cleanAcademicText(name);
      if (!clean) return '';
      if (clean.includes(',')) {
        const parsed = parseCreatorName(clean);
        return parsed.fullName || clean;
      }
      return clean;
    })
    .filter((a) => Boolean(a));

  if (cleaned.length === 0) return '—';
  if (cleaned.length <= maxAuthors) return cleaned.join(', ');
  return `${cleaned.slice(0, maxAuthors).join(', ')} et al.`;
}

export {
  type CreatorEntry,
  type CreatorDraft,
  parseCreators,
  areCreatorsEqual,
  toItemCreators,
} from './creator-entries.domain';



