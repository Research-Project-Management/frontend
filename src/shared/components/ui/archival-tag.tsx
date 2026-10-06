'use client';

import * as React from 'react';
import { cn } from '@/shared/lib/utils';
import { toast } from 'sonner';

export interface ArchivalTagProps extends React.HTMLAttributes<HTMLSpanElement> {
  value: string;
  type?: 'doi' | 'arxiv' | 'bibtex' | 'isbn' | 'generic';
  copyable?: boolean;
  href?: string;
  className?: string;
}

/**
 * ArchivalTag
 *
 * Implements The Archival Identifier Rule from DESIGN.md:
 * - Font: IBM Plex Mono (var(--font-ibm-plex-mono))
 * - Size: 11px (text-11)
 * - Background: #FAFAF9 (App Surface) / dark: #1A1A22 (Paper Canvas Dark)
 * - Border: 0.5px solid #E4E4E4 / dark: #2D2D31
 * - Color: #595959 / dark: #8A8A8E
 * - Padding: 1px 4px (px-1 py-px)
 * - Radius: 3px (rounded-[3px])
 * - No accent colors (blue/purple forbidden for archival codes)
 */
export function ArchivalTag({
  value,
  type = 'generic',
  copyable = true,
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
    'bg-[#FAFAF9] dark:bg-[#1A1A22]',
    'border border-[#E4E4E4] dark:border-[#2D2D31]',
    'text-[#595959] dark:text-[#8A8A8E]',
    'px-1 py-[1px] rounded-[3px] tracking-normal',
    copyable && 'cursor-pointer hover:border-border transition-colors',
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
