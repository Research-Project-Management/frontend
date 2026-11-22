/**
 * Static Bootstrap Constants, Field Labels & Mappings for Zotero Schema v42 Item Types
 * Sourced dynamically from Backend Single Source of Truth (/api/v1/library/item-types/schema).
 * Provides 0ms instant bootstrap with persistent client-side cache and runtime reactivity.
 */

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

export interface ItemTypeCategoryGroup {
  id: string;
  label: string;
  types: { value: string; label: string }[];
}

export const SCHEMA_VERSION = 42;
export const SCHEMA_SOURCE = 'bibliographic-schema-v42';

/**
 * Converts a camelCase field identifier into a human-readable title.
 */
export function humanizeFieldName(field: string): string {
  if (!field) return '';
  const uppercaseAcronyms = new Set(['doi', 'isbn', 'issn', 'pmid', 'pmcid', 'url', 'csl']);
  if (uppercaseAcronyms.has(field.toLowerCase())) {
    return field.toUpperCase();
  }
  return field
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

/**
 * Standard baseline field labels for initial offline render or SSR
 * prior to backend schema query completion.
 */
export const INITIAL_FIELD_LABELS: Record<string, string> = {
  abstractNote: 'Abstract',
  accessDate: 'Accessed',
  applicationNumber: 'Application Number',
  archive: 'Archive',
  archiveID: 'Archive ID',
  archiveLocation: 'Loc. in Archive',
  artworkMedium: 'Medium',
  artworkSize: 'Artwork Size',
  assignee: 'Assignee',
  audioFileType: 'File Type',
  audioRecordingFormat: 'Format',
  billNumber: 'Bill Number',
  blogTitle: 'Blog Title',
  bookTitle: 'Book Title',
  callNumber: 'Call Number',
  caseName: 'Case Name',
  citationKey: 'Citation Key',
  code: 'Code',
  codeNumber: 'Code Number',
  codePages: 'Code Pages',
  codeVolume: 'Code Volume',
  committee: 'Committee',
  company: 'Company',
  conferenceName: 'Conference Name',
  country: 'Country',
  court: 'Court',
  date: 'Date',
  dateDecided: 'Date Decided',
  dateEnacted: 'Date Enacted',
  dictionaryTitle: 'Dictionary Title',
  distributor: 'Distributor',
  docketNumber: 'Docket Number',
  documentNumber: 'Document Number',
  DOI: 'DOI',
  edition: 'Edition',
  encyclopediaTitle: 'Encyclopedia Title',
  episodeNumber: 'Episode Number',
  eventPlace: 'Event Place',
  extra: 'Extra',
  filingDate: 'Filing Date',
  firstPage: 'First Page',
  format: 'Format',
  forumTitle: 'Forum/List Title',
  genre: 'Genre',
  history: 'History',
  identifier: 'Identifier',
  institution: 'Institution',
  interviewMedium: 'Medium',
  ISBN: 'ISBN',
  ISSN: 'ISSN',
  issue: 'Issue',
  issueDate: 'Issue Date',
  issuingAuthority: 'Issuing Authority',
  itemType: 'Item Type',
  journalAbbreviation: 'Journal Abbr',
  label: 'Label',
  language: 'Language',
  legalStatus: 'Legal Status',
  legislativeBody: 'Legislative Body',
  letterType: 'Type',
  libraryCatalog: 'Library Catalog',
  manuscriptType: 'Type',
  mapType: 'Type',
  medium: 'Medium',
  meetingName: 'Meeting Name',
  nameOfAct: 'Name of Act',
  network: 'Network',
  number: 'Number',
  numberOfVolumes: '# of Volumes',
  numPages: '# of Pages',
  organization: 'Organization',
  originalDate: 'Original Date',
  originalPlace: 'Original Place',
  originalPublisher: 'Original Publisher',
  pages: 'Pages',
  partNumber: 'Part Number',
  partTitle: 'Part Title',
  patentNumber: 'Patent Number',
  place: 'Place',
  PMCID: 'PMCID',
  PMID: 'PMID',
  postType: 'Post Type',
  presentationType: 'Type',
  priorityDate: 'Priority Date',
  priorityNumbers: 'Priority Numbers',
  proceedingsTitle: 'Proceedings Title',
  programmingLanguage: 'Prog. Language',
  programTitle: 'Program Title',
  publicationTitle: 'Publication',
  publicLawNumber: 'Public Law Number',
  publisher: 'Publisher',
  references: 'References',
  reporter: 'Reporter',
  reporterVolume: 'Reporter Volume',
  reportNumber: 'Report Number',
  reportType: 'Report Type',
  repository: 'Repository',
  repositoryLocation: 'Repo. Location',
  rights: 'License',
  runningTime: 'Running Time',
  scale: 'Scale',
  section: 'Section',
  series: 'Series',
  seriesNumber: 'Series Number',
  seriesText: 'Series Text',
  seriesTitle: 'Series Title',
  session: 'Session',
  sessionTitle: 'Session Title',
  shortTitle: 'Short Title',
  status: 'Status',
  studio: 'Studio',
  subject: 'Subject',
  system: 'System',
  thesisType: 'Type',
  title: 'Title',
  type: 'Type',
  university: 'University',
  url: 'URL',
  versionNumber: 'Version',
  videoRecordingFormat: 'Format',
  volume: 'Volume',
  websiteTitle: 'Website Title',
  websiteType: 'Website Type',
};

/**
 * Mutable, dynamically-updated label lookup map for all fields.
 * Hydrated from backend schema and persisted across sessions.
 */
export const FIELD_LABELS: Record<string, string> = {
  ...INITIAL_FIELD_LABELS,
};

/**
 * Seed mappings for all 37 Zotero Schema v42 bibliographic item types.
 * Dynamically updated from backend schema at runtime.
 */
export const INITIAL_ITEM_TYPE_FIELDS_MAP: Record<string, string[]> = {
  artwork: [
    'title', 'abstractNote', 'artworkMedium', 'artworkSize', 'date', 'eventPlace', 'DOI', 'citationKey', 'url', 'accessDate', 'archive', 'archiveLocation', 'shortTitle', 'language', 'libraryCatalog', 'callNumber', 'rights', 'extra',
  ],
  audioRecording: [
    'title', 'abstractNote', 'audioRecordingFormat', 'seriesTitle', 'volume', 'numberOfVolumes', 'label', 'place', 'date', 'runningTime', 'ISBN', 'DOI', 'citationKey', 'url', 'accessDate', 'archive', 'archiveLocation', 'shortTitle', 'language', 'libraryCatalog', 'callNumber', 'rights', 'extra',
  ],
  bill: [
    'title', 'abstractNote', 'billNumber', 'code', 'codeVolume', 'section', 'codePages', 'legislativeBody', 'session', 'history', 'date', 'DOI', 'citationKey', 'url', 'accessDate', 'shortTitle', 'language', 'rights', 'extra',
  ],
  blogPost: [
    'title', 'abstractNote', 'blogTitle', 'websiteType', 'date', 'DOI', 'citationKey', 'url', 'accessDate', 'ISSN', 'shortTitle', 'language', 'rights', 'extra',
  ],
  book: [
    'title', 'abstractNote', 'series', 'seriesNumber', 'volume', 'numberOfVolumes', 'edition', 'date', 'publisher', 'place', 'originalDate', 'originalPublisher', 'originalPlace', 'format', 'numPages', 'ISBN', 'DOI', 'citationKey', 'url', 'accessDate', 'ISSN', 'archive', 'archiveLocation', 'shortTitle', 'language', 'libraryCatalog', 'callNumber', 'rights', 'extra',
  ],
  bookSection: [
    'title', 'abstractNote', 'bookTitle', 'series', 'seriesNumber', 'volume', 'numberOfVolumes', 'edition', 'date', 'publisher', 'place', 'originalDate', 'originalPublisher', 'originalPlace', 'format', 'pages', 'ISBN', 'DOI', 'citationKey', 'url', 'accessDate', 'ISSN', 'archive', 'archiveLocation', 'shortTitle', 'language', 'libraryCatalog', 'callNumber', 'rights', 'extra',
  ],
  case: [
    'caseName', 'abstractNote', 'court', 'dateDecided', 'docketNumber', 'reporter', 'reporterVolume', 'firstPage', 'history', 'DOI', 'citationKey', 'url', 'accessDate', 'shortTitle', 'language', 'rights', 'extra',
  ],
  computerProgram: [
    'title', 'abstractNote', 'seriesTitle', 'versionNumber', 'date', 'system', 'company', 'place', 'programmingLanguage', 'rights', 'citationKey', 'url', 'accessDate', 'DOI', 'ISBN', 'archive', 'archiveLocation', 'libraryCatalog', 'callNumber', 'shortTitle', 'extra',
  ],
  conferencePaper: [
    'title', 'abstractNote', 'proceedingsTitle', 'conferenceName', 'publisher', 'place', 'date', 'eventPlace', 'volume', 'issue', 'numberOfVolumes', 'pages', 'series', 'seriesNumber', 'DOI', 'ISBN', 'citationKey', 'url', 'accessDate', 'ISSN', 'archive', 'archiveLocation', 'shortTitle', 'language', 'libraryCatalog', 'callNumber', 'rights', 'extra',
  ],
  dataset: [
    'title', 'abstractNote', 'identifier', 'type', 'versionNumber', 'date', 'repository', 'repositoryLocation', 'format', 'DOI', 'citationKey', 'url', 'accessDate', 'archive', 'archiveLocation', 'shortTitle', 'language', 'libraryCatalog', 'callNumber', 'rights', 'extra',
  ],
  dictionaryEntry: [
    'title', 'abstractNote', 'dictionaryTitle', 'series', 'seriesNumber', 'volume', 'numberOfVolumes', 'edition', 'date', 'publisher', 'place', 'pages', 'ISBN', 'DOI', 'citationKey', 'url', 'accessDate', 'archive', 'archiveLocation', 'shortTitle', 'language', 'libraryCatalog', 'callNumber', 'rights', 'extra',
  ],
  document: [
    'title', 'abstractNote', 'type', 'date', 'publisher', 'place', 'DOI', 'citationKey', 'url', 'accessDate', 'archive', 'archiveLocation', 'shortTitle', 'language', 'libraryCatalog', 'callNumber', 'rights', 'extra',
  ],
  email: [
    'subject', 'abstractNote', 'date', 'DOI', 'citationKey', 'url', 'accessDate', 'shortTitle', 'language', 'rights', 'extra',
  ],
  encyclopediaArticle: [
    'title', 'abstractNote', 'encyclopediaTitle', 'series', 'seriesNumber', 'volume', 'numberOfVolumes', 'edition', 'date', 'publisher', 'place', 'pages', 'ISBN', 'DOI', 'citationKey', 'url', 'accessDate', 'archive', 'archiveLocation', 'shortTitle', 'language', 'libraryCatalog', 'callNumber', 'rights', 'extra',
  ],
  film: [
    'title', 'abstractNote', 'distributor', 'place', 'date', 'genre', 'videoRecordingFormat', 'runningTime', 'DOI', 'citationKey', 'url', 'accessDate', 'archive', 'archiveLocation', 'shortTitle', 'language', 'libraryCatalog', 'callNumber', 'rights', 'extra',
  ],
  forumPost: [
    'title', 'abstractNote', 'forumTitle', 'postType', 'date', 'DOI', 'citationKey', 'url', 'accessDate', 'shortTitle', 'language', 'rights', 'extra',
  ],
  hearing: [
    'title', 'abstractNote', 'committee', 'publisher', 'numberOfVolumes', 'documentNumber', 'pages', 'legislativeBody', 'session', 'history', 'date', 'place', 'DOI', 'citationKey', 'url', 'accessDate', 'shortTitle', 'language', 'rights', 'extra',
  ],
  instantMessage: [
    'title', 'abstractNote', 'date', 'DOI', 'citationKey', 'url', 'accessDate', 'shortTitle', 'language', 'rights', 'extra',
  ],
  interview: [
    'title', 'abstractNote', 'interviewMedium', 'date', 'publisher', 'place', 'DOI', 'citationKey', 'url', 'accessDate', 'archive', 'archiveLocation', 'shortTitle', 'language', 'libraryCatalog', 'callNumber', 'rights', 'extra',
  ],
  journalArticle: [
    'title', 'abstractNote', 'publicationTitle', 'publisher', 'place', 'date', 'volume', 'issue', 'section', 'partNumber', 'partTitle', 'pages', 'series', 'seriesTitle', 'seriesText', 'journalAbbreviation', 'DOI', 'citationKey', 'url', 'accessDate', 'PMID', 'PMCID', 'ISSN', 'archive', 'archiveLocation', 'shortTitle', 'language', 'libraryCatalog', 'callNumber', 'rights', 'extra',
  ],
  letter: [
    'title', 'abstractNote', 'letterType', 'date', 'eventPlace', 'DOI', 'citationKey', 'url', 'accessDate', 'archive', 'archiveLocation', 'shortTitle', 'language', 'libraryCatalog', 'callNumber', 'rights', 'extra',
  ],
  magazineArticle: [
    'title', 'abstractNote', 'publicationTitle', 'publisher', 'place', 'date', 'volume', 'issue', 'pages', 'ISSN', 'DOI', 'citationKey', 'url', 'accessDate', 'archive', 'archiveLocation', 'shortTitle', 'language', 'libraryCatalog', 'callNumber', 'rights', 'extra',
  ],
  manuscript: [
    'title', 'abstractNote', 'manuscriptType', 'institution', 'place', 'date', 'numPages', 'number', 'DOI', 'citationKey', 'url', 'accessDate', 'archive', 'archiveLocation', 'shortTitle', 'language', 'libraryCatalog', 'callNumber', 'rights', 'extra',
  ],
  map: [
    'title', 'abstractNote', 'mapType', 'scale', 'seriesTitle', 'edition', 'publisher', 'place', 'date', 'DOI', 'ISBN', 'citationKey', 'url', 'accessDate', 'archive', 'archiveLocation', 'shortTitle', 'language', 'libraryCatalog', 'callNumber', 'rights', 'extra',
  ],
  newspaperArticle: [
    'title', 'abstractNote', 'publicationTitle', 'publisher', 'place', 'date', 'volume', 'issue', 'edition', 'section', 'pages', 'ISSN', 'DOI', 'citationKey', 'url', 'accessDate', 'archive', 'archiveLocation', 'shortTitle', 'language', 'libraryCatalog', 'callNumber', 'rights', 'extra',
  ],
  patent: [
    'title', 'abstractNote', 'place', 'country', 'assignee', 'issuingAuthority', 'patentNumber', 'filingDate', 'pages', 'applicationNumber', 'priorityNumbers', 'issueDate', 'priorityDate', 'references', 'legalStatus', 'DOI', 'citationKey', 'url', 'accessDate', 'shortTitle', 'language', 'rights', 'extra',
  ],
  podcast: [
    'title', 'abstractNote', 'seriesTitle', 'episodeNumber', 'audioFileType', 'date', 'publisher', 'place', 'runningTime', 'DOI', 'citationKey', 'url', 'accessDate', 'shortTitle', 'language', 'rights', 'extra',
  ],
  preprint: [
    'title', 'abstractNote', 'genre', 'repository', 'archiveID', 'place', 'date', 'series', 'seriesNumber', 'DOI', 'citationKey', 'url', 'accessDate', 'archive', 'archiveLocation', 'shortTitle', 'language', 'libraryCatalog', 'callNumber', 'rights', 'extra',
  ],
  presentation: [
    'title', 'abstractNote', 'presentationType', 'date', 'meetingName', 'place', 'series', 'sessionTitle', 'DOI', 'citationKey', 'url', 'accessDate', 'shortTitle', 'language', 'rights', 'extra',
  ],
  radioBroadcast: [
    'title', 'abstractNote', 'programTitle', 'episodeNumber', 'audioRecordingFormat', 'network', 'place', 'date', 'runningTime', 'DOI', 'citationKey', 'url', 'accessDate', 'archive', 'archiveLocation', 'shortTitle', 'language', 'libraryCatalog', 'callNumber', 'rights', 'extra',
  ],
  report: [
    'title', 'abstractNote', 'reportNumber', 'reportType', 'institution', 'place', 'date', 'seriesTitle', 'seriesNumber', 'pages', 'DOI', 'ISBN', 'citationKey', 'url', 'accessDate', 'ISSN', 'archive', 'archiveLocation', 'shortTitle', 'language', 'libraryCatalog', 'callNumber', 'rights', 'extra',
  ],
  standard: [
    'title', 'abstractNote', 'organization', 'committee', 'type', 'number', 'versionNumber', 'edition', 'status', 'date', 'publisher', 'place', 'partNumber', 'partTitle', 'ISBN', 'DOI', 'citationKey', 'url', 'accessDate', 'archive', 'archiveLocation', 'shortTitle', 'numPages', 'language', 'libraryCatalog', 'callNumber', 'rights', 'extra',
  ],
  statute: [
    'nameOfAct', 'abstractNote', 'code', 'codeNumber', 'publicLawNumber', 'dateEnacted', 'pages', 'section', 'session', 'history', 'DOI', 'citationKey', 'url', 'accessDate', 'shortTitle', 'language', 'rights', 'extra',
  ],
  thesis: [
    'title', 'abstractNote', 'thesisType', 'university', 'place', 'date', 'series', 'seriesNumber', 'numPages', 'DOI', 'ISBN', 'citationKey', 'url', 'accessDate', 'ISSN', 'archive', 'archiveLocation', 'shortTitle', 'language', 'libraryCatalog', 'callNumber', 'rights', 'extra',
  ],
  tvBroadcast: [
    'title', 'abstractNote', 'programTitle', 'episodeNumber', 'videoRecordingFormat', 'network', 'place', 'date', 'runningTime', 'DOI', 'citationKey', 'url', 'accessDate', 'archive', 'archiveLocation', 'shortTitle', 'language', 'libraryCatalog', 'callNumber', 'rights', 'extra',
  ],
  videoRecording: [
    'title', 'abstractNote', 'videoRecordingFormat', 'seriesTitle', 'volume', 'numberOfVolumes', 'studio', 'place', 'date', 'runningTime', 'ISBN', 'DOI', 'citationKey', 'url', 'accessDate', 'archive', 'archiveLocation', 'shortTitle', 'language', 'libraryCatalog', 'callNumber', 'rights', 'extra',
  ],
  webpage: [
    'title', 'abstractNote', 'websiteTitle', 'websiteType', 'date', 'publisher', 'place', 'DOI', 'citationKey', 'url', 'accessDate', 'shortTitle', 'language', 'rights', 'extra',
  ],
};

/**
 * Mutable, dynamically-updated type-to-field list mapping.
 * Hydrated from backend schema and persisted across sessions.
 */
export const ITEM_TYPE_FIELDS_MAP: Record<string, string[]> = {
  ...INITIAL_ITEM_TYPE_FIELDS_MAP,
};

/**
 * All canonical Zotero Schema v42 field names derived automatically from the
 * bibliographic item types in `ITEM_TYPE_FIELDS_MAP`.
 * Mutated in place by `updateCachedFields` whenever the dynamic schema registry hydrates.
 */
const MUTABLE_ALL_SCHEMA_FIELD_KEYS = new Set<string>(
  Object.values(INITIAL_ITEM_TYPE_FIELDS_MAP).flat(),
);

export const ALL_SCHEMA_FIELD_KEYS: ReadonlySet<string> =
  MUTABLE_ALL_SCHEMA_FIELD_KEYS;

export function rebuildAllSchemaFieldKeys(): void {
  for (const fields of Object.values(ITEM_TYPE_FIELDS_MAP)) {
    if (Array.isArray(fields)) {
      for (const f of fields) {
        if (typeof f === 'string' && f.trim()) {
          MUTABLE_ALL_SCHEMA_FIELD_KEYS.add(f.trim());
        }
      }
    }
  }
}

export interface SchemaFieldEntry {
  field?: string;
  key?: string;
  label?: string;
}

export interface SchemaTypeEntry {
  itemType: string;
  fields?: SchemaFieldEntry[];
}

/**
 * Updates the field label and type-field mappings in-memory from backend schema definitions.
 */
export function updateCachedFields(types: unknown[]): void {
  if (!Array.isArray(types)) return;
  for (const entry of types) {
    if (!entry || typeof entry !== 'object') continue;
    const typedEntry = entry as Partial<SchemaTypeEntry>;
    const itemType = typedEntry.itemType;
    if (!itemType || typeof itemType !== 'string') continue;

    const fields = typedEntry.fields;
    if (Array.isArray(fields)) {
      const fieldKeys: string[] = [];
      for (const f of fields) {
        if (!f) continue;
        const fieldName = f.field || f.key;
        if (typeof fieldName === 'string' && fieldName.trim()) {
          fieldKeys.push(fieldName);
          MUTABLE_ALL_SCHEMA_FIELD_KEYS.add(fieldName);
          if (f.label && typeof f.label === 'string') {
            FIELD_LABELS[fieldName] = f.label;
          } else if (!FIELD_LABELS[fieldName]) {
            FIELD_LABELS[fieldName] = humanizeFieldName(fieldName);
          }
        }
      }
      ITEM_TYPE_FIELDS_MAP[itemType] = fieldKeys;
    }
  }
}

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

/**
 * baseField -> concrete field mappings per item type, derived from Zotero Schema v42.
 * Updated at runtime by updateLibrarySchemaRegistry() via Object.assign.
 */
export const BASE_FIELD_MAPPINGS: Record<string, Record<string, string>> = {
  journalArticle: {},
  conferencePaper: { publicationTitle: 'proceedingsTitle' },
  preprint: { type: 'genre', publisher: 'repository', number: 'archiveID' },
  thesis: { type: 'thesisType', publisher: 'university' },
  report: { number: 'reportNumber', type: 'reportType', publisher: 'institution' },
  dataset: { number: 'identifier', publisher: 'repository', place: 'repositoryLocation', medium: 'format' },
  presentation: { type: 'presentationType', publicationTitle: 'sessionTitle' },
  standard: { authority: 'organization' },
  book: { medium: 'format' },
  bookSection: { publicationTitle: 'bookTitle', medium: 'format' },
  dictionaryEntry: { publicationTitle: 'dictionaryTitle' },
  encyclopediaArticle: { publicationTitle: 'encyclopediaTitle' },
  manuscript: { type: 'manuscriptType', publisher: 'institution' },
  magazineArticle: {},
  newspaperArticle: {},
  webpage: { publicationTitle: 'websiteTitle', type: 'websiteType' },
  blogPost: { publicationTitle: 'blogTitle', type: 'websiteType' },
  forumPost: { publicationTitle: 'forumTitle', type: 'postType' },
  patent: { authority: 'issuingAuthority', number: 'patentNumber', date: 'issueDate', originalDate: 'priorityDate', status: 'legalStatus' },
  statute: { title: 'nameOfAct', number: 'publicLawNumber', date: 'dateEnacted' },
  bill: { number: 'billNumber', volume: 'codeVolume', pages: 'codePages', authority: 'legislativeBody' },
  case: { title: 'caseName', authority: 'court', date: 'dateDecided', number: 'docketNumber', volume: 'reporterVolume', pages: 'firstPage' },
  hearing: { number: 'documentNumber', authority: 'legislativeBody' },
  artwork: { medium: 'artworkMedium' },
  audioRecording: { medium: 'audioRecordingFormat', publisher: 'label' },
  videoRecording: { medium: 'videoRecordingFormat', publisher: 'studio' },
  film: { publisher: 'distributor', type: 'genre', medium: 'videoRecordingFormat' },
  radioBroadcast: { publicationTitle: 'programTitle', number: 'episodeNumber', medium: 'audioRecordingFormat', publisher: 'network' },
  tvBroadcast: { publicationTitle: 'programTitle', number: 'episodeNumber', medium: 'videoRecordingFormat', publisher: 'network' },
  podcast: { number: 'episodeNumber', medium: 'audioFileType' },
  map: { type: 'mapType' },
  document: {},
  computerProgram: { publisher: 'company' },
  letter: { type: 'letterType' },
  email: { title: 'subject' },
  instantMessage: {},
  interview: { medium: 'interviewMedium' },
};

export function deriveReverseBaseFieldMappings(
  baseMappings: Record<string, Record<string, string>>,
): Record<string, Record<string, string>> {
  const reverse: Record<string, Record<string, string>> = {};
  for (const [itemType, mapping] of Object.entries(baseMappings)) {
    const inverted: Record<string, string> = {};
    for (const [baseField, concreteField] of Object.entries(mapping)) {
      if (concreteField) {
        inverted[concreteField] = baseField;
      }
    }
    if (Object.keys(inverted).length > 0) {
      reverse[itemType] = inverted;
    }
  }
  return reverse;
}

export const REVERSE_BASE_FIELD_MAPPINGS: Record<string, Record<string, string>> =
  deriveReverseBaseFieldMappings(BASE_FIELD_MAPPINGS);

/**
 * All 37 Zotero creator roles (en-US, schema v42).
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
 * Exact creator role lists for all 37 Zotero Schema v42 bibliographic item types,
 * in canonical Zotero schema order (index 0 is always the primary creator role).
 */
export const ITEM_TYPE_CREATOR_ROLES_MAP: Record<string, readonly string[]> = {
  artwork: ['artist', 'contributor'],
  audioRecording: ['performer', 'originalCreator', 'composer', 'wordsBy', 'translator', 'contributor'],
  bill: ['sponsor', 'cosponsor', 'contributor'],
  blogPost: ['author', 'translator', 'commenter', 'contributor'],
  book: ['author', 'contributor', 'editor', 'translator', 'seriesEditor'],
  bookSection: ['author', 'contributor', 'editor', 'bookAuthor', 'translator', 'seriesEditor'],
  case: ['author', 'counsel', 'contributor'],
  computerProgram: ['programmer', 'contributor'],
  conferencePaper: ['author', 'contributor', 'editor', 'translator', 'seriesEditor'],
  dataset: ['author', 'contributor'],
  dictionaryEntry: ['author', 'contributor', 'editor', 'translator', 'seriesEditor'],
  document: ['author', 'contributor', 'editor', 'translator', 'reviewedAuthor'],
  email: ['author', 'translator', 'contributor', 'recipient'],
  encyclopediaArticle: ['author', 'contributor', 'editor', 'translator', 'seriesEditor'],
  film: ['director', 'producer', 'scriptwriter', 'castMember', 'host', 'guest', 'narrator', 'translator', 'contributor'],
  forumPost: ['author', 'contributor'],
  hearing: ['contributor'],
  instantMessage: ['author', 'contributor', 'recipient'],
  interview: ['interviewee', 'contributor', 'interviewer', 'translator'],
  journalArticle: ['author', 'contributor', 'editor', 'translator', 'reviewedAuthor'],
  letter: ['author', 'recipient', 'contributor', 'translator'],
  magazineArticle: ['author', 'contributor', 'translator', 'reviewedAuthor'],
  manuscript: ['author', 'contributor', 'translator'],
  map: ['cartographer', 'contributor', 'seriesEditor'],
  newspaperArticle: ['author', 'contributor', 'translator', 'reviewedAuthor'],
  patent: ['inventor', 'attorneyAgent', 'contributor'],
  podcast: ['podcaster', 'guest', 'producer', 'executiveProducer', 'seriesCreator', 'director', 'scriptwriter', 'castMember', 'translator', 'contributor'],
  preprint: ['author', 'contributor', 'editor', 'translator', 'reviewedAuthor'],
  presentation: ['presenter', 'chair', 'organizer', 'contributor', 'translator'],
  radioBroadcast: ['creator', 'host', 'guest', 'producer', 'executiveProducer', 'seriesCreator', 'director', 'scriptwriter', 'castMember', 'translator', 'contributor'],
  report: ['author', 'editor', 'contributor', 'translator', 'seriesEditor'],
  standard: ['author', 'editor', 'contributor'],
  statute: ['author', 'contributor'],
  thesis: ['author', 'contributor'],
  tvBroadcast: ['director', 'producer', 'executiveProducer', 'seriesCreator', 'scriptwriter', 'castMember', 'host', 'guest', 'narrator', 'translator', 'contributor'],
  videoRecording: ['creator', 'director', 'producer', 'scriptwriter', 'executiveProducer', 'castMember', 'host', 'guest', 'narrator', 'translator', 'contributor'],
  webpage: ['author', 'contributor', 'translator'],
};
