/**
 * structure.types.ts
 * DTOs for virtual file tree structure, binary filestore metadata, linked files, and symbols.
 */

import type {
  ProjectSymbolLabelDto,
  ProjectSymbolCitationDto,
  ProjectSymbolCommandDto,
  ProjectSymbolEnvironmentDto,
  ProjectSymbolPackageDto,
  ProjectSymbolOutlineDto,
  ProjectSymbolsResponseDto,
} from '@/features/editor/domain/types/symbols.types';

export type {
  ProjectSymbolLabelDto,
  ProjectSymbolCitationDto,
  ProjectSymbolCommandDto,
  ProjectSymbolEnvironmentDto,
  ProjectSymbolPackageDto,
  ProjectSymbolOutlineDto,
  ProjectSymbolsResponseDto,
};

export interface FileMetadataDto {
  id: string;
  projectId: string;
  spaceId?: string | null;
  pageId?: string | null;
  nodeId?: string;
  docId?: string | null;
  fileId?: string | null;
  parentId?: string | null;
  path?: string;
  isRootDoc?: boolean;
  sortOrder?: number;
  name?: string;
  filename: string;
  sizeBytes: number;
  hash: string;
  mimeType: string;
  storageKey?: string;
  bucketName?: string;
  rev?: number;
  createdAt: string;
  updatedAt?: string;
}

export interface StructureNodeDto {
  id: string;
  nodeId?: string;
  spaceId?: string | null;
  pageId?: string | null;
  projectId: string;
  name: string;
  path: string;
  type: 'folder' | 'file' | 'doc' | 'FOLDER' | 'FILE' | 'DOC';
  parentId?: string | null;
  docId?: string | null;
  fileId?: string | null;
  sortOrder?: number;
  sizeBytes?: number;
  hash?: string | null;
  rev?: number | null;
  isRootDoc?: boolean;
  createdAt: string;
  updatedAt: string;
  children?: StructureNodeDto[];
}

export interface ImportFromUrlInput {
  url: string;
  filename?: string;
  pageId?: string;
}

export interface ImportFromUrlResult {
  filename: string;
  sizeBytes: number;
  imported: boolean;
}

export interface ImportFromProjectPayload {
  sourceSpaceId?: string;
  sourceProjectId?: string;
  sourceFileId: string;
  targetName?: string;
  targetPath?: string;
  parentPageId?: string;
}

export interface LatexOutlineEntryDto {
  level:
    | 'part'
    | 'chapter'
    | 'section'
    | 'subsection'
    | 'subsubsection'
    | 'paragraph'
    | 'subparagraph'
    | 'figure'
    | 'table'
    | 'slide'
    | 'appendix'
    | 'abstract';
  title: string;
  line: number;
  file?: string;
  label?: string;
  starred?: boolean;
  shortTitle?: string;
  children?: LatexOutlineEntryDto[];
}

export interface ProjectOutlineResponseDto {
  rootDocPath: string | null;
  entries: LatexOutlineEntryDto[];
  tree: LatexOutlineEntryDto[];
}
