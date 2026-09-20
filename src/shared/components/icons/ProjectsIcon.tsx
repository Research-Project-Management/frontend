import * as React from 'react';
import { cn } from '@/shared/lib/utils';

import { Layers } from 'lucide-react';

export interface ProjectsIconProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
  size?: number | string;
}

/**
 * ProjectsIcon
 * Biểu tượng gốc ban đầu của Projects: Lucide Layers.
 */
export function ProjectsIcon({
  className,
  size = 24,
  ...props
}: ProjectsIconProps) {
  return (
    <Layers
      size={size}
      className={cn('size-4 shrink-0 text-current', className)}
      {...props}
    />
  );
}

export const ProjectIcon = ProjectsIcon;
export const ResearchNexusIcon = ProjectsIcon;
export default ProjectsIcon;
