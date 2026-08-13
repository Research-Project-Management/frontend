export { default as MyFilesPage } from './pages/MyFilesPage';
export { default as StoragePage } from './pages/HomePage';
export { default as SharedPage } from './pages/SharedPage';
export { default as StarredPage } from './pages/StarredPage';
export { default as TrashPage } from './pages/TrashPage';
// Page exports are clean and without prefixes
export { 
  getAllFiles, 
  createFolder,
  uploadFile
} from './services/storage.services';
export type { StorageItem } from '@/features/workspaces/storage/types/storage.types';
export { default as StorageSidebar } from './components/layout/Sidebar';
