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
  buildUnifiedTree,
  filterFileTree,
  getRootFilePriority,
  type FileTreeNode,
  type FileTreeFileNode,
  type FileTreeFolderNode,
  type BuildFileTreeParams,
} from './model/document-tree';

export {
  lruDocumentCache,
  LRUDocumentCache,
  type DocumentModelState,
  type DocumentCursorSelection,
  type DocumentScrollViewport,
  type DocumentModelStats,
  type ModelChangeListener,
  type ModelEvictionListener,
} from '@/features/editor/domain/document/lru-document-cache';

export {
  ACADEMIC_TEMPLATES,
  RAW_ACADEMIC_TEMPLATES,
  type AcademicTemplate,
  type RawAcademicTemplate,
  type AcademicTemplateCategory,
  type TemplateIconName,
} from './model/template-gallery.data';

export {
  formatEditorTitle,
  getExportFilename,
  isLatexSourceFile,
  isBibtexFile,
  isImageAsset,
  displayName,
  cleanBasename,
  normalizeVirtualPath,
  splitVirtualPathSegments,
  splitVirtualPath,
  joinVirtualPath,
  isUnderVirtualFolder,
  rewritePathPrefix,
  parseVirtualFolderId,
  formatLatexIncludeSnippet,
} from '@/features/editor/domain/document/document-naming';

export {
  isZipFile,
  parseZipArchive,
  extractAndImportZipToProject,
  type ExtractedZipProject,
  type ImportZipProgress,
} from '@/features/editor/sdk/archive/archive-import';
export {
  exportProjectAsZip,
  exportArxivSubmissionZip,
  exportVersionAsZip,
} from '@/features/editor/sdk/archive/archive-export';

// 2. UI Presentation Layer
export { default as FilesTab } from './ui/FilesTab';
export { FileTreeContainer } from './ui/FileTreeContainer';
export { TexFileRow } from './ui/subcomponents/TexFileRow';
export { IndentGuides, InlineInput, RenameInput, RowActions } from './ui/subcomponents/FileTreePrimitives';
export { StorageFileRow, getStorageIcon } from './ui/subcomponents/FileTreeNodes';
export { FileTreeFolderRow } from './ui/subcomponents/FileTreeFolderRow';
export { default as AddFilesModal } from './ui/modals/AddFilesModal';
export { DeleteFileDialog } from './ui/modals/DeleteFileDialog';
export { UploadConflictDialog } from './ui/modals/UploadConflictDialog';

