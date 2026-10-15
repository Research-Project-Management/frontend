import type {
  DisplayPropertyKey,
  GroupByOption,
  OrderByOption,
} from '@/features/projects/project-id/work-items/types/work-item.types';

export const DISPLAY_PROPERTY_ITEMS: Array<{ key: DisplayPropertyKey; label: string }> = [
  { key: 'id', label: 'ID' },
  { key: 'state', label: 'State' },
  { key: 'priority', label: 'Priority' },
  { key: 'assignee', label: 'Assignee' },
  { key: 'startDate', label: 'Start date' },
  { key: 'dueDate', label: 'Due date' },
  { key: 'labels', label: 'Labels' },
  { key: 'childWorkItemCount', label: 'Sub-work item count' },
  { key: 'attachmentCount', label: 'Attachment count' },
  { key: 'link', label: 'Link' },
];

export const GROUP_BY_OPTIONS: Array<{ value: GroupByOption; label: string }> = [
  { value: 'state', label: 'States' },
  { value: 'priority', label: 'Priority' },
  { value: 'labels', label: 'Labels' },
  { value: 'assignee', label: 'Assignees' },
  { value: 'none', label: 'None' },
];

export const ORDER_BY_OPTIONS: Array<{ value: OrderByOption; label: string }> = [
  { value: 'manual', label: 'Manual - Rank' },
  { value: 'createdAt', label: 'Created at' },
  { value: 'updatedAt', label: 'Updated at' },
  { value: 'dueDate', label: 'Due date' },
  { value: 'priority', label: 'Priority' },
];
