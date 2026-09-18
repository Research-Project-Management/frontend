import { create } from 'zustand';

export interface ReaderTab {
  id: string; // 'library' or paperId
  title: string;
  type: 'library' | 'paper';
}

export type ReaderAnnotationTool =
  | 'select'
  | 'highlight'
  | 'underline'
  | 'strike'
  | 'note'
  | 'text'
  | 'area'
  | 'ink';

export interface ReaderStoreState {
  tabs: ReaderTab[];
  activeTabId: string;
  readingPaperId: string | null;
  activeColor: string;
  activeTool: ReaderAnnotationTool;
  openReader: (paperId: string, title?: string) => void;
  closeReader: (paperId?: string) => void;
  openTab: (tab: ReaderTab) => void;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  setActiveColor: (color: string) => void;
  setActiveTool: (tool: ReaderAnnotationTool) => void;
}

const DEFAULT_TABS: ReaderTab[] = [
  { id: 'library', title: 'My Library', type: 'library' },
];

function loadInitialTabs(): { tabs: ReaderTab[]; activeTabId: string } {
  if (typeof window === 'undefined') {
    return { tabs: DEFAULT_TABS, activeTabId: 'library' };
  }
  try {
    const raw = localStorage.getItem('flux_reader_tabs');
    const rawActive = localStorage.getItem('flux_reader_active_tab');
    const parsed = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed) && parsed.length > 0) {
      const filtered = parsed.filter((t: any) => t && t.id && t.id !== 'library');
      const tabs: ReaderTab[] = [DEFAULT_TABS[0], ...filtered];
      const activeTabId = rawActive && tabs.some((t) => t.id === rawActive) ? rawActive : tabs[0].id;
      return { tabs, activeTabId };
    }
  } catch {
    // Ignore parse error
  }
  return { tabs: DEFAULT_TABS, activeTabId: 'library' };
}

function saveTabsToStorage(tabs: ReaderTab[], activeTabId: string) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('flux_reader_tabs', JSON.stringify(tabs));
    localStorage.setItem('flux_reader_active_tab', activeTabId);
  } catch {
    // Ignore storage write error
  }
}

const initial = loadInitialTabs();

export const useReaderStore = create<ReaderStoreState>((set, get) => ({
  tabs: initial.tabs,
  activeTabId: initial.activeTabId,
  readingPaperId: initial.activeTabId !== 'library' ? initial.activeTabId : null,
  activeColor: '#ffd400',
  activeTool: 'highlight',

  openReader: (paperId: string, title?: string) => {
    const { tabs } = get();
    const existing = tabs.find((t) => t.id === paperId);
    let nextTabs = tabs;
    if (!existing) {
      nextTabs = [...tabs, { id: paperId, title: title || 'Loading...', type: 'paper' }];
    } else if (title && existing.title !== title) {
      nextTabs = tabs.map((t) => (t.id === paperId ? { ...t, title } : t));
    }
    saveTabsToStorage(nextTabs, paperId);
    set({
      tabs: nextTabs,
      activeTabId: paperId,
      readingPaperId: paperId,
    });
  },

  closeReader: (paperId?: string) => {
    const { tabs, activeTabId } = get();
    const targetId = paperId || (activeTabId !== 'library' ? activeTabId : null);
    if (!targetId) return;

    const nextTabs = tabs.filter((t) => t.id !== targetId);
    let nextActive = activeTabId;
    if (activeTabId === targetId) {
      const idx = tabs.findIndex((t) => t.id === targetId);
      const prevTab = tabs[idx - 1] || nextTabs[0] || DEFAULT_TABS[0];
      nextActive = prevTab.id;
    }
    saveTabsToStorage(nextTabs, nextActive);
    set({
      tabs: nextTabs,
      activeTabId: nextActive,
      readingPaperId: nextActive !== 'library' ? nextActive : null,
    });
  },

  openTab: (tab: ReaderTab) => {
    const { tabs } = get();
    const exists = tabs.some((t) => t.id === tab.id);
    const nextTabs = exists
      ? tabs.map((t) => (t.id === tab.id ? { ...t, title: tab.title || t.title } : t))
      : [...tabs, tab];
    saveTabsToStorage(nextTabs, tab.id);
    set({
      tabs: nextTabs,
      activeTabId: tab.id,
      readingPaperId: tab.id !== 'library' ? tab.id : null,
    });
  },

  closeTab: (id: string) => {
    if (id === 'library') return;
    const { tabs, activeTabId } = get();
    const nextTabs = tabs.filter((t) => t.id !== id);
    let nextActive = activeTabId;
    if (activeTabId === id) {
      const idx = tabs.findIndex((t) => t.id === id);
      const prevTab = tabs[idx - 1] || nextTabs[0] || DEFAULT_TABS[0];
      nextActive = prevTab.id;
    }
    saveTabsToStorage(nextTabs, nextActive);
    set({
      tabs: nextTabs,
      activeTabId: nextActive,
      readingPaperId: nextActive !== 'library' ? nextActive : null,
    });
  },

  setActiveTab: (id: string) => {
    const { tabs } = get();
    if (!tabs.some((t) => t.id === id)) return;
    saveTabsToStorage(tabs, id);
    set({
      activeTabId: id,
      readingPaperId: id !== 'library' ? id : null,
    });
  },

  setActiveColor: (color: string) => set({ activeColor: color }),
  setActiveTool: (tool: ReaderAnnotationTool) => set({ activeTool: tool }),
}));

// Backward-compatible alias
export const useLibraryReaderStore = useReaderStore;
