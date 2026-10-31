import {
  ALL_SCHEMA_FIELD_KEYS,
  FIELD_LABELS,
  INITIAL_ITEM_TYPE_FIELDS_MAP,
  ITEM_TYPE_FIELDS_MAP,
  humanizeFieldName,
} from './types/item-fields.constants';
import {
  BASE_FIELD_MAPPINGS,
  registerSchemaRegistryUpdateListener,
} from './types/item-types.types';
import type { Item } from './types/core.types';

/**
 * Genuine Zotero 7 `Extra` keys that are also valid schema fields on specific item types
 * (`PMID`/`PMCID` on `journalArticle`, `originalDate` on `book`/`bookSection`) and must remain
 * allowed as explicit `Key: Value` lines in the Zotero `Extra` textarea.
 */
export const ALLOWED_ITEM_EXTRA_LINE_KEYS = new Set<string>([
  'pmid',
  'pmcid',
  'originaldate',
]);

export const SYSTEM_INTERNAL_METADATA_KEYS = new Set<string>([
  'dismissedduplicateids',
  'mergedcitationkeys',
  'mergedfromids',
  'isretracted',
  'retraction',
  'retractionstatus',
  'retractiondate',
  'retractionnature',
  'retractionreasons',
  'retractionnoticedoi',
  'retractiondetails',
  'retractioncheckedat',
  'ismypublication',
  'publicationconfirmedat',
  'provenance',
  'fieldprovenance',
  'sourceprovider',
  'source',
  'sources',
  'extractionstatus',
  'ingestionstatus',
  'verificationscore',
  'isverified',
  'matchedsignals',
  'missingfields',
  'isselfsufficient',
  'qualityscore',
  'engineused',
  'primarycategory',
  'categories',
  'journalref',
  'warnings',
  'disambiguationwarning',
  'rejectedciteddoi',
  'wafkind',
  'promptuploadpdf',
  'crossrefenriched',
  'confidencescore',
  'originprovider',
  'canonicalid',
  'canonicalurl',
  'resolvedat',
  '_version',
  'version',
  'expectedversion',
  'isdeleted',
  'silent',
  'deletedat',
  'createdat',
  'updatedat',
  'dateadded',
  'datemodified',
  'id',
  'itemid',
  'paperid',
  'userid',
  'projectid',
  'scopeid',
  'uploadedbyid',
  'createdbyid',
  'fileid',
  'filename',
  'mimetype',
  'size',
  'primaryfile',
  'hasfile',
  'attachmentcount',
  'notecount',
  'firstauthor',
  'userstates',
  'states',
  'readstatus',
  'rating',
  'lastreadat',
  'outgoingrel',
  'incomingrel',
  'relations',
  'seealso',
  'identifiers',
  'itemtags',
  'zoterotags',
  'collectionitems',
  'noteslist',
  'ingestionruns',
  'itemmetadata',
  'publications',
  'abstract',
  'openaccesspdfurl',
  'pdfurl',
  'fileurl',
  'year',
  'publicationdate',
  'accessedat',
  'itemtype',
  'citationcount',
  'referencecount',
  'authors',
  'creators',
  'contributors',
  'editors',
  'tags',
  'keywords',
  'keywordslist',
  'labels',
  'notes',
  'attachments',
  'collections',
  'collectionid',
  'collectionids',
  'extra',
  'extrafields',
]);

export const INTERNAL_AND_DEDICATED_METADATA_KEYS = new Set<string>([
  ...Array.from(ALL_SCHEMA_FIELD_KEYS)
    .map((f) => f.toLowerCase().replace(/[\s_-]+/g, ''))
    .filter((k) => !ALLOWED_ITEM_EXTRA_LINE_KEYS.has(k)),
  ...SYSTEM_INTERNAL_METADATA_KEYS,
  'license',
  'journalabbr',
  'abstract',
]);

export const DEDICATED_FIELDS_BY_TYPE_MAP = new Map<string, ReadonlySet<string>>(
  Object.entries(INITIAL_ITEM_TYPE_FIELDS_MAP).map(([type, fields]) => [
    type,
    new Set(fields.map((f) => f.toLowerCase().replace(/[\s_-]+/g, ''))),
  ]),
);

export const EMPTY_DEDICATED_FIELDS_SET: ReadonlySet<string> = new Set();

function refreshMetadataExtraSchemaCaches(): void {
  for (const [type, fields] of Object.entries(ITEM_TYPE_FIELDS_MAP)) {
    DEDICATED_FIELDS_BY_TYPE_MAP.set(
      type,
      new Set(fields.map((f) => f.toLowerCase().replace(/[\s_-]+/g, ''))),
    );
  }
  for (const f of ALL_SCHEMA_FIELD_KEYS) {
    const norm = f.toLowerCase().replace(/[\s_-]+/g, '');
    if (!ALLOWED_ITEM_EXTRA_LINE_KEYS.has(norm)) {
      INTERNAL_AND_DEDICATED_METADATA_KEYS.add(norm);
    }
  }
  for (const alias of ['license', 'journalabbr', 'abstract']) {
    INTERNAL_AND_DEDICATED_METADATA_KEYS.add(alias);
  }
}

registerSchemaRegistryUpdateListener(refreshMetadataExtraSchemaCaches);

export const EXTRA_KEY_ALIASES: Record<string, readonly string[]> = {
  doi: ['doi', 'DOI'],
  citationkey: ['citationKey', 'citeKey'],
  citekey: ['citationKey', 'citeKey'],
  arxiv: ['arxivId', 'archiveID', 'archiveId', 'arXiv'],
  arxivid: ['arxivId', 'archiveID', 'archiveId', 'arXiv'],
  archiveid: ['archiveID', 'archiveId', 'arxivId', 'arXiv'],
  pmid: ['pmid', 'PMID'],
  pmcid: ['pmcid', 'PMCID'],
  isbn: ['isbn', 'ISBN'],
  issn: ['issn', 'ISSN'],
  rights: ['rights', 'license'],
  license: ['rights', 'license'],
  journalabbr: ['journalAbbreviation', 'journalAbbr'],
  journalabbreviation: ['journalAbbreviation', 'journalAbbr'],
  librarycatalog: ['libraryCatalog', 'catalog'],
  callnumber: ['callNumber'],
  abstract: ['abstractNote', 'abstract'],
  abstractnote: ['abstractNote', 'abstract'],
  eventplace: ['eventPlace', 'event-place', 'place'],
  originaldate: ['originalDate', 'original-date'],
  publisher: ['publisher'],
  institution: ['institution', 'publisher'],
  university: ['university', 'publisher'],
  authority: ['issuingAuthority', 'authority', 'publisher'],
  issuingauthority: ['issuingAuthority', 'authority', 'publisher'],
  court: ['court', 'authority', 'publisher'],
  organization: ['organization', 'publisher'],
  company: ['company', 'publisher'],
  containertitle: ['containerTitle', 'publicationTitle'],
  publicationtitle: ['publicationTitle'],
  proceedingstitle: ['proceedingsTitle', 'publicationTitle'],
  booktitle: ['bookTitle', 'publicationTitle'],
  meetingname: ['meetingName', 'conferenceName', 'publicationTitle'],
  versionnumber: ['versionNumber'],
  patentnumber: ['patentNumber', 'number'],
  docketnumber: ['docketNumber', 'number'],
  publiclawnumber: ['publicLawNumber', 'number'],
  reportnumber: ['reportNumber', 'number'],
};

/**
 * Determines whether a given raw key represents a dedicated first-class field
 * for the specified item type (e.g. `journalAbbr` on `journalArticle`, `license` / `rights`).
 * Inspects both exact normalized field names and any bidirectional aliases.
 */
export function isDedicatedFieldForType(
  rawKey: string,
  dedicatedFieldsForType: ReadonlySet<string>,
  unmappedFields?: ReadonlySet<string>,
): boolean {
  const normKey = rawKey.trim().toLowerCase().replace(/[\s_-]+/g, '');
  if (!normKey || normKey === 'extra') return false;
  if (unmappedFields && unmappedFields.has(normKey)) return false;
  if (dedicatedFieldsForType.has(normKey)) return true;

  const aliases = EXTRA_KEY_ALIASES[normKey];
  if (aliases) {
    for (const alias of aliases) {
      const aliasNorm = alias.toLowerCase().replace(/[\s_-]+/g, '');
      if (dedicatedFieldsForType.has(aliasNorm)) {
        return true;
      }
    }
  }
  return false;
}

export const CROSS_FIELD_FALLBACK_NORMS = new Set<string>([
  'publisher',
  'publicationtitle',
  'number',
  'place',
  'authority',
]);

export const PROMOTED_TOP_LEVEL_EXTRA_KEYS = new Set<string>([
  'originalDate',
  'pmid',
  'pmcid',
  'arxivId',
  'archiveID',
  'doi',
  'isbn',
  'issn',
  'citationKey',
  'place',
  'eventPlace',
  'publisher',
  'versionNumber',
  'patentNumber',
  'docketNumber',
  'publicLawNumber',
  'reportNumber',
  ...ALL_SCHEMA_FIELD_KEYS,
]);

export function getMatchingExtraKeyNorms(canonicalKey: string): Set<string> {
  const targetNorm = canonicalKey.trim().toLowerCase().replace(/[\s_-]+/g, '');
  const norms = new Set<string>();
  if (!targetNorm) return norms;
  norms.add(targetNorm);
  const aliases = EXTRA_KEY_ALIASES[targetNorm];
  if (aliases) {
    for (const alias of aliases) {
      const aliasNorm = alias.toLowerCase().replace(/[\s_-]+/g, '');
      if (aliasNorm === targetNorm || !CROSS_FIELD_FALLBACK_NORMS.has(aliasNorm)) {
        norms.add(aliasNorm);
      }
    }
  }
  return norms;
}

export function getCandidateNormsForUnmappedField(field: string): string[] {
  const norms = new Set<string>();
  const cleanField = field.trim();
  const fieldNorm = cleanField.toLowerCase().replace(/[\s_-]+/g, '');
  if (fieldNorm) norms.add(fieldNorm);
  const label = FIELD_LABELS[cleanField] || humanizeFieldName(cleanField);
  if (label) {
    const labelNorm = label.trim().toLowerCase().replace(/[\s_-]+/g, '');
    if (labelNorm) norms.add(labelNorm);
  }
  const aliases = EXTRA_KEY_ALIASES[fieldNorm];
  if (aliases) {
    for (const alias of aliases) {
      const aliasNorm = alias.toLowerCase().replace(/[\s_-]+/g, '');
      if (aliasNorm === fieldNorm || !CROSS_FIELD_FALLBACK_NORMS.has(aliasNorm)) {
        norms.add(aliasNorm);
      }
    }
  }
  return Array.from(norms);
}

export function collectUnmappedFieldsSet(
  associatedPaperItem?: Partial<Item> | null,
  additionalExtraFields?: Record<string, unknown> | null,
): Set<string> {
  const unmapped = new Set<string>();
  const sources = [
    associatedPaperItem?.metadata as Record<string, unknown> | undefined,
    associatedPaperItem?.extraFields as Record<string, unknown> | undefined,
    additionalExtraFields ?? undefined,
  ];
  for (const src of sources) {
    if (!src || typeof src !== 'object') continue;
    for (const k of Object.keys(src)) {
      const m = k.match(/^__unmapped_[^_]+_(.+)$/i);
      if (m && m[1]) {
        for (const norm of getCandidateNormsForUnmappedField(m[1])) {
          unmapped.add(norm);
        }
      }
    }
  }
  return unmapped;
}

export const FALLBACK_VENUE_FIELDS_BASE = [
  'publicationTitle',
  'journal',
  'proceedingsTitle',
  'bookTitle',
  'repository',
  'publisher',
  'court',
  'issuingAuthority',
  'authority',
  'company',
  'organization',
  'institution',
  'university',
  'distributor',
  'studio',
  'network',
  'label',
  'programTitle',
  'websiteTitle',
  'blogTitle',
  'forumTitle',
  'dictionaryTitle',
  'encyclopediaTitle',
  'sessionTitle',
  'legislativeBody',
  'committee',
  'code',
  'reporter',
] as const;

const CROSS_FIELD_ALIAS_TARGETS = new Set<string>([
  'publisher',
  'publicationTitle',
  'number',
  'place',
  'authority',
]);

export function getDirectExtraAliases(fieldKey: string): readonly string[] {
  const collapsed = fieldKey.trim().toLowerCase().replace(/[\s_-]+/g, '');
  const rawAliases = EXTRA_KEY_ALIASES[collapsed];
  if (!rawAliases) return [];
  return rawAliases.filter(
    (alias) =>
      alias.toLowerCase().replace(/[\s_-]+/g, '') === collapsed ||
      !CROSS_FIELD_ALIAS_TARGETS.has(alias),
  );
}

/** First-class columns on the backend Prisma `Item` table. */
export const FIRST_CLASS_ITEM_COLUMNS: ReadonlySet<string> = new Set([
  'title', 'abstractNote', 'publicationTitle', 'journalAbbreviation', 'volume', 'issue',
  'pages', 'numberOfPages', 'publisher', 'place', 'edition', 'series', 'seriesTitle',
  'seriesNumber', 'doi', 'isbn', 'issn', 'pmid', 'pmcid', 'arxivId', 'url', 'openAccessPdfUrl',
  'year', 'publicationDate', 'date', 'accessDate', 'itemType', 'language', 'license',
  'archive', 'archiveLocation', 'callNumber', 'libraryCatalog', 'citationKey', 'shortTitle',
  'citationCount', 'referenceCount',
]);

/** Universal bidirectional field aliases between Zotero Schema v42 field keys and canonical `Item` columns. */
export const CANONICAL_FIELD_ALIASES: Record<string, readonly string[]> = {
  abstractNote: ['abstractNote', 'abstract'],
  abstract: ['abstractNote', 'abstract'],
  journalAbbreviation: ['journalAbbreviation', 'journalAbbr'],
  journalAbbr: ['journalAbbreviation', 'journalAbbr'],
  publicationTitle: ['publicationTitle', 'journal'],
  journal: ['publicationTitle', 'journal'],
  accessDate: ['accessDate', 'accessedAt'],
  accessedAt: ['accessDate', 'accessedAt'],
  rights: ['license', 'rights'],
  license: ['license', 'rights'],
  ISBN: ['isbn', 'ISBN'],
  isbn: ['isbn', 'ISBN'],
  ISSN: ['issn', 'ISSN'],
  issn: ['issn', 'ISSN'],
  PMID: ['pmid', 'PMID'],
  pmid: ['pmid', 'PMID'],
  PMCID: ['pmcid', 'PMCID'],
  pmcid: ['pmcid', 'PMCID'],
  DOI: ['doi', 'DOI'],
  doi: ['doi', 'DOI'],
  archiveID: ['archiveID', 'archiveId', 'arxivId'],
  archiveId: ['archiveID', 'archiveId', 'arxivId'],
  arxivId: ['archiveID', 'archiveId', 'arxivId'],
  citationKey: ['citationKey'],
  citeKey: ['citationKey'],
  numPages: ['numberOfPages', 'numPages'],
  numberOfPages: ['numberOfPages', 'numPages'],
  versionNumber: ['versionNumber'],
  meetingName: ['meetingName', 'conferenceName'],
  reporter: ['reporter', 'publicationTitle'],
};

const BASE_FIELD_SYNC_EXPANSIONS: Record<string, readonly string[]> = {
  title: ['title'],
  publicationTitle: ['publicationTitle'],
  publisher: ['publisher'],
  authority: ['authority', 'issuingAuthority'],
  place: ['place'],
  date: ['publicationDate', 'date'],
  volume: ['volume'],
  pages: ['pages'],
  number: ['number'],
  type: ['genre', 'type'],
  status: ['status'],
};

const WRITE_SYNC_OVERRIDES: Record<string, readonly string[]> = {
  eventplace: ['eventPlace'],
  country: ['country'],
  organization: ['organization', 'authority'],
  reportnumber: ['reportNumber', 'number'],
  websitetype: ['websiteType'],
};

export function buildDerivedFieldMappings(): {
  syncSetters: Record<string, readonly string[]>;
  fallbackChains: Record<string, ReadonlyArray<readonly ['p' | 'ef', string]>>;
} {
  const syncSetters: Record<string, readonly string[]> = {};
  const concreteToBaseField = new Map<string, string>();

  for (const mapping of Object.values(BASE_FIELD_MAPPINGS)) {
    for (const [baseField, concreteField] of Object.entries(mapping)) {
      if (concreteField && !concreteToBaseField.has(concreteField)) {
        concreteToBaseField.set(concreteField, baseField);
      }
    }
  }

  for (const [concreteField, baseField] of concreteToBaseField.entries()) {
    const lower = concreteField.toLowerCase();
    if (WRITE_SYNC_OVERRIDES[lower]) {
      syncSetters[lower] = WRITE_SYNC_OVERRIDES[lower]!;
      continue;
    }
    const expansions = BASE_FIELD_SYNC_EXPANSIONS[baseField] || [baseField];
    syncSetters[lower] = Array.from(new Set([concreteField, ...expansions]));
  }

  for (const [fieldKey, aliases] of Object.entries(CANONICAL_FIELD_ALIASES)) {
    syncSetters[fieldKey.toLowerCase()] = aliases;
  }
  for (const [lowerKey, overrideTargets] of Object.entries(WRITE_SYNC_OVERRIDES)) {
    syncSetters[lowerKey] = overrideTargets;
  }
  syncSetters.authority = ['issuingAuthority', 'authority'];

  const fallbackChains: Record<string, ReadonlyArray<readonly ['p' | 'ef', string]>> = {};

  const addChain = (key: string, entries: ReadonlyArray<readonly ['p' | 'ef', string]>) => {
    const seen = new Set<string>();
    const deduped: Array<readonly ['p' | 'ef', string]> = [];
    for (const [src, prop] of entries) {
      const id = `${src}:${prop}`;
      if (!seen.has(id)) {
        seen.add(id);
        deduped.push([src, prop]);
      }
    }
    fallbackChains[key.toLowerCase()] = deduped;
  };

  for (const schemaField of ALL_SCHEMA_FIELD_KEYS) {
    addChain(schemaField, [['p', schemaField], ['ef', schemaField]]);
  }

  for (const [concreteField, baseField] of concreteToBaseField.entries()) {
    const expansions = BASE_FIELD_SYNC_EXPANSIONS[baseField] || [baseField];
    addChain(concreteField, [
      ['p', concreteField],
      ['ef', concreteField],
      ...expansions.map((b): readonly ['p' | 'ef', string] => ['p', b]),
      ...expansions.map((b): readonly ['p' | 'ef', string] => ['ef', b]),
    ]);
  }

  for (const [fieldKey, aliases] of Object.entries(CANONICAL_FIELD_ALIASES)) {
    addChain(fieldKey, [
      ...aliases.map((a): readonly ['p' | 'ef', string] => ['p', a]),
      ...aliases.map((a): readonly ['p' | 'ef', string] => ['ef', a]),
    ]);
  }

  addChain('booktitle', [['p', 'bookTitle'], ['p', 'publicationTitle'], ['p', 'containerTitle'], ['p', 'proceedingsTitle'], ['ef', 'bookTitle']]);
  addChain('proceedingstitle', [['p', 'proceedingsTitle'], ['p', 'publicationTitle'], ['p', 'containerTitle'], ['p', 'bookTitle'], ['ef', 'proceedingsTitle']]);
  addChain('sessiontitle', [['p', 'sessionTitle'], ['ef', 'sessionTitle'], ['p', 'meetingName'], ['ef', 'meetingName'], ['p', 'publicationTitle']]);
  addChain('meetingname', [['p', 'meetingName'], ['ef', 'meetingName'], ['p', 'conferenceName'], ['ef', 'conferenceName'], ['p', 'sessionTitle'], ['ef', 'sessionTitle'], ['p', 'publicationTitle']]);
  addChain('codenumber', [['p', 'codeNumber'], ['ef', 'codeNumber'], ['p', 'volume'], ['ef', 'volume'], ['p', 'codeVolume'], ['ef', 'codeVolume']]);
  addChain('volume', [['p', 'volume'], ['ef', 'volume'], ['p', 'reporterVolume'], ['ef', 'reporterVolume'], ['p', 'codeNumber'], ['ef', 'codeNumber'], ['p', 'codeVolume'], ['ef', 'codeVolume']]);
  addChain('publisher', [['p', 'publisher'], ['p', 'university'], ['p', 'institution'], ['ef', 'publisher']]);
  addChain('university', [['p', 'university'], ['p', 'publisher'], ['p', 'institution'], ['ef', 'university']]);
  addChain('institution', [['p', 'institution'], ['p', 'publisher'], ['p', 'university'], ['ef', 'institution']]);
  addChain('authority', [['p', 'issuingAuthority'], ['ef', 'issuingAuthority'], ['p', 'authority'], ['p', 'publisher']]);
  addChain('place', [['p', 'place'], ['ef', 'place'], ['p', 'eventPlace'], ['ef', 'eventPlace'], ['ef', 'address'], ['ef', 'location'], ['p', 'repositoryLocation'], ['ef', 'repositoryLocation'], ['p', 'country'], ['ef', 'country']]);
  addChain('eventplace', [['p', 'eventPlace'], ['ef', 'eventPlace'], ['p', 'place']]);
  addChain('country', [['p', 'country'], ['ef', 'country'], ['p', 'place']]);
  addChain('filingdate', [['p', 'filingDate'], ['ef', 'filingDate'], ['p', 'date']]);
  addChain('prioritydate', [['p', 'priorityDate'], ['ef', 'priorityDate']]);

  return { syncSetters, fallbackChains };
}

export function parseValidYear(val: string): number | undefined {
  const yearMatch = val.match(/(?:^|[^\d])(1\d{3}|20\d{2})(?:[^\d]|$)/);
  const parsedYear = yearMatch
    ? parseInt(yearMatch[1]!, 10)
    : parseInt(val, 10);
  return !isNaN(parsedYear) && parsedYear >= 1000 && parsedYear <= 2999
    ? parsedYear
    : undefined;
}
