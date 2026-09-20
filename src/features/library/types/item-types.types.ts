/**
 * Library Item-Type Registry — Dynamic Backend Schema Consumer & Lightweight Definitions
 * Standardized 100% against Official Zotero Schema v42 (https://api.zotero.org/schema).
 * Single Source of Truth is owned by backend (/api/v1/library/item-types).
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
 * Standard 37 Zotero bibliographic item types for immediate UI rendering
 * without bundling hundreds of kilobytes of static JSON.
 */
export const ALL_ITEM_TYPES_FLAT: { value: string; label: string }[] = [
  { value: 'artwork', label: 'Artwork' },
  { value: 'audioRecording', label: 'Audio Recording' },
  { value: 'bill', label: 'Bill' },
  { value: 'blogPost', label: 'Blog Post' },
  { value: 'book', label: 'Book' },
  { value: 'bookSection', label: 'Book Section' },
  { value: 'case', label: 'Case' },
  { value: 'computerProgram', label: 'Computer Program' },
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
    id: 'media_docs',
    label: 'Media & Documents',
    types: [
      { value: 'document', label: 'Document' },
      { value: 'computerProgram', label: 'Computer Program' },
      { value: 'film', label: 'Film' },
      { value: 'videoRecording', label: 'Video Recording' },
      { value: 'audioRecording', label: 'Audio Recording' },
      { value: 'podcast', label: 'Podcast' },
      { value: 'radioBroadcast', label: 'Radio Broadcast' },
      { value: 'tvBroadcast', label: 'TV Broadcast' },
      { value: 'interview', label: 'Interview' },
      { value: 'letter', label: 'Letter' },
      { value: 'email', label: 'E-mail' },
      { value: 'instantMessage', label: 'Instant Message' },
      { value: 'map', label: 'Map' },
      { value: 'artwork', label: 'Artwork' },
    ],
  },
];

export const ITEM_TYPE_CATEGORIES = ITEM_TYPE_GROUPS;

// ── In-Memory Dynamic Schema Registry (populated by Backend via React Query) ─

export const BASE_FIELD_MAPPINGS: Record<string, Record<string, string>> = {
  journalArticle: { publicationTitle: 'publicationTitle' },
  conferencePaper: { publicationTitle: 'proceedingsTitle' },
  bookSection: { publicationTitle: 'bookTitle' },
  preprint: { publicationTitle: 'repository' },
  dataset: { publicationTitle: 'repository' },
  dictionaryEntry: { publicationTitle: 'dictionaryTitle' },
  encyclopediaArticle: { publicationTitle: 'encyclopediaTitle' },
};

export const REVERSE_BASE_FIELD_MAPPINGS: Record<string, Record<string, string>> = {
  journalArticle: { publicationTitle: 'publicationTitle' },
  conferencePaper: { proceedingsTitle: 'publicationTitle' },
  bookSection: { bookTitle: 'publicationTitle' },
  preprint: { repository: 'publicationTitle' },
  dataset: { repository: 'publicationTitle' },
  dictionaryEntry: { dictionaryTitle: 'publicationTitle' },
  encyclopediaArticle: { encyclopediaTitle: 'publicationTitle' },
};

export const ALL_CREATOR_TYPES: Record<string, string> = {
  author: 'Author',
  contributor: 'Contributor',
  editor: 'Editor',
  translator: 'Translator',
  seriesEditor: 'Series Editor',
  reviewedAuthor: 'Reviewed Author',
  interviewee: 'Interviewee',
  interviewer: 'Interviewer',
  programmer: 'Programmer',
  recipient: 'Recipient',
  director: 'Director',
  producer: 'Producer',
  podcaster: 'Podcaster',
  presenter: 'Presenter',
  cartographer: 'Cartographer',
  inventor: 'Inventor',
  counsel: 'Counsel',
  performer: 'Performer',
  composer: 'Composer',
  wordsBy: 'Words By',
  artist: 'Artist',
  sponsor: 'Sponsor',
  cosponsor: 'Cosponsor',
  attorneyAgent: 'Attorney/Agent',
};

export const CSL_TYPE_MAP: Record<string, string> = {
  journalArticle: 'article-journal',
  book: 'book',
  bookSection: 'chapter',
  conferencePaper: 'paper-conference',
  preprint: 'article',
  report: 'report',
  thesis: 'thesis',
  webpage: 'webpage',
};

export const LIBRARY_ITEM_TYPES: Record<string, SchemaItemTypeDefinition> = {};
export const ITEM_TYPE_DEFINITIONS = LIBRARY_ITEM_TYPES;
export const LIBRARY_ITEM_TYPE_KEYS = Object.keys(LIBRARY_ITEM_TYPES);
export const FIELD_DEFINITIONS: Record<string, SchemaFieldDefinition> = {};

/**
 * Dynamically updates the in-memory schema registry with live data received
 * from backend GET /api/v1/library/item-types.
 */
export function updateLibrarySchemaRegistry(data: {
  itemTypes?: any[];
  baseFieldMappings?: Record<string, Record<string, string>>;
  reverseBaseFieldMappings?: Record<string, Record<string, string>>;
  creatorRoles?: Record<string, string>;
  cslTypeMap?: Record<string, string>;
}): void {
  if (!data) return;

  if (data.baseFieldMappings) {
    Object.assign(BASE_FIELD_MAPPINGS, data.baseFieldMappings);
  }
  if (data.reverseBaseFieldMappings) {
    Object.assign(REVERSE_BASE_FIELD_MAPPINGS, data.reverseBaseFieldMappings);
  }
  if (data.creatorRoles) {
    Object.assign(ALL_CREATOR_TYPES, data.creatorRoles);
  }
  if (data.cslTypeMap) {
    Object.assign(CSL_TYPE_MAP, data.cslTypeMap);
  }

  if (Array.isArray(data.itemTypes)) {
    const mapped = mapRegistryItemTypes(data.itemTypes);
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

// ── DRY Schema Helpers ───────────────────────────────────────────────────────

/**
 * Standard default fields for bibliographic item types when rendering
 * before the full backend schema response arrives.
 */
const DEFAULT_BIBLIOGRAPHIC_FIELDS: SchemaFieldDefinition[] = [
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
    fields: DEFAULT_BIBLIOGRAPHIC_FIELDS,
    isBibliographic: true,
    isSpecial: false,
  };

  return fallbackDef;
}

/**
 * Returns the primary creator role for an item type per Zotero Schema v42.
 */
export function getPrimaryCreatorType(itemType?: string | null): string {
  if (!itemType) return 'author';
  if (LIBRARY_ITEM_TYPES[itemType]?.primaryCreatorType) {
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
