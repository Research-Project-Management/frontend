/**
 * Public API Surface for features/storage
 * Conforms to ADR 002 Deep Modules & Hexagonal Architecture
 */

// UI Store
export {
  useStorageUIStore,
  useStorageViewStore,
  useViewStore,
  usePreviewStore,
  useStorageSelectionStore,
  useStorageFilterStore,
} from './store/storage-ui.store';

// Types
export type * from './types/storage.types';
export type { UploadFileParams, CreateFileRecordParams } from './types/storage.types';

// Services
export * as storageFileService from './services/file.service';
export * as storageDriveService from './services/drive.service';
export * from './services/upload.service';

// Hooks
export * from './hooks/use-storage';

// Pages
export { default as StorageHomePage } from './pages/HomePage';
