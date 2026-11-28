/**
 * src/features/editor/subsystems/explorer/index.ts
 *
 * Explorer & File Tree Subsystem Public Seam & Facade Port (Matt Pocock Deep Module).
 *
 * Responsibilities:
 * - Document Tree Assembly, Virtual Hierarchy, and Sorting Rules.
 * - LRU Document Model Cache (In-Memory Buffer Store & Offline Sync Eviction).
 * - Academic Templates Catalog & Starter File Presets.
 * - File Explorer Sidebar Tab, Add Files Modal & Conflict Dialogs.
 */

// 1. Domain Models & Engines
export {
  buildFileTree,
  filterFileTree,
  flattenVisibleTree,
  findAncestorFolderPaths,
  getRootFilePriority,
  type BuildFileTreeParams,
  type FileTreeNode,
  type FileTreeFileNode,
  type FileTreeFolderNode,
  type FlattenedTreeNode,
} from './model/document-tree';

export {
  lruDocumentCache,
  LRUDocumentCache,
  type DocumentModelState,
} from '@/features/editor/domain/document/lru-document-cache';

export {
  normalizeVirtualPath,
} from '@/features/editor/domain/document/document-naming';

// 2. Hooks
export {
  useEditorStorage,
  type UseEditorStorageFilesOptions,
} from './hooks/useStorage';

// 3. UI Presentation Layer & Modals
export { default as FilesTab } from './ui/FilesTab';
export {
  TemplateGalleryModal,
  type TemplateGalleryModalProps,
} from './ui/modals/TemplateGalleryModal';
export { getFileIcon } from './ui/subcomponents/file-icon';
export { TexFileRow } from './ui/subcomponents/TexFileRow';
export { IndentGuides, InlineInput, RenameInput, RowActions } from './ui/subcomponents/FileTreePrimitives';
export { FileTreeFolderRow } from './ui/subcomponents/FileTreeFolderRow';

