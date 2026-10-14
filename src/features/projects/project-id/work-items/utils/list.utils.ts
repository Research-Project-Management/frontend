import { ItemHelpers } from './work-item.utils';

export const PRIORITY_THEME_CLASSES: Record<string, string> = {
  urgent:
    'text-foreground bg-muted/40 border-border hover:bg-muted shadow-none font-normal',
  high:
    'text-foreground bg-muted/30 border-border hover:bg-muted shadow-none font-normal',
  medium:
    'text-foreground bg-muted/20 border-border hover:bg-muted shadow-none font-normal',
  low:
    'text-foreground bg-muted/10 border-border hover:bg-muted shadow-none font-normal',
  none:
    'text-foreground bg-transparent hover:bg-muted/50 border-border shadow-none font-normal',
};

export function formatDueDate(dateStr?: string | null): string {
  return ItemHelpers.formatDate(dateStr);
}

export const EMPTY_ARRAY: never[] = [];
