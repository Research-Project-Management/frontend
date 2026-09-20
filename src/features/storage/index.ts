/**
 * Public API Surface for features/storage
 * Conforms to ADR 002 Deep Modules & Hexagonal Architecture
 */

// UI Store
export { useStorageUIStore } from './store/storage-ui.store';
export { useStorageSelectionStore } from './store/use-selection-store';
export { useStorageFilterStore } from './store/use-filter-store';
export { useStorageViewStore } from './store/use-view-store';
export { usePreviewStore } from './store/use-preview-store';

// Types
export type * from './types/storage.types';
export type * from './types/storage-item.types';

// Services
export * as storageFileService from './services/file.service';
export * as storageDriveService from './services/drive.service';

// Hooks
export * from './hooks/use-storage';

// Pages
export { default as StorageHomePage } from './pages/HomePage';
export { default as StorageMyFilesPage } from './pages/MyFilesPage';
export { default as StorageSharedPage } from './pages/SharedPage';
export { default as StorageStarredPage } from './pages/StarredPage';
export { default as StorageTrashPage } from './pages/TrashPage';
