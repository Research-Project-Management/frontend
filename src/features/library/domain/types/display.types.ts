export type LibraryColumnKey =
  | 'authors'
  | 'year'
  | 'publication'
  | 'itemType'
  | 'doi'
  | 'citationKey'
  | 'citations';

export type LibraryOrderBy =
  | 'createdAt'
  | 'updatedAt'
  | 'year'
  | 'title'
  | 'citationKey'
  | 'authors'
  | 'publicationTitle'
  | 'deletedAt';

export interface LibraryDisplayOptions {
  columns: Record<LibraryColumnKey, boolean>;
  orderBy: LibraryOrderBy;
  orderDirection: 'asc' | 'desc';
  density?: 'comfortable' | 'compact';
  includeSubcollections?: boolean;
}

export const DEFAULT_LIBRARY_DISPLAY_OPTIONS: LibraryDisplayOptions = {
  columns: {
    authors: true,
    year: true,
    publication: true,
    itemType: false,
    doi: false,
    citationKey: true,
    citations: false,
  },
  orderBy: 'createdAt',
  orderDirection: 'desc',
  density: 'comfortable',
  includeSubcollections: true,
};

