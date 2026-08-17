import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/shared/lib/utils';
import { PenLine, Search, Columns3, AlignJustify, Plus } from 'lucide-react';
import { Button, Input, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui';

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
      className="flex items-center justify-between border-b border-border/50 bg-background/80 px-6 h-14 backdrop-blur-md sticky top-0 z-10 shrink-0"
      style={{ paddingLeft: "max(1.5rem, var(--header-offset, 0px))" }}
    >
      <div className="flex items-center gap-2">
        <PenLine className="size-4 text-foreground/80" />
        <h1 className="text-sm font-semibold tracking-tight text-foreground transition-colors duration-200">All pages</h1>
      </div>
      <div className="flex items-center gap-4">
        {/* Search */}
        <div
          className={cn(
            "relative flex items-center transition-all duration-300 ease-in-out h-8 rounded-lg overflow-hidden group",
            isSearchExpanded || searchQuery ? "w-64 border border-border/50 bg-background" : "w-8 hover:bg-secondary/80 cursor-pointer"
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
              "h-full text-[13px] py-0 leading-none border-none bg-transparent focus-visible:ring-0 shadow-none w-full placeholder:text-muted-foreground/50 transition-opacity duration-200 pl-8 pr-8",
              isSearchExpanded || searchQuery ? "opacity-100" : "opacity-0 pointer-events-none"
            )}
            autoFocus={isSearchExpanded}
          />
          {(isSearchExpanded || searchQuery) && (
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleClearSearch}
              className="absolute right-2.5 text-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <Plus className="size-3.5 rotate-45 text-foreground" />
            </button>
          )}
        </div>

        {/* View Toggle */}
        <TooltipProvider delayDuration={150}>
          <div className="flex items-center bg-muted p-1 rounded-lg">
            {(['grid', 'list'] as const).map((v) => (
              <Tooltip key={v}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setViewMode(v)}
                    className={cn(
                      "relative p-1.5 rounded-md transition-colors cursor-pointer outline-none",
                      viewMode === v
                        ? "text-foreground"
                        : "text-foreground/70 hover:text-foreground hover:bg-muted/50"
                    )}
                    aria-label={`${v === 'grid' ? 'Grid' : 'List'} view`}
                  >
                    {viewMode === v && (
                      <motion.div
                        layoutId="allpages-view-toggle"
                        className="absolute inset-0 bg-black/10 dark:bg-white/10 rounded-md"
                        transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
                      />
                    )}
                    <span className="relative z-10 flex">
                      {v === 'grid' && <Columns3 className="size-4 text-foreground" strokeWidth={2.5} />}
                      {v === 'list' && <AlignJustify className="size-4 text-foreground" strokeWidth={2.5} />}
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
          <Plus className="size-3.5 text-primary-foreground" />
          New
        </Button>
      </div>
    </header>
  );
}
