import {
  ALL_SCHEMA_FIELD_KEYS,
  INITIAL_ITEM_TYPE_FIELDS_MAP,
  ITEM_TYPE_FIELDS_MAP,
} from './types/item-fields.constants';
import { registerSchemaRegistryUpdateListener } from './types/item-types.types';

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
  'journal',
  'journalabbr',
  'numberofpages',
  'arxiv',
  'arxivid',
  'openaccesspdfurl',
  'pdfurl',
  'fileurl',
  'year',
  'publicationdate',
  'accessedat',
  'itemtype',
  'license',
  'citekey',
  'citationcount',
  'referencecount',
  'authority',
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
