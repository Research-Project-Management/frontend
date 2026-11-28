/**
 * docs.types.ts
 * DTOs for Docstore, Batch Updater, and Editor Bootstrap.
 */

import type { CompilerDiagnostic } from '@/features/editor/domain/types/compiler.types';
import type { ProjectSymbolsResponseDto } from '@/features/editor/domain/types/symbols.types';
import type { StructureNodeDto } from './structure.types';

export interface QueueUpdatePayload {
  lines?: string[];
  splice?: {
    startLine: number;
    deleteCount: number;
    newLines: string[];
  };
  userId?: string;
  clientRev?: number;
  debounceMs?: number;
  pathname?: string;
  docLines?: string[];
  docOps?: unknown[];
  version?: number;
}

export interface DocstoreDocDto {
  _id: string;
  spaceId?: string | null;
  projectId: string;
  path: string;
  lines: string[];
  version: number;
  rev: number;
  deleted?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface FlushResultDto {
  spaceId?: string | null;
  projectId?: string;
  flushed?: boolean;
  flushedDocCount?: number;
  flushedDocsCount: number;
  flushedDocIds?: string[];
  skippedDocIds?: string[];
  errors?: Array<{ docId: string; error: string }>;
  durationMs?: number;
}

type EditorBootstrapDegradedBranch = 'symbols' | 'lastBuild';

interface EditorBootstrapGithubLinkDto {
  id: string;
  repoFullName: string;
  branch: string;
  lastSyncedAt: string | null;
}

interface EditorBootstrapPermissionsDto {
  role: string;
  canEdit: boolean;
  canCompile: boolean;
}

interface EditorBootstrapWorkspaceDto {
  spaceId: string;
  spaceType?: 'personal' | 'project';
  pageId: string;
  rootDocId: string;
  projectName: string | null;
  title: string;
  mainFilePath: string;
  compiler?: 'pdflatex' | 'xelatex' | 'lualatex' | 'latex';
  texlive?: string;
  spellLang?: string;
  permissions: EditorBootstrapPermissionsDto;
  githubLink: EditorBootstrapGithubLinkDto | null;
}

interface EditorBootstrapPageMetadataDto {
  id?: string;
  title?: string;
  description?: string | null;
  status?: string;
  compiler?: 'pdflatex' | 'xelatex' | 'lualatex' | 'latex';
  texlive?: string;
  spellLang?: string;
  rootDocId?: string;
}

interface EditorBootstrapActiveDocDto {
  id: string;
  nodeId?: string | null;
  page: {
    id: string;
    title: string;
    content: string;
    path?: string;
    status: string;
    spaceId?: string;
    pageId?: string;
    projectId: string;
    mainFile: { id: string; title: string };
    mainFileId: string;
    rootPageId: string;
    compiler?: 'pdflatex' | 'xelatex' | 'lualatex' | 'latex';
    texlive?: string;
    spellLang?: string;
    version: number;
    rev: number;
    hash?: string | null;
    createdAt: string;
    updatedAt: string;
  };
  lines: string[];
  version: number;
  rev: number;
  hash?: string | null;
  ranges: Record<string, unknown>;
  fallbackToRoot: boolean;
}

interface EditorBootstrapLastBuildDto {
  status: 'ready' | 'error' | 'uncompiled';
  pdfArtifactUrl: string | null;
  synctexAvailable: boolean;
  lastCompiledAt: string | null;
  diagnostics: CompilerDiagnostic[];
}

export interface EditorBootstrapResponseDto {
  workspace: EditorBootstrapWorkspaceDto;
  page?: EditorBootstrapPageMetadataDto | null;
  tree: StructureNodeDto[];
  activeDoc: EditorBootstrapActiveDocDto;
  symbols: ProjectSymbolsResponseDto | null;
  lastBuild: EditorBootstrapLastBuildDto;
  degraded: boolean;
  degradedBranches: EditorBootstrapDegradedBranch[];
  serverTimestamp: string;
}
