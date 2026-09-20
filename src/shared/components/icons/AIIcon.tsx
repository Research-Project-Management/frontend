import * as React from 'react';
import { BrainCircuit } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

export interface AIIconProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
  size?: number | string;
}

/**
 * AIIcon - BrainCircuit (Bộ não và Điện tử / Vi mạch Nơ-ron)
 * 
 * Biểu tượng chuẩn mực theo đúng yêu cầu của người dùng:
 * - Kết hợp giữa Bộ não nhận thức học thuật và Mạch vi điện tử nơ-ron (Brain + Circuit).
 * - Nghiêm túc, hàn lâm, hiện đại và đồng bộ tuyệt đối với Layers (Projects).
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




