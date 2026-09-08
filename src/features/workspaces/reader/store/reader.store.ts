import { create } from 'zustand';

export interface ReaderStoreState {
  readingPaperId: string | null;
  openReader: (paperId: string) => void;
  closeReader: () => void;
}

export const useReaderStore = create<ReaderStoreState>((set) => ({
  readingPaperId: null,
  openReader: (paperId: string) => set({ readingPaperId: paperId }),
  closeReader: () => set({ readingPaperId: null }),
}));

// Backward-compatible alias
export const useLibraryReaderStore = useReaderStore;
