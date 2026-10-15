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

import type { Item, CslStyle } from '@/features/library/types/library.types';
import {
  CSL_TYPE_MAP,
  getPrimaryCreatorType,
} from '@/features/library/types/item-types.types';
import { parseCreatorName, normalizeAuthors, isInstitutionName } from './creators';
import {
  stripLatexMarkup,
  isValidValue,
  parseZoteroExtraField,
  normalizeTags,
  getItemDisplayTitle,
  getPublicationVenue,
  getItemDisplayDate,
} from './metadata';
import { cleanDoi, extractArxivId, extractPmid, extractPmcId, cleanIsbn } from './identifiers';

export interface CitationKeyInput {
  title?: string | null;
  authors?: Array<string | { name?: string; fullName?: string; lastName?: string; [key: string]: unknown }> | null;
  creators?: Array<{ firstName?: string; lastName?: string; fullName?: string; name?: string; creatorType?: string; [key: string]: unknown }> | null;
  year?: number | string | null;
  doi?: string | null;
  citationKey?: string | null;
  key?: string | null;
  id?: string | null;
  extra?: string | null;
  extraFields?: Record<string, unknown> | null;
  [key: string]: unknown;
}

const PRIMARY_AUTHOR_LIKE_CREATOR_ROLES = new Set([
  'author',
  'creator',
  'programmer',
  'inventor',
  'presenter',
  'artist',
  'performer',
  'composer',
  'director',
  'podcaster',
  'cartographer',
  'interviewee',
  'interviewer',
  'sponsor',
  'counsel',
  'contributor',
]);

/**
 * Transliterates Unicode diacritics (e.g., Đ/đ -> d, Ł/ł -> l, Ø/ø -> o, ß -> ss, NFD combining marks)
 * into clean ASCII lowercase alphanumeric characters for BibTeX keys.
 */
function toAsciiKeyPart(raw: string): string {
  if (!raw) return '';
  return stripLatexMarkup(raw)
    .replace(/[Đđ]/g, 'd')
    .replace(/[Łł]/g, 'l')
    .replace(/[Øø]/g, 'o')
    .replace(/ß/g, 'ss')
    .replace(/[Ææ]/g, 'ae')
    .replace(/[Œœ]/g, 'oe')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Computes or accesses a BibTeX-compliant citation key.
 * Format: {firstAuthorSurname}{year}{firstSignificantTitleWord}
 * Supports disambiguation suffixes (a, b, c...) when collisions exist.
 */
export function generateCitationKey(
  item?: Partial<Item> | CitationKeyInput | null,
  existingKeys?: Set<string> | string[],
): string {
  if (!item) return 'ref';

  const rec = item as Record<string, unknown>;
  const ef = (rec.extraFields as Record<string, unknown> | undefined) || {};
  const parsedExtra = parseZoteroExtraField(
    (item as CitationKeyInput).extra || (item as CitationKeyInput).extraFields,
  );
  const extraCiteKey = parsedExtra.citationKey || parsedExtra.citekey || (ef.citationKey as string | undefined);

  let baseKey = '';

  let authorPart = '';
  const rawAuthors =
    Array.isArray(item.authors) && item.authors.length > 0
      ? item.authors
      : Array.isArray((item as CitationKeyInput).creators) && (item as CitationKeyInput).creators!.length > 0
        ? (item as CitationKeyInput).creators
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
    const stopWords = new Set(['a', 'an', 'the', 'on', 'of', 'for', 'in', 'to', 'is', 'and', 'with', 'by', 'as', 'at']);
    const cleanTitle = stripLatexMarkup(String(effectiveTitle))
      .replace(/[Đđ]/g, 'd')
      .replace(/[Łł]/g, 'l')
      .replace(/[Øø]/g, 'o')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    const words = cleanTitle.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);
    for (const w of words) {
      if (!stopWords.has(w)) {
        titlePart = w;
        break;
      }
    }
  }

  if (item.citationKey && isValidValue(item.citationKey)) {
    baseKey = String(item.citationKey).trim().replace(/\s+/g, '');
  } else if (extraCiteKey && isValidValue(extraCiteKey)) {
    baseKey = String(extraCiteKey).trim().replace(/\s+/g, '');
  } else if (authorPart || yearPart || titlePart) {
    baseKey = `${authorPart || 'ref'}${yearPart}${titlePart}`;
  } else if (item.key && isValidValue(item.key)) {
    baseKey = String(item.key).trim().replace(/\s+/g, '');
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

  return `${baseKey}_${Date.now()}`;
}

export const getItemCitationKey = generateCitationKey;
export const getPaperCitationKey = generateCitationKey;

export interface BibTeXExportableItem {
  title?: string;
  caseName?: string | null;
  nameOfAct?: string | null;
  subject?: string | null;
  authors?: string[];
  creators?: Array<{
    firstName?: string;
    lastName?: string;
    fullName?: string;
    name?: string;
    creatorType?: string;
    fieldMode?: number;
    shortName?: string;
    [key: string]: unknown;
  }>;
  year?: number | string | null;
  publicationDate?: string | null;
  date?: string | null;
  issueDate?: string | null;
  filingDate?: string | null;
  dateDecided?: string | null;
  dateEnacted?: string | null;
  doi?: string | null;
  DOI?: string | null;
  arxivId?: string | null;
  archiveID?: string | null;
  isbn?: string | null;
  ISBN?: string | null;
  issn?: string | null;
  ISSN?: string | null;
  pmid?: string | null;
  PMID?: string | null;
  pmcid?: string | null;
  PMCID?: string | null;
  url?: string | null;
  accessDate?: string | null;
  accessedAt?: string | null;
  itemType?: string;
  journal?: string | null;
  journalAbbr?: string | null;
  journalAbbreviation?: string | null;
  shortTitle?: string | null;
  publicationTitle?: string | null;
  booktitle?: string | null;
  bookTitle?: string | null;
  proceedingsTitle?: string | null;
  dictionaryTitle?: string | null;
  encyclopediaTitle?: string | null;
  websiteTitle?: string | null;
  blogTitle?: string | null;
  forumTitle?: string | null;
  programTitle?: string | null;
  sessionTitle?: string | null;
  conferenceName?: string | null;
  meetingName?: string | null;
  presentationType?: string | null;
  publisher?: string | null;
  university?: string | null;
  institution?: string | null;
  issuingAuthority?: string | null;
  authority?: string | null;
  court?: string | null;
  legislativeBody?: string | null;
  company?: string | null;
  organization?: string | null;
  distributor?: string | null;
  studio?: string | null;
  network?: string | null;
  label?: string | null;
  country?: string | null;
  place?: string | null;
  eventPlace?: string | null;
  repositoryLocation?: string | null;
  volume?: string | number | null;
  reporterVolume?: string | number | null;
  codeVolume?: string | number | null;
  issue?: string | number | null;
  number?: string | number | null;
  reportNumber?: string | number | null;
  patentNumber?: string | number | null;
  docketNumber?: string | number | null;
  publicLawNumber?: string | number | null;
  billNumber?: string | number | null;
  documentNumber?: string | number | null;
  identifier?: string | number | null;
  episodeNumber?: string | number | null;
  versionNumber?: string | number | null;
  version?: string | number | null;
  programmingLanguage?: string | null;
  reportType?: string | null;
  thesisType?: string | null;
  manuscriptType?: string | null;
  letterType?: string | null;
  mapType?: string | null;
  postType?: string | null;
  websiteType?: string | null;
  genre?: string | null;
  type?: string | null;
  series?: string | null;
  seriesTitle?: string | null;
  seriesNumber?: string | number | null;
  edition?: string | number | null;
  numPages?: string | number | null;
  numberOfPages?: string | number | null;
  pages?: string | null;
  firstPage?: string | null;
  codePages?: string | null;
  reporter?: string | null;
  code?: string | null;
  archive?: string | null;
  repository?: string | null;
  archiveLocation?: string | null;
  callNumber?: string | null;
  language?: string | null;
  abstract?: string | null;
  abstractNote?: string | null;
  tags?: unknown;
  keywords?: unknown;
  citationKey?: string | null;
  extra?: string | null;
  extraFields?: Record<string, unknown> | null;
  [key: string]: unknown;
}

function formatBibTeXCreatorToken(
  creator:
    | string
    | {
        firstName?: string;
        lastName?: string;
        fullName?: string;
        name?: string;
        fieldMode?: number;
        [key: string]: unknown;
      },
): string {
  if (typeof creator === 'string') {
    const clean = stripLatexMarkup(creator.trim());
    if (!clean) return '';
    if (isInstitutionName(clean)) {
      return `{${clean}}`;
    }
    return clean;
  }
  const rawName = stripLatexMarkup(
    String(creator.name || creator.fullName || '').trim(),
  );
  const first = stripLatexMarkup(
    String(creator.firstName || (creator as Record<string, unknown>).given || '').trim(),
  );
  const last = stripLatexMarkup(
    String(creator.lastName || (creator as Record<string, unknown>).family || '').trim(),
  );
  const display = [first, last].filter(Boolean).join(' ') || rawName;
  if (!display) return '';
  if (
    creator.fieldMode === 1 ||
    (!first && isInstitutionName(rawName || last || display))
  ) {
    return `{${rawName || last || display}}`;
  }
  return normalizeAuthors([creator])[0] || display;
}

export interface ItemTypeExportSpec {
  bibtexType: string;
  risType: string;
  cslType: string;
}

/**
 * Declarative item-type export specification table mapping Zotero & CSL itemType keys
 * to BibTeX entry types, RIS `TY` tags, and CSL-JSON `type` values across all 37 Zotero types.
 */
export const ITEM_TYPE_EXPORT_SPEC: Record<string, ItemTypeExportSpec> = {
  journalarticle: { bibtexType: 'article', risType: 'JOUR', cslType: 'article-journal' },
  'article-journal': { bibtexType: 'article', risType: 'JOUR', cslType: 'article-journal' },
  magazinearticle: { bibtexType: 'article', risType: 'MGZN', cslType: 'article-magazine' },
  newspaperarticle: { bibtexType: 'article', risType: 'NEWS', cslType: 'article-newspaper' },
  preprint: { bibtexType: 'article', risType: 'JOUR', cslType: 'article' },
  conferencepaper: { bibtexType: 'inproceedings', risType: 'CONF', cslType: 'paper-conference' },
  'paper-conference': { bibtexType: 'inproceedings', risType: 'CONF', cslType: 'paper-conference' },
  inproceedings: { bibtexType: 'inproceedings', risType: 'CONF', cslType: 'paper-conference' },
  book: { bibtexType: 'book', risType: 'BOOK', cslType: 'book' },
  booksection: { bibtexType: 'incollection', risType: 'CHAP', cslType: 'chapter' },
  chapter: { bibtexType: 'incollection', risType: 'CHAP', cslType: 'chapter' },
  incollection: { bibtexType: 'incollection', risType: 'CHAP', cslType: 'chapter' },
  inbook: { bibtexType: 'incollection', risType: 'CHAP', cslType: 'chapter' },
  dictionaryentry: { bibtexType: 'incollection', risType: 'DICT', cslType: 'entry-dictionary' },
  encyclopediaarticle: { bibtexType: 'incollection', risType: 'ENCYC', cslType: 'entry-encyclopedia' },
  thesis: { bibtexType: 'phdthesis', risType: 'THES', cslType: 'thesis' },
  phdthesis: { bibtexType: 'phdthesis', risType: 'THES', cslType: 'thesis' },
  mastersthesis: { bibtexType: 'mastersthesis', risType: 'THES', cslType: 'thesis' },
  report: { bibtexType: 'techreport', risType: 'RPRT', cslType: 'report' },
  techreport: { bibtexType: 'techreport', risType: 'RPRT', cslType: 'report' },
  webpage: { bibtexType: 'misc', risType: 'ELEC', cslType: 'webpage' },
  blogpost: { bibtexType: 'misc', risType: 'BLOG', cslType: 'post-weblog' },
  'post-weblog': { bibtexType: 'misc', risType: 'BLOG', cslType: 'post-weblog' },
  forumpost: { bibtexType: 'misc', risType: 'ELEC', cslType: 'post' },
  dataset: { bibtexType: 'misc', risType: 'DATA', cslType: 'dataset' },
  computerprogram: { bibtexType: 'misc', risType: 'COMP', cslType: 'software' },
  software: { bibtexType: 'misc', risType: 'COMP', cslType: 'software' },
  patent: { bibtexType: 'misc', risType: 'PAT', cslType: 'patent' },
  standard: { bibtexType: 'misc', risType: 'STAND', cslType: 'standard' },
  manuscript: { bibtexType: 'unpublished', risType: 'UNPB', cslType: 'manuscript' },
  presentation: { bibtexType: 'inproceedings', risType: 'CONF', cslType: 'speech' },
  speech: { bibtexType: 'inproceedings', risType: 'CONF', cslType: 'speech' },
  case: { bibtexType: 'misc', risType: 'CASE', cslType: 'legal_case' },
  legal_case: { bibtexType: 'misc', risType: 'CASE', cslType: 'legal_case' },
  statute: { bibtexType: 'misc', risType: 'STAT', cslType: 'legislation' },
  legislation: { bibtexType: 'misc', risType: 'STAT', cslType: 'legislation' },
  bill: { bibtexType: 'misc', risType: 'BILL', cslType: 'bill' },
  hearing: { bibtexType: 'misc', risType: 'HEAR', cslType: 'hearing' },
  artwork: { bibtexType: 'misc', risType: 'ART', cslType: 'graphic' },
  audiorecording: { bibtexType: 'misc', risType: 'SOUND', cslType: 'song' },
  videorecording: { bibtexType: 'misc', risType: 'ADVS', cslType: 'motion_picture' },
  film: { bibtexType: 'misc', risType: 'MPCT', cslType: 'motion_picture' },
  tvbroadcast: { bibtexType: 'misc', risType: 'ADVS', cslType: 'broadcast' },
  radiobroadcast: { bibtexType: 'misc', risType: 'ADVS', cslType: 'broadcast' },
  podcast: { bibtexType: 'misc', risType: 'SOUND', cslType: 'broadcast' },
  map: { bibtexType: 'misc', risType: 'MAP', cslType: 'map' },
  interview: { bibtexType: 'misc', risType: 'INTV', cslType: 'interview' },
  letter: { bibtexType: 'misc', risType: 'PCOMM', cslType: 'personal_communication' },
  email: { bibtexType: 'misc', risType: 'PCOMM', cslType: 'personal_communication' },
  instantmessage: { bibtexType: 'misc', risType: 'PCOMM', cslType: 'personal_communication' },
  document: { bibtexType: 'misc', risType: 'GEN', cslType: 'document' },
};

const MASTERS_THESIS_REGEX = /master|m\.?s\.?|m\.?a\.?|m\.?sc|m\.?eng|m\.?phil|thạc\s*sĩ/i;

export function resolveExportSpec(item: BibTeXExportableItem): ItemTypeExportSpec {
  const rawType = (item.itemType || '').trim();
  const t = rawType.toLowerCase();
  const baseSpec = ITEM_TYPE_EXPORT_SPEC[t] || {
    bibtexType: 'article',
    risType: 'JOUR',
    cslType: CSL_TYPE_MAP[rawType] || 'article-journal',
  };

  if (baseSpec.bibtexType === 'phdthesis') {
    const ef = (item.extraFields as Record<string, unknown> | undefined) || {};
    const parsedExtra = parseZoteroExtraField(item.extra || item.extraFields);
    const rawThesisType = String(
      item.thesisType || ef.thesisType || parsedExtra.thesisType || item.genre || item.type || '',
    ).trim();
    if (MASTERS_THESIS_REGEX.test(rawThesisType)) {
      return { ...baseSpec, bibtexType: 'mastersthesis' };
    }
  }
  return baseSpec;
}

function pickFromRecord(
  rec: Record<string, unknown>,
  ef: Record<string, unknown>,
  parsedExtra: Record<string, string>,
  keys: readonly string[],
): string {
  for (const k of keys) {
    if (isValidValue(rec[k])) return String(rec[k]).trim();
  }
  for (const k of keys) {
    if (isValidValue(ef[k])) return String(ef[k]).trim();
  }
  for (const k of keys) {
    if (isValidValue(parsedExtra[k])) return String(parsedExtra[k]).trim();
  }
  return '';
}

const BOOKTITLE_CANDIDATE_KEYS = [
  'booktitle',
  'bookTitle',
  'proceedingsTitle',
  'dictionaryTitle',
  'encyclopediaTitle',
  'meetingName',
  'conferenceName',
  'sessionTitle',
] as const;

const VENUE_CONTAINER_KEYS = [
  'publicationTitle',
  'journal',
  'proceedingsTitle',
  'bookTitle',
  'dictionaryTitle',
  'encyclopediaTitle',
  'websiteTitle',
  'blogTitle',
  'forumTitle',
  'programTitle',
  'sessionTitle',
  'meetingName',
  'conferenceName',
  'reporter',
  'code',
] as const;

const PUBLISHER_EXPORT_KEYS = [
  'publisher',
  'university',
  'institution',
  'issuingAuthority',
  'authority',
  'court',
  'legislativeBody',
  'company',
  'organization',
  'repository',
  'distributor',
  'studio',
  'network',
  'label',
] as const;

const AUTHORITY_EXPORT_KEYS = [
  'issuingAuthority',
  'authority',
  'court',
  'legislativeBody',
  'organization',
] as const;

const PLACE_EXPORT_KEYS = [
  'eventPlace',
  'repositoryLocation',
  'place',
  'country',
] as const;

const VOLUME_EXPORT_KEYS = ['volume', 'reporterVolume', 'codeVolume'] as const;

const DOC_NUMBER_EXPORT_KEYS = [
  'reportNumber',
  'patentNumber',
  'docketNumber',
  'publicLawNumber',
  'billNumber',
  'documentNumber',
  'identifier',
  'episodeNumber',
  'number',
] as const;

const ISSUE_OR_NUMBER_EXPORT_KEYS = ['issue', ...DOC_NUMBER_EXPORT_KEYS] as const;

const PAGES_EXPORT_KEYS = ['pages', 'firstPage', 'codePages'] as const;

const SUBTYPE_GENRE_EXPORT_KEYS = [
  'thesisType',
  'reportType',
  'presentationType',
  'manuscriptType',
  'letterType',
  'mapType',
  'postType',
  'websiteType',
  'genre',
] as const;

const DATE_EXPORT_KEYS = [
  'publicationDate',
  'date',
  'issueDate',
  'dateDecided',
  'dateEnacted',
  'filingDate',
] as const;

interface NormalizedExportPartial {
  citeKey: string;
  title: string;
  shortTitle: string;
  year: string | number;
  rawDate: string;
  accessDate: string;
  venue: string;
  journal: string;
  booktitle: string;
  journalAbbr: string;
  series: string;
  seriesNumber: string;
  edition: string;
  version: string;
  volume: string;
  issue: string;
  docNumber: string;
  issueOrNumber: string;
  pages: string;
  numPages: string;
  publisher: string;
  school: string;
  institution: string;
  authority: string;
  place: string;
  eventTitle: string;
  genre: string;
  thesisType: string;
  reportType: string;
  archive: string;
  archiveLocation: string;
  callNumber: string;
  language: string;
  abstract: string;
  doi: string;
  arxiv: string;
  isbn: string;
  issn: string;
  pmid: string;
  pmcid: string;
  url: string;
}

/**
 * Extracts a single normalized export partial from a `BibTeXExportableItem`,
 * shared across `formatCitation`, `toBibTeXEntry`, `formatRis`, and `formatCslJson`.
 */
function extractNormalizedExportPartial(
  item: BibTeXExportableItem,
  bibtexType = 'article',
): NormalizedExportPartial {
  const rec = item as Record<string, unknown>;
  const ef = (item.extraFields as Record<string, unknown> | undefined) || {};
  const parsedExtra = parseZoteroExtraField(item.extra || item.extraFields);
  const pick = (keys: readonly string[]) => pickFromRecord(rec, ef, parsedExtra, keys);

  const citeKey =
    pick(['citationKey']) || generateCitationKey(item);
  const title = getItemDisplayTitle(item) || item.title || '';
  const yearVal = item.year || getItemDisplayDate(item) || parsedExtra.originalDate || '';
  const venue = pick(VENUE_CONTAINER_KEYS) || getPublicationVenue(item);
  const journal =
    pick(['journal']) ||
    (bibtexType === 'article' ? pick(['publicationTitle']) : '');
  const booktitle =
    pick(BOOKTITLE_CANDIDATE_KEYS) ||
    (bibtexType === 'inproceedings' || bibtexType === 'incollection'
      ? pick(['publicationTitle'])
      : '');

  const rawAccessDate = pick(['accessDate', 'accessedAt']);
  const accessDate =
    rawAccessDate.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] || rawAccessDate;

  return {
    citeKey,
    title,
    shortTitle: pick(['shortTitle']),
    year: isValidValue(yearVal) ? yearVal : '',
    rawDate: pick(DATE_EXPORT_KEYS),
    accessDate,
    venue,
    journal,
    booktitle,
    journalAbbr: pick(['journalAbbr', 'journalAbbreviation']),
    series: pick(['series', 'seriesTitle']),
    seriesNumber: pick(['seriesNumber']),
    edition: pick(['edition']),
    version: pick(['versionNumber', 'version']),
    volume: pick(VOLUME_EXPORT_KEYS),
    issue: pick(['issue']),
    docNumber: pick(DOC_NUMBER_EXPORT_KEYS),
    issueOrNumber: pick(ISSUE_OR_NUMBER_EXPORT_KEYS),
    pages: pick(PAGES_EXPORT_KEYS),
    numPages: pick(['numPages', 'numberOfPages']),
    publisher: pick(PUBLISHER_EXPORT_KEYS),
    school: pick(['university', 'publisher', 'institution']),
    institution: pick(['institution', 'publisher', 'university']),
    authority: pick(AUTHORITY_EXPORT_KEYS),
    place: pick(PLACE_EXPORT_KEYS),
    eventTitle: pick(['conferenceName', 'meetingName']),
    genre: pick(SUBTYPE_GENRE_EXPORT_KEYS),
    thesisType: pick(['thesisType']),
    reportType: pick(['reportType']),
    archive: pick(['archive', 'repository']),
    archiveLocation: pick(['archiveLocation']),
    callNumber: pick(['callNumber']),
    language: pick(['language']),
    abstract: pick(['abstract', 'abstractNote']),
    doi: cleanDoi(pick(['doi', 'DOI'])) || '',
    arxiv: extractArxivId(pick(['arxivId', 'archiveID', 'archiveId'])) || '',
    isbn: cleanIsbn(pick(['isbn', 'ISBN'])) || '',
    issn: pick(['issn', 'ISSN']),
    pmid: extractPmid(pick(['pmid', 'PMID'])) || '',
    pmcid: extractPmcId(pick(['pmcid', 'PMCID'])) || '',
    url: pick(['url']),
  };
}

/**
 * Formats a fallback client-side citation string (APA or IEEE) for an item.
 */
export function formatCitation(item: Partial<Item>, style: CslStyle = 'apa'): string {
  const p = extractNormalizedExportPartial(item as BibTeXExportableItem);
  const authors = normalizeAuthors(item.authors, item.creators);
  const year = p.year || 'n.d.';
  const title = stripLatexMarkup(p.title || 'Untitled');
  const venue = stripLatexMarkup(getPublicationVenue(item) || p.venue);
  const { volume, issueOrNumber: issue, pages, doi, url } = p;

  if (style === 'ieee') {
    const ieeeAuthors = authors
      .map((a) => {
        const parsed = parseCreatorName(a);
        if (parsed.isInstitution || !parsed.firstName) return parsed.fullName;
        const initials = parsed.firstName
          .split(/\s+/)
          .filter(Boolean)
          .map((w) => `${w[0]}.`)
          .join(' ');
        return `${initials} ${parsed.lastName}`;
      })
      .join(', ');
    return [
      ieeeAuthors ? `${ieeeAuthors},` : '',
      `"${title},"`,
      venue ? `${venue},` : '',
      volume ? `vol. ${volume},` : '',
      issue ? `no. ${issue},` : '',
      pages ? `pp. ${pages},` : '',
      `${year}.`,
      doi ? `doi: ${doi}.` : url ? `[Online]. Available: ${url}` : '',
    ]
      .filter(Boolean)
      .join(' ');
  }

  const apaAuthors = authors
    .map((a) => {
      const parsed = parseCreatorName(a);
      if (parsed.isInstitution || !parsed.firstName) return parsed.fullName;
      const initials = parsed.firstName
        .split(/\s+/)
        .filter(Boolean)
        .map((w) => `${w[0]}.`)
        .join(' ');
      return `${parsed.lastName}, ${initials}`;
    })
    .join(', ');

  let apaVenueBlock = '';
  if (venue) {
    apaVenueBlock = venue;
    if (volume) {
      apaVenueBlock += `, ${volume}${issue ? `(${issue})` : ''}`;
    } else if (issue) {
      apaVenueBlock += ` (${issue})`;
    }
    if (pages) apaVenueBlock += `, ${pages}`;
    apaVenueBlock += '.';
  } else if (volume || issue || pages) {
    const volIssue = volume ? `${volume}${issue ? `(${issue})` : ''}` : issue ? `(${issue})` : '';
    apaVenueBlock = `${[volIssue, pages].filter(Boolean).join(', ')}.`;
  }

  return [
    apaAuthors || 'Unknown',
    `(${year}).`,
    `${title}.`,
    apaVenueBlock,
    doi ? `https://doi.org/${doi}` : url ? `Retrieved from ${url}` : '',
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * Exports a bibliographic item to a standard BibTeX entry string.
 * Supports full Zotero/CSL item type mappings, editors, school/institution, booktitle, and Zotero Extra fallbacks.
 */
export function toBibTeXEntry(item: BibTeXExportableItem): string {
  const { bibtexType: entryType } = resolveExportSpec(item);
  const p = extractNormalizedExportPartial(item, entryType);
  const lines = [`@${entryType}{${p.citeKey},`];

  const emitField = (tag: string, val?: string | number | null, cleanLatex = true) => {
    if (val === undefined || val === null || !isValidValue(val)) return;
    const str = cleanLatex ? stripLatexMarkup(String(val)) : String(val).trim();
    if (str) lines.push(`  ${tag} = {${str}},`);
  };

  lines.push(`  title = {${stripLatexMarkup(p.title)}},`);

  const primaryRoleForType = getPrimaryCreatorType(item.itemType).toLowerCase();
  const authorCreators = Array.isArray(item.creators)
    ? item.creators.filter((c) => {
        const role = (c.creatorType || 'author').toLowerCase();
        return (
          role === primaryRoleForType ||
          PRIMARY_AUTHOR_LIKE_CREATOR_ROLES.has(role) ||
          (c.fieldMode === 1 && role !== 'editor' && role !== 'serieseditor' && role !== 'translator')
        );
      })
    : [];
  const editorCreators = Array.isArray(item.creators)
    ? item.creators.filter((c) => c.creatorType === 'editor' || c.creatorType === 'seriesEditor')
    : [];

  const normalizedAuthors =
    authorCreators.length > 0 &&
    (authorCreators.some((c) => c.fieldMode === 1) || !Array.isArray(item.authors) || item.authors.length === 0)
      ? authorCreators.map((c) => formatBibTeXCreatorToken(c)).filter(Boolean)
      : Array.isArray(item.authors)
        ? item.authors
            .filter((a) => isValidValue(a))
            .map((a) => formatBibTeXCreatorToken(a))
            .filter(Boolean)
        : [];

  if (normalizedAuthors.length > 0) {
    emitField('author', normalizedAuthors.join(' and '), false);
  }
  if (editorCreators.length > 0) {
    const normalizedEditors = editorCreators.map((c) => formatBibTeXCreatorToken(c)).filter(Boolean);
    if (normalizedEditors.length > 0) {
      emitField('editor', normalizedEditors.join(' and '), false);
    }
  }

  emitField('year', p.year, false);

  if (entryType === 'inproceedings' || entryType === 'incollection') {
    emitField('booktitle', p.booktitle);
  } else if (p.journal) {
    emitField('journal', p.journal);
  } else if (p.booktitle) {
    emitField('booktitle', p.booktitle);
  }

  if (entryType === 'phdthesis' || entryType === 'mastersthesis') {
    emitField('school', p.school);
    emitField('type', p.thesisType);
  } else if (entryType === 'techreport') {
    emitField('institution', p.institution);
    emitField('type', p.reportType);
  } else {
    emitField('publisher', p.publisher);
    emitField('type', p.genre);
  }

  const normalizedPages = p.pages
    ? p.pages.replace(/^(\d+)\s*[-–—]\s*(\d+)$/, '$1--$2')
    : '';

  const standardFields: ReadonlyArray<readonly [string, string, boolean]> = [
    ['version', p.version, true],
    ['series', p.series, true],
    ['edition', p.edition, true],
    ['address', p.place, true],
    ['volume', p.volume, false],
    ['number', p.issueOrNumber, false],
    ['pages', normalizedPages, false],
    ['doi', p.doi, false],
  ];
  for (const [tag, val, clean] of standardFields) {
    emitField(tag, val, clean);
  }

  if (p.arxiv) {
    emitField('eprint', p.arxiv, false);
    emitField('archiveprefix', 'arXiv', false);
  }

  const identifierFields: ReadonlyArray<readonly [string, string]> = [
    ['isbn', p.isbn],
    ['issn', p.issn],
    ['pmid', p.pmid],
    ['pmcid', p.pmcid],
    ['url', p.url],
    ['urldate', p.accessDate],
  ];
  for (const [tag, val] of identifierFields) {
    emitField(tag, val, false);
  }

  const lastIdx = lines.length - 1;
  if (lines[lastIdx]!.endsWith(',')) {
    lines[lastIdx] = lines[lastIdx]!.slice(0, -1);
  }
  lines.push('}');
  return lines.join('\n');
}

export const formatBibTeX = toBibTeXEntry;

/**
 * Exports a bibliographic item to a standard RIS record string.
 */
export function formatRis(item: BibTeXExportableItem): string {
  const { risType } = resolveExportSpec(item);
  const p = extractNormalizedExportPartial(item);
  const lines: string[] = [`TY  - ${risType}`];

  const emitTag = (tag: string, val?: string | number | null, cleanLatex = true) => {
    if (val === undefined || val === null || !isValidValue(val)) return;
    const str = cleanLatex ? stripLatexMarkup(String(val)) : String(val).trim();
    if (str) lines.push(`${tag}  - ${str}`);
  };

  emitTag('TI', p.title);
  emitTag('ST', p.shortTitle);

  if (Array.isArray(item.creators) && item.creators.length > 0) {
    for (const c of item.creators) {
      const role = (c.creatorType || 'author').toLowerCase();
      const tag =
        role === 'editor' || role === 'serieseditor'
          ? 'ED'
          : role === 'translator'
            ? 'TA'
            : 'AU';
      const rawName = stripLatexMarkup(String(c.name || c.fullName || '').trim());
      const first = stripLatexMarkup(String(c.firstName || (c as Record<string, unknown>).given || '').trim());
      const last = stripLatexMarkup(String(c.lastName || (c as Record<string, unknown>).family || '').trim());
      if (c.fieldMode === 1 || (!first && isInstitutionName(rawName || last))) {
        emitTag(tag, rawName || last, false);
      } else if (last && first) {
        emitTag(tag, `${last}, ${first}`, false);
      } else if (rawName) {
        const parsed = parseCreatorName(rawName);
        const formatted =
          !parsed.isInstitution && parsed.lastName && parsed.firstName
            ? `${parsed.lastName}, ${parsed.firstName}`
            : parsed.fullName || rawName;
        emitTag(tag, formatted, false);
      } else if (last || first) {
        emitTag(tag, last || first, false);
      }
    }
  } else if (Array.isArray(item.authors) && item.authors.length > 0) {
    for (const au of normalizeAuthors(item.authors)) {
      const parsed = parseCreatorName(au);
      const risAuthor =
        !parsed.isInstitution && parsed.lastName && parsed.firstName
          ? `${parsed.lastName}, ${parsed.firstName}`
          : parsed.fullName || au;
      emitTag('AU', risAuthor, false);
    }
  }

  emitTag('PY', p.year, false);
  emitTag('T2', p.venue);
  emitTag('J2', p.journalAbbr);
  emitTag('T3', p.series);
  emitTag('ET', p.edition || p.version);
  emitTag('VL', p.volume, false);
  emitTag('IS', p.issueOrNumber, false);

  if (p.pages) {
    const rangeMatch = p.pages.match(/^([^\s\-–—]+)\s*(?:--|[-–—])\s*([^\s\-–—]+)$/);
    if (rangeMatch?.[1] && rangeMatch?.[2]) {
      emitTag('SP', rangeMatch[1], false);
      emitTag('EP', rangeMatch[2], false);
    } else {
      emitTag('SP', p.pages, false);
    }
  }

  emitTag('PB', p.publisher);
  emitTag('CY', p.place);
  emitTag('DO', p.doi, false);
  emitTag('SN', p.isbn || p.issn, false);
  emitTag('AN', p.pmid, false);
  emitTag('C2', p.pmcid, false);
  emitTag('Y2', p.accessDate, false);

  for (const kw of normalizeTags(item)) {
    emitTag('KW', kw, false);
  }

  emitTag('AB', p.abstract);
  emitTag('UR', p.url, false);

  lines.push('ER  - ');
  return lines.join('\n');
}

function parseIsoDateParts(rawDate?: unknown, fallbackYear?: unknown): number[] | null {
  if (rawDate && isValidValue(rawDate)) {
    const s = String(rawDate).trim();
    const ymdMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (ymdMatch) {
      return [
        parseInt(ymdMatch[1]!, 10),
        parseInt(ymdMatch[2]!, 10),
        parseInt(ymdMatch[3]!, 10),
      ];
    }
    const ymMatch = s.match(/^(\d{4})-(\d{2})$/);
    if (ymMatch) {
      return [parseInt(ymMatch[1]!, 10), parseInt(ymMatch[2]!, 10)];
    }
    const yMatch = s.match(/\b(\d{4})\b/);
    if (yMatch) {
      return [parseInt(yMatch[1]!, 10)];
    }
  }
  if (fallbackYear && isValidValue(fallbackYear)) {
    const yNum = parseInt(String(fallbackYear), 10);
    if (!isNaN(yNum)) return [yNum];
  }
  return null;
}

const CREATOR_ROLE_TO_CSL_FIELD: Record<string, string> = {
  author: 'author',
  creator: 'author',
  programmer: 'author',
  inventor: 'author',
  artist: 'author',
  performer: 'author',
  composer: 'composer',
  cartographer: 'author',
  podcaster: 'author',
  presenter: 'author',
  interviewee: 'author',
  sponsor: 'author',
  counsel: 'author',
  editor: 'editor',
  translator: 'translator',
  serieseditor: 'collection-editor',
  bookauthor: 'container-author',
  director: 'director',
  producer: 'producer',
  executiveproducer: 'executive-producer',
  scriptwriter: 'script-writer',
  seriescreator: 'series-creator',
  interviewer: 'interviewer',
  recipient: 'recipient',
  reviewedauthor: 'reviewed-author',
  contributor: 'contributor',
  chair: 'chair',
  organizer: 'organizer',
  host: 'host',
  guest: 'guest',
  narrator: 'narrator',
  castmember: 'performer',
};

/**
 * Exports a bibliographic item to a standard CSL-JSON object.
 */
export function formatCslJson(item: BibTeXExportableItem): Record<string, unknown> {
  const { cslType } = resolveExportSpec(item);
  const p = extractNormalizedExportPartial(item);

  const csl: Record<string, unknown> = {
    id: p.citeKey,
    type: cslType,
    title: stripLatexMarkup(p.title),
  };

  if (Array.isArray(item.creators) && item.creators.length > 0) {
    const groupedCreators: Record<string, Array<Record<string, unknown>>> = {};
    for (const c of item.creators) {
      const roleKey = (c.creatorType || 'author').toLowerCase();
      const cslField = CREATOR_ROLE_TO_CSL_FIELD[roleKey] || 'author';
      const rawName = stripLatexMarkup(String(c.name || c.fullName || '').trim());
      const first = stripLatexMarkup(String(c.firstName || (c as Record<string, unknown>).given || '').trim());
      const last = stripLatexMarkup(String(c.lastName || (c as Record<string, unknown>).family || '').trim());

      let entry: Record<string, unknown> | null = null;
      if (c.fieldMode === 1 || (!first && isInstitutionName(rawName || last))) {
        const literalName = rawName || last;
        if (literalName) entry = { literal: literalName };
      } else if (last || first) {
        entry = {
          family: last || rawName,
          ...(first ? { given: first } : {}),
        };
      } else if (rawName) {
        const parsed = parseCreatorName(rawName);
        entry = parsed.isInstitution
          ? { literal: parsed.fullName }
          : {
              family: parsed.lastName || parsed.fullName,
              ...(parsed.firstName ? { given: parsed.firstName } : {}),
            };
      }

      if (entry) {
        if (!groupedCreators[cslField]) groupedCreators[cslField] = [];
        groupedCreators[cslField]!.push(entry);
      }
    }
    for (const [cslField, list] of Object.entries(groupedCreators)) {
      if (list.length > 0) csl[cslField] = list;
    }
  } else if (Array.isArray(item.authors) && item.authors.length > 0) {
    const cslAuthors = normalizeAuthors(item.authors).map((a) => {
      const parsed = parseCreatorName(a);
      return parsed.isInstitution
        ? { literal: parsed.fullName }
        : { family: parsed.lastName || parsed.fullName, given: parsed.firstName || undefined };
    });
    if (cslAuthors.length > 0) csl.author = cslAuthors;
  }

  const issuedParts = parseIsoDateParts(p.rawDate, p.year);
  if (issuedParts) csl.issued = { 'date-parts': [issuedParts] };

  const accessedParts = parseIsoDateParts(p.accessDate);
  if (accessedParts) csl.accessed = { 'date-parts': [accessedParts] };

  const containerVal = pickFromRecord(
    item as Record<string, unknown>,
    (item.extraFields as Record<string, unknown>) || {},
    parseZoteroExtraField(item.extra || item.extraFields),
    VENUE_CONTAINER_KEYS.filter((k) => k !== 'meetingName' && k !== 'conferenceName'),
  );

  const cslFieldSpecs: ReadonlyArray<readonly [string, string, boolean]> = [
    ['title-short', p.shortTitle, true],
    ['container-title', containerVal, true],
    ['container-title-short', p.journalAbbr, true],
    ['collection-title', p.series, true],
    ['collection-number', p.seriesNumber, false],
    ['edition', p.edition, false],
    ['version', p.version, false],
    ['volume', p.volume, false],
    ['issue', p.issue, false],
    ['page', p.pages, false],
    ['number-of-pages', p.numPages, false],
    ['number', p.docNumber, false],
    ['genre', p.genre, true],
    ['event-title', p.eventTitle, true],
    ['authority', p.authority, true],
    ['publisher', p.publisher, true],
    ['publisher-place', p.place, true],
    ['archive', p.archive, true],
    ['archive_location', p.archiveLocation, true],
    ['call-number', p.callNumber, true],
    ['language', p.language, false],
    ['abstract', p.abstract, true],
    ['DOI', p.doi, false],
    ['PMID', p.pmid, false],
    ['PMCID', p.pmcid, false],
    ['ISBN', p.isbn, false],
    ['ISSN', p.issn, false],
    ['URL', p.url, false],
  ];

  for (const [cslKey, rawVal, cleanLatex] of cslFieldSpecs) {
    if (isValidValue(rawVal)) {
      csl[cslKey] = cleanLatex ? stripLatexMarkup(rawVal) : rawVal;
    }
  }

  return csl;
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
