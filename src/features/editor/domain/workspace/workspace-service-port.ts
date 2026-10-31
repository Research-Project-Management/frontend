/**
 * workspace-service-port.ts
 *
 * Hexagonal / Deep Module Ports for WorkspaceCoordinatorRegistry.
 * Location: `features/editor/domain/workspace/workspace-service-port.ts`
 *
 * Isolates file-system lifecycle orchestration from:
 * 1. Backend HTTP SDK (`manuscriptService`)
 * 2. UI Toast Notifications (`sonner`)
 * 3. Zustand Store singletons (`useWorkspaceStore`, `usePageStore`, `useSettingsStore`)
 */

export interface WorkspaceFileNodeDto {
  id: string;
  title?: string | null;
  name?: string | null;
  path?: string | null;
  content?: string | null;
  projectId?: string | { id: string; name: string } | null;
  type?: 'DOC' | 'FOLDER' | 'FILE' | string;
}

export interface WorkspaceServicePort {
  createNode(
    projectId: string,
    data: {
      name: string;
      parentId: string | null;
      content: string;
      type: 'DOC' | 'FOLDER' | 'FILE';
      path?: string;
    }
  ): Promise< unknown >;
  renameNode(projectId: string, itemId: string, data: { name: string }): Promise<unknown>;
  deleteNode(projectId: string, fileId: string): Promise<unknown>;
  moveNode(
    projectId: string,
    itemId: string,
    data: { destParentId: string | null; destPath?: string }
  ): Promise<unknown>;
  restoreFile(fileId: string, projectId?: string): Promise<unknown>;
  setRootDoc(projectId: string, fileId: string): Promise<unknown>;
  getFilesByProjectId(projectId: string): Promise<WorkspaceFileNodeDto[]>;
  updateFileContent(fileId: string, content: string): Promise<unknown>;
}

export interface WorkspaceNotificationPort {
  notifySuccess(message: string, id?: string): void;
  notifyError(message: string, id?: string): void;
  notifyInfo(message: string, id?: string): void;
}

export interface WorkspaceStorePort {
  getActiveProjectId(): string | null;
  closeTab(fileId: string): void;
  updateTabTitle(projectId: string, itemId: string, newTitle: string): void;
  setMainFile(fileNameOrId: string): void;
  getActiveDocumentId(): string | null;
}

export interface WorkspaceCoordinatorPorts {
  service?: WorkspaceServicePort;
  notification?: WorkspaceNotificationPort;
  store?: WorkspaceStorePort;
}
