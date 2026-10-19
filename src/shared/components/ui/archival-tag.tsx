'use client';

import * as React from 'react';
import { cn } from '@/shared/lib/utils';
import { toast } from 'sonner';

export interface ArchivalTagProps extends React.HTMLAttributes<HTMLSpanElement> {
  value: string;
  type?: 'doi' | 'arxiv' | 'bibtex' | 'isbn' | 'generic';
  copyable?: boolean;
  borderless?: boolean;
  href?: string;
  className?: string;
}

/**
 * ArchivalTag
 *
 * Implements The Archival Identifier Rule from DESIGN.md:
 * - Font: IBM Plex Mono (var(--font-ibm-plex-mono))
 * - Size: 11px (text-11)
 * - Color: #595959 / dark: #8A8A8E
 * - No accent colors (blue/purple forbidden for archival codes)
 */
export function ArchivalTag({
  value,
  type = 'generic',
  copyable = true,
  borderless = true,
  href,
  className,
  children,
  onClick,
  ...props
}: ArchivalTagProps) {
  const displayValue = children ?? value;

  const handleCopy = (e: React.MouseEvent<HTMLSpanElement>) => {
    if (onClick) {
      onClick(e);
      return;
    }
    if (!copyable) return;
    e.stopPropagation();
    navigator.clipboard?.writeText(value);
    toast.success(`Copied ${type.toUpperCase()}: ${value}`, {
      duration: 1500,
    });
  };

  const tagClasses = cn(
    'inline-flex items-center font-mono text-[11px] leading-tight select-all',
    'text-foreground tracking-normal',
    borderless
      ? 'bg-transparent border-0 p-0'
      : 'bg-muted/50 border border-border px-1 py-[1px] rounded-xs',
    copyable && 'cursor-pointer hover:underline transition-colors',
    className
  );

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className={cn(tagClasses, 'hover:underline')}
        title={`Open ${type.toUpperCase()}: ${value}`}
        {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
      >
        {displayValue}
      </a>
    );
  }

  return (
    <span
      className={tagClasses}
      onClick={handleCopy}
      title={copyable ? `Click to copy ${type.toUpperCase()}: ${value}` : undefined}
      {...props}
    >
      {displayValue}
    </span>
  );
}

export default ArchivalTag;
