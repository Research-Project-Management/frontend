/**
 * Library Item-Type Registry — Frontend Canonical Definitions & Offline Cache
 * Dynamically loaded from official api.zotero.org/schema (Schema v42).
 * Eliminates manual guesswork and keeps UI strictly in sync with Zotero Desktop and Backend.
 */
import rawZoteroSchema from './zotero-schema.json';

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

function buildFrontendRegistry() {
  const schema = rawZoteroSchema as any;
  const en = schema.locales?.['en-US'] || { fields: {}, itemTypes: {}, creatorTypes: {} };

  const fieldDefinitions: Record<string, SchemaFieldDefinition> = {};
  const libraryItemTypes: Record<string, SchemaItemTypeDefinition> = {};
  const flatItemTypes: { value: string; label: string }[] = [];

  for (const t of schema.itemTypes || []) {
    const typeKey = t.itemType;
    if (['attachment', 'note', 'annotation'].includes(typeKey)) continue;

    const fields: SchemaFieldDefinition[] = (t.fields || []).map((f: any) => {
      const fieldDef: SchemaFieldDefinition = {
        field: f.field,
        label: en.fields[f.field] || f.field,
        type: schema.meta?.fields?.[f.field]?.type === 'date'
          ? 'date'
          : f.field === 'url'
            ? 'url'
            : f.field === 'abstractNote' || f.field === 'extra'
              ? 'textarea'
              : 'text',
        category: FIELD_CATEGORY_MAP[f.field] || 'publication',
        mono: MONO_FIELDS.has(f.field),
        baseField: f.baseField,
      };
      if (!fieldDefinitions[f.field]) {
        fieldDefinitions[f.field] = fieldDef;
      }
      return fieldDef;
    });

    const creatorTypes: SchemaCreatorTypeDefinition[] = (t.creatorTypes || []).map((c: any) => ({
      creatorType: c.creatorType,
      label: en.creatorTypes[c.creatorType] || c.creatorType,
      primary: Boolean(c.primary),
    }));

    const primaryCreatorType = creatorTypes.find((c) => c.primary)?.creatorType || creatorTypes[0]?.creatorType || 'author';

    libraryItemTypes[typeKey] = {
      itemType: typeKey,
      label: en.itemTypes[typeKey] || typeKey,
      category: CATEGORY_MAP[typeKey] || 'documents',
      primaryCreatorType,
      creatorTypes,
      fields,
    };

    flatItemTypes.push({
      value: typeKey,
      label: en.itemTypes[typeKey] || typeKey,
    });
  }

  flatItemTypes.sort((a, b) => a.label.localeCompare(b.label));

  return {
    creatorTypes: (en.creatorTypes || {}) as Record<string, string>,
    fieldDefinitions,
    libraryItemTypes,
    flatItemTypes,
  };
}

const REGISTRY_DATA = buildFrontendRegistry();

export const ALL_CREATOR_TYPES: Record<string, string> = REGISTRY_DATA.creatorTypes;
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
