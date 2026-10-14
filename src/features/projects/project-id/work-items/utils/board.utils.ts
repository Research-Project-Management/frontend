import { ItemHelpers } from './work-item.utils';

export function formatDateDisplay(dateStr?: string | null): string {
  return ItemHelpers.formatDate(dateStr);
}

export const EMPTY_ARRAY: never[] = [];
