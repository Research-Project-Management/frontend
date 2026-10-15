import React from 'react';
import {
  UrgentPriorityBoxIcon,
  HighPriorityBoxIcon,
  MediumPriorityBoxIcon,
  LowPriorityBoxIcon,
  NonePriorityBoxIcon,
} from '@/shared/components/icons';
import { cn } from '@/shared/lib/utils';
import type { Priority } from '@/features/projects/project-id/work-items/types/work-item.types';
import { ItemHelpers } from './work-item.utils';

export function renderPriorityIcon(priority?: Priority, className?: string) {
  const p = priority || 'none';
  switch (p) {
    case 'urgent':
      return <UrgentPriorityBoxIcon className={cn('size-3.5 shrink-0', className)} />;
    case 'high':
      return <HighPriorityBoxIcon className={cn('size-3.5 shrink-0', className)} />;
    case 'medium':
      return <MediumPriorityBoxIcon className={cn('size-3.5 shrink-0', className)} />;
    case 'low':
      return <LowPriorityBoxIcon className={cn('size-3.5 shrink-0', className)} />;
    case 'none':
    default:
      return <NonePriorityBoxIcon className={cn('size-3.5 shrink-0', className)} />;
  }
}

export function formatTableDate(dateStr?: string | null): string | null {
  return ItemHelpers.formatDate(dateStr) || null;
}

export function isDateOverdue(dateStr?: string | null, completed?: boolean): boolean {
  if (!dateStr || completed) return false;
  return ItemHelpers.checkOverdue(dateStr);
}
