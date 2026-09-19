import { create } from 'zustand';

export type LibraryModalType =
  | 'CREATE_COLLECTION'
  | 'RENAME_COLLECTION'
  | 'DELETE_COLLECTION'
  | 'IMPORT_PAPER'
  | 'EDIT_METADATA'
  | 'DELETE_ITEMS'
  | 'MOVE_ITEMS'
  | 'MERGE_DUPLICATES'
  | 'EXPORT_BIBTEX'
  | 'SHARE_COLLECTION';

interface LibraryModalState<T = any> {
  activeModal: LibraryModalType | null;
  payload: T | null;
  openModal: (type: LibraryModalType, payload?: T) => void;
  closeModal: () => void;
}

export const useLibraryModalStore = create<LibraryModalState>((set) => ({
  activeModal: null,
  payload: null,
  openModal: (type, payload = null) => set({ activeModal: type, payload }),
  closeModal: () => set({ activeModal: null, payload: null }),
}));
