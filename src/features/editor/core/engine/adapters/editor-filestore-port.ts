/**
 * editor-filestore-port.ts
 *
 * Facet & Port for background file uploads from CodeMirror 6 extensions.
 * Location: `features/editor/engines/adapters/editor-filestore-port.ts`
 *
 * Matt Pocock Codebase Design principles:
 * - Decouples CodeMirror extensions from SDK filestore singletons.
 * - Allows headless testing of smart-paste image uploads with mock uploaders.
 * - Bridges to pagesService.filestore at application runtime.
 */

import { filestore } from '@/features/editor/sdk/pages.service';
import { usePageStore } from '@/features/editor/core/store/editor.store';

export type FileUploader = (projectId: string, file: File, name: string, pageId?: string) => Promise<unknown>;

let defaultUploader: FileUploader = (projectId, file, name, pageId) => {
  const pageState = typeof usePageStore?.getState === 'function' ? usePageStore.getState() : undefined;
  const resolvedSpaceId = pageState?.spaceId?.trim() || projectId;
  const resolvedPageId = pageId || pageState?.rootPageId || pageState?.parentPageId || undefined;
  return filestore.upload(resolvedSpaceId, file, name, resolvedPageId);
};

export function setDefaultFileUploader(uploader: FileUploader): void {
  defaultUploader = uploader;
}

export function getDefaultFileUploader(): FileUploader {
  return defaultUploader;
}
