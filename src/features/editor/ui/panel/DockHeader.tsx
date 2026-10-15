'use client';

import React from 'react';
import {
  AlertCircle,
  Terminal,
  X,
  Copy,
  Check,
  Search,
  Trash2,
  WrapText,
  Loader2,
  Bot,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';

export interface DockHeaderProps {
  activeBottomTab: 'problems' | 'output';
  setActiveBottomTab: (tab: 'problems' | 'output') => void;
  errorCount: number;
  warningCount: number;
  compileStatus: string;
  compileLog: string | null;
  compileErrorsCount: number;
  filterSeverity: 'all' | 'error' | 'warning';
  setFilterSeverity: (val: 'all' | 'error' | 'warning') => void;
  searchFilter: string;
  setSearchFilter: (val: string) => void;
  onAutoFixFirst?: (e: React.MouseEvent) => void;
  showLogErrorsOnly: boolean;
  setShowLogErrorsOnly: React.Dispatch<React.SetStateAction<boolean>>;
  logSearch: string;
  setLogSearch: (val: string) => void;
  wrapLines: boolean;
  setWrapLines: React.Dispatch<React.SetStateAction<boolean>>;
  copied: boolean;
  onCopyLogs: () => void;
  onClearLogs: () => void;
  onClosePanel: () => void;
}

export function DockHeader({
  activeBottomTab,
  setActiveBottomTab,
  errorCount,
  warningCount,
  compileStatus,
  compileLog,
  compileErrorsCount,
  filterSeverity,
  setFilterSeverity,
  searchFilter,
  setSearchFilter,
  onAutoFixFirst,
  showLogErrorsOnly,
  setShowLogErrorsOnly,
  logSearch,
  setLogSearch,
  wrapLines,
  setWrapLines,
  copied,
  onCopyLogs,
  onClearLogs,
  onClosePanel,
}: DockHeaderProps) {
  return (
    <div className="h-9 shrink-0 flex items-center justify-between border-b border-border bg-surface px-2.5 overflow-x-auto overflow-y-hidden scrollbar-none gap-2">
      {/* Left Dock Tabs */}
      <div className="flex items-center h-full shrink-0">
        {/* Problems Tab */}
        <button
          type="button"
          role="tab"
          aria-selected={activeBottomTab === 'problems'}
          onClick={() => setActiveBottomTab('problems')}
          className={cn(
            'relative flex items-center gap-1.5 h-full px-3 text-xs font-medium cursor-pointer transition-colors border-r border-border/60 outline-none select-none',
            activeBottomTab === 'problems'
              ? 'text-foreground bg-canvas font-semibold after:absolute after:bottom-0 after:inset-x-0 after:h-0.5 after:bg-primary'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/40 font-medium'
          )}
        >
          <AlertCircle
            className={cn(
              'size-3.5 shrink-0 transition-colors',
              errorCount > 0 ? 'text-destructive' : 'text-foreground'
            )}
          />
          <span>Problems</span>
          {(errorCount > 0 || warningCount > 0) && (
            <span
              className={cn(
                'ml-1.5 px-1.5 py-0.5 rounded-full text-xs font-mono font-medium',
                errorCount > 0
                  ? 'bg-destructive/15 text-destructive'
                  : 'bg-warning/15 text-warning'
              )}
            >
              {errorCount + warningCount}
            </span>
          )}
        </button>

        {/* Compiler Output Tab */}
        <button
          type="button"
          role="tab"
          aria-selected={activeBottomTab === 'output'}
          onClick={() => setActiveBottomTab('output')}
          className={cn(
            'relative flex items-center gap-1.5 h-full px-3 text-xs font-medium cursor-pointer transition-colors border-r border-border/60 outline-none select-none',
            activeBottomTab === 'output'
              ? 'text-foreground bg-canvas font-semibold after:absolute after:bottom-0 after:inset-x-0 after:h-0.5 after:bg-primary'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/40 font-medium'
          )}
        >
          <Terminal className="size-3.5 shrink-0 text-foreground" />
          <span>Compiler Output</span>
          {compileStatus === 'compiling' ? (
            <Loader2 className="size-3 text-primary animate-spin ml-0.5 shrink-0" />
          ) : errorCount > 0 ? (
            <span className="size-1.5 rounded-full bg-destructive ml-0.5 shrink-0" />
          ) : compileLog ? (
            <span className="size-1.5 rounded-full bg-success/80 ml-0.5 shrink-0" />
          ) : null}
        </button>
      </div>

      {/* Right Toolbar Actions */}
      <div className="flex items-center gap-2 shrink-0">
        {/* ── TAB 1 CONTROLS: PROBLEMS ── */}
        {activeBottomTab === 'problems' && (
          <>
            {/* 1. Severity Filter (Desktop pills) with comfortable padding */}
            <div className="hidden sm:flex items-center p-1 gap-1 rounded-md bg-muted/40 border border-border/50 text-xs">
              <button
                type="button"
                onClick={() => setFilterSeverity('all')}
                className={cn(
                  'px-2.5 py-0.5 rounded-xs font-medium transition-colors cursor-pointer',
                  filterSeverity === 'all'
                    ? 'bg-canvas text-foreground border border-border/60 font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                All ({compileErrorsCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterSeverity('error')}
                className={cn(
                  'px-2.5 py-0.5 rounded-xs font-medium transition-colors cursor-pointer flex items-center gap-1',
                  filterSeverity === 'error'
                    ? 'bg-canvas text-destructive border border-border/60 font-semibold'
                    : 'text-muted-foreground hover:text-destructive'
                )}
              >
                <span className="size-1.5 rounded-full bg-destructive shrink-0" />
                <span>Errors ({errorCount})</span>
              </button>
              <button
                type="button"
                onClick={() => setFilterSeverity('warning')}
                className={cn(
                  'px-2.5 py-0.5 rounded-xs font-medium transition-colors cursor-pointer flex items-center gap-1',
                  filterSeverity === 'warning'
                    ? 'bg-canvas text-warning border border-border/60 font-semibold'
                    : 'text-muted-foreground hover:text-warning'
                )}
              >
                <span className="size-1.5 rounded-full bg-warning shrink-0" />
                <span>Warnings ({warningCount})</span>
              </button>
            </div>

            {/* 1-Click AI AutoFix Header Action */}
            {compileErrorsCount > 0 && onAutoFixFirst && (
              <button
                type="button"
                onClick={onAutoFixFirst}
                title="1-Click AI AutoFix for first error in workspace"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-sm text-xs font-medium bg-ai-subtle hover:bg-ai-subtle/80 text-ai border border-ai-border/40 transition-colors cursor-pointer"
              >
                <Bot className="size-3 shrink-0" />
                <span>AutoFix</span>
              </button>
            )}

            {/* Narrow screen select fallback */}
            <div className="flex sm:hidden items-center">
              <select
                value={filterSeverity}
                onChange={(e) => setFilterSeverity(e.target.value as 'all' | 'error' | 'warning')}
                className="bg-canvas border border-border/70 text-xs font-medium text-foreground rounded-md h-7 px-2 outline-none cursor-pointer"
              >
                <option value="all">All ({compileErrorsCount})</option>
                <option value="error">Errors ({errorCount})</option>
                <option value="warning">Warnings ({warningCount})</option>
              </select>
            </div>

            {/* 2. Search Filter Input */}
            <div className="flex items-center gap-1.5 px-2.5 h-7 rounded-md border border-border/70 bg-canvas text-xs w-28 sm:w-44 focus-within:ring-1 focus-within:ring-primary focus-within:border-primary transition-all">
              <Search className="size-3 text-muted-foreground shrink-0" />
              <input
                type="text"
                placeholder="Filter problems..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="bg-transparent border-none outline-none text-12 w-full text-foreground placeholder:text-muted-foreground/60 min-w-0"
              />
              {searchFilter && (
                <button
                  type="button"
                  onClick={() => setSearchFilter('')}
                  className="text-muted-foreground hover:text-foreground cursor-pointer shrink-0 relative after:absolute after:-inset-1.5 after:content-['']"
                  title="Clear search"
                >
                  <X className="size-3" />
                </button>
              )}
            </div>
          </>
        )}

        {/* ── TAB 2 CONTROLS: COMPILER OUTPUT ── */}
        {activeBottomTab === 'output' && (
          <>
            {/* 1. "Errors Only" Toggle Button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => setShowLogErrorsOnly((v) => !v)}
                  className={cn(
                    'flex size-6 items-center justify-center rounded-md transition-colors cursor-pointer shrink-0 relative after:absolute after:-inset-1.5 after:content-[\'\']',
                    showLogErrorsOnly
                      ? 'bg-destructive/15 text-destructive font-semibold'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                  )}
                  aria-label="Filter: Errors only"
                >
                  <AlertCircle className="size-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                {showLogErrorsOnly ? 'Showing errors only (Click to show all)' : 'Filter: Errors only'}
              </TooltipContent>
            </Tooltip>

            {/* 2. Search Filter Input */}
            <div className="flex items-center gap-1.5 px-2 h-6 rounded-md border border-border/70 bg-canvas text-12 w-28 sm:w-40 focus-within:ring-1 focus-within:ring-primary focus-within:border-primary transition-all">
              <Search className="size-3 text-muted-foreground shrink-0" />
              <input
                type="text"
                placeholder="Filter output..."
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                className="bg-transparent border-none outline-none text-12 w-full text-foreground placeholder:text-muted-foreground/60 min-w-0"
              />
              {logSearch && (
                <button
                  type="button"
                  onClick={() => setLogSearch('')}
                  className="text-muted-foreground hover:text-foreground cursor-pointer shrink-0 relative after:absolute after:-inset-1.5 after:content-['']"
                  title="Clear filter"
                >
                  <X className="size-3" />
                </button>
              )}
            </div>

            {/* Divider between Filter and Actions */}
            <div className="h-3.5 w-px bg-border/60 mx-0.5 shrink-0" />

            {/* 3. Word Wrap Toggle */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => setWrapLines((w) => !w)}
                  className={cn(
                    'flex size-6 items-center justify-center rounded-md transition-colors cursor-pointer shrink-0 relative after:absolute after:-inset-1.5 after:content-[\'\']',
                    wrapLines
                      ? 'text-primary bg-primary/10 hover:bg-primary/15'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                  )}
                  aria-label="Toggle word wrap"
                >
                  <WrapText className="size-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                {wrapLines ? 'Disable Word Wrap' : 'Enable Word Wrap (Alt+Z)'}
              </TooltipContent>
            </Tooltip>

            {/* 4. Copy Output */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onCopyLogs}
                  disabled={!compileLog}
                  className={cn(
                    'flex size-6 items-center justify-center rounded-md transition-colors cursor-pointer shrink-0 disabled:opacity-40 disabled:cursor-not-allowed relative after:absolute after:-inset-1.5 after:content-[\'\']',
                    copied
                      ? 'text-success bg-success/15'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                  )}
                  aria-label="Copy compiler output"
                >
                  {copied ? (
                    <Check className="size-3.5 text-success" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent>
                {copied ? 'Copied to clipboard!' : 'Copy Output to Clipboard'}
              </TooltipContent>
            </Tooltip>

            {/* 5. Clear Output */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onClearLogs}
                  disabled={!compileLog && compileErrorsCount === 0}
                  className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer shrink-0 disabled:opacity-40 disabled:cursor-not-allowed relative after:absolute after:-inset-1.5 after:content-[\'\']"
                  aria-label="Clear compiler output"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Clear Compiler Output</TooltipContent>
            </Tooltip>
          </>
        )}

        {/* ── Universal Close Dock Button ── */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onClosePanel}
              aria-label="Close bottom panel"
              className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer shrink-0 ml-1 relative after:absolute after:-inset-1.5 after:content-['']"
            >
              <X className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Close Panel (Ctrl+J)</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
