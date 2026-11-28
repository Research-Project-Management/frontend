/**
 * search-export.types.ts
 * DTOs for project search/replace, export/import archives, citations, and templates.
 */

export interface BibEntryDto {
  id?: string;
  key: string;
  sourceFile?: string;
  type: string;
  entryType?: string;
  title?: string;
  author?: string;
  authorsDisplay?: string;
  authors?: string[];
  displayLabel?: string;
  fields?: Record<string, string>;
  year?: string;
  journal?: string;
  doi?: string;
  rawBibtex?: string;
}

export interface CitationValidationDto {
  valid?: boolean;
  isValid: boolean;
  totalFiles?: number;
  duplicateKeys: string[];
  warnings?: string[];
  missingFieldWarnings: Array<{ key: string; missingFields: string[] }>;
  totalEntries: number;
}

export interface TemplateSummaryDto {
  id: string;
  name: string;
  category: string;
  publisher?: string;
  description?: string;
  badge?: string;
}

interface SearchMatchEntry {
  line: number;
  text: string;
  matchStart: number;
  matchEnd: number;
  snippet: string;
}

interface FileSearchResult {
  fileId: string;
  fileName: string;
  isMainFile: boolean;
  totalMatches: number;
  matches: SearchMatchEntry[];
}

export interface SearchResultResponse {
  query: string;
  totalFiles: number;
  totalMatches: number;
  results: FileSearchResult[];
  truncated: boolean;
}

export interface BatchReplaceResultResponse {
  query: string;
  replaceWith: string;
  totalFilesAffected: number;
  totalOccurrencesReplaced: number;
  affectedFileIds: string[];
}

export interface SearchOptions {
  caseSensitive?: boolean;
  wholeWord?: boolean;
  useRegex?: boolean;
  fileIds?: string[];
  maxResults?: number;
  pageId?: string;
}

export interface BatchReplaceOptions {
  caseSensitive?: boolean;
  wholeWord?: boolean;
  useRegex?: boolean;
  fileIds?: string[];
  pageId?: string;
}

export type DocumentExportFormat = 'tex' | 'docx' | 'html' | 'md';

export interface ExportFileResult {
  filename: string;
  mimeType: string;
  content: string;
  isBase64: boolean;
  sizeBytes: number;
}

export interface ImportZipResult {
  projectId: string;
  totalEntries: number;
  totalDocs: number;
  totalFiles: number;
  totalFolders: number;
  rootDocId?: string | null;
  rootDocPath?: string | null;
}

export interface ExportZipQuery {
  includePdf?: boolean;
  cleanArxiv?: boolean;
  mode?: 'standard' | 'arxiv';
  version?: number;
  projectName?: string;
  pageId?: string;
}
