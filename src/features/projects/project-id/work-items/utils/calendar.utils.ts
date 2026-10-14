import { format } from 'date-fns';

export const DATE_KEY_FORMAT = 'yyyy-MM-dd';
export const WEEK_DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isMidnightDueDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T00:00(?::00(?:\.000)?)?(?:Z|[+-]\d{2}:\d{2})?$/.test(
    value,
  );
}

export function getCalendarDateKey(dueDate?: string | null): string | null {
  if (!dueDate) return null;
  if (DATE_KEY_PATTERN.test(dueDate)) return dueDate;

  const [datePart] = dueDate.split('T');
  const parsedDate = new Date(dueDate);

  if (isMidnightDueDate(dueDate) && DATE_KEY_PATTERN.test(datePart)) {
    return datePart;
  }

  if (Number.isNaN(parsedDate.getTime())) {
    return DATE_KEY_PATTERN.test(datePart) ? datePart : null;
  }

  return format(parsedDate, DATE_KEY_FORMAT);
}

export function createCalendarDueDate(dateKey: string): string {
  return `${dateKey}T00:00:00.000Z`;
}
