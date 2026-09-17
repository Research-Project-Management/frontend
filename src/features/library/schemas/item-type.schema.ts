/**
 * Library Item-Type Registry — Frontend Canonical Definitions & Offline Cache
 * Dynamic runtime SSOT powered by Backend GET /api/v1/library/item-types.
 * Lightweight static fallbacks provide offline stability without bundling raw 462KB JSON.
 */

export interface SchemaFieldDefinition {
  field: string;
  label: string;
  placeholder?: string;
  type: 'text' | 'textarea' | 'date' | 'number' | 'url';
  category?: 'core' | 'venue' | 'publication' | 'identifiers' | 'archive' | 'extra';
  mono?: boolean;
  /** Canonical semantic field supplied by the Library registry, when applicable. */
  baseField?: string;
}

export interface SchemaCreatorTypeDefinition {
  creatorType: string;
  label: string;
  primary?: boolean;
}

export interface SchemaItemTypeDefinition {
  itemType: string;
  label: string;
  category: 'academic' | 'books' | 'articles' | 'legal' | 'media' | 'documents';
  primaryCreatorType: string;
  creatorTypes: SchemaCreatorTypeDefinition[];
  fields: SchemaFieldDefinition[];
}

export interface ItemTypeCategoryGroup {
  id: string;
  label: string;
  types: { value: string; label: string }[];
}

/** Shape returned by the Library item-type registry API. Kept local to this
 * feature so the UI has one explicit boundary for the backend contract. */
export interface RegistryItemTypeDefinition {
  itemType: string;
  label: string;
  category: SchemaItemTypeDefinition['category'] | 'special';
  primaryCreatorType: string;
  creatorTypes: SchemaCreatorTypeDefinition[];
  fields: Array<{
    key: string;
    label: string;
    placeholder?: string;
    type?: SchemaFieldDefinition['type'];
    category?: SchemaFieldDefinition['category'];
    mono?: boolean;
    baseField?: string;
    order?: number;
  }>;
  isBibliographic?: boolean;
}

const VALID_ITEM_TYPE_CATEGORIES = new Set<SchemaItemTypeDefinition['category']>([
  'academic', 'books', 'articles', 'legal', 'media', 'documents',
]);
const FIELD_TYPES = new Set<SchemaFieldDefinition['type']>([
  'text', 'textarea', 'date', 'number', 'url',
]);
const FIELD_CATEGORIES = new Set<NonNullable<SchemaFieldDefinition['category']>>([
  'core', 'venue', 'publication', 'identifiers', 'archive', 'extra',
]);

/**
 * Converts the server-owned registry to the shape used by the Info panel.
 * Invalid API entries are ignored, while the caller may still use the local
 * definitions as an offline fallback.
 */
export function mapRegistryItemTypes(value: unknown): SchemaItemTypeDefinition[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry): SchemaItemTypeDefinition[] => {
    if (!entry || typeof entry !== 'object') return [];
    const type = entry as RegistryItemTypeDefinition;
    if (
      type.isBibliographic === false ||
      !type.itemType ||
      !type.label ||
      !VALID_ITEM_TYPE_CATEGORIES.has(type.category as SchemaItemTypeDefinition['category'])
    ) {
      return [];
    }

    const fields = Array.isArray(type.fields)
      ? type.fields
          .filter((field) => field && typeof field.key === 'string' && field.key.length > 0)
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          .map((field): SchemaFieldDefinition => ({
            field: field.key,
            label: field.label || field.key,
            placeholder: field.placeholder,
            type: FIELD_TYPES.has(field.type as SchemaFieldDefinition['type'])
              ? (field.type as SchemaFieldDefinition['type'])
              : 'text',
            category: FIELD_CATEGORIES.has(field.category as NonNullable<SchemaFieldDefinition['category']>)
              ? (field.category as NonNullable<SchemaFieldDefinition['category']>)
              : undefined,
            mono: Boolean(field.mono),
            baseField: field.baseField,
          }))
      : [];

    return [{
      itemType: type.itemType,
      label: type.label,
      category: type.category as SchemaItemTypeDefinition['category'],
      primaryCreatorType: type.primaryCreatorType || 'author',
      creatorTypes: Array.isArray(type.creatorTypes) ? type.creatorTypes : [],
      fields,
    }];
  });
}

const CATEGORY_MAP: Record<string, SchemaItemTypeDefinition['category']> = {
  journalArticle: 'academic',
  preprint: 'academic',
  conferencePaper: 'academic',
  thesis: 'academic',
  report: 'academic',
  dataset: 'academic',
  presentation: 'academic',
  standard: 'academic',
  book: 'books',
  bookSection: 'books',
  manuscript: 'books',
  dictionaryEntry: 'books',
  encyclopediaArticle: 'books',
  magazineArticle: 'articles',
  newspaperArticle: 'articles',
  bill: 'legal',
  case: 'legal',
  hearing: 'legal',
  statute: 'legal',
  patent: 'legal',
  audioRecording: 'media',
  videoRecording: 'media',
  film: 'media',
  radioBroadcast: 'media',
  tvBroadcast: 'media',
  podcast: 'media',
  artwork: 'media',
  map: 'media',
  blogPost: 'documents',
  webpage: 'documents',
  forumPost: 'documents',
  letter: 'documents',
  interview: 'documents',
  document: 'documents',
  email: 'documents',
  instantMessage: 'documents',
  computerProgram: 'documents',
};

const FIELD_CATEGORY_MAP: Record<string, NonNullable<SchemaFieldDefinition['category']>> = {
  title: 'core',
  shortTitle: 'core',
  abstractNote: 'core',
  publicationTitle: 'venue',
  publisher: 'venue',
  place: 'venue',
  university: 'venue',
  institution: 'venue',
  conferenceName: 'venue',
  court: 'venue',
  distributor: 'venue',
  studio: 'venue',
  network: 'venue',
  company: 'venue',
  repository: 'venue',
  date: 'publication',
  dateDecided: 'publication',
  dateEnacted: 'publication',
  issueDate: 'publication',
  filingDate: 'publication',
  accessDate: 'publication',
  pages: 'publication',
  volume: 'publication',
  issue: 'publication',
  section: 'publication',
  partNumber: 'publication',
  partTitle: 'publication',
  series: 'publication',
  seriesTitle: 'publication',
  seriesText: 'publication',
  seriesNumber: 'publication',
  journalAbbreviation: 'publication',
  language: 'publication',
  edition: 'publication',
  numPages: 'publication',
  numberOfVolumes: 'publication',
  runningTime: 'publication',
  versionNumber: 'publication',
  DOI: 'identifiers',
  ISSN: 'identifiers',
  ISBN: 'identifiers',
  PMID: 'identifiers',
  PMCID: 'identifiers',
  url: 'identifiers',
  citationKey: 'identifiers',
  archiveID: 'identifiers',
  patentNumber: 'identifiers',
  applicationNumber: 'identifiers',
  reportNumber: 'identifiers',
  docketNumber: 'identifiers',
  documentNumber: 'identifiers',
  billNumber: 'identifiers',
  standardNumber: 'identifiers',
  codeNumber: 'identifiers',
  publicLawNumber: 'identifiers',
  bookTitle: 'venue',
  proceedingsTitle: 'venue',
  eventPlace: 'venue',
  websiteTitle: 'venue',
  blogTitle: 'venue',
  dictionaryTitle: 'venue',
  encyclopediaTitle: 'venue',
  forumTitle: 'venue',
  websiteType: 'publication',
  thesisType: 'publication',
  reportType: 'publication',
  genre: 'publication',
  postType: 'publication',
  format: 'publication',
  originalDate: 'publication',
  originalPublisher: 'venue',
  originalPlace: 'venue',
  country: 'venue',
  assignee: 'venue',
  issuingAuthority: 'venue',
  legalStatus: 'publication',
  archive: 'archive',
  archiveLocation: 'archive',
  libraryCatalog: 'archive',
  callNumber: 'archive',
  rights: 'extra',
  extra: 'extra',
};

const MONO_FIELDS = new Set([
  'volume', 'issue', 'pages', 'seriesNumber', 'date', 'filingDate', 'accessDate',
  'dateDecided', 'dateEnacted', 'issueDate', 'DOI', 'ISBN', 'ISSN', 'PMID', 'PMCID',
  'archiveID', 'patentNumber', 'applicationNumber', 'reportNumber', 'docketNumber',
  'documentNumber', 'billNumber', 'standardNumber', 'codeNumber', 'publicLawNumber',
  'citationKey', 'url', 'callNumber', 'versionNumber', 'episodeNumber', 'runningTime',
  'scale', 'numPages', 'numberOfVolumes'
]);

const TYPE_PRIMARY_CREATORS: Record<string, string> = {
  computerProgram: 'programmer',
  film: 'director',
  videoRecording: 'director',
  tvBroadcast: 'director',
  radioBroadcast: 'director',
  podcast: 'podcaster',
  patent: 'inventor',
  presentation: 'presenter',
  interview: 'interviewee',
  map: 'cartographer',
  artwork: 'artist',
};

const ITEM_TYPE_LABELS: Record<string, string> = {
  journalArticle: 'Journal Article',
  preprint: 'Preprint',
  conferencePaper: 'Conference Paper',
  thesis: 'Thesis',
  report: 'Report',
  dataset: 'Dataset',
  presentation: 'Presentation',
  standard: 'Standard',
  book: 'Book',
  bookSection: 'Book Section',
  manuscript: 'Manuscript',
  dictionaryEntry: 'Dictionary Entry',
  encyclopediaArticle: 'Encyclopedia Article',
  magazineArticle: 'Magazine Article',
  newspaperArticle: 'Newspaper Article',
  bill: 'Bill',
  case: 'Case',
  hearing: 'Hearing',
  statute: 'Statute',
  patent: 'Patent',
  audioRecording: 'Audio Recording',
  videoRecording: 'Video Recording',
  film: 'Film',
  radioBroadcast: 'Radio Broadcast',
  tvBroadcast: 'TV Broadcast',
  podcast: 'Podcast',
  artwork: 'Artwork',
  map: 'Map',
  blogPost: 'Blog Post',
  webpage: 'Web Page',
  forumPost: 'Forum Post',
  letter: 'Letter',
  interview: 'Interview',
  document: 'Document',
  email: 'E-mail',
  instantMessage: 'Instant Message',
  computerProgram: 'Computer Program',
};

const FIELD_LABELS: Record<string, string> = {
  title: 'Title',
  shortTitle: 'Short Title',
  abstractNote: 'Abstract',
  publicationTitle: 'Publication Title',
  publisher: 'Publisher',
  place: 'Place',
  university: 'University',
  institution: 'Institution',
  conferenceName: 'Conference Name',
  court: 'Court',
  distributor: 'Distributor',
  studio: 'Studio',
  network: 'Network',
  company: 'Company',
  repository: 'Repository',
  date: 'Date',
  dateDecided: 'Date Decided',
  dateEnacted: 'Date Enacted',
  issueDate: 'Issue Date',
  filingDate: 'Filing Date',
  accessDate: 'Accessed',
  pages: 'Pages',
  volume: 'Volume',
  issue: 'Issue',
  section: 'Section',
  partNumber: 'Part Number',
  partTitle: 'Part Title',
  series: 'Series',
  seriesTitle: 'Series Title',
  seriesText: 'Series Text',
  seriesNumber: 'Series Number',
  journalAbbreviation: 'Journal Abbr',
  language: 'Language',
  edition: 'Edition',
  numPages: '# of Pages',
  numberOfVolumes: '# of Volumes',
  runningTime: 'Running Time',
  versionNumber: 'Version',
  DOI: 'DOI',
  ISSN: 'ISSN',
  ISBN: 'ISBN',
  PMID: 'PMID',
  PMCID: 'PMCID',
  url: 'URL',
  citationKey: 'Citation Key',
  archiveID: 'Archive ID',
  patentNumber: 'Patent Number',
  applicationNumber: 'Application Number',
  reportNumber: 'Report Number',
  docketNumber: 'Docket Number',
  documentNumber: 'Document Number',
  billNumber: 'Bill Number',
  standardNumber: 'Standard Number',
  codeNumber: 'Code Number',
  publicLawNumber: 'Public Law Number',
  archive: 'Archive',
  archiveLocation: 'Loc. in Archive',
  libraryCatalog: 'Library Catalog',
  callNumber: 'Call Number',
  bookTitle: 'Book Title',
  proceedingsTitle: 'Proceedings Title',
  websiteTitle: 'Website Title',
  blogTitle: 'Blog Title',
  dictionaryTitle: 'Dictionary Title',
  encyclopediaTitle: 'Encyclopedia Title',
  forumTitle: 'Forum Title',
  websiteType: 'Website Type',
  thesisType: 'Type',
  reportType: 'Report Type',
  genre: 'Genre',
  postType: 'Post Type',
  eventPlace: 'Place',
  format: 'Format',
  originalDate: 'Original Date',
  originalPublisher: 'Original Publisher',
  originalPlace: 'Original Place',
  country: 'Country',
  assignee: 'Assignee',
  issuingAuthority: 'Issuing Authority',
  legalStatus: 'Legal Status',
  rights: 'Rights',
  extra: 'Extra',
};

export const ALL_CREATOR_TYPES: Record<string, string> = {
  author: 'Author',
  contributor: 'Contributor',
  editor: 'Editor',
  translator: 'Translator',
  seriesEditor: 'Series Editor',
  interviewee: 'Interviewee',
  interviewer: 'Interviewer',
  director: 'Director',
  scriptwriter: 'Scriptwriter',
  producer: 'Producer',
  castMember: 'Cast Member',
  programmer: 'Programmer',
  artist: 'Artist',
  sponsor: 'Sponsor',
  inventor: 'Inventor',
  attorneyAgent: 'Attorney/Agent',
  recipient: 'Recipient',
  performer: 'Performer',
  composer: 'Composer',
  wordsBy: 'Words By',
  cartographer: 'Cartographer',
  cosponsor: 'Cosponsor',
  bookAuthor: 'Book Author',
  reviewedAuthor: 'Reviewed Author',
  commenter: 'Commenter',
  presenter: 'Presenter',
  guest: 'Guest',
  podcaster: 'Podcaster',
};

const COMMON_FIELDS = ['title', 'abstractNote', 'date', 'url', 'extra'];

const TYPE_SPECIFIC_FIELDS: Record<string, string[]> = {
  journalArticle: [
    'title', 'abstractNote', 'publicationTitle', 'volume', 'issue', 'pages', 'date',
    'series', 'seriesTitle', 'seriesText', 'journalAbbreviation', 'language', 'DOI',
    'ISSN', 'shortTitle', 'url', 'accessDate', 'archive', 'archiveLocation',
    'libraryCatalog', 'callNumber', 'rights', 'extra',
  ],
  preprint: [
    'title', 'abstractNote', 'genre', 'repository', 'archiveID', 'place', 'date',
    'series', 'seriesNumber', 'DOI', 'citationKey', 'url', 'accessDate',
    'archive', 'archiveLocation', 'shortTitle', 'language', 'libraryCatalog',
    'callNumber', 'rights', 'extra',
  ],
  conferencePaper: [
    'title', 'abstractNote', 'publicationTitle', 'publisher',
    'place', 'date', 'eventPlace', 'volume', 'issue', 'numberOfVolumes',
    'pages', 'series', 'seriesNumber', 'DOI', 'ISBN', 'citationKey', 'url',
    'accessDate', 'ISSN', 'archive', 'archiveLocation', 'shortTitle', 'language',
    'libraryCatalog', 'callNumber', 'rights', 'extra',
  ],
  book: [
    'title', 'abstractNote', 'series', 'seriesNumber', 'volume', 'numberOfVolumes',
    'edition', 'place', 'publisher', 'date', 'numPages', 'language', 'ISBN',
    'shortTitle', 'url', 'accessDate', 'archive', 'archiveLocation', 'libraryCatalog',
    'callNumber', 'rights', 'extra',
  ],
  bookSection: [
    'title', 'abstractNote', 'bookTitle', 'series', 'seriesNumber', 'volume',
    'numberOfVolumes', 'edition', 'place', 'publisher', 'date', 'originalDate',
    'originalPublisher', 'originalPlace', 'format', 'pages', 'language',
    'ISBN', 'DOI', 'citationKey', 'url', 'accessDate', 'ISSN', 'archive',
    'archiveLocation', 'shortTitle', 'libraryCatalog', 'callNumber', 'rights', 'extra',
  ],
  thesis: [
    'title', 'abstractNote', 'thesisType', 'university', 'place', 'date',
    'series', 'seriesNumber', 'numPages', 'DOI', 'ISBN', 'citationKey',
    'url', 'accessDate', 'ISSN', 'archive', 'archiveLocation', 'shortTitle',
    'language', 'libraryCatalog', 'callNumber', 'rights', 'extra',
  ],
  report: [
    'title', 'abstractNote', 'reportNumber', 'reportType', 'institution',
    'place', 'date', 'seriesTitle', 'seriesNumber', 'pages', 'DOI', 'ISBN',
    'citationKey', 'url', 'accessDate', 'ISSN', 'archive', 'archiveLocation',
    'shortTitle', 'language', 'libraryCatalog', 'callNumber', 'rights', 'extra',
  ],
  webpage: [
    'title', 'abstractNote', 'websiteTitle', 'websiteType', 'date', 'publisher',
    'place', 'DOI', 'citationKey', 'url', 'accessDate', 'shortTitle', 'language',
    'rights', 'extra',
  ],
  patent: [
    'title', 'abstractNote', 'place', 'patentNumber', 'applicationNumber', 'filingDate',
    'issueDate', 'url', 'accessDate', 'rights', 'extra',
  ],
  dataset: [
    'title', 'abstractNote', 'repository', 'versionNumber', 'date', 'DOI', 'citationKey',
    'shortTitle', 'url', 'accessDate', 'rights', 'extra',
  ],
};

function buildFrontendRegistry() {
  const fieldDefinitions: Record<string, SchemaFieldDefinition> = {};
  for (const field of Object.keys(FIELD_CATEGORY_MAP)) {
    fieldDefinitions[field] = {
      field,
      label: FIELD_LABELS[field] || field,
      type: field.toLowerCase().endsWith('date') || field === 'date'
        ? 'date'
        : field === 'url'
          ? 'url'
          : field === 'abstractNote' || field === 'extra'
            ? 'textarea'
            : ['numPages', 'numberOfVolumes'].includes(field)
              ? 'number'
              : 'text',
      category: FIELD_CATEGORY_MAP[field] || 'publication',
      mono: MONO_FIELDS.has(field),
    };
  }

  const libraryItemTypes: Record<string, SchemaItemTypeDefinition> = {};
  const flatItemTypes: { value: string; label: string }[] = [];

  for (const [typeKey, label] of Object.entries(ITEM_TYPE_LABELS)) {
    const category = CATEGORY_MAP[typeKey] || 'documents';
    const primaryCreatorType = TYPE_PRIMARY_CREATORS[typeKey] || 'author';

    const creatorTypes: SchemaCreatorTypeDefinition[] = [
      {
        creatorType: primaryCreatorType,
        label: ALL_CREATOR_TYPES[primaryCreatorType] || primaryCreatorType,
        primary: true,
      },
      {
        creatorType: 'contributor',
        label: 'Contributor',
      },
    ];

    if (primaryCreatorType !== 'author') {
      creatorTypes.push({
        creatorType: 'author',
        label: 'Author',
      });
    }
    if (['book', 'bookSection', 'conferencePaper'].includes(typeKey)) {
      creatorTypes.push(
        { creatorType: 'editor', label: 'Editor' },
        { creatorType: 'translator', label: 'Translator' },
      );
    } else if (['journalArticle', 'preprint'].includes(typeKey)) {
      creatorTypes.push(
        { creatorType: 'translator', label: 'Translator' },
        { creatorType: 'editor', label: 'Editor' },
      );
    }

    const fieldKeys = TYPE_SPECIFIC_FIELDS[typeKey] || COMMON_FIELDS;
    const fields: SchemaFieldDefinition[] = fieldKeys.map(
      (f) =>
        fieldDefinitions[f] || {
          field: f,
          label: FIELD_LABELS[f] || f,
          type: 'text',
          category: FIELD_CATEGORY_MAP[f] || 'publication',
          mono: MONO_FIELDS.has(f),
        },
    );

    libraryItemTypes[typeKey] = {
      itemType: typeKey,
      label,
      category,
      primaryCreatorType,
      creatorTypes,
      fields,
    };

    flatItemTypes.push({
      value: typeKey,
      label,
    });
  }

  flatItemTypes.sort((a, b) => a.label.localeCompare(b.label));

  return {
    fieldDefinitions,
    libraryItemTypes,
    flatItemTypes,
  };
}

const REGISTRY_DATA = buildFrontendRegistry();

export const FIELD_DEFINITIONS: Record<string, SchemaFieldDefinition> = REGISTRY_DATA.fieldDefinitions;
export const LIBRARY_ITEM_TYPES: Record<string, SchemaItemTypeDefinition> = REGISTRY_DATA.libraryItemTypes;
export const ALL_ITEM_TYPES_FLAT: { value: string; label: string }[] = REGISTRY_DATA.flatItemTypes;

export const ITEM_TYPE_GROUPS: ItemTypeCategoryGroup[] = [
  {
    id: 'academic',
    label: 'Academic & Scientific',
    types: [
      { value: 'journalArticle', label: 'Journal Article' },
      { value: 'conferencePaper', label: 'Conference Paper' },
      { value: 'preprint', label: 'Preprint (arXiv / SSRN)' },
      { value: 'thesis', label: 'Thesis / Dissertation' },
      { value: 'report', label: 'Report / White Paper' },
      { value: 'dataset', label: 'Dataset' },
      { value: 'presentation', label: 'Presentation / Slides' },
    ],
  },
  {
    id: 'books',
    label: 'Books & Sections',
    types: [
      { value: 'book', label: 'Book' },
      { value: 'bookSection', label: 'Book Section / Chapter' },
      { value: 'dictionaryEntry', label: 'Dictionary Entry' },
      { value: 'encyclopediaArticle', label: 'Encyclopedia Article' },
      { value: 'manuscript', label: 'Manuscript' },
    ],
  },
  {
    id: 'articles',
    label: 'Articles & Online Content',
    types: [
      { value: 'webpage', label: 'Web Page' },
      { value: 'blogPost', label: 'Blog Post' },
      { value: 'magazineArticle', label: 'Magazine Article' },
      { value: 'newspaperArticle', label: 'Newspaper Article' },
      { value: 'forumPost', label: 'Forum Post' },
    ],
  },
  {
    id: 'legal',
    label: 'Legal & Standards',
    types: [
      { value: 'patent', label: 'Patent' },
      { value: 'statute', label: 'Statute' },
      { value: 'bill', label: 'Bill' },
      { value: 'case', label: 'Case' },
      { value: 'hearing', label: 'Hearing' },
      { value: 'standard', label: 'Standard' },
    ],
  },
  {
    id: 'media_docs',
    label: 'Documents & Media',
    types: [
      { value: 'document', label: 'Document' },
      { value: 'computerProgram', label: 'Software / Program' },
      { value: 'film', label: 'Film / Video' },
      { value: 'audioRecording', label: 'Audio Recording' },
      { value: 'podcast', label: 'Podcast' },
      { value: 'interview', label: 'Interview' },
      { value: 'letter', label: 'Letter' },
      { value: 'email', label: 'E-mail' },
      { value: 'map', label: 'Map' },
      { value: 'artwork', label: 'Artwork' },
    ],
  },
];

export const ITEM_TYPE_DEFINITIONS = LIBRARY_ITEM_TYPES;
export const ITEM_TYPE_CATEGORIES = ITEM_TYPE_GROUPS;
export const LIBRARY_ITEM_TYPE_KEYS = Object.keys(LIBRARY_ITEM_TYPES);

/**
 * Get Library item-type definition. Returns null for unknown types.
 * Callers must handle null — do NOT assume a default type.
 */
export function getItemTypeDefinition(itemType?: string | null): SchemaItemTypeDefinition | null {
  if (!itemType) return null;
  return LIBRARY_ITEM_TYPES[itemType] ?? null;
}
