import type {
  ViewMode,
  DisplayOptions,
  Priority,
  GroupByOption,
  SubGroupByOption,
} from '../types/work-item.types';
import { DEFAULT_DISPLAY_OPTIONS } from '../types/work-item.types';

export const ITEMS_VIEW_STORAGE_KEY = 'flux:work-items-view-mode';
export const DISPLAY_OPTIONS_STORAGE_KEY = 'flux:work-item-display-options';
export const VALID_MODES: ViewMode[] = ['board', 'list', 'calendar', 'table', 'timeline', 'split'];

export const getDisplayOptionsStorageKey = (projId?: string, currentMode?: ViewMode) => {
  const modeKey = currentMode || 'board';
  return projId
    ? `flux:work-item-display-options:${projId}:${modeKey}`
    : `${DISPLAY_OPTIONS_STORAGE_KEY}:${modeKey}`;
};

export const getInitialDisplayOptions = (projId?: string, targetMode: ViewMode = 'board'): DisplayOptions => {
  const defaultGb: GroupByOption = (targetMode === 'table' || targetMode === 'timeline') ? 'none' : 'state';
  if (typeof window !== 'undefined') {
    try {
      const modeKey = getDisplayOptionsStorageKey(projId, targetMode);
      const saved = localStorage.getItem(modeKey);
      if (saved) {
        const parsed = JSON.parse(saved) as Record<string, unknown>;
        const rawGb = typeof parsed.groupBy === 'string' ? parsed.groupBy : undefined;
        const rawSubGb = typeof parsed.subGroupBy === 'string' ? parsed.subGroupBy : undefined;
        const groupBy = rawGb && rawGb !== 'null' ? (rawGb as GroupByOption) : defaultGb;
        let subGroupBy = rawSubGb && rawSubGb !== 'null' ? (rawSubGb as SubGroupByOption) : 'none';
        if (subGroupBy === groupBy) subGroupBy = 'none';
        return {
          ...DEFAULT_DISPLAY_OPTIONS,
          ...parsed,
          groupBy,
          subGroupBy,
        };
      }
      // Fallback check legacy key if exists
      const legacyKey = projId ? `flux:work-item-display-options:${projId}` : DISPLAY_OPTIONS_STORAGE_KEY;
      const legacySaved = localStorage.getItem(legacyKey);
      if (legacySaved) {
        const parsed = JSON.parse(legacySaved) as Record<string, unknown>;
        const groupBy = (targetMode === 'table' || targetMode === 'timeline') ? 'none' : (((typeof parsed.groupBy === 'string' && parsed.groupBy !== 'null' ? parsed.groupBy : defaultGb)) as GroupByOption);
        return {
          ...DEFAULT_DISPLAY_OPTIONS,
          ...parsed,
          groupBy,
        };
      }
    } catch {}
  }
  return {
    ...DEFAULT_DISPLAY_OPTIONS,
    groupBy: defaultGb,
  };
};

export const PRIORITY_WEIGHT: Record<Priority, number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
  none: 0,
};
