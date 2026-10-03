'use client';

import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { PenLine, Search, X, Columns3, AlignJustify } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';
import { cn } from '@/shared/lib/utils';
import { Switcher } from '@/features/projects/project-id/components/layout/Switcher';

export interface TopbarProps {
  project?: {
    id?: string;
    name?: string;
    avatar?: string | null;
  };
  viewMode: 'grid' | 'list';
  setViewMode: (mode: 'grid' | 'list') => void;
  onCreateClick: () => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

const VIEW_OPTIONS = [
  { id: 'grid' as const, label: 'Grid view', icon: Columns3 },
  { id: 'list' as const, label: 'List view', icon: AlignJustify },
] as const;

export function Topbar({
  project,
  viewMode,
  setViewMode,
  onCreateClick,
  searchQuery = '',
  onSearchChange,
}: TopbarProps) {
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isSearching = isSearchExpanded || Boolean(searchQuery);

  return (
    <header
      className="flex items-center justify-between px-3 sm:px-4 h-11 border-b border-border bg-transparent sticky top-0 z-10 shrink-0 select-none overflow-x-auto scrollbar-none min-w-0"
      style={{ paddingLeft: 'max(1rem, var(--header-offset, 0px))' }}
    >
      {/* Left: Project Switcher & Module Title */}
      <Switcher
        project={project}
        moduleTitle="Pages"
        moduleIcon={PenLine}
      />

      {/* Right: Collapsible Search, Segmented View Switcher & Add Document CTA */}
      <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 ml-auto">
        {/* Collapsible Search matching Sticky Topbar style: default is an icon button, click to open */}
        <div
          role="search"
          tabIndex={isSearching ? -1 : 0}
          aria-label="Search pages"
          className={cn(
            'relative flex items-center transition-all duration-300 ease-in-out h-8 rounded-md overflow-hidden group focus-visible:ring-2 focus-visible:ring-ring',
            isSearching
              ? 'w-48 sm:w-64 border border-border bg-background'
              : 'w-8 hover:bg-muted cursor-pointer'
          )}
          onClick={() => {
            if (!isSearchExpanded) {
              setIsSearchExpanded(true);
              setTimeout(() => inputRef.current?.focus(), 50);
            }
          }}
          onKeyDown={(e) => {
            if (!isSearchExpanded && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault();
              setIsSearchExpanded(true);
              setTimeout(() => inputRef.current?.focus(), 50);
            }
          }}
        >
          <Search
            className={cn(
              'absolute top-1/2 -translate-y-1/2 size-3.5 transition-all duration-300 ease-in-out z-10 text-foreground shrink-0',
              isSearching ? 'left-2.5 translate-x-0' : 'left-1/2 -translate-x-1/2'
            )}
          />
          <Input
            ref={inputRef}
            placeholder="Search pages..."
            value={searchQuery}
            onChange={(e) => onSearchChange?.(e.target.value)}
            onBlur={() => !searchQuery && setIsSearchExpanded(false)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setIsSearchExpanded(false);
                onSearchChange?.('');
              }
            }}
            className={cn(
              'h-full text-xs py-0 leading-none border-none bg-transparent focus-visible:ring-0 shadow-none w-full placeholder:text-muted-foreground/60 transition-opacity duration-200 pl-8 pr-8 text-foreground',
              isSearching ? 'opacity-100' : 'opacity-0 pointer-events-none'
            )}
            autoFocus={isSearchExpanded}
          />
          {isSearching && (
            <button
              type="button"
              aria-label="Clear search"
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {
                e.stopPropagation();
                onSearchChange?.('');
                setIsSearchExpanded(false);
              }}
              className="absolute right-2 text-foreground/70 hover:text-foreground transition-colors cursor-pointer p-0.5 rounded-md"
            >
              <X className="size-3.5 text-foreground shrink-0" />
            </button>
          )}
        </div>

        {/* Segmented View Switcher matching Storage and Work-Items */}
        <TooltipProvider delayDuration={150}>
          <div
            role="tablist"
            aria-label="View mode"
            className="flex items-center bg-muted/70 p-0.5 rounded-md shrink-0 gap-0.5 h-8 border border-border/40"
          >
            {VIEW_OPTIONS.map((opt) => {
              const IconComp = opt.icon;
              const isSelected = viewMode === opt.id;
              return (
                <Tooltip key={opt.id}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={isSelected}
                      onClick={() => setViewMode(opt.id)}
                      className={cn(
                        'relative size-7 flex items-center justify-center rounded-md transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary',
                        isSelected
                          ? 'text-foreground font-medium'
                          : 'text-muted-foreground hover:text-foreground hover:bg-background/40'
                      )}
                      aria-label={opt.label}
                    >
                      {isSelected && (
                        <motion.div
                          layoutId="pages-view-toggle"
                          className="absolute inset-0 bg-background rounded-md border border-border/50"
                          transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }}
                        />
                      )}
                      <span className="relative z-10 flex items-center justify-center">
                        <IconComp className="size-4 shrink-0" strokeWidth={1.75} />
                      </span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent
                    side="bottom"
                    sideOffset={6}
                    className="text-11 px-2 py-0.5 rounded-md font-medium"
                  >
                    {opt.label}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </TooltipProvider>

        {/* Primary Action CTA */}
        <Button
          size="sm"
          onClick={onCreateClick}
          className="h-8 rounded-md px-3 text-xs font-medium cursor-pointer"
        >
          Add Document
        </Button>
      </div>
    </header>
  );
}

export const TopBar = Topbar;
export default Topbar;
