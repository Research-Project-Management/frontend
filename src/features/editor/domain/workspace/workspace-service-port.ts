/**
 * workspace-service-port.ts
 *
 * Real Seams & Ports (Domain Layer) for Workspace & File System lifecycle.
 * Follows Matt Pocock's Codebase Design principles:
 * - Pure interfaces defining capabilities without concrete SDK/UI/Store dependencies.
 * - Deep Module architecture: encapsulates file tree mutations, caching, DAG re-indexing,
 *   and command bus event dispatching behind a clean, testable contract.
 */

export interface WorkspaceCreateNodeInput {
  name: string;
  parentId?: string | null;
  content?: string;
  type?: 'folder' | 'file' | 'doc' | 'FOLDER' | 'FILE' | 'DOC';
}

export interface WorkspaceRenameNodeInput {
  name: string;
  [key: string]: unknown;
}

export interface WorkspaceMoveNodeInput {
  destParentId: string | null;
  [key: string]: unknown;
}

export interface WorkspaceProjectFile {
  id: string;
  title: string;
  content?: string;
}

export interface WorkspaceServicePort {
  createNode(projectId: string, data: WorkspaceCreateNodeInput): Promise<unknown>;
  renameNode(projectId: string, itemId: string, data: WorkspaceRenameNodeInput): Promise<unknown>;
  deleteNode(projectId: string, itemId: string): Promise<unknown>;
  moveNode(projectId: string, itemId: string, data: WorkspaceMoveNodeInput): Promise<unknown>;
  restoreFile(fileId: string, projectId?: string): Promise<unknown>;
  setRootDoc(projectId: string, fileId: string): Promise<unknown>;
  getFilesByProjectId(projectId: string): Promise<WorkspaceProjectFile[]>;
  updateFileContent(fileId: string, content: string): Promise<unknown>;
}

export interface WorkspaceNotificationPort {
  notifySuccess(message: string, id?: string): void;
  notifyError(message: string, id?: string): void;
  notifyInfo?(message: string, id?: string): void;
}

export interface WorkspaceStorePort {
  getActiveProjectId(): string | null;
  closeTab(fileId: string): void;
  updateTabTitle(projectId: string, itemId: string, newTitle: string): void;
  setMainFile(fileId: string): void;
  getActiveDocumentId(): string | null;
}
