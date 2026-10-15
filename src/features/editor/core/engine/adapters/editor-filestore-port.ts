/**
 * editor-filestore-port.ts
 *
 * Facet & Port for background file uploads from CodeMirror 6 extensions.
 * Location: `features/editor/engines/adapters/editor-filestore-port.ts`
 *
 * Matt Pocock Codebase Design principles:
 * - Decouples CodeMirror extensions from SDK filestore singletons.
 * - Allows headless testing of smart-paste image uploads with mock uploaders.
 * - Bridges to manuscriptService.filestore at application runtime.
 */

export type FileUploader = (projectId: string, file: File, name: string) => Promise<unknown>;

let defaultUploader: FileUploader = async () => {};

export function setDefaultFileUploader(uploader: FileUploader): void {
  defaultUploader = uploader;
}

export function getDefaultFileUploader(): FileUploader {
  return defaultUploader;
}
