import type { MessageAttachment } from './message';

export interface AttachedSourcePayload {
  kind: 'library' | 'upload' | 'paper';
  title: string;
  source_id?: string | null;
  source_type?: 'upload' | 'file' | null;
  item_id?: string | null;
  file_id?: string | null;
  has_pdf?: boolean;
  indexed?: boolean;
}

export type TurnMode = 'chat' | 'editor' | 'paper';

export interface EditorTurnContext {
  pageId?: string | null;
  activeFileId?: string | null;
  activeFilePath?: string | null;
  filename?: string | null;
  fileContent?: string | null;
  selection?: string | null;
  cursorContext?: string | null;
  cursorLine?: number | null;
  cursorColumn?: number | null;
  selectionStartLine?: number | null;
  selectionEndLine?: number | null;
  selectionStartColumn?: number | null;
  selectionEndColumn?: number | null;
  contextBefore?: string | null;
  contextAfter?: string | null;
  currentSection?: string | null;
  currentEnvironment?: string | null;
  documentStructureSummary?: string | null;
  documentStructure?: string | Array<Record<string, unknown>> | null;
  compileErrors?: unknown;
  userSelection?: string | Record<string, unknown> | null;
}

export interface PaperTurnContext {
  paperId: string;
  paperTitle?: string;
  quotedPassage?: string;
  pageNumber?: number;
}

export interface TurnContext {
  mode?: TurnMode;
  spaceId?: string | null;
  chatId?: string | null;
  documentIds?: string[];
  attachedSources?: AttachedSourcePayload[];
  attachments?: MessageAttachment[];
  webSearchSites?: string[] | null;
  intentHint?: string | null;
  modelId?: string | null;
  editor?: EditorTurnContext;
  paper?: PaperTurnContext;
}
