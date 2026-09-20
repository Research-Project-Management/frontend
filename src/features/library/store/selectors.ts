import { useLibraryUIStore } from './library-ui.store';

/**
 * Granular Selectors - Performance Optimization Engine
 *
 * Rule: Return primitive values (boolean, string, number) whenever possible
 * so Zustand's strict equality comparison skips unnecessary component re-renders.
 */

// ── Selection Selectors ────────────────────────────────────────────────────────
export const useIsItemSelected = (id: string): boolean =>
  useLibraryUIStore((state) => state.selectedIds.has(id));

export const useIsActiveItem = (id: string): boolean =>
  useLibraryUIStore((state) => state.activeItemId === id);

export const useActiveItemId = (): string | null =>
  useLibraryUIStore((state) => state.activeItemId);

export const useSelectedCount = (): number =>
  useLibraryUIStore((state) => state.selectedIds.size);

export const useSelectedIds = (): Set<string> =>
  useLibraryUIStore((state) => state.selectedIds);

export const useViewMode = () =>
  useLibraryUIStore((state) => state.viewMode);

// ── Layout Selectors ───────────────────────────────────────────────────────────
export const useActiveScope = () =>
  useLibraryUIStore((state) => state.activeScope);

export const useIsSidebarOpen = (): boolean =>
  useLibraryUIStore((state) => state.isSidebarOpen);

export const useSidebarWidth = (): number =>
  useLibraryUIStore((state) => state.sidebarWidth);

export const useIsInspectorOpen = (): boolean =>
  useLibraryUIStore((state) => state.isInspectorOpen);

export const useActiveInspectorTab = () =>
  useLibraryUIStore((state) => state.activeInspectorTab);

export const useInspectorWidth = (): number =>
  useLibraryUIStore((state) => state.inspectorWidth);

// ── Modal Selectors ───────────────────────────────────────────────────────────
export const useActiveModal = () =>
  useLibraryUIStore((state) => state.activeModal);

export const useModalProps = () =>
  useLibraryUIStore((state) => state.modalProps);
