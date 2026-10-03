import * as React from 'react';
import { BookOpen, type LucideProps } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

export interface LibraryIconProps extends LucideProps {}

/**
 * LibraryIcon - Academic Research Knowledge Base & Papers
 * Consistent with Lucide icon design system matching Storage (Database) and Settings.
 */
export function LibraryIcon({
  className,
  size = 24,
  ...props
}: LibraryIconProps) {
  return (
    <BookOpen
      size={size}
      className={cn('size-4 shrink-0 text-current', className)}
      {...props}
    />
  );
}

export const LibrarySpaceIcon = LibraryIcon;
export const CosmicLibraryIcon = LibraryIcon;
export default LibraryIcon;
