'use client';

import React from 'react';
import { cn } from '@/shared/lib/utils';
import type { StateGroup } from '../../types/state.types';

interface StateIconProps {
  icon?: string | null;
  group?: StateGroup | string | null;
  color?: string | null;
  className?: string;
  size?: number;
}

export function StateIcon({
  icon,
  group,
  color,
  className,
  size = 15,
}: StateIconProps) {
  // Resolve icon type: prioritize icon from backend, then group
  const resolvedIcon = icon || (group ? getDefaultIconForGroup(group) : 'circle');
  const resolvedColor = color || getDefaultColorForIcon(resolvedIcon);

  switch (resolvedIcon) {
    case 'circle-dashed':
    case 'backlog':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={cn('shrink-0', className)}
          style={{ color: resolvedColor }}
        >
          <circle
            cx="8"
            cy="8"
            r="6"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeDasharray="2.5 2"
            strokeLinecap="round"
          />
        </svg>
      );

    case 'circle':
    case 'unstarted':
    case 'todo':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={cn('shrink-0', className)}
          style={{ color: resolvedColor }}
        >
          <circle
            cx="8"
            cy="8"
            r="6"
            stroke="currentColor"
            strokeWidth="1.6"
          />
        </svg>
      );

    case 'circle-dot':
    case 'started':
    case 'in_progress':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={cn('shrink-0', className)}
          style={{ color: resolvedColor }}
        >
          <circle
            cx="8"
            cy="8"
            r="6"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <circle
            cx="8"
            cy="8"
            r="2.75"
            fill="currentColor"
          />
        </svg>
      );

    case 'check-circle':
    case 'completed':
    case 'done':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={cn('shrink-0', className)}
        >
          <circle
            cx="8"
            cy="8"
            r="6.5"
            fill={resolvedColor}
          />
          <path
            d="M5.25 8.25L7.25 10.25L10.75 6.25"
            stroke="white"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );

    case 'x-circle':
    case 'cancelled':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={cn('shrink-0', className)}
        >
          <circle
            cx="8"
            cy="8"
            r="6.5"
            fill={resolvedColor}
          />
          <path
            d="M5.75 5.75L10.25 10.25M10.25 5.75L5.75 10.25"
            stroke="white"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      );

    default:
      return (
        <span
          className={cn('rounded-full shrink-0 inline-block', className)}
          style={{
            width: size,
            height: size,
            backgroundColor: resolvedColor,
          }}
        />
      );
  }
}

function getDefaultIconForGroup(group: string): string {
  switch (group) {
    case 'backlog':
      return 'circle-dashed';
    case 'unstarted':
      return 'circle';
    case 'started':
      return 'circle-dot';
    case 'completed':
      return 'check-circle';
    case 'cancelled':
      return 'x-circle';
    default:
      return 'circle';
  }
}

function getDefaultColorForIcon(icon: string): string {
  switch (icon) {
    case 'circle-dashed':
    case 'backlog':
      return '#8A9093';
    case 'circle':
    case 'unstarted':
    case 'todo':
      return '#525866';
    case 'circle-dot':
    case 'started':
    case 'in_progress':
      return '#EAB308';
    case 'check-circle':
    case 'completed':
    case 'done':
      return '#10B981';
    case 'x-circle':
    case 'cancelled':
      return '#EF4444';
    default:
      return '#8A9093';
  }
}

export default StateIcon;
