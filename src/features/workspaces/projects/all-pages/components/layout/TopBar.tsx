import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/shared/lib/utils';
import { PenLine, Search, Columns3, AlignJustify, Plus } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip';

interface TopBarProps {
  viewMode: 'grid' | 'list';
  setViewMode: (mode: 'grid' | 'list') => void;
  onCreateClick: () => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

export function TopBar({ viewMode, setViewMode, onCreateClick, searchQuery = '', onSearchChange }: TopBarProps) {
  const [isSearchExpanded, setIsSearchExpanded] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const expandSearch = () => {
    setIsSearchExpanded(true);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const collapseSearch = (query: string) => {
    if (!query) setIsSearchExpanded(false);
  };

  const handleClearSearch = () => {
    onSearchChange?.('');
    setIsSearchExpanded(false);
  };

  return (
    <header
      className="flex items-center justify-between border-b border-border bg-background/80 px-4 h-12 backdrop-blur-md sticky top-0 z-10 shrink-0 select-none"
      style={{ paddingLeft: "max(1rem, var(--header-offset, 0px))" }}
    >
      <div className="flex items-center gap-2">
        <PenLine className="size-4 text-foreground shrink-0" />
        <h1 className="text-sm font-semibold tracking-tight text-foreground transition-colors duration-200">All pages</h1>
      </div>
      <div className="flex items-center gap-2">
        {/* Search */}
        <div
          className={cn(
            "relative flex items-center transition-all duration-300 ease-in-out h-8 rounded-md overflow-hidden group",
            isSearchExpanded || searchQuery ? "w-64 border border-border bg-background" : "w-8 hover:bg-muted cursor-pointer"
          )}
          onClick={!isSearchExpanded ? expandSearch : undefined}
        >
          <Search
            className={cn(
              "absolute top-1/2 -translate-y-1/2 size-3.5 transition-all duration-300 ease-in-out z-10 text-foreground",
              isSearchExpanded || searchQuery
                ? "left-2.5 translate-x-0"
                : "left-1/2 -translate-x-1/2"
            )}
          />
          <Input
            ref={inputRef}
            placeholder="Search pages..."
            value={searchQuery}
            onChange={(e) => onSearchChange?.(e.target.value)}
            onBlur={() => collapseSearch(searchQuery)}
            className={cn(
              "h-full text-sm py-0 leading-none border-none bg-transparent focus-visible:ring-0 shadow-none w-full placeholder:text-muted-foreground/50 transition-opacity duration-200 pl-8 pr-8",
              isSearchExpanded || searchQuery ? "opacity-100" : "opacity-0 pointer-events-none"
            )}
            autoFocus={isSearchExpanded}
          />
          {(isSearchExpanded || searchQuery) && (
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleClearSearch}
              className="absolute right-2.5 text-foreground transition-colors cursor-pointer"
            >
              <Plus className="size-3.5 rotate-45 text-foreground shrink-0" />
            </button>
          )}
        </div>

        {/* View Toggle */}
        <TooltipProvider delayDuration={150}>
          <div className="flex items-center bg-muted p-1 rounded-md">
            {(['grid', 'list'] as const).map((v) => (
              <Tooltip key={v}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setViewMode(v)}
                    className={cn(
                      "relative p-1.5 rounded-md transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary",
                      viewMode === v
                        ? "text-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    aria-label={`${v === 'grid' ? 'Grid' : 'List'} view`}
                  >
                    {viewMode === v && (
                      <motion.div
                        layoutId="allpages-view-toggle"
                        className="absolute inset-0 bg-background rounded-md shadow-xs"
                        transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
                      />
                    )}
                    <span className="relative z-10 flex">
                      {v === 'grid' && <Columns3 className="size-4 text-foreground shrink-0" strokeWidth={2.5} />}
                      {v === 'list' && <AlignJustify className="size-4 text-foreground shrink-0" strokeWidth={2.5} />}
                    </span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={6}>
                  {v === 'grid' ? 'Grid view' : 'List view'}
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </TooltipProvider>

        {/* Create Button */}
        <Button
          size="sm"
          className="h-8 gap-1.5 px-3 rounded-lg cursor-pointer"
          onClick={onCreateClick}
        >
          <Plus className="size-3.5 text-primary-foreground shrink-0" />
          New
        </Button>
      </div>
    </header>
  );
}
