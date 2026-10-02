/**
 * Library Item-Type Registry — Dynamic Backend Schema Consumer & Lightweight Definitions
 * Standardized 100% against Official Zotero Schema v42 (https://api.zotero.org/schema).
 * Single Source of Truth is owned by backend (/api/v1/library/item-types).
 */
import {
  ITEM_TYPE_FIELDS_MAP,
  FIELD_LABELS,
  updateCachedFields,
  saveSchemaCache,
  loadSchemaCache,
} from './item-fields.constants';

export {
  ITEM_TYPE_FIELDS_MAP,
  FIELD_LABELS,
  updateCachedFields,
  saveSchemaCache,
  loadSchemaCache,
};


export interface SchemaFieldDefinition {
  field: string;
  label: string;
  placeholder?: string;
  type: 'text' | 'textarea' | 'date' | 'number' | 'url';
  category?: 'core' | 'venue' | 'publication' | 'identifiers' | 'archive' | 'extra';
  mono?: boolean;
  /** Canonical semantic field supplied by Zotero Schema v42 baseField mappings */
  baseField?: string;
  order?: number;
}

export interface SchemaCreatorTypeDefinition {
  creatorType: string;
  label: string;
  primary?: boolean;
}

export type ItemFieldDefinition = SchemaFieldDefinition;
export type CreatorTypeDefinition = SchemaCreatorTypeDefinition;

export interface SchemaItemTypeDefinition {
  itemType: string;
  label: string;
  category: 'academic' | 'books' | 'articles' | 'legal' | 'media' | 'documents' | 'special';
  primaryCreatorType: string;
  creatorTypes: SchemaCreatorTypeDefinition[];
  fields: SchemaFieldDefinition[];
  isBibliographic?: boolean;
  isSpecial?: boolean;
}

export interface ItemTypeCategoryGroup {
  id: string;
  label: string;
  types: { value: string; label: string }[];
}

export interface RegistryItemTypeDefinition {
  itemType: string;
  label: string;
  category: SchemaItemTypeDefinition['category'];
  primaryCreatorType: string;
  creatorTypes: SchemaCreatorTypeDefinition[];
  fields: Array<{
    key?: string;
    field?: string;
    label: string;
    placeholder?: string;
    type?: SchemaFieldDefinition['type'];
    category?: SchemaFieldDefinition['category'];
    mono?: boolean;
    baseField?: string;
    order?: number;
  }>;
  isBibliographic?: boolean;
  isSpecial?: boolean;
}

// ── Schema v42 Constants & Dynamic Registry (Owned by Backend) ───────────────

export const SCHEMA_VERSION = 42;
export const SCHEMA_SOURCE = 'zotero-schema-v42';

/**
 * Standard 37 Zotero bibliographic item types for immediate UI rendering.
 * Labels are sourced from the official Zotero API (en-US locale, schema v42).
 * Note: computerProgram is officially labeled "Software" by Zotero.
 */
export const ALL_ITEM_TYPES_FLAT: { value: string; label: string }[] = [
  { value: 'artwork', label: 'Artwork' },
  { value: 'audioRecording', label: 'Audio Recording' },
  { value: 'bill', label: 'Bill' },
  { value: 'blogPost', label: 'Blog Post' },
  { value: 'book', label: 'Book' },
  { value: 'bookSection', label: 'Book Section' },
  { value: 'case', label: 'Case' },
  { value: 'computerProgram', label: 'Software' },
  { value: 'conferencePaper', label: 'Conference Paper' },
  { value: 'dataset', label: 'Dataset' },
  { value: 'dictionaryEntry', label: 'Dictionary Entry' },
  { value: 'document', label: 'Document' },
  { value: 'email', label: 'E-mail' },
  { value: 'encyclopediaArticle', label: 'Encyclopedia Article' },
  { value: 'film', label: 'Film' },
  { value: 'forumPost', label: 'Forum Post' },
  { value: 'hearing', label: 'Hearing' },
  { value: 'instantMessage', label: 'Instant Message' },
  { value: 'interview', label: 'Interview' },
  { value: 'journalArticle', label: 'Journal Article' },
  { value: 'letter', label: 'Letter' },
  { value: 'magazineArticle', label: 'Magazine Article' },
  { value: 'manuscript', label: 'Manuscript' },
  { value: 'map', label: 'Map' },
  { value: 'newspaperArticle', label: 'Newspaper Article' },
  { value: 'patent', label: 'Patent' },
  { value: 'podcast', label: 'Podcast' },
  { value: 'preprint', label: 'Preprint' },
  { value: 'presentation', label: 'Presentation' },
  { value: 'radioBroadcast', label: 'Radio Broadcast' },
  { value: 'report', label: 'Report' },
  { value: 'standard', label: 'Standard' },
  { value: 'statute', label: 'Statute' },
  { value: 'thesis', label: 'Thesis' },
  { value: 'tvBroadcast', label: 'TV Broadcast' },
  { value: 'videoRecording', label: 'Video Recording' },
  { value: 'webpage', label: 'Web Page' },
];

export const ITEM_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  ALL_ITEM_TYPES_FLAT.map((t) => [t.value, t.label]),
);

/**
 * Category groupings mirroring backend CATEGORY_MAP in schema.constants.ts.
 * 'media' and 'documents' are separate categories, not merged.
 */
export const ITEM_TYPE_GROUPS: ItemTypeCategoryGroup[] = [
  {
    id: 'academic',
    label: 'Academic & Scientific',
    types: [
      { value: 'journalArticle', label: 'Journal Article' },
      { value: 'conferencePaper', label: 'Conference Paper' },
      { value: 'preprint', label: 'Preprint' },
      { value: 'thesis', label: 'Thesis' },
      { value: 'report', label: 'Report' },
      { value: 'dataset', label: 'Dataset' },
      { value: 'presentation', label: 'Presentation' },
      { value: 'standard', label: 'Standard' },
    ],
  },
  {
    id: 'books',
    label: 'Books & Sections',
    types: [
      { value: 'book', label: 'Book' },
      { value: 'bookSection', label: 'Book Section' },
      { value: 'dictionaryEntry', label: 'Dictionary Entry' },
      { value: 'encyclopediaArticle', label: 'Encyclopedia Article' },
      { value: 'manuscript', label: 'Manuscript' },
    ],
  },
  {
    id: 'articles',
    label: 'Articles & Web Content',
    types: [
      { value: 'magazineArticle', label: 'Magazine Article' },
      { value: 'newspaperArticle', label: 'Newspaper Article' },
      { value: 'webpage', label: 'Web Page' },
      { value: 'blogPost', label: 'Blog Post' },
      { value: 'forumPost', label: 'Forum Post' },
    ],
  },
  {
    id: 'legal',
    label: 'Legal & Patents',
    types: [
      { value: 'patent', label: 'Patent' },
      { value: 'statute', label: 'Statute' },
      { value: 'bill', label: 'Bill' },
      { value: 'case', label: 'Case' },
      { value: 'hearing', label: 'Hearing' },
    ],
  },
  {
    id: 'media',
    label: 'Media & Recordings',
    types: [
      { value: 'audioRecording', label: 'Audio Recording' },
      { value: 'videoRecording', label: 'Video Recording' },
      { value: 'film', label: 'Film' },
      { value: 'radioBroadcast', label: 'Radio Broadcast' },
      { value: 'tvBroadcast', label: 'TV Broadcast' },
      { value: 'podcast', label: 'Podcast' },
      { value: 'artwork', label: 'Artwork' },
      { value: 'map', label: 'Map' },
    ],
  },
  {
    id: 'documents',
    label: 'Documents & Communication',
    types: [
      { value: 'document', label: 'Document' },
      { value: 'computerProgram', label: 'Software' },
      { value: 'letter', label: 'Letter' },
      { value: 'email', label: 'E-mail' },
      { value: 'instantMessage', label: 'Instant Message' },
      { value: 'interview', label: 'Interview' },
    ],
  },
];

export const ITEM_TYPE_CATEGORIES = ITEM_TYPE_GROUPS;

// ── In-Memory Dynamic Schema Registry (populated by Backend via React Query) ─

/**
 * baseField → concrete field mappings per item type, derived from Zotero Schema v42.
 * Covers all 32 item types that have at least one baseField mapping.
 * Backend is the authoritative source; this is the bootstrap fallback only.
 * Updated at runtime by updateLibrarySchemaRegistry() via Object.assign.
 */
export const BASE_FIELD_MAPPINGS: Record<string, Record<string, string>> = {
  // academic
  journalArticle: { publicationTitle: 'publicationTitle' },
  conferencePaper: { publicationTitle: 'proceedingsTitle' },
  preprint: { publicationTitle: 'repository', number: 'archiveID', type: 'genre' },
  thesis: { type: 'thesisType', publisher: 'university' },
  report: { number: 'reportNumber', type: 'reportType', publisher: 'institution' },
  dataset: {
    number: 'identifier',
    publisher: 'repository',
    place: 'repositoryLocation',
    medium: 'format',
  },
  presentation: { type: 'presentationType', publicationTitle: 'sessionTitle' },
  standard: { authority: 'organization' },
  // books
  book: { medium: 'format' },
  bookSection: { publicationTitle: 'bookTitle', medium: 'format' },
  dictionaryEntry: { publicationTitle: 'dictionaryTitle' },
  encyclopediaArticle: { publicationTitle: 'encyclopediaTitle' },
  manuscript: { type: 'manuscriptType', publisher: 'institution' },
  // articles
  magazineArticle: {},
  newspaperArticle: {},
  webpage: { publicationTitle: 'websiteTitle', type: 'websiteType' },
  blogPost: { publicationTitle: 'blogTitle', type: 'websiteType' },
  forumPost: { publicationTitle: 'forumTitle', type: 'postType' },
  // legal
  patent: {
    authority: 'issuingAuthority',
    number: 'patentNumber',
    date: 'issueDate',
    originalDate: 'priorityDate',
    status: 'legalStatus',
  },
  statute: { title: 'nameOfAct', number: 'publicLawNumber', date: 'dateEnacted' },
  bill: {
    number: 'billNumber',
    volume: 'codeVolume',
    pages: 'codePages',
    authority: 'legislativeBody',
  },
  case: {
    title: 'caseName',
    authority: 'court',
    date: 'dateDecided',
    number: 'docketNumber',
    volume: 'reporterVolume',
    pages: 'firstPage',
  },
  hearing: { number: 'documentNumber', authority: 'legislativeBody' },
  // media
  artwork: { medium: 'artworkMedium' },
  audioRecording: { medium: 'audioRecordingFormat', publisher: 'label' },
  videoRecording: { medium: 'videoRecordingFormat', publisher: 'studio' },
  film: { publisher: 'distributor', type: 'genre', medium: 'videoRecordingFormat' },
  radioBroadcast: {
    publicationTitle: 'programTitle',
    number: 'episodeNumber',
    medium: 'audioRecordingFormat',
    publisher: 'network',
  },
  tvBroadcast: {
    publicationTitle: 'programTitle',
    number: 'episodeNumber',
    medium: 'videoRecordingFormat',
    publisher: 'network',
  },
  podcast: { number: 'episodeNumber', medium: 'audioFileType' },
  map: { type: 'mapType' },
  // documents
  document: {},
  computerProgram: { publisher: 'company' },
  letter: { type: 'letterType' },
  email: { title: 'subject' },
  instantMessage: {},
  interview: { medium: 'interviewMedium' },
};

export const REVERSE_BASE_FIELD_MAPPINGS: Record<string, Record<string, string>> = {
  journalArticle: { publicationTitle: 'publicationTitle' },
  conferencePaper: { proceedingsTitle: 'publicationTitle' },
  bookSection: { bookTitle: 'publicationTitle' },
  preprint: { repository: 'publicationTitle', archiveID: 'number', genre: 'type' },
  dataset: {
    repository: 'publisher',
    identifier: 'number',
    repositoryLocation: 'place',
    format: 'medium',
  },
  dictionaryEntry: { dictionaryTitle: 'publicationTitle' },
  encyclopediaArticle: { encyclopediaTitle: 'publicationTitle' },
  thesis: { thesisType: 'type', university: 'publisher' },
  report: { reportNumber: 'number', reportType: 'type', institution: 'publisher' },
  manuscript: { manuscriptType: 'type', institution: 'publisher' },
  webpage: { websiteTitle: 'publicationTitle', websiteType: 'type' },
  blogPost: { blogTitle: 'publicationTitle' },
  forumPost: { forumTitle: 'publicationTitle', postType: 'type' },
  computerProgram: { company: 'publisher' },
  patent: {
    issuingAuthority: 'authority',
    patentNumber: 'number',
    issueDate: 'date',
    priorityDate: 'originalDate',
    legalStatus: 'status',
  },
  statute: { nameOfAct: 'title', publicLawNumber: 'number', dateEnacted: 'date' },
  bill: { billNumber: 'number', codeVolume: 'volume', legislativeBody: 'authority' },
  case: {
    caseName: 'title',
    court: 'authority',
    dateDecided: 'date',
    docketNumber: 'number',
    reporterVolume: 'volume',
    firstPage: 'pages',
  },
  hearing: { documentNumber: 'number', legislativeBody: 'authority' },
  artwork: { artworkMedium: 'medium' },
  audioRecording: { audioRecordingFormat: 'medium', label: 'publisher' },
  videoRecording: { videoRecordingFormat: 'medium', studio: 'publisher' },
  film: { distributor: 'publisher', genre: 'type', videoRecordingFormat: 'medium' },
  radioBroadcast: { programTitle: 'publicationTitle', episodeNumber: 'number', network: 'publisher' },
  tvBroadcast: { programTitle: 'publicationTitle', episodeNumber: 'number', network: 'publisher' },
  podcast: { episodeNumber: 'number', audioFileType: 'medium' },
  presentation: { presentationType: 'type', sessionTitle: 'publicationTitle' },
  standard: { organization: 'authority' },
  map: { mapType: 'type' },
  interview: { interviewMedium: 'medium' },
  letter: { letterType: 'type' },
  email: { subject: 'title' },
};

/**
 * All 37 Zotero creator roles (en-US, schema v42).
 * Backend is the authoritative source; this is the bootstrap fallback only.
 * Updated at runtime by updateLibrarySchemaRegistry() via Object.assign.
 */
export const ALL_CREATOR_TYPES: Record<string, string> = {
  artist: 'Artist',
  attorneyAgent: 'Attorney/Agent',
  author: 'Author',
  bookAuthor: 'Book Author',
  cartographer: 'Cartographer',
  castMember: 'Cast Member',
  chair: 'Chair',
  commenter: 'Commenter',
  composer: 'Composer',
  contributor: 'Contributor',
  cosponsor: 'Cosponsor',
  counsel: 'Counsel',
  creator: 'Creator',
  director: 'Director',
  editor: 'Editor',
  executiveProducer: 'Executive Producer',
  guest: 'Guest',
  host: 'Host',
  interviewee: 'Interview With',
  interviewer: 'Interviewer',
  inventor: 'Inventor',
  narrator: 'Narrator',
  organizer: 'Organizer',
  originalCreator: 'Original Creator',
  performer: 'Performer',
  podcaster: 'Podcaster',
  presenter: 'Presenter',
  producer: 'Producer',
  programmer: 'Programmer',
  recipient: 'Recipient',
  reviewedAuthor: 'Reviewed Author',
  scriptwriter: 'Scriptwriter',
  seriesCreator: 'Series Creator',
  seriesEditor: 'Series Editor',
  sponsor: 'Sponsor',
  translator: 'Translator',
  wordsBy: 'Words By',
};

/**
 * Full CSL type map for all 37 Zotero bibliographic item types.
 * Sourced from Zotero Schema v42 csl.types section.
 * Backend is the authoritative source; this is the bootstrap fallback only.
 * Updated at runtime by updateLibrarySchemaRegistry() via Object.assign.
 */
export const CSL_TYPE_MAP: Record<string, string> = {
  artwork: 'graphic',
  audioRecording: 'song',
  bill: 'bill',
  blogPost: 'post-weblog',
  book: 'book',
  bookSection: 'chapter',
  case: 'legal_case',
  computerProgram: 'software',
  conferencePaper: 'paper-conference',
  dataset: 'dataset',
  dictionaryEntry: 'entry-dictionary',
  document: 'document',
  email: 'personal_communication',
  encyclopediaArticle: 'entry-encyclopedia',
  film: 'motion_picture',
  forumPost: 'post',
  hearing: 'hearing',
  instantMessage: 'personal_communication',
  interview: 'interview',
  journalArticle: 'article-journal',
  letter: 'personal_communication',
  magazineArticle: 'article-magazine',
  manuscript: 'manuscript',
  map: 'map',
  newspaperArticle: 'article-newspaper',
  patent: 'patent',
  podcast: 'broadcast',
  preprint: 'article',
  presentation: 'speech',
  radioBroadcast: 'broadcast',
  report: 'report',
  standard: 'standard',
  statute: 'legislation',
  thesis: 'thesis',
  tvBroadcast: 'broadcast',
  videoRecording: 'motion_picture',
  webpage: 'webpage',
};

// ── DRY Schema Helpers ───────────────────────────────────────────────────────

/**
 * Standard default fields for bibliographic item types when rendering
 * before the full backend schema response arrives.
 */
export const DEFAULT_BIBLIOGRAPHIC_FIELDS: SchemaFieldDefinition[] = [
  { field: 'title', label: 'Title', type: 'text', category: 'core', order: 1 },
  { field: 'abstractNote', label: 'Abstract', type: 'textarea', category: 'core', order: 2 },
  { field: 'date', label: 'Date', type: 'text', category: 'publication', order: 3 },
  { field: 'publicationTitle', label: 'Publication', type: 'text', category: 'publication', order: 4 },
  { field: 'volume', label: 'Volume', type: 'text', category: 'publication', order: 5 },
  { field: 'issue', label: 'Issue', type: 'text', category: 'publication', order: 6 },
  { field: 'pages', label: 'Pages', type: 'text', category: 'publication', order: 7 },
  { field: 'doi', label: 'DOI', type: 'text', category: 'identifiers', mono: true, order: 8 },
  { field: 'url', label: 'URL', type: 'url', category: 'identifiers', mono: true, order: 9 },
  { field: 'extra', label: 'Extra', type: 'textarea', category: 'extra', order: 10 },
];

/**
 * Returns the primary creator role for an item type per Zotero Schema v42.
 */
export function getPrimaryCreatorType(itemType?: string | null): string {
  if (!itemType) return 'author';
  if (LIBRARY_ITEM_TYPES?.[itemType]?.primaryCreatorType) {
    return LIBRARY_ITEM_TYPES[itemType].primaryCreatorType;
  }
  if (itemType === 'interview') return 'interviewee';
  if (itemType === 'letter' || itemType === 'email') return 'recipient';
  if (itemType === 'podcast') return 'podcaster';
  if (itemType === 'film' || itemType === 'videoRecording') return 'director';
  if (itemType === 'computerProgram') return 'programmer';
  if (itemType === 'patent') return 'inventor';
  if (itemType === 'presentation') return 'presenter';
  if (itemType === 'map') return 'cartographer';
  if (itemType === 'artwork') return 'artist';
  return 'author';
}

const MONO_FIELD_KEYS = new Set([
  'volume',
  'issue',
  'pages',
  'seriesNumber',
  'date',
  'filingDate',
  'accessDate',
  'DOI',
  'ISBN',
  'ISSN',
  'PMID',
  'PMCID',
  'archiveID',
  'patentNumber',
  'applicationNumber',
  'reportNumber',
  'citationKey',
  'url',
  'numPages',
]);

export function buildStaticFieldsForType(itemType: string): SchemaFieldDefinition[] {
  const keys = ITEM_TYPE_FIELDS_MAP[itemType] || [];
  return keys.map((field, idx) => {
    const fieldName = String(field);
    const fieldLower = fieldName.toLowerCase();
    return {
      field: fieldName,
      label: FIELD_LABELS[fieldName] || fieldName.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()),
      type: fieldLower.includes('date')
        ? 'date'
        : fieldName === 'url'
          ? 'url'
          : fieldName === 'abstractNote' || fieldName === 'extra'
            ? 'textarea'
            : 'text',
      category:
        ['title', 'abstractnote', 'shorttitle'].includes(fieldLower)
          ? 'core'
          : ['publicationtitle', 'publisher', 'place', 'university', 'institution', 'conferencename', 'booktitle', 'proceedingstitle', 'websitetitle', 'repository'].includes(fieldLower)
            ? 'venue'
            : ['doi', 'isbn', 'issn', 'pmid', 'pmcid', 'archiveid', 'patentnumber', 'citationkey', 'url'].includes(fieldLower)
              ? 'identifiers'
              : ['archive', 'archivelocation', 'librarycatalog', 'callnumber'].includes(fieldLower)
                ? 'archive'
                : fieldName === 'extra' || fieldName === 'rights'
                  ? 'extra'
                  : 'publication',
      mono: MONO_FIELD_KEYS.has(fieldName),
      baseField: BASE_FIELD_MAPPINGS[itemType]?.[fieldName],
      order: idx + 1,
    };
  });
}

export const LIBRARY_ITEM_TYPES: Record<string, SchemaItemTypeDefinition> = {};
export const FIELD_DEFINITIONS: Record<string, SchemaFieldDefinition> = {};

// Pre-populate statically with all official Zotero Schema v42 fields
for (const t of ALL_ITEM_TYPES_FLAT) {
  const primaryRole = getPrimaryCreatorType(t.value);
  const group = ITEM_TYPE_GROUPS.find((g) => g.types.some((ty) => ty.value === t.value));
  const category = (group?.id ?? 'documents') as SchemaItemTypeDefinition['category'];
  const typeFields = buildStaticFieldsForType(t.value);

  LIBRARY_ITEM_TYPES[t.value] = {
    itemType: t.value,
    label: t.label,
    category,
    primaryCreatorType: primaryRole,
    creatorTypes: [
      { creatorType: primaryRole, label: ALL_CREATOR_TYPES[primaryRole] || 'Author', primary: true },
      { creatorType: 'contributor', label: 'Contributor' },
      { creatorType: 'editor', label: 'Editor' },
      { creatorType: 'translator', label: 'Translator' },
    ],
    fields: typeFields.length > 0 ? typeFields : DEFAULT_BIBLIOGRAPHIC_FIELDS,
    isBibliographic: true,
    isSpecial: false,
  };

  for (const f of typeFields) {
    if (!FIELD_DEFINITIONS[f.field]) {
      FIELD_DEFINITIONS[f.field] = f;
    }
  }
}

export const ITEM_TYPE_DEFINITIONS = LIBRARY_ITEM_TYPES;
export const LIBRARY_ITEM_TYPE_KEYS = Object.keys(LIBRARY_ITEM_TYPES);
for (const f of DEFAULT_BIBLIOGRAPHIC_FIELDS) {
  if (!FIELD_DEFINITIONS[f.field]) {
    FIELD_DEFINITIONS[f.field] = f;
  }
}

/**
 * Dynamically updates the in-memory schema registry with live data received
 * from backend GET /api/v1/library/item-types.
 */
export function updateLibrarySchemaRegistry(data: unknown): void {
  if (!data) return;

  // Handle case where data is directly an array of item types
  if (Array.isArray(data)) {
    const mapped = mapRegistryItemTypes(data);
    updateCachedFields(mapped);
    saveSchemaCache(data);
    for (const def of mapped) {
      LIBRARY_ITEM_TYPES[def.itemType] = def;
      ITEM_TYPE_LABELS[def.itemType] = def.label;
      for (const field of def.fields) {
        if (!FIELD_DEFINITIONS[field.field]) {
          FIELD_DEFINITIONS[field.field] = field;
        }
      }
    }
    return;
  }

  if (typeof data !== 'object') return;
  const payload = data as Record<string, any>;

  if (payload.baseFieldMappings) {
    Object.assign(BASE_FIELD_MAPPINGS, payload.baseFieldMappings);
  }
  if (payload.reverseBaseFieldMappings) {
    Object.assign(REVERSE_BASE_FIELD_MAPPINGS, payload.reverseBaseFieldMappings);
  }
  if (payload.creatorRoles) {
    Object.assign(ALL_CREATOR_TYPES, payload.creatorRoles);
  }
  if (payload.cslTypeMap) {
    Object.assign(CSL_TYPE_MAP, payload.cslTypeMap);
  }

  const rawTypes = payload.itemTypes || payload.data;
  if (Array.isArray(rawTypes)) {
    const mapped = mapRegistryItemTypes(rawTypes);
    updateCachedFields(mapped);
    saveSchemaCache(payload);
    for (const def of mapped) {
      LIBRARY_ITEM_TYPES[def.itemType] = def;
      ITEM_TYPE_LABELS[def.itemType] = def.label;
      for (const field of def.fields) {
        if (!FIELD_DEFINITIONS[field.field]) {
          FIELD_DEFINITIONS[field.field] = field;
        }
      }
    }
  }
}

// Synchronously hydrate from client cache if present
if (typeof window !== 'undefined') {
  const cached = loadSchemaCache();
  if (cached) {
    updateLibrarySchemaRegistry(cached);
  }
}

/**
 * Retrieves the canonical SchemaItemTypeDefinition for a given item type.
 * If not yet loaded from backend, creates a clean synthetic definition.
 */
export function getItemTypeDefinition(itemType?: string | null): SchemaItemTypeDefinition | null {
  if (!itemType) return null;
  if (LIBRARY_ITEM_TYPES[itemType]) {
    return LIBRARY_ITEM_TYPES[itemType];
  }

  const label = ITEM_TYPE_LABELS[itemType] || itemType.replace(/([A-Z])/g, ' $1').trim();
  const primaryCreatorType = getPrimaryCreatorType(itemType);

  const fallbackDef: SchemaItemTypeDefinition = {
    itemType,
    label,
    category: 'academic',
    primaryCreatorType,
    creatorTypes: [
      { creatorType: primaryCreatorType, label: ALL_CREATOR_TYPES[primaryCreatorType] || 'Author', primary: true },
      { creatorType: 'contributor', label: 'Contributor' },
      { creatorType: 'editor', label: 'Editor' },
      { creatorType: 'translator', label: 'Translator' },
    ],
    fields:
      buildStaticFieldsForType(itemType).length > 0
        ? buildStaticFieldsForType(itemType)
        : DEFAULT_BIBLIOGRAPHIC_FIELDS,
    isBibliographic: true,
    isSpecial: false,
  };

  return fallbackDef;
}

/**
 * Checks whether a creator role is valid for a given item type per Zotero Schema v42.
 */
export function isValidCreatorType(itemType: string, creatorType: string): boolean {
  const def = LIBRARY_ITEM_TYPES[itemType];
  if (!def) return creatorType === 'author' || creatorType === 'contributor' || creatorType === 'editor';
  return def.creatorTypes.some((c) => c.creatorType === creatorType);
}

/**
 * Determines the type-specific venue field for an item type based on Schema v42 baseFieldMappings.
 */
export function getVenueFieldForType(itemType?: string | null): string {
  if (!itemType) return 'publicationTitle';
  const mapping = BASE_FIELD_MAPPINGS[itemType];
  if (mapping?.publicationTitle) {
    return mapping.publicationTitle;
  }
  const def = LIBRARY_ITEM_TYPES[itemType];
  if (def?.fields.some((f) => f.field === 'publicationTitle')) {
    return 'publicationTitle';
  }
  if (itemType === 'conferencePaper') return 'proceedingsTitle';
  if (itemType === 'bookSection') return 'bookTitle';
  if (itemType === 'preprint' || itemType === 'dataset') return 'repository';
  if (itemType === 'dictionaryEntry') return 'dictionaryTitle';
  if (itemType === 'encyclopediaArticle') return 'encyclopediaTitle';
  return 'publicationTitle';
}

/**
 * Determines the type-specific publisher/institution field for an item type.
 */
export function getPublisherFieldForType(itemType?: string | null): string {
  if (!itemType) return 'publisher';
  const mapping = BASE_FIELD_MAPPINGS[itemType];
  if (mapping?.publisher) {
    return mapping.publisher;
  }
  if (itemType === 'thesis') return 'university';
  if (itemType === 'report') return 'institution';
  return 'publisher';
}

/**
 * Converts the server-owned registry payload from GET /api/v1/library/item-types
 * into strongly-typed SchemaItemTypeDefinition[].
 */
export function mapRegistryItemTypes(value: unknown): SchemaItemTypeDefinition[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry): SchemaItemTypeDefinition[] => {
    if (!entry || typeof entry !== 'object') return [];
    const type = entry as RegistryItemTypeDefinition;
    if (type.isBibliographic === false || !type.itemType || !type.label) {
      return [];
    }

    const fields: SchemaFieldDefinition[] = Array.isArray(type.fields)
      ? type.fields
          .filter((field) => field && typeof (field.key || field.field) === 'string')
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          .map((field): SchemaFieldDefinition => {
            const fieldName = (field.key || field.field) as string;
            return {
              field: fieldName,
              label: field.label || fieldName,
              placeholder: field.placeholder,
              type: field.type || 'text',
              category: field.category || 'publication',
              mono: Boolean(field.mono),
              baseField: field.baseField,
              order: field.order,
            };
          })
      : [];

    return [
      {
        itemType: type.itemType,
        label: type.label,
        category: type.category || 'documents',
        primaryCreatorType: type.primaryCreatorType || 'author',
        creatorTypes: Array.isArray(type.creatorTypes) ? type.creatorTypes : [],
        fields,
        isBibliographic: Boolean(type.isBibliographic ?? true),
        isSpecial: Boolean(type.isSpecial),
      },
    ];
  });
}
