export const DUE_DATE_LABELS: Record<string, string> = {
  all: 'All',
  overdue: 'Overdue',
  today: 'Due today',
  this_week: 'Due this week',
  this_month: 'Due this month',
  '15_days': 'Due in 15 days',
  '30_days': 'Due in 30 days',
  no_date: 'No due date',
};

export const DUE_DATE_QUICK_OPTIONS: Array<{ id: string; label: string }> = [
  { id: 'overdue', label: 'Overdue' },
  { id: 'today', label: 'Due today' },
  { id: 'this_week', label: 'Due this week' },
  { id: 'this_month', label: 'Due this month' },
  { id: '15_days', label: '15 days from now' },
  { id: '30_days', label: '30 days from now' },
  { id: 'no_date', label: 'No due date' },
];
