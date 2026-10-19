/**
 * Public API Surface for features/storage
 * Conforms to ADR 002 Deep Modules & Hexagonal Architecture
 */

// UI Store
export {
  useStorageUIStore,
  useViewStore,
  usePreviewStore,
  useStorageSelectionStore,
  useStorageFilterStore,
} from './store/storage-ui.store';

// Types
export type * from './types/storage.types';

// Services
export * as storageDriveService from './services/drive.service';
export { getAllFiles } from './services/drive.service';
export * from './services/upload.service';

// Hooks
export * from './hooks/use-storage';

// Utils & Public Components
export {
  getFileType,
  getFileIcon,
  getFileColor,
  isScientificTextFile,
  formatFileSize,
  formatMimeType,
  formatDate,
  formatDetailedSize,
  formatFileLocation,
  formatDetailedDate,
  createFolderDropHandlers,
  canDropIntoFolder,
} from './utils/storage.util';
export { StorageEmptyState } from './components/layout/StorageEmptyState';

// Pages
export { default as StorageHomePage } from './pages/HomePage';
