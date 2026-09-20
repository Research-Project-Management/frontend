import * as React from 'react';
import { Database } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

export interface StorageIconProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
  size?: number | string;
}

/**
 * StorageIcon - Academic Research Data Repository (Ngân hàng Dữ liệu & Lưu trữ Nghiên cứu)
 */
export function StorageIcon({
  className,
  size = 24,
  ...props
}: StorageIconProps) {
  return (
    <Database
      size={size}
      className={cn('size-4 shrink-0 text-current', className)}
      {...props}
    />
  );
}

export const CloudStorageIcon = StorageIcon;
export const DatabaseStorageIcon = StorageIcon;
export default StorageIcon;

