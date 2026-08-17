import { create } from 'zustand';

interface LibraryReaderState {
  readingPaperId: string | null;
  openReader: (paperId: string) => void;
  closeReader: () => void;
}

export const useLibraryReaderStore = create<LibraryReaderState>((set) => ({
  readingPaperId: null,
  openReader: (paperId: string) => set({ readingPaperId: paperId }),
  closeReader: () => set({ readingPaperId: null }),
}));
