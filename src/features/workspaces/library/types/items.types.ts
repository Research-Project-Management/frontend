import { z } from 'zod';
import {
  userSchema,
  creatorCreditSchema,
  contributorRelationSchema,
  identifierSchema,
  primaryFileSchema,
  provenanceSchema,
  collectionRelationSchema,
  itemTagRelationSchema,
  itemSchema,
  createItemSchema,
  updateItemSchema,
  typeConversionPreviewSchema,
  typeConversionSchema,
  bulkDeleteItemsSchema,
  bulkMoveItemsSchema,
  bulkTagItemsSchema,
  cursorPaginationMetaSchema,
  paginatedItemsResponseSchema,
} from '../schemas/item.schema';

export type User = z.infer<typeof userSchema>;
export type CreatorCredit = z.infer<typeof creatorCreditSchema>;
export type ContributorRelation = z.infer<typeof contributorRelationSchema>;
export type Identifier = z.infer<typeof identifierSchema>;
export type PrimaryFile = z.infer<typeof primaryFileSchema>;
export type Provenance = z.infer<typeof provenanceSchema>;
export type CollectionRelation = z.infer<typeof collectionRelationSchema>;
export type ItemTagRelation = z.infer<typeof itemTagRelationSchema>;

export type Item = z.infer<typeof itemSchema>;
/** @deprecated Use Item */
export type Paper = Item;

export type CreateItemInput = z.infer<typeof createItemSchema>;
export type UpdateItemInput = z.infer<typeof updateItemSchema>;

export type CreateItemDTO = CreateItemInput;
export type UpdateItemDTO = UpdateItemInput;
export type ItemInput = Partial<Item>;

export type TypeConversionPreviewInput = z.infer<typeof typeConversionPreviewSchema>;
export type TypeConversionInput = z.infer<typeof typeConversionSchema>;

export type BulkDeleteItemsInput = z.infer<typeof bulkDeleteItemsSchema>;
export type BulkMoveItemsInput = z.infer<typeof bulkMoveItemsSchema>;
export type BulkTagItemsInput = z.infer<typeof bulkTagItemsSchema>;

export type CursorPaginationMeta = z.infer<typeof cursorPaginationMetaSchema>;
export type PaginatedItemsResponse = z.infer<typeof paginatedItemsResponseSchema>;

export interface ItemQueryParams {
  collectionId?: string;
  search?: string;
  smartFilter?: 'unfiled' | 'missing-doi' | 'missing-pdf' | 'with-notes';
  limit?: number;
  skip?: number;
  view?: string;
}

export interface MoveToTrashTarget {
  id: string;
  title: string;
  year?: number | null;
  authors?: string[];
}

export interface AddLinkData {
  url: string;
  title?: string;
  fileUrl?: string;
  filename?: string;
  mimeType?: string;
  size?: number;
  doi?: string;
  authors?: string[];
  year?: number | string | null;
  abstract?: string;
  journal?: string;
  publisher?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  type?: string;
  [key: string]: any;
}

export interface ItemUploadData {
  title: string;
  authors: string[];
  year: number | null;
  doi: string;
  abstract: string;
  fileUrl: string;
  filename: string;
  mimeType: string;
  size: number;
  journal?: string;
  publicationTitle?: string;
  publicationDate?: string;
  publisher?: string;
  place?: string;
  keywords?: string[];
  volume?: string;
  issue?: string;
  pages?: string;
  section?: string;
  partNumber?: string;
  partTitle?: string;
  series?: string;
  seriesTitle?: string;
  seriesText?: string;
  issn?: string;
  isbn?: string;
  url?: string;
  type?: string;
  itemType?: string;
  date?: string;
  language?: string;
  rights?: string;
  shortTitle?: string;
  citationKey?: string;
  edition?: string;
  bookTitle?: string;
  proceedingsTitle?: string;
  conferenceName?: string;
  institution?: string;
  university?: string;
  reportNumber?: string;
  reportType?: string;
  patentNumber?: string;
  assignee?: string;
  filingDate?: string;
  extraFields?: Record<string, unknown>;
  [key: string]: unknown;
}

/** @deprecated Use ItemUploadData */
export type PaperUploadData = ItemUploadData;
