import * as React from 'react';
import { cn } from '@/shared/lib/utils';

export interface CycleIconProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
  size?: number | string;
}

export function CycleIcon({
  className,
  size = 16,
  ...props
}: CycleIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('size-3.5 shrink-0', className)}
      {...props}
    >
      <circle
        cx="8"
        cy="8"
        r="6.25"
        stroke="currentColor"
        strokeWidth="1.35"
        fill="none"
      />
      <path
        d="M 8 3.5 A 4.5 4.5 0 0 1 8 12.5 Z"
        fill="currentColor"
      />
    </svg>
  );
}

export default CycleIcon;
