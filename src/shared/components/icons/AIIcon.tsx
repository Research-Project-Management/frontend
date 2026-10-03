import * as React from 'react';
import { BrainCircuit } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

export interface AIIconProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
  size?: number | string;
}

/**
 * AIIcon - BrainCircuit (Scholarly Cognition & Neural Electronic Circuit)
 * 
 * Standardized icon:
 * - Combines academic cognitive intelligence with neural circuits (Brain + Circuit).
 * - Rigorous, scholarly, modern, and aligned with Layers (Projects).
 */
export function AIIcon({
  className,
  size = 24,
  ...props
}: AIIconProps) {
  return (
    <BrainCircuit
      size={size}
      className={cn('size-4 shrink-0 text-current', className)}
      {...props}
    />
  );
}

export const AiIcon = AIIcon;
export const BrainCircuitIcon = AIIcon;
export default AIIcon;




