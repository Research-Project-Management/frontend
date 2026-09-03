/**
 * Library Item-Type Registry — Frontend Cache
 * Canonical item-type definitions owned by the Flux Library domain.
 * This file is the FE representation of the Library registry contract.
 */

export interface SchemaFieldDefinition {
  field: string;
  label: string;
  placeholder?: string;
  type: 'text' | 'textarea' | 'date' | 'number' | 'url';
  category?: 'core' | 'venue' | 'publication' | 'identifiers' | 'archive' | 'extra';
  mono?: boolean;
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

// ── 1. Global Creator Roles ──────────────────────────────────────────────────
export const ALL_CREATOR_TYPES: Record<string, string> = {
  author: 'Author',
  editor: 'Editor',
  contributor: 'Contributor',
  translator: 'Translator',
  seriesEditor: 'Series Editor',
  bookAuthor: 'Book Author',
  reviewedAuthor: 'Reviewed Author',
  inventor: 'Inventor',
  attorneyAgent: 'Attorney/Agent',
  director: 'Director',
  producer: 'Producer',
  scriptwriter: 'Scriptwriter',
  presenter: 'Presenter',
  counsel: 'Counsel',
  interviewee: 'Interviewee',
  interviewer: 'Interviewer',
  cartographer: 'Cartographer',
  programmer: 'Programmer',
  artist: 'Artist',
  recipient: 'Recipient',
  performer: 'Performer',
  composer: 'Composer',
  wordsBy: 'Words By',
  guest: 'Guest',
  castMember: 'Cast Member',
  podcaster: 'Podcaster',
  sponsor: 'Sponsor',
};

// ── 2. Standard Field Metadata Definitions ──────────────────────────────────
export const FIELD_DEFINITIONS: Record<string, SchemaFieldDefinition> = {
  title: { field: 'title', label: 'Title', type: 'text', category: 'core', placeholder: 'Title of the document...' },
  abstractNote: { field: 'abstractNote', label: 'Abstract', type: 'textarea', category: 'core', placeholder: 'Summary or abstract...' },
  publicationTitle: { field: 'publicationTitle', label: 'Publication', type: 'text', category: 'venue', placeholder: 'Journal / Periodical name...' },
  bookTitle: { field: 'bookTitle', label: 'Book Title', type: 'text', category: 'venue', placeholder: 'Title of the complete book...' },
  proceedingsTitle: { field: 'proceedingsTitle', label: 'Proceedings Title', type: 'text', category: 'venue', placeholder: 'Conference proceedings title...' },
  conferenceName: { field: 'conferenceName', label: 'Conference Name', type: 'text', category: 'venue', placeholder: 'Name of the conference...' },
  websiteTitle: { field: 'websiteTitle', label: 'Website Title', type: 'text', category: 'venue', placeholder: 'Name of the website...' },
  websiteType: { field: 'websiteType', label: 'Website Type', type: 'text', category: 'venue', placeholder: 'e.g. Blog, Documentation...' },
  university: { field: 'university', label: 'University', type: 'text', category: 'venue', placeholder: 'University or Degree Granting Institution...' },
  institution: { field: 'institution', label: 'Institution', type: 'text', category: 'venue', placeholder: 'Institution / Organization...' },
  publisher: { field: 'publisher', label: 'Publisher', type: 'text', category: 'venue', placeholder: 'Publishing company...' },
  place: { field: 'place', label: 'Place', type: 'text', category: 'venue', placeholder: 'Place / City / Country...' },
  country: { field: 'country', label: 'Country', type: 'text', category: 'venue', placeholder: 'Country of patent / jurisdiction...' },
  assignee: { field: 'assignee', label: 'Assignee', type: 'text', category: 'venue', placeholder: 'Company or assignee...' },
  issuingAuthority: { field: 'issuingAuthority', label: 'Issuing Authority', type: 'text', category: 'venue', placeholder: 'Patent or Trademark office...' },

  volume: { field: 'volume', label: 'Volume', type: 'text', category: 'publication', placeholder: 'Volume #', mono: true },
  issue: { field: 'issue', label: 'Issue', type: 'text', category: 'publication', placeholder: 'Issue #', mono: true },
  pages: { field: 'pages', label: 'Pages', type: 'text', category: 'publication', placeholder: 'e.g. 100-125', mono: true },
  section: { field: 'section', label: 'Section', type: 'text', category: 'publication', placeholder: 'Section #' },
  edition: { field: 'edition', label: 'Edition', type: 'text', category: 'publication', placeholder: 'e.g. 2nd ed.' },
  numPages: { field: 'numPages', label: '# of Pages', type: 'text', category: 'publication', placeholder: 'Total page count', mono: true },
  numberOfVolumes: { field: 'numberOfVolumes', label: '# of Volumes', type: 'text', category: 'publication', placeholder: 'Total volumes', mono: true },
  series: { field: 'series', label: 'Series', type: 'text', category: 'publication', placeholder: 'Series name' },
  seriesTitle: { field: 'seriesTitle', label: 'Series Title', type: 'text', category: 'publication', placeholder: 'Series title' },
  seriesText: { field: 'seriesText', label: 'Series Text', type: 'text', category: 'publication', placeholder: 'Series description' },
  seriesNumber: { field: 'seriesNumber', label: 'Series Number', type: 'text', category: 'publication', placeholder: 'Series number', mono: true },
  journalAbbreviation: { field: 'journalAbbreviation', label: 'Journal Abbr', type: 'text', category: 'publication', placeholder: 'e.g. Phys. Rev. Lett.' },
  
  date: { field: 'date', label: 'Date', type: 'date', category: 'publication', placeholder: 'YYYY or YYYY-MM-DD', mono: true },
  filingDate: { field: 'filingDate', label: 'Filing Date', type: 'date', category: 'publication', placeholder: 'YYYY-MM-DD', mono: true },
  accessDate: { field: 'accessDate', label: 'Accessed', type: 'date', category: 'publication', placeholder: 'YYYY-MM-DD', mono: true },

  DOI: { field: 'doi', label: 'DOI', type: 'text', category: 'identifiers', placeholder: '10.xxxx/...', mono: true },
  citationCount: { field: 'citationCount', label: 'Citations', type: 'number', category: 'identifiers', placeholder: 'e.g. 150', mono: true },
  influentialCitationCount: { field: 'influentialCitationCount', label: 'Influential Citations', type: 'number', category: 'identifiers', placeholder: 'e.g. 25', mono: true },
  ISBN: { field: 'isbn', label: 'ISBN', type: 'text', category: 'identifiers', placeholder: '978-...', mono: true },
  ISSN: { field: 'issn', label: 'ISSN', type: 'text', category: 'identifiers', placeholder: 'xxxx-xxxx', mono: true },
  PMID: { field: 'pmid', label: 'PMID', type: 'text', category: 'identifiers', placeholder: 'e.g. 22745249', mono: true },
  PMCID: { field: 'pmcid', label: 'PMCID', type: 'text', category: 'identifiers', placeholder: 'e.g. PMC6286148', mono: true },
  arxivId: { field: 'arxivId', label: 'arXiv ID', type: 'text', category: 'identifiers', placeholder: 'e.g. 1706.03762', mono: true },
  patentNumber: { field: 'patentNumber', label: 'Patent #', type: 'text', category: 'identifiers', placeholder: 'Patent number', mono: true },
  applicationNumber: { field: 'applicationNumber', label: 'Application #', type: 'text', category: 'identifiers', placeholder: 'Application number', mono: true },
  reportNumber: { field: 'reportNumber', label: 'Report #', type: 'text', category: 'identifiers', placeholder: 'Report number', mono: true },
  reportType: { field: 'reportType', label: 'Report Type', type: 'text', category: 'publication', placeholder: 'Technical Report / White Paper' },
  thesisType: { field: 'thesisType', label: 'Type', type: 'text', category: 'publication', placeholder: 'Ph.D. Dissertation / Master\'s Thesis' },
  genre: { field: 'genre', label: 'Genre', type: 'text', category: 'publication', placeholder: 'Document genre' },
  identifier: { field: 'identifier', label: 'Identifier', type: 'text', category: 'identifiers', placeholder: 'Unique resource ID', mono: true },
  versionNumber: { field: 'versionNumber', label: 'Version', type: 'text', category: 'publication', placeholder: 'e.g. 1.0.0', mono: true },
  legalStatus: { field: 'legalStatus', label: 'Legal Status', type: 'text', category: 'publication', placeholder: 'e.g. Active, Expired, Pending' },

  url: { field: 'url', label: 'URL', type: 'url', category: 'identifiers', placeholder: 'https://...', mono: true },
  language: { field: 'language', label: 'Language', type: 'text', category: 'publication', placeholder: 'e.g. en, vi, fr' },
  shortTitle: { field: 'shortTitle', label: 'Short Title', type: 'text', category: 'core', placeholder: 'Abbreviated title' },
  citationKey: { field: 'citationKey', label: 'Citation Key', type: 'text', category: 'identifiers', placeholder: 'e.g. author2024title', mono: true },

  archive: { field: 'archive', label: 'Archive', type: 'text', category: 'archive', placeholder: 'Archive repository' },
  archiveLocation: { field: 'archiveLocation', label: 'Loc. in Archive', type: 'text', category: 'archive', placeholder: 'Location within archive' },
  libraryCatalog: { field: 'libraryCatalog', label: 'Library Catalog', type: 'text', category: 'archive', placeholder: 'Catalog or database name' },
  callNumber: { field: 'callNumber', label: 'Call Number', type: 'text', category: 'archive', placeholder: 'Library call number', mono: true },

  // ── Legal Fields (Court, Statute, Bill, Hearing) ──────────────────────────
  court: { field: 'court', label: 'Court', type: 'text', category: 'venue', placeholder: 'e.g. U.S. Supreme Court' },
  docketNumber: { field: 'docketNumber', label: 'Docket #', type: 'text', category: 'identifiers', placeholder: 'Docket number', mono: true },
  dateDecided: { field: 'dateDecided', label: 'Date Decided', type: 'date', category: 'publication', placeholder: 'YYYY-MM-DD', mono: true },
  reporter: { field: 'reporter', label: 'Reporter', type: 'text', category: 'publication', placeholder: 'e.g. U.S., F.3d' },
  reporterVolume: { field: 'reporterVolume', label: 'Reporter Vol.', type: 'text', category: 'publication', placeholder: 'Volume #', mono: true },
  firstPage: { field: 'firstPage', label: 'First Page', type: 'text', category: 'publication', placeholder: 'e.g. 100', mono: true },
  nameOfAct: { field: 'nameOfAct', label: 'Name of Act', type: 'text', category: 'core', placeholder: 'Full statute title' },
  code: { field: 'code', label: 'Code', type: 'text', category: 'publication', placeholder: 'Statutory code name' },
  codeNumber: { field: 'codeNumber', label: 'Code #', type: 'text', category: 'identifiers', placeholder: 'e.g. 42 U.S.C.', mono: true },
  codeVolume: { field: 'codeVolume', label: 'Code Vol.', type: 'text', category: 'publication', placeholder: 'Volume #', mono: true },
  codePages: { field: 'codePages', label: 'Code Pages', type: 'text', category: 'publication', placeholder: 'Pages', mono: true },
  publicLawNumber: { field: 'publicLawNumber', label: 'Public Law #', type: 'text', category: 'identifiers', placeholder: 'e.g. Pub. L. 104-191', mono: true },
  dateEnacted: { field: 'dateEnacted', label: 'Date Enacted', type: 'date', category: 'publication', placeholder: 'YYYY-MM-DD', mono: true },
  billNumber: { field: 'billNumber', label: 'Bill #', type: 'text', category: 'identifiers', placeholder: 'e.g. H.R. 1234', mono: true },
  legislativeBody: { field: 'legislativeBody', label: 'Legislative Body', type: 'text', category: 'venue', placeholder: 'e.g. U.S. Congress' },
  session: { field: 'session', label: 'Session', type: 'text', category: 'publication', placeholder: 'e.g. 117th Congress' },
  history: { field: 'history', label: 'History', type: 'textarea', category: 'extra', placeholder: 'Subsequent history or amendments' },
  committee: { field: 'committee', label: 'Committee', type: 'text', category: 'venue', placeholder: 'Congressional committee' },
  documentNumber: { field: 'documentNumber', label: 'Doc #', type: 'text', category: 'identifiers', placeholder: 'Document number', mono: true },

  // ── Standards & Organizations ─────────────────────────────────────────────
  organization: { field: 'organization', label: 'Organization', type: 'text', category: 'venue', placeholder: 'Standards body, e.g. IEEE, ISO' },
  standardNumber: { field: 'standardNumber', label: 'Standard #', type: 'text', category: 'identifiers', placeholder: 'e.g. ISO 9001:2015', mono: true },

  // ── Media & Broadcast ─────────────────────────────────────────────────────
  distributor: { field: 'distributor', label: 'Distributor', type: 'text', category: 'venue', placeholder: 'Distribution company' },
  studio: { field: 'studio', label: 'Studio', type: 'text', category: 'venue', placeholder: 'Production studio' },
  network: { field: 'network', label: 'Network', type: 'text', category: 'venue', placeholder: 'Broadcast network' },
  programTitle: { field: 'programTitle', label: 'Program Title', type: 'text', category: 'venue', placeholder: 'TV / Radio series title' },
  episodeNumber: { field: 'episodeNumber', label: 'Episode #', type: 'text', category: 'publication', placeholder: 'e.g. S01E05', mono: true },
  runningTime: { field: 'runningTime', label: 'Running Time', type: 'text', category: 'publication', placeholder: 'e.g. 1h 45m', mono: true },
  audioRecordingFormat: { field: 'audioRecordingFormat', label: 'Format', type: 'text', category: 'publication', placeholder: 'e.g. CD, Vinyl, MP3' },
  videoRecordingFormat: { field: 'videoRecordingFormat', label: 'Format', type: 'text', category: 'publication', placeholder: 'e.g. DVD, Blu-ray, Web' },
  audioFileType: { field: 'audioFileType', label: 'File Type', type: 'text', category: 'publication', placeholder: 'e.g. MP3, AAC, FLAC' },
  label: { field: 'label', label: 'Label', type: 'text', category: 'venue', placeholder: 'Record label' },
  podcastType: { field: 'podcastType', label: 'Type', type: 'text', category: 'publication', placeholder: 'e.g. Audio podcast' },

  // ── Communication, Arts & Cartography ─────────────────────────────────────
  interviewMedium: { field: 'interviewMedium', label: 'Medium', type: 'text', category: 'publication', placeholder: 'e.g. In-person, Phone, Video' },
  letterType: { field: 'letterType', label: 'Type', type: 'text', category: 'publication', placeholder: 'e.g. Letter, Correspondence' },
  manuscriptType: { field: 'manuscriptType', label: 'Type', type: 'text', category: 'publication', placeholder: 'e.g. Draft, Typescript' },
  mapType: { field: 'mapType', label: 'Type', type: 'text', category: 'publication', placeholder: 'e.g. Topographic, Thematic' },
  scale: { field: 'scale', label: 'Scale', type: 'text', category: 'publication', placeholder: 'e.g. 1:50,000', mono: true },
  artworkMedium: { field: 'artworkMedium', label: 'Medium', type: 'text', category: 'publication', placeholder: 'e.g. Oil on canvas, Bronze' },
  artworkSize: { field: 'artworkSize', label: 'Artwork Size', type: 'text', category: 'publication', placeholder: 'e.g. 60 x 80 cm', mono: true },
  subject: { field: 'subject', label: 'Subject', type: 'text', category: 'core', placeholder: 'Email subject line' },

  // ── Software, Web & Reference Works ───────────────────────────────────────
  programmingLanguage: { field: 'programmingLanguage', label: 'Language', type: 'text', category: 'publication', placeholder: 'e.g. Python, TypeScript' },
  system: { field: 'system', label: 'System', type: 'text', category: 'publication', placeholder: 'e.g. Linux, macOS, Windows' },
  company: { field: 'company', label: 'Company', type: 'text', category: 'venue', placeholder: 'Software company' },
  forumTitle: { field: 'forumTitle', label: 'Forum / Group', type: 'text', category: 'venue', placeholder: 'Forum or discussion board' },
  blogTitle: { field: 'blogTitle', label: 'Blog Title', type: 'text', category: 'venue', placeholder: 'Blog title' },
  postType: { field: 'postType', label: 'Post Type', type: 'text', category: 'publication', placeholder: 'e.g. Thread, Reply' },
  presentationType: { field: 'presentationType', label: 'Type', type: 'text', category: 'publication', placeholder: 'e.g. Keynote, Poster' },
  meetingName: { field: 'meetingName', label: 'Meeting', type: 'text', category: 'venue', placeholder: 'Meeting name' },
  dictionaryTitle: { field: 'dictionaryTitle', label: 'Dictionary', type: 'text', category: 'venue', placeholder: 'Dictionary name' },
  encyclopediaTitle: { field: 'encyclopediaTitle', label: 'Encyclopedia', type: 'text', category: 'venue', placeholder: 'Encyclopedia name' },

  rights: { field: 'rights', label: 'Rights', type: 'text', category: 'extra', placeholder: 'Copyright / License' },
  extra: { field: 'extra', label: 'Extra', type: 'textarea', category: 'extra', placeholder: 'Extra fields (key: value)...' },
};

function buildFields(keys: string[]): SchemaFieldDefinition[] {
  return keys.map((k) => {
    // normalized lookup (e.g. DOI -> doi or direct key)
    const def = FIELD_DEFINITIONS[k] || FIELD_DEFINITIONS[k.toLowerCase()] || FIELD_DEFINITIONS[k.toUpperCase()];
    return def || { field: k, label: k, type: 'text', category: 'extra' };
  });
}

function buildCreators(roles: string[], primaryRole: string = 'author'): SchemaCreatorTypeDefinition[] {
  return roles.map((r) => ({
    creatorType: r,
    label: ALL_CREATOR_TYPES[r] || r,
    primary: r === primaryRole,
  }));
}

// ── 3. Library Item-Type Registry ────────────────────────────────────────────
export const LIBRARY_ITEM_TYPES: Record<string, SchemaItemTypeDefinition> = {
  // ── A. Academic & Scientific ────────────────────────────────────────────────
  journalArticle: {
    itemType: 'journalArticle',
    label: 'Journal Article',
    category: 'academic',
    primaryCreatorType: 'author',
    creatorTypes: buildCreators(['author', 'editor', 'translator', 'reviewedAuthor', 'contributor'], 'author'),
    fields: buildFields([
      'publicationTitle', 'volume', 'issue', 'pages', 'date',
      'series', 'seriesTitle', 'seriesText', 'journalAbbreviation', 'DOI', 'citationCount', 'ISSN', 'PMID', 'PMCID', 'arxivId',
      'shortTitle', 'url', 'accessDate', 'archive', 'archiveLocation', 'libraryCatalog', 'callNumber',
      'rights', 'extra'
    ]),
  },
  conferencePaper: {
    itemType: 'conferencePaper',
    label: 'Conference Paper',
    category: 'academic',
    primaryCreatorType: 'author',
    creatorTypes: buildCreators(['author', 'editor', 'translator', 'seriesEditor', 'contributor'], 'author'),
    fields: buildFields([
      'proceedingsTitle', 'conferenceName', 'place', 'publisher',
      'volume', 'pages', 'series', 'date', 'DOI', 'citationCount', 'ISBN', 'arxivId',
      'shortTitle', 'url', 'accessDate', 'archive', 'archiveLocation', 'libraryCatalog', 'callNumber',
      'rights', 'extra'
    ]),
  },
  preprint: {
    itemType: 'preprint',
    label: 'Preprint (arXiv / SSRN)',
    category: 'academic',
    primaryCreatorType: 'author',
    creatorTypes: buildCreators(['author', 'contributor', 'editor', 'reviewedAuthor', 'translator'], 'author'),
    fields: buildFields([
      'genre', 'institution', 'series', 'seriesNumber', 'date',
      'DOI', 'citationCount', 'arxivId', 'PMID', 'citationKey', 'shortTitle', 'url', 'accessDate', 'archive', 'archiveLocation', 'libraryCatalog', 'callNumber',
      'rights', 'extra'
    ]),
  },
  thesis: {
    itemType: 'thesis',
    label: 'Thesis / Dissertation',
    category: 'academic',
    primaryCreatorType: 'author',
    creatorTypes: buildCreators(['author', 'contributor', 'editor', 'reviewedAuthor', 'translator'], 'author'),
    fields: buildFields([
      'thesisType', 'university', 'place', 'date',
      'numPages', 'language', 'shortTitle', 'url', 'accessDate', 'archive', 'archiveLocation', 'libraryCatalog', 'callNumber',
      'rights', 'extra'
    ]),
  },
  report: {
    itemType: 'report',
    label: 'Report',
    category: 'academic',
    primaryCreatorType: 'author',
    creatorTypes: buildCreators(['author', 'contributor', 'editor', 'reviewedAuthor', 'seriesEditor', 'translator'], 'author'),
    fields: buildFields([
      'reportNumber', 'reportType', 'institution', 'place', 'date',
      'pages', 'language', 'shortTitle', 'url', 'accessDate', 'archive', 'archiveLocation', 'libraryCatalog', 'callNumber',
      'rights', 'extra'
    ]),
  },
  dataset: {
    itemType: 'dataset',
    label: 'Dataset',
    category: 'academic',
    primaryCreatorType: 'author',
    creatorTypes: buildCreators(['author', 'contributor', 'editor', 'reviewedAuthor', 'translator'], 'author'),
    fields: buildFields([
      'identifier', 'genre', 'versionNumber', 'publisher', 'place',
      'date', 'DOI', 'shortTitle', 'url', 'accessDate', 'rights', 'extra'
    ]),
  },
  presentation: {
    itemType: 'presentation',
    label: 'Presentation',
    category: 'academic',
    primaryCreatorType: 'presenter',
    creatorTypes: buildCreators(['presenter', 'contributor'], 'presenter'),
    fields: buildFields([
      'genre', 'place', 'date', 'conferenceName',
      'shortTitle', 'url', 'accessDate', 'rights', 'extra'
    ]),
  },

  // ── B. Books & Long-form Publications ──────────────────────────────────────
  book: {
    itemType: 'book',
    label: 'Book',
    category: 'books',
    primaryCreatorType: 'author',
    creatorTypes: buildCreators(['author', 'editor', 'translator', 'seriesEditor', 'contributor'], 'author'),
    fields: buildFields([
      'series', 'seriesNumber', 'volume', 'numberOfVolumes',
      'edition', 'place', 'publisher', 'date', 'numPages', 'language', 'ISBN',
      'shortTitle', 'url', 'accessDate', 'archive', 'archiveLocation', 'libraryCatalog', 'callNumber',
      'rights', 'extra'
    ]),
  },
  bookSection: {
    itemType: 'bookSection',
    label: 'Book Section',
    category: 'books',
    primaryCreatorType: 'author',
    creatorTypes: buildCreators(['author', 'bookAuthor', 'editor', 'translator', 'seriesEditor', 'contributor'], 'author'),
    fields: buildFields([
      'bookTitle', 'series', 'seriesNumber', 'volume', 'numberOfVolumes',
      'edition', 'place', 'publisher', 'date', 'pages', 'language', 'ISBN',
      'shortTitle', 'url', 'accessDate', 'archive', 'archiveLocation', 'libraryCatalog', 'callNumber',
      'rights', 'extra'
    ]),
  },
  manuscript: {
    itemType: 'manuscript',
    label: 'Manuscript',
    category: 'books',
    primaryCreatorType: 'author',
    creatorTypes: buildCreators(['author', 'translator', 'contributor'], 'author'),
    fields: buildFields([
      'genre', 'place', 'date', 'numPages', 'language',
      'shortTitle', 'url', 'accessDate', 'archive', 'archiveLocation', 'libraryCatalog', 'callNumber',
      'rights', 'extra'
    ]),
  },
  dictionaryEntry: {
    itemType: 'dictionaryEntry',
    label: 'Dictionary Entry',
    category: 'books',
    primaryCreatorType: 'author',
    creatorTypes: buildCreators(['author', 'editor', 'translator', 'seriesEditor', 'contributor'], 'author'),
    fields: buildFields([
      'bookTitle', 'series', 'seriesNumber', 'volume', 'numberOfVolumes',
      'edition', 'place', 'publisher', 'date', 'pages', 'language', 'ISBN',
      'shortTitle', 'url', 'accessDate', 'archive', 'archiveLocation', 'libraryCatalog', 'callNumber',
      'rights', 'extra'
    ]),
  },
  encyclopediaArticle: {
    itemType: 'encyclopediaArticle',
    label: 'Encyclopedia Article',
    category: 'books',
    primaryCreatorType: 'author',
    creatorTypes: buildCreators(['author', 'editor', 'translator', 'seriesEditor', 'contributor'], 'author'),
    fields: buildFields([
      'bookTitle', 'series', 'seriesNumber', 'volume', 'numberOfVolumes',
      'edition', 'place', 'publisher', 'date', 'pages', 'language', 'ISBN',
      'shortTitle', 'url', 'accessDate', 'archive', 'archiveLocation', 'libraryCatalog', 'callNumber',
      'rights', 'extra'
    ]),
  },

  // ── C. Articles & Periodicals ──────────────────────────────────────────────
  magazineArticle: {
    itemType: 'magazineArticle',
    label: 'Magazine Article',
    category: 'articles',
    primaryCreatorType: 'author',
    creatorTypes: buildCreators(['author', 'reviewedAuthor', 'translator', 'contributor'], 'author'),
    fields: buildFields([
      'publicationTitle', 'volume', 'issue', 'date', 'pages',
      'language', 'ISSN', 'shortTitle', 'url', 'accessDate', 'archive', 'archiveLocation', 'libraryCatalog', 'callNumber',
      'rights', 'extra'
    ]),
  },
  newspaperArticle: {
    itemType: 'newspaperArticle',
    label: 'Newspaper Article',
    category: 'articles',
    primaryCreatorType: 'author',
    creatorTypes: buildCreators(['author', 'reviewedAuthor', 'translator', 'contributor'], 'author'),
    fields: buildFields([
      'publicationTitle', 'place', 'section', 'date', 'pages',
      'language', 'shortTitle', 'url', 'accessDate', 'archive', 'archiveLocation', 'libraryCatalog', 'callNumber',
      'rights', 'extra'
    ]),
  },
  blogPost: {
    itemType: 'blogPost',
    label: 'Blog Post',
    category: 'articles',
    primaryCreatorType: 'author',
    creatorTypes: buildCreators(['author', 'commenter', 'contributor'], 'author'),
    fields: buildFields([
      'websiteTitle', 'websiteType', 'date',
      'shortTitle', 'url', 'accessDate', 'rights', 'extra'
    ]),
  },
  forumPost: {
    itemType: 'forumPost',
    label: 'Forum Post',
    category: 'articles',
    primaryCreatorType: 'author',
    creatorTypes: buildCreators(['author', 'contributor'], 'author'),
    fields: buildFields([
      'forumTitle', 'date',
      'shortTitle', 'url', 'accessDate', 'rights', 'extra'
    ]),
  },
  webpage: {
    itemType: 'webpage',
    label: 'Web Page',
    category: 'articles',
    primaryCreatorType: 'author',
    creatorTypes: buildCreators(['author', 'contributor', 'translator'], 'author'),
    fields: buildFields([
      'websiteTitle', 'websiteType', 'date',
      'shortTitle', 'url', 'accessDate', 'rights', 'extra'
    ]),
  },

  // ── D. Legal & Official ────────────────────────────────────────────────────
  patent: {
    itemType: 'patent',
    label: 'Patent',
    category: 'legal',
    primaryCreatorType: 'inventor',
    creatorTypes: buildCreators(['inventor', 'attorneyAgent', 'contributor'], 'inventor'),
    fields: buildFields([
      'place', 'country', 'assignee', 'issuingAuthority',
      'patentNumber', 'applicationNumber', 'date', 'filingDate', 'legalStatus',
      'shortTitle', 'url', 'accessDate', 'rights', 'extra'
    ]),
  },
  statute: {
    itemType: 'statute',
    label: 'Statute',
    category: 'legal',
    primaryCreatorType: 'author',
    creatorTypes: buildCreators(['author', 'contributor'], 'author'),
    fields: buildFields([
      'nameOfAct', 'code', 'codeNumber', 'publicLawNumber',
      'dateEnacted', 'pages', 'section', 'session', 'history', 'shortTitle', 'url', 'accessDate', 'rights', 'extra'
    ]),
  },
  bill: {
    itemType: 'bill',
    label: 'Bill',
    category: 'legal',
    primaryCreatorType: 'sponsor',
    creatorTypes: buildCreators(['sponsor', 'cosponsor', 'contributor'], 'sponsor'),
    fields: buildFields([
      'billNumber', 'code', 'codeVolume', 'section',
      'legislativeBody', 'session', 'history', 'date', 'language', 'url', 'accessDate', 'rights', 'extra'
    ]),
  },
  case: {
    itemType: 'case',
    label: 'Case',
    category: 'legal',
    primaryCreatorType: 'author',
    creatorTypes: buildCreators(['author', 'counsel', 'contributor'], 'author'),
    fields: buildFields([
      'court', 'dateDecided', 'docketNumber', 'reporter', 'reporterVolume',
      'firstPage', 'history', 'language', 'shortTitle', 'url', 'accessDate', 'rights', 'extra'
    ]),
  },
  hearing: {
    itemType: 'hearing',
    label: 'Hearing',
    category: 'legal',
    primaryCreatorType: 'contributor',
    creatorTypes: buildCreators(['contributor'], 'contributor'),
    fields: buildFields([
      'committee', 'legislativeBody', 'session', 'history',
      'documentNumber', 'pages', 'place', 'publisher', 'date', 'language', 'shortTitle', 'url', 'accessDate', 'rights', 'extra'
    ]),
  },
  standard: {
    itemType: 'standard',
    label: 'Standard',
    category: 'legal',
    primaryCreatorType: 'author',
    creatorTypes: buildCreators(['author', 'contributor'], 'author'),
    fields: buildFields([
      'organization', 'institution', 'standardNumber', 'versionNumber',
      'date', 'place', 'publisher', 'shortTitle', 'url', 'accessDate', 'rights', 'extra'
    ]),
  },

  // ── E. Documents & Media ──────────────────────────────────────────────────
  document: {
    itemType: 'document',
    label: 'Document',
    category: 'documents',
    primaryCreatorType: 'author',
    creatorTypes: buildCreators(['author', 'editor', 'translator', 'contributor'], 'author'),
    fields: buildFields([
      'publisher', 'date', 'language',
      'shortTitle', 'url', 'accessDate', 'archive', 'archiveLocation', 'libraryCatalog', 'callNumber',
      'rights', 'extra'
    ]),
  },
  film: {
    itemType: 'film',
    label: 'Film',
    category: 'media',
    primaryCreatorType: 'director',
    creatorTypes: buildCreators(['director', 'producer', 'scriptwriter', 'contributor'], 'director'),
    fields: buildFields([
      'distributor', 'genre', 'runningTime', 'date',
      'shortTitle', 'url', 'accessDate', 'archive', 'archiveLocation', 'libraryCatalog', 'callNumber',
      'rights', 'extra'
    ]),
  },
  audioRecording: {
    itemType: 'audioRecording',
    label: 'Audio Recording',
    category: 'media',
    primaryCreatorType: 'performer',
    creatorTypes: buildCreators(['performer', 'composer', 'wordsBy', 'contributor'], 'performer'),
    fields: buildFields([
      'audioRecordingFormat', 'seriesTitle', 'volume', 'numberOfVolumes',
      'place', 'label', 'date', 'runningTime', 'ISBN', 'shortTitle', 'url', 'accessDate', 'rights', 'extra'
    ]),
  },
  videoRecording: {
    itemType: 'videoRecording',
    label: 'Video Recording',
    category: 'media',
    primaryCreatorType: 'director',
    creatorTypes: buildCreators(['director', 'producer', 'scriptwriter', 'castMember', 'contributor'], 'director'),
    fields: buildFields([
      'videoRecordingFormat', 'seriesTitle', 'volume', 'numberOfVolumes',
      'place', 'studio', 'date', 'runningTime', 'ISBN', 'shortTitle', 'url', 'accessDate', 'rights', 'extra'
    ]),
  },
  podcast: {
    itemType: 'podcast',
    label: 'Podcast',
    category: 'media',
    primaryCreatorType: 'podcaster',
    creatorTypes: buildCreators(['podcaster', 'guest', 'contributor'], 'podcaster'),
    fields: buildFields([
      'seriesTitle', 'episodeNumber', 'audioFileType',
      'runningTime', 'url', 'accessDate', 'rights', 'extra'
    ]),
  },
  interview: {
    itemType: 'interview',
    label: 'Interview',
    category: 'media',
    primaryCreatorType: 'interviewee',
    creatorTypes: buildCreators(['interviewee', 'interviewer', 'translator', 'contributor'], 'interviewee'),
    fields: buildFields([
      'interviewMedium', 'date', 'language',
      'shortTitle', 'url', 'accessDate', 'rights', 'extra'
    ]),
  },
  letter: {
    itemType: 'letter',
    label: 'Letter',
    category: 'documents',
    primaryCreatorType: 'author',
    creatorTypes: buildCreators(['author', 'recipient', 'contributor'], 'author'),
    fields: buildFields([
      'letterType', 'date', 'language',
      'shortTitle', 'url', 'accessDate', 'archive', 'archiveLocation', 'libraryCatalog', 'callNumber',
      'rights', 'extra'
    ]),
  },
  email: {
    itemType: 'email',
    label: 'E-mail',
    category: 'documents',
    primaryCreatorType: 'author',
    creatorTypes: buildCreators(['author', 'recipient', 'contributor'], 'author'),
    fields: buildFields([
      'subject', 'date',
      'shortTitle', 'url', 'accessDate', 'rights', 'extra'
    ]),
  },
  map: {
    itemType: 'map',
    label: 'Map',
    category: 'documents',
    primaryCreatorType: 'cartographer',
    creatorTypes: buildCreators(['cartographer', 'seriesEditor', 'contributor'], 'cartographer'),
    fields: buildFields([
      'mapType', 'scale', 'seriesTitle', 'edition',
      'place', 'publisher', 'date', 'ISBN', 'shortTitle', 'url', 'accessDate', 'rights', 'extra'
    ]),
  },
  artwork: {
    itemType: 'artwork',
    label: 'Artwork',
    category: 'media',
    primaryCreatorType: 'artist',
    creatorTypes: buildCreators(['artist', 'contributor'], 'artist'),
    fields: buildFields([
      'artworkMedium', 'artworkSize', 'place', 'date',
      'language', 'shortTitle', 'url', 'accessDate', 'archive', 'archiveLocation', 'libraryCatalog', 'callNumber',
      'rights', 'extra'
    ]),
  },
  computerProgram: {
    itemType: 'computerProgram',
    label: 'Software',
    category: 'documents',
    primaryCreatorType: 'programmer',
    creatorTypes: buildCreators(['programmer', 'contributor'], 'programmer'),
    fields: buildFields([
      'seriesTitle', 'versionNumber', 'date', 'system',
      'place', 'company', 'ISBN', 'shortTitle', 'url', 'accessDate', 'rights', 'extra'
    ]),
  },
  instantMessage: {
    itemType: 'instantMessage',
    label: 'Instant Message',
    category: 'documents',
    primaryCreatorType: 'author',
    creatorTypes: buildCreators(['author', 'recipient', 'contributor'], 'author'),
    fields: buildFields([
      'date', 'language', 'shortTitle', 'url', 'accessDate', 'rights', 'extra'
    ]),
  },
  radioBroadcast: {
    itemType: 'radioBroadcast',
    label: 'Radio Broadcast',
    category: 'media',
    primaryCreatorType: 'director',
    creatorTypes: buildCreators(['director', 'producer', 'scriptwriter', 'guest', 'contributor'], 'director'),
    fields: buildFields([
      'programTitle', 'episodeNumber', 'audioRecordingFormat', 'place', 'network', 'date', 'runningTime', 'language', 'shortTitle', 'url', 'accessDate', 'rights', 'extra'
    ]),
  },
  tvBroadcast: {
    itemType: 'tvBroadcast',
    label: 'TV Broadcast',
    category: 'media',
    primaryCreatorType: 'director',
    creatorTypes: buildCreators(['director', 'producer', 'scriptwriter', 'guest', 'contributor'], 'director'),
    fields: buildFields([
      'programTitle', 'episodeNumber', 'videoRecordingFormat', 'place', 'network', 'date', 'runningTime', 'language', 'shortTitle', 'url', 'accessDate', 'rights', 'extra'
    ]),
  },
};

// ── 4. Flat Item-Type List for Dropdown UI (Sorted Alphabetically A-Z) ──────────
export const ALL_ITEM_TYPES_FLAT = [
  { value: 'artwork', label: 'Artwork' },
  { value: 'audioRecording', label: 'Audio Recording' },
  { value: 'bill', label: 'Bill' },
  { value: 'blogPost', label: 'Blog Post' },
  { value: 'book', label: 'Book' },
  { value: 'bookSection', label: 'Book Section' },
  { value: 'case', label: 'Case' },
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
  { value: 'computerProgram', label: 'Software' },
  { value: 'standard', label: 'Standard' },
  { value: 'statute', label: 'Statute' },
  { value: 'thesis', label: 'Thesis' },
  { value: 'tvBroadcast', label: 'TV Broadcast' },
  { value: 'videoRecording', label: 'Video Recording' },
  { value: 'webpage', label: 'Web Page' },
];

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
/** @deprecated Use LIBRARY_ITEM_TYPE_KEYS */
export const ZOTERO_ITEM_TYPES_EXTENDED = LIBRARY_ITEM_TYPE_KEYS;

/**
 * Get Library item-type definition. Returns null for unknown types.
 * Callers must handle null — do NOT assume a default type.
 */
export function getItemTypeDefinition(itemType?: string | null): SchemaItemTypeDefinition | null {
  if (!itemType) return null;
  return LIBRARY_ITEM_TYPES[itemType] ?? null;
}

/** @deprecated Use getItemTypeDefinition — silent fallback to journalArticle removed. */
export function getZoteroItemTypeDefinition(itemType?: string | null): SchemaItemTypeDefinition | null {
  return getItemTypeDefinition(itemType);
}
