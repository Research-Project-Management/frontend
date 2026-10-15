import { ItemHelpers, EMPTY_ARRAY } from './work-item.utils';

export { EMPTY_ARRAY };

export function formatDateDisplay(dateStr?: string | null): string {
  return ItemHelpers.formatDate(dateStr);
}

