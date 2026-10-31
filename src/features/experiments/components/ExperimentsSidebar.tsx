'use client';

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Search,
  X,
  FolderPlus,
  PanelLeft,
  FlaskConical,
  ChevronRight,
  Activity,
  GitCompare,
  Folder,
  Database,
  Table2,
  Box,
  FileCode2,
  Trash2,
  SlidersHorizontal,
  ClipboardCheck,
  Container,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/shared/lib/utils';
import { Input } from '@/shared/components/ui/input';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';
import { usePanelResize } from '@/features/library/ui/hooks/usePanelResize';
import { SidebarResizer } from '@/features/library/ui/sidebar/SidebarResizer';
import {
  useExperimentsUIStore,
  type ExperimentsViewId,
} from '../store/experiments-ui.store';

export function ExperimentsSidebar() {
  const activeView = useExperimentsUIStore((s) => s.activeView);
  const setActiveView = useExperimentsUIStore((s) => s.setActiveView);
  const isSidebarOpen = useExperimentsUIStore((s) => s.isSidebarOpen);
  const setSidebarOpen = useExperimentsUIStore((s) => s.setSidebarOpen);
  const sidebarWidth = useExperimentsUIStore((s) => s.sidebarWidth);
  const setSidebarWidth = useExperimentsUIStore((s) => s.setSidebarWidth);
  const toggleSidebar = useExperimentsUIStore((s) => s.toggleSidebar);
  const searchQuery = useExperimentsUIStore((s) => s.sidebarSearchQuery);
  const setSearchQuery = useExperimentsUIStore((s) => s.setSidebarSearchQuery);
  const groups = useExperimentsUIStore((s) => s.groups);
  const runs = useExperimentsUIStore((s) => s.runs);
  const datasets = useExperimentsUIStore((s) => s.datasets);
  const checkpoints = useExperimentsUIStore((s) => s.checkpoints);
  const protocols = useExperimentsUIStore((s) => s.protocols);
  const sweep = useExperimentsUIStore((s) => s.sweep);
  const addExperimentGroup = useExperimentsUIStore((s) => s.addExperimentGroup);

  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [isExperimentsExpanded, setIsExperimentsExpanded] = useState(true);
  const [isProtocolsExpanded, setIsProtocolsExpanded] = useState(true);
  const [isDatasetsExpanded, setIsDatasetsExpanded] = useState(true);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [isMounted, setIsMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    if (typeof window !== 'undefined') {
      const mql = window.matchMedia('(max-width: 767px)');
      setIsMobile(mql.matches);
      const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
      mql.addEventListener('change', handler);
      return () => mql.removeEventListener('change', handler);
    }
  }, []);

  const { isDragging, handleMouseDown } = usePanelResize({
    width: sidebarWidth,
    setWidth: setSidebarWidth,
    direction: 'right',
    minWidth: 200,
    maxWidth: 400,
  });

  if (!isSidebarOpen) {
    return null;
  }

  const activeRuns = runs.filter((r) => !r.isDeleted);
  const trashedRuns = runs.filter((r) => r.isDeleted);

  const q = searchQuery.trim().toLowerCase();
  const filteredGroups = q
    ? groups.filter((g) => g.name.toLowerCase().includes(q))
    : groups;

  const handleSelectView = (view: ExperimentsViewId) => {
    setActiveView(view);
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

  const handleCreateNewExperiment = () => {
    const nextNum = groups.length + 1;
    const code = `EXP-0${nextNum}`;
    const newId = `exp-0${nextNum}` as ExperimentsViewId;
    addExperimentGroup({
      id: newId,
      code,
      name: `${code}: New Study Group`,
      hypothesis: 'Formulate hypothesis and link target dataset version.',
      runsCount: 0,
    });
    setActiveView(newId);
    toast.success(`Created ${code}: New Study Group`);
  };

  const sidebarBody = (
    <>
      {/* Topbar Header matching the h-11 of LibrarySidebar & SidebarHeader */}
      <div className="h-11 px-2.5 flex items-center shrink-0">
        <div
          className={cn(
            'flex items-center h-8 font-semibold text-sm tracking-tight text-foreground select-none w-full',
            isSearchExpanded || searchQuery ? 'px-0' : 'justify-between px-1',
          )}
        >
          {isSearchExpanded || searchQuery ? (
            <div className="relative flex items-center w-full h-8 rounded-md border border-border bg-background overflow-hidden font-normal text-13">
              <Search
                className="absolute top-1/2 -translate-y-1/2 size-3.5 z-10 left-2.5 translate-x-0 text-muted-foreground pointer-events-none shrink-0"
                strokeWidth={1.5}
              />
              <Input
                ref={searchInputRef}
                autoFocus
                placeholder="Search experiments..."
                aria-label="Search experiments"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setSearchQuery('');
                    setIsSearchExpanded(false);
                  }
                }}
                onBlur={() => {
                  if (!searchQuery) {
                    setIsSearchExpanded(false);
                  }
                }}
                className="h-full text-13 font-normal tracking-tight py-0 leading-none border-none bg-transparent focus-visible:ring-0 focus-visible:border-none focus-visible:outline-none focus:outline-none outline-none shadow-none w-full placeholder:text-muted-foreground placeholder:font-normal pl-8 pr-7 text-foreground"
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSearchQuery('');
                      setIsSearchExpanded(false);
                    }}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center justify-center size-5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer rounded-md outline-none focus-visible:ring-1 focus-visible:ring-ring before:absolute before:-inset-2 md:before:hidden"
                    aria-label="Clear search"
                  >
                    <X className="size-3 shrink-0" strokeWidth={1.5} />
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="bottom"
                  align="start"
                  sideOffset={6}
                  alignOffset={2}
                >
                  Clear search
                </TooltipContent>
              </Tooltip>
            </div>
          ) : (
            <>
              <span className="shrink-0 font-semibold text-15 tracking-tight text-foreground">
                Lab
              </span>

              <div className="flex items-center gap-0.5 shrink-0">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => {
                        setIsSearchExpanded(true);
                        setTimeout(() => searchInputRef.current?.focus(), 50);
                      }}
                      className="rounded-md p-1.5 text-foreground hover:bg-muted cursor-pointer transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary relative before:absolute before:-inset-1.5 md:before:hidden"
                      aria-label="Search experiments"
                    >
                      <Search
                        className="size-4 shrink-0 text-foreground"
                        strokeWidth={1.5}
                      />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent
                    side="bottom"
                    align="start"
                    sideOffset={6}
                    alignOffset={2}
                  >
                    Search experiments
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={handleCreateNewExperiment}
                      className="rounded-md p-1.5 text-foreground hover:bg-muted cursor-pointer transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary relative before:absolute before:-inset-1.5 md:before:hidden"
                      aria-label="New experiment group"
                    >
                      <FolderPlus
                        className="size-4 shrink-0 text-foreground"
                        strokeWidth={1.5}
                      />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent
                    side="bottom"
                    align="start"
                    sideOffset={6}
                    alignOffset={2}
                  >
                    New experiment group
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={toggleSidebar}
                      aria-label="Toggle sidebar"
                      className="rounded-md p-1.5 text-foreground hover:bg-muted cursor-pointer transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary relative before:absolute before:-inset-1.5 md:before:hidden"
                    >
                      <PanelLeft
                        className="size-4 shrink-0 text-foreground"
                        strokeWidth={1.5}
                      />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent
                    side="bottom"
                    align="start"
                    sideOffset={6}
                    alignOffset={2}
                  >
                    Collapse sidebar
                  </TooltipContent>
                </Tooltip>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Upper Area: Navigation Tree matching LibrarySidebar spacing */}
      <div className="flex-1 min-h-0 flex flex-col p-2.5 pt-2.5 pb-1">
        <nav
          aria-label="Lab Navigation"
          className="flex-1 overflow-x-hidden overflow-y-auto flex flex-col gap-0.5 sidebar-scrollbar scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        >
          {/* 1. Root Section: Experiment Tracking */}
          <div className="relative group/root flex items-center w-full">
            <button
              type="button"
              onClick={() => handleSelectView('all-runs')}
              className={cn(
                'group/item relative flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-13 leading-5 transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary select-none pr-8 cursor-pointer text-left',
                activeView === 'all-runs'
                  ? 'bg-muted text-foreground font-medium'
                  : 'text-foreground hover:bg-muted group-hover/root:bg-muted font-normal',
              )}
            >
              <FlaskConical
                className="relative z-10 size-4 shrink-0 text-foreground"
                strokeWidth={1.5}
              />
              <span
                className={cn(
                  'relative z-10 min-w-0 truncate flex-1 tracking-tight text-foreground',
                  activeView === 'all-runs' ? 'font-medium' : 'font-normal',
                )}
              >
                Experiment Tracking
              </span>
            </button>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsExperimentsExpanded((v) => !v);
                  }}
                  aria-label={
                    isExperimentsExpanded
                      ? 'Collapse Experiment Tracking'
                      : 'Expand Experiment Tracking'
                  }
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 z-20 flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground border border-transparent hover:border-border/50 hover:bg-background cursor-pointer transition-colors duration-150 outline-none focus-visible:ring-1 focus-visible:ring-primary before:absolute before:-inset-2 md:before:hidden"
                >
                  <ChevronRight
                    className={cn(
                      'size-3.5 transition-transform duration-150 shrink-0',
                      isExperimentsExpanded && 'rotate-90',
                    )}
                    strokeWidth={1.5}
                  />
                </button>
              </TooltipTrigger>
              <TooltipContent
                side="bottom"
                align="start"
                sideOffset={6}
                alignOffset={2}
              >
                {isExperimentsExpanded ? 'Collapse' : 'Expand'}
              </TooltipContent>
            </Tooltip>
          </div>

          {isExperimentsExpanded && (
            <div className="flex flex-col gap-0.5 w-full">
              {/* All Runs */}
              <button
                type="button"
                onClick={() => handleSelectView('all-runs')}
                className={cn(
                  'relative flex h-8 w-full items-center gap-2.5 rounded-md pr-2.5 pl-6 text-13 leading-5 outline-none focus-visible:ring-1 focus-visible:ring-primary select-none cursor-pointer transition-colors text-left',
                  activeView === 'all-runs'
                    ? 'bg-muted text-foreground font-medium'
                    : 'text-foreground hover:bg-muted font-normal',
                )}
              >
                <Activity
                  className="size-4 shrink-0 text-foreground"
                  strokeWidth={1.5}
                />
                <span className="min-w-0 truncate flex-1 tracking-tight text-foreground">
                  All Runs
                </span>
                <span className="text-11 font-mono text-muted-foreground tabular-nums">
                  {activeRuns.length}
                </span>
              </button>

              {/* Compare Runs */}
              <button
                type="button"
                onClick={() => handleSelectView('compare-runs')}
                className={cn(
                  'relative flex h-8 w-full items-center gap-2.5 rounded-md pr-2.5 pl-6 text-13 leading-5 outline-none focus-visible:ring-1 focus-visible:ring-primary select-none cursor-pointer transition-colors text-left',
                  activeView === 'compare-runs'
                    ? 'bg-muted text-foreground font-medium'
                    : 'text-foreground hover:bg-muted font-normal',
                )}
              >
                <GitCompare
                  className="size-4 shrink-0 text-foreground"
                  strokeWidth={1.5}
                />
                <span className="min-w-0 truncate flex-1 tracking-tight text-foreground">
                  Compare Runs
                </span>
              </button>

              {/* Hyperparameter Sweeps */}
              <button
                type="button"
                onClick={() => handleSelectView('sweeps')}
                className={cn(
                  'relative flex h-8 w-full items-center gap-2.5 rounded-md pr-2.5 pl-6 text-13 leading-5 outline-none focus-visible:ring-1 focus-visible:ring-primary select-none cursor-pointer transition-colors text-left',
                  activeView === 'sweeps'
                    ? 'bg-muted text-foreground font-medium'
                    : 'text-foreground hover:bg-muted font-normal',
                )}
              >
                <SlidersHorizontal
                  className="size-4 shrink-0 text-foreground"
                  strokeWidth={1.5}
                />
                <span className="min-w-0 truncate flex-1 tracking-tight text-foreground">
                  Hyperparameter Sweeps
                </span>
                <span className="text-11 font-mono text-muted-foreground tabular-nums">
                  {sweep.totalTrials}
                </span>
              </button>

              {/* Individual Experiment Groups */}
              {filteredGroups.map((group) => {
                const count = activeRuns.filter(
                  (r) => r.experimentId === group.id,
                ).length;
                const isActive = activeView === group.id;
                return (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() =>
                      handleSelectView(group.id as ExperimentsViewId)
                    }
                    className={cn(
                      'relative flex h-8 w-full items-center gap-2.5 rounded-md pr-2.5 pl-6 text-13 leading-5 outline-none focus-visible:ring-1 focus-visible:ring-primary select-none cursor-pointer transition-colors text-left',
                      isActive
                        ? 'bg-muted text-foreground font-medium'
                        : 'text-foreground hover:bg-muted font-normal',
                    )}
                  >
                    <Folder
                      className="size-4 shrink-0 text-foreground"
                      strokeWidth={1.5}
                    />
                    <span className="min-w-0 truncate flex-1 tracking-tight text-foreground">
                      {group.name}
                    </span>
                    <span className="text-11 font-mono text-muted-foreground tabular-nums">
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* 2. Protocols & Reproducibility */}
          <div className="relative group/root flex items-center w-full">
            <button
              type="button"
              onClick={() => handleSelectView('protocols')}
              className={cn(
                'group/item relative flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-13 leading-5 transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary select-none pr-8 cursor-pointer text-left',
                activeView === 'protocols'
                  ? 'bg-muted text-foreground font-medium'
                  : 'text-foreground hover:bg-muted group-hover/root:bg-muted font-normal',
              )}
            >
              <ClipboardCheck
                className="relative z-10 size-4 shrink-0 text-foreground"
                strokeWidth={1.5}
              />
              <span
                className={cn(
                  'relative z-10 min-w-0 truncate flex-1 tracking-tight text-foreground',
                  activeView === 'protocols' ? 'font-medium' : 'font-normal',
                )}
              >
                Protocols & Repro
              </span>
            </button>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsProtocolsExpanded((v) => !v);
                  }}
                  aria-label={
                    isProtocolsExpanded
                      ? 'Collapse Protocols & Repro'
                      : 'Expand Protocols & Repro'
                  }
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 z-20 flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground border border-transparent hover:border-border/50 hover:bg-background cursor-pointer transition-colors duration-150 outline-none focus-visible:ring-1 focus-visible:ring-primary before:absolute before:-inset-2 md:before:hidden"
                >
                  <ChevronRight
                    className={cn(
                      'size-3.5 transition-transform duration-150 shrink-0',
                      isProtocolsExpanded && 'rotate-90',
                    )}
                    strokeWidth={1.5}
                  />
                </button>
              </TooltipTrigger>
              <TooltipContent
                side="bottom"
                align="start"
                sideOffset={6}
                alignOffset={2}
              >
                {isProtocolsExpanded ? 'Collapse' : 'Expand'}
              </TooltipContent>
            </Tooltip>
          </div>

          {isProtocolsExpanded && (
            <div className="flex flex-col gap-0.5 w-full">
              <button
                type="button"
                onClick={() => handleSelectView('protocols')}
                className={cn(
                  'relative flex h-8 w-full items-center gap-2.5 rounded-md pr-2.5 pl-6 text-13 leading-5 outline-none focus-visible:ring-1 focus-visible:ring-primary select-none cursor-pointer transition-colors text-left',
                  activeView === 'protocols'
                    ? 'bg-muted text-foreground font-medium'
                    : 'text-foreground hover:bg-muted font-normal',
                )}
              >
                <ClipboardCheck
                  className="size-4 shrink-0 text-foreground"
                  strokeWidth={1.5}
                />
                <span className="min-w-0 truncate flex-1 tracking-tight text-foreground">
                  Protocols & SOPs
                </span>
                <span className="text-11 font-mono text-muted-foreground tabular-nums">
                  {protocols.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectView('reproducibility')}
                className={cn(
                  'relative flex h-8 w-full items-center gap-2.5 rounded-md pr-2.5 pl-6 text-13 leading-5 outline-none focus-visible:ring-1 focus-visible:ring-primary select-none cursor-pointer transition-colors text-left',
                  activeView === 'reproducibility'
                    ? 'bg-muted text-foreground font-medium'
                    : 'text-foreground hover:bg-muted font-normal',
                )}
              >
                <Container
                  className="size-4 shrink-0 text-foreground"
                  strokeWidth={1.5}
                />
                <span className="min-w-0 truncate flex-1 tracking-tight text-foreground">
                  Repro Capsule & DAG
                </span>
              </button>
            </div>
          )}

          {/* 3. Datasets & Registry Section */}
          <div className="relative group/root flex items-center w-full">
            <button
              type="button"
              onClick={() => handleSelectView('raw-corpus')}
              className={cn(
                'group/item relative flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-13 leading-5 transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary select-none pr-8 cursor-pointer text-left',
                activeView === 'raw-corpus'
                  ? 'bg-muted text-foreground font-medium'
                  : 'text-foreground hover:bg-muted group-hover/root:bg-muted font-normal',
              )}
            >
              <Database
                className="relative z-10 size-4 shrink-0 text-foreground"
                strokeWidth={1.5}
              />
              <span
                className={cn(
                  'relative z-10 min-w-0 truncate flex-1 tracking-tight text-foreground',
                  activeView === 'raw-corpus' ? 'font-medium' : 'font-normal',
                )}
              >
                Datasets & Registry
              </span>
            </button>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDatasetsExpanded((v) => !v);
                  }}
                  aria-label={
                    isDatasetsExpanded
                      ? 'Collapse Datasets & Registry'
                      : 'Expand Datasets & Registry'
                  }
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 z-20 flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground border border-transparent hover:border-border/50 hover:bg-background cursor-pointer transition-colors duration-150 outline-none focus-visible:ring-1 focus-visible:ring-primary before:absolute before:-inset-2 md:before:hidden"
                >
                  <ChevronRight
                    className={cn(
                      'size-3.5 transition-transform duration-150 shrink-0',
                      isDatasetsExpanded && 'rotate-90',
                    )}
                    strokeWidth={1.5}
                  />
                </button>
              </TooltipTrigger>
              <TooltipContent
                side="bottom"
                align="start"
                sideOffset={6}
                alignOffset={2}
              >
                {isDatasetsExpanded ? 'Collapse' : 'Expand'}
              </TooltipContent>
            </Tooltip>
          </div>

          {isDatasetsExpanded && (
            <div className="flex flex-col gap-0.5 w-full">
              <button
                type="button"
                onClick={() => handleSelectView('raw-corpus')}
                className={cn(
                  'relative flex h-8 w-full items-center gap-2.5 rounded-md pr-2.5 pl-6 text-13 leading-5 outline-none focus-visible:ring-1 focus-visible:ring-primary select-none cursor-pointer transition-colors text-left',
                  activeView === 'raw-corpus'
                    ? 'bg-muted text-foreground font-medium'
                    : 'text-foreground hover:bg-muted font-normal',
                )}
              >
                <Table2
                  className="size-4 shrink-0 text-foreground"
                  strokeWidth={1.5}
                />
                <span className="min-w-0 truncate flex-1 tracking-tight text-foreground">
                  Raw Corpus & Tables
                </span>
                <span className="text-11 font-mono text-muted-foreground tabular-nums">
                  {datasets.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectView('checkpoints')}
                className={cn(
                  'relative flex h-8 w-full items-center gap-2.5 rounded-md pr-2.5 pl-6 text-13 leading-5 outline-none focus-visible:ring-1 focus-visible:ring-primary select-none cursor-pointer transition-colors text-left',
                  activeView === 'checkpoints'
                    ? 'bg-muted text-foreground font-medium'
                    : 'text-foreground hover:bg-muted font-normal',
                )}
              >
                <Box
                  className="size-4 shrink-0 text-foreground"
                  strokeWidth={1.5}
                />
                <span className="min-w-0 truncate flex-1 tracking-tight text-foreground">
                  Model Registry
                </span>
                <span className="text-11 font-mono text-muted-foreground tabular-nums">
                  {checkpoints.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectView('notebooks')}
                className={cn(
                  'relative flex h-8 w-full items-center gap-2.5 rounded-md pr-2.5 pl-6 text-13 leading-5 outline-none focus-visible:ring-1 focus-visible:ring-primary select-none cursor-pointer transition-colors text-left',
                  activeView === 'notebooks'
                    ? 'bg-muted text-foreground font-medium'
                    : 'text-foreground hover:bg-muted font-normal',
                )}
              >
                <FileCode2
                  className="size-4 shrink-0 text-foreground"
                  strokeWidth={1.5}
                />
                <span className="min-w-0 truncate flex-1 tracking-tight text-foreground">
                  Analysis Notebooks
                </span>
                <span className="text-11 font-mono text-muted-foreground tabular-nums">
                  4
                </span>
              </button>
            </div>
          )}

          {/* 4. System Navigation: Trash (root level matching SidebarSystemNav) */}
          <button
            type="button"
            onClick={() => handleSelectView('trash')}
            className={cn(
              'relative flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-13 leading-5 outline-none focus-visible:ring-1 focus-visible:ring-primary select-none cursor-pointer transition-colors text-left',
              activeView === 'trash'
                ? 'bg-muted text-foreground font-medium'
                : 'text-foreground hover:bg-muted font-normal',
            )}
          >
            <Trash2
              className="size-4 shrink-0 text-foreground"
              strokeWidth={1.5}
            />
            <span className="min-w-0 truncate flex-1 tracking-tight text-foreground">
              Trash
            </span>
            {trashedRuns.length > 0 && (
              <span className="text-11 font-mono text-muted-foreground tabular-nums">
                {trashedRuns.length}
              </span>
            )}
          </button>
        </nav>
      </div>

      {/* Drag Handle for Resizing */}
      <SidebarResizer
        width={sidebarWidth}
        setWidth={setSidebarWidth}
        isDragging={isDragging}
        onMouseDown={handleMouseDown}
      />
    </>
  );

  const mobileDrawer =
    isMobile && isMounted && typeof document !== 'undefined'
      ? createPortal(
          <div className="md:hidden">
            <div
              className="fixed inset-0 z-40 bg-black/50"
              onClick={() => setSidebarOpen(false)}
              aria-hidden="true"
            />
            <aside
              aria-label="Lab navigation"
              style={{
                width: `${sidebarWidth}px`,
                minWidth: '200px',
                maxWidth: '400px',
              }}
              className="fixed inset-y-0 left-0 z-50 h-full border-r border-border bg-background flex flex-col select-none shrink-0 shadow-raised-200"
            >
              {sidebarBody}
            </aside>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      {mobileDrawer}
      {!isMobile && (
        <aside
          aria-label="Lab navigation"
          style={{
            width: `${sidebarWidth}px`,
            minWidth: '200px',
            maxWidth: '400px',
          }}
          className="relative z-20 h-full border-r border-border bg-transparent flex flex-col select-none shrink-0"
        >
          {sidebarBody}
        </aside>
      )}
    </>
  );
}
export default ExperimentsSidebar;
