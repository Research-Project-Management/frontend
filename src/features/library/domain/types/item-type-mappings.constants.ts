/**
 * Static Bootstrap Constants & Mappings for Zotero Schema v42 Item Types
 * Extracted from item-types.types.ts to maintain strict modularity and file-size bounds (<= 800 lines).
 */

import type {
  ItemTypeCategoryGroup,
  SchemaFieldDefinition,
} from './item-types.types';

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

/**
 * baseField → concrete field mappings per item type, derived from Zotero Schema v42.
 * Covers all 32 item types that have at least one baseField mapping.
 * Backend is the authoritative source; this is the bootstrap fallback only.
 * Updated at runtime by updateLibrarySchemaRegistry() via Object.assign.
 */
export const BASE_FIELD_MAPPINGS: Record<string, Record<string, string>> = {
  // academic
  journalArticle: {},
  conferencePaper: { publicationTitle: 'proceedingsTitle' },
  preprint: { type: 'genre', publisher: 'repository', number: 'archiveID' },
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
