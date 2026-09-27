export type LibraryColumnKey =
  | 'authors'
  | 'year'
  | 'publication'
  | 'citationKey'
  | 'itemType'
  | 'doi'
  | 'citations';

export type LibraryOrderBy =
  | 'createdAt'
  | 'updatedAt'
  | 'year'
  | 'title'
  | 'citationKey'
  | 'authors'
  | 'publicationTitle';

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
    citationKey: true,
    itemType: false,
    doi: false,
    citations: false,
  },
  orderBy: 'createdAt',
  orderDirection: 'desc',
  density: 'comfortable',
};

