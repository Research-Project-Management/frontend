export type LibraryColumnKey =
  | 'authors'
  | 'year'
  | 'publication'
  | 'itemType'
  | 'publisher'
  | 'dateAdded'
  | 'dateModified'
  | 'doi'
  | 'citationKey'
  | 'citations'
  | 'references'
  | 'pages'
  | 'volume'
  | 'issue'
  | 'edition'
  | 'language'
  | 'extra'
  | 'collection';

export type LibraryOrderBy =
  | 'createdAt'
  | 'updatedAt'
  | 'year'
  | 'title'
  | 'authors'
  | 'itemType'
  | 'citationCount'
  | 'lastReadAt';

export interface LibraryDisplayOptions {
  columns: Record<LibraryColumnKey, boolean>;
  orderBy: LibraryOrderBy;
  orderDirection: 'asc' | 'desc';
  density?: 'comfortable' | 'compact';
}

export const DEFAULT_LIBRARY_DISPLAY_OPTIONS: LibraryDisplayOptions = {
  columns: {
    authors: true,
    year: true,
    publication: true,
    itemType: true,
    publisher: false,
    dateAdded: false,
    dateModified: false,
    doi: true,
    citationKey: false,
    citations: true,
    references: false,
    pages: false,
    volume: false,
    issue: false,
    edition: false,
    language: false,
    extra: false,
    collection: false,
  },
  orderBy: 'createdAt',
  orderDirection: 'desc',
  density: 'comfortable',
};
