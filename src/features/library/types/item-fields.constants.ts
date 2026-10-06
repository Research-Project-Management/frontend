/**
 * Library Item-Field Dynamic Schema Cache & Bootstrap Fallback
 * Sourced dynamically from Backend Single Source of Truth (/api/v1/library/item-types/schema).
 * Provides 0ms instant bootstrap with persistent client-side cache and runtime reactivity.
 */

export const SCHEMA_CACHE_KEY = 'flux:library:schema-v42:cache';

export function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

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
 * Seed mappings for standard academic & common bibliographic item types.
 * Full mappings for all 37 types are dynamically populated from backend schema.
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

export interface SchemaFieldEntry {
  field?: string;
  key?: string;
  label?: string;
}

export interface SchemaTypeEntry {
  itemType: string;
  fields?: SchemaFieldEntry[];
}

export interface SchemaCachePayload {
  version?: number;
  timestamp?: number;
  itemTypes?: SchemaTypeEntry[];
  data?: SchemaTypeEntry[] | { itemTypes?: SchemaTypeEntry[] };
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
 * Persists the backend schema snapshot to localStorage for 0ms initial render on future loads.
 */
export function saveSchemaCache(data: unknown): void {
  if (!isBrowser() || !data) return;
  try {
    window.localStorage.setItem(
      SCHEMA_CACHE_KEY,
      JSON.stringify({
        version: 42,
        timestamp: Date.now(),
        data,
      }),
    );
  } catch {
    // Gracefully handle storage quota or private browsing mode
  }
}

/**
 * Retrieves the cached backend schema snapshot from localStorage if available.
 */
export function loadSchemaCache(): unknown | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(SCHEMA_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown> | null;
    return parsed?.data ?? null;
  } catch {
    return null;
  }
}

// Hydrate immediately at module evaluation time if in browser
if (isBrowser()) {
  const cached = loadSchemaCache();
  if (cached && typeof cached === 'object') {
    const payload = cached as SchemaCachePayload;
    const rawTypes =
      payload.itemTypes ||
      (Array.isArray(payload.data) ? payload.data : (payload.data as { itemTypes?: SchemaTypeEntry[] })?.itemTypes);
    if (Array.isArray(rawTypes)) {
      updateCachedFields(rawTypes);
    }
  }
}
