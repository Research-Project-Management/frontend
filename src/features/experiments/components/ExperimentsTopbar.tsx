'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Check,
  ChevronRight,
  Folder,
  FlaskConical,
  Database,
  PanelLeft,
  PanelRight,
  Search,
  X,
  ChevronUp,
  ChevronDown,
  ArrowUpNarrowWide,
  ArrowDownNarrowWide,
  Activity,
  FileUp,
  FolderPlus,
  Download,
  Trash2,
  ClipboardCheck,
  Table2,
  LineChart,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Checkbox } from '@/shared/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/shared/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';
import { FilterFunnelIcon } from '@/shared/components/icons';
import {
  useExperimentsUIStore,
  type ExperimentsViewId,
  type ExperimentsDisplayOptions,
} from '../store/experiments-ui.store';

const COLUMN_ITEMS: Array<{
  key: keyof ExperimentsDisplayOptions['columns'];
  label: string;
}> = [
  { key: 'status', label: 'Status' },
  { key: 'model', label: 'Model' },
  { key: 'dataset', label: 'Dataset' },
  { key: 'f1', label: 'F1 Score' },
  { key: 'bleu', label: 'BLEU' },
  { key: 'loss', label: 'Eval Loss' },
  { key: 'duration', label: 'Duration' },
  { key: 'updatedAt', label: 'Created' },
];

const ORDER_BY_OPTIONS: Array<{
  value: ExperimentsDisplayOptions['orderBy'];
  label: string;
}> = [
  { value: 'id', label: 'Run ID' },
  { value: 'f1', label: 'F1 Score' },
  { value: 'bleu', label: 'BLEU Score' },
  { value: 'loss', label: 'Eval Loss' },
  { value: 'updatedAt', label: 'Date Created' },
];

export function ExperimentsTopbar() {
  const activeView = useExperimentsUIStore((s) => s.activeView);
  const setActiveView = useExperimentsUIStore((s) => s.setActiveView);
  const subMode = useExperimentsUIStore((s) => s.subMode);
  const setSubMode = useExperimentsUIStore((s) => s.setSubMode);
  const isSidebarOpen = useExperimentsUIStore((s) => s.isSidebarOpen);
  const toggleSidebar = useExperimentsUIStore((s) => s.toggleSidebar);
  const isInspectorOpen = useExperimentsUIStore((s) => s.isInspectorOpen);
  const toggleInspector = useExperimentsUIStore((s) => s.toggleInspector);
  const searchQuery = useExperimentsUIStore((s) => s.topbarSearchQuery);
  const setSearchQuery = useExperimentsUIStore((s) => s.setTopbarSearchQuery);
  const statusFilter = useExperimentsUIStore((s) => s.statusFilter);
  const setStatusFilter = useExperimentsUIStore((s) => s.setStatusFilter);
  const deviceFilter = useExperimentsUIStore((s) => s.deviceFilter);
  const setDeviceFilter = useExperimentsUIStore((s) => s.setDeviceFilter);
  const displayOptions = useExperimentsUIStore((s) => s.displayOptions);
  const setDisplayOptions = useExperimentsUIStore((s) => s.setDisplayOptions);
  const groups = useExperimentsUIStore((s) => s.groups);
  const runs = useExperimentsUIStore((s) => s.runs);
  const emptyTrash = useExperimentsUIStore((s) => s.emptyTrash);
  const addExperimentGroup = useExperimentsUIStore((s) => s.addExperimentGroup);
  const setLogRunModalOpen = useExperimentsUIStore((s) => s.setLogRunModalOpen);
  const setLatexModalOpen = useExperimentsUIStore((s) => s.setLatexModalOpen);

  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [switcherQuery, setSwitcherQuery] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [displayOpen, setDisplayOpen] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(true);
  const [orderByOpen, setOrderByOpen] = useState(true);

  const activeSearch = isSearchExpanded || Boolean(searchQuery);

  useEffect(() => {
    if (isSearchExpanded) {
      const t = setTimeout(() => searchInputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [isSearchExpanded]);

  const activeFilterCount = (statusFilter ? 1 : 0) + (deviceFilter ? 1 : 0);

  const currentGroup = groups.find((g) => g.id === activeView);
  const isRunsView = Boolean(currentGroup) || activeView === 'all-runs';
  const isTrash = activeView === 'trash';
  const trashCount = runs.filter((r) => r.isDeleted).length;

  const getViewInfo = () => {
    if (currentGroup) {
      return {
        rootLabel: 'Lab',
        RootIcon: FlaskConical,
        leafLabel: currentGroup.name,
        hasSwitcher: true,
      };
    }
    switch (activeView) {
      case 'all-runs':
        return {
          rootLabel: 'Lab',
          RootIcon: FlaskConical,
          leafLabel: 'All Runs',
          hasSwitcher: false,
        };
      case 'compare-runs':
        return {
          rootLabel: 'Lab',
          RootIcon: FlaskConical,
          leafLabel: 'Compare Runs',
          hasSwitcher: false,
        };
      case 'sweeps':
        return {
          rootLabel: 'Lab',
          RootIcon: FlaskConical,
          leafLabel: 'Hyperparameter Sweeps',
          hasSwitcher: false,
        };
      case 'protocols':
        return {
          rootLabel: 'Protocols & Repro',
          RootIcon: ClipboardCheck,
          leafLabel: 'Protocols & SOPs',
          hasSwitcher: false,
        };
      case 'reproducibility':
        return {
          rootLabel: 'Protocols & Repro',
          RootIcon: ClipboardCheck,
          leafLabel: 'Repro Capsule & DAG',
          hasSwitcher: false,
        };
      case 'raw-corpus':
        return {
          rootLabel: 'Datasets & Registry',
          RootIcon: Database,
          leafLabel: 'Raw Corpus & Tables',
          hasSwitcher: false,
        };
      case 'checkpoints':
        return {
          rootLabel: 'Datasets & Registry',
          RootIcon: Database,
          leafLabel: 'Model Registry',
          hasSwitcher: false,
        };
      case 'notebooks':
        return {
          rootLabel: 'Datasets & Registry',
          RootIcon: Database,
          leafLabel: 'Analysis Notebooks',
          hasSwitcher: false,
        };
      case 'trash':
        return {
          rootLabel: 'Lab',
          RootIcon: Trash2,
          leafLabel: 'Trash',
          hasSwitcher: false,
        };
      default:
        return {
          rootLabel: 'Lab',
          RootIcon: FlaskConical,
          leafLabel: 'All Runs',
          hasSwitcher: false,
        };
    }
  };

  const { rootLabel, RootIcon, leafLabel, hasSwitcher } = getViewInfo();

  const filteredGroups = switcherQuery.trim()
    ? groups.filter((g) =>
        g.name.toLowerCase().includes(switcherQuery.trim().toLowerCase()),
      )
    : groups;

  return (
    <header
      className="flex items-center justify-between border-b border-border bg-transparent px-3 sm:px-4 h-11 sticky top-0 z-10 shrink-0 select-none overflow-x-auto scrollbar-none min-w-0"
      style={{ paddingLeft: 'max(0.75rem, var(--header-offset, 0px))' }}
    >
      {/* Left Section: Sidebar Toggle + Breadcrumbs */}
      <div className="flex items-center gap-2.5 min-w-0 shrink-0 mr-2">
        {!isSidebarOpen && (
          <div className="flex items-center gap-1.5 -ml-1 mr-0.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={toggleSidebar}
                  className="relative size-8 rounded-md text-foreground hover:bg-muted cursor-pointer transition-colors select-none shrink-0 before:absolute before:-inset-1.5 md:before:hidden"
                  aria-label="Expand sidebar"
                >
                  <PanelLeft
                    className="size-4 text-foreground shrink-0"
                    strokeWidth={1.5}
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" align="start" sideOffset={6}>
                Expand sidebar
              </TooltipContent>
            </Tooltip>
            <div className="h-4 w-px bg-border shrink-0" aria-hidden="true" />
          </div>
        )}

        <nav
          aria-label="Breadcrumbs"
          className="flex items-center gap-1 sm:gap-1.5 min-w-0 overflow-hidden"
        >
          <button
            type="button"
            onClick={() =>
              setActiveView(
                rootLabel === 'Datasets & Registry'
                  ? 'raw-corpus'
                  : rootLabel === 'Protocols & Repro'
                    ? 'protocols'
                    : 'all-runs',
              )
            }
            className="flex items-center gap-1.5 h-7 px-1.5 rounded-md text-13 font-medium text-foreground hover:bg-muted transition-colors cursor-pointer outline-none shrink-0 select-none focus-visible:ring-1 focus-visible:ring-primary"
          >
            <RootIcon
              className="size-4 shrink-0 text-foreground"
              strokeWidth={1.5}
            />
            <span className="text-13 tracking-tight truncate max-w-[140px] sm:max-w-[180px] font-medium text-foreground">
              {rootLabel}
            </span>
          </button>

          {hasSwitcher ? (
            <DropdownMenu
              open={switcherOpen}
              onOpenChange={(next) => {
                setSwitcherOpen(next);
                if (!next) setSwitcherQuery('');
              }}
            >
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="group/chevron flex size-6 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted data-[state=open]:bg-muted data-[state=open]:text-foreground transition-colors cursor-pointer outline-none shrink-0 focus-visible:ring-1 focus-visible:ring-primary"
                  aria-label="Switch experiment group"
                >
                  <ChevronRight
                    className="size-3.5 shrink-0 transition-transform duration-150 group-data-[state=open]/chevron:rotate-90"
                    strokeWidth={1.5}
                  />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="bottom"
                align="start"
                sideOffset={4}
                collisionPadding={12}
                onCloseAutoFocus={(e) => e.preventDefault()}
                className="w-64 p-1.5 rounded-md border border-border bg-popover text-popover-foreground z-50 shadow-raised-200 select-none"
              >
                <div
                  className="flex items-center gap-2 px-2 h-8 mb-1 rounded-md bg-muted/60 border border-border/60"
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  <Search
                    className="size-3.5 text-muted-foreground shrink-0"
                    strokeWidth={1.5}
                  />
                  <input
                    type="text"
                    value={switcherQuery}
                    onChange={(e) => setSwitcherQuery(e.target.value)}
                    placeholder="Find experiment..."
                    aria-label="Find experiment"
                    className="w-full bg-transparent text-12 text-foreground placeholder:text-muted-foreground outline-none border-none"
                  />
                </div>
                <div className="max-h-60 overflow-y-auto space-y-0.5 scrollbar-none">
                  {filteredGroups.map((grp) => {
                    const isActive = grp.id === activeView;
                    return (
                      <DropdownMenuItem
                        key={grp.id}
                        onClick={() => {
                          setActiveView(grp.id as ExperimentsViewId);
                          setSwitcherOpen(false);
                        }}
                        className={cn(
                          'h-8 gap-2.5 px-2.5 text-13 whitespace-nowrap cursor-pointer rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors flex items-center justify-between',
                          isActive
                            ? 'font-medium text-foreground bg-muted/60'
                            : 'font-normal text-foreground',
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <Folder
                            className="size-3.5 shrink-0 text-foreground"
                            strokeWidth={1.5}
                          />
                          <span className="truncate">{grp.name}</span>
                        </div>
                        {isActive && (
                          <Check
                            className="size-3.5 shrink-0 text-foreground"
                            strokeWidth={1.5}
                          />
                        )}
                      </DropdownMenuItem>
                    );
                  })}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <ChevronRight
              className="size-3.5 text-foreground shrink-0"
              strokeWidth={1.5}
            />
          )}

          <div className="flex items-center gap-2 h-7 px-1 min-w-0 select-none shrink-0">
            <span className="text-13 font-medium tracking-tight text-foreground truncate max-w-[200px] sm:max-w-[320px]">
              {leafLabel}
            </span>
          </div>
        </nav>
      </div>

      {/* Right Section: SubMode Toggle + Search + Filter + Display + New/Empty Trash + Inspector Toggle */}
      <div className="flex items-center gap-2 shrink-0">
        {isRunsView && (
          <div className="hidden sm:flex items-center h-8 p-0.5 rounded-md border border-border bg-muted/40">
            <button
              type="button"
              onClick={() => setSubMode('table')}
              className={cn(
                'h-full px-2 rounded-xs inline-flex items-center gap-1.5 text-12 transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary',
                subMode === 'table'
                  ? 'bg-background text-foreground font-medium shadow-xs'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Table2 className="size-3.5 shrink-0" strokeWidth={1.5} />
              <span>Table</span>
            </button>
            <button
              type="button"
              onClick={() => setSubMode('charts')}
              className={cn(
                'h-full px-2 rounded-xs inline-flex items-center gap-1.5 text-12 transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary',
                subMode === 'charts'
                  ? 'bg-background text-foreground font-medium shadow-xs'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <LineChart className="size-3.5 shrink-0" strokeWidth={1.5} />
              <span>Charts</span>
            </button>
          </div>
        )}

        {/* Search Input matching TopbarSearch */}
        <div
          role="search"
          tabIndex={activeSearch ? -1 : 0}
          aria-label="Search runs, models, datasets..."
          className={cn(
            'relative flex items-center transition-colors duration-150 h-8 rounded-md group focus-visible:ring-1 focus-visible:ring-ring select-none',
            activeSearch
              ? 'w-48 sm:w-60 border border-border bg-background hover:border-border-hover overflow-hidden'
              : 'w-8 hover:bg-muted cursor-pointer before:absolute before:-inset-1.5 md:before:hidden',
          )}
          onClick={() => {
            if (!isSearchExpanded) setIsSearchExpanded(true);
          }}
          onKeyDown={(e) => {
            if (!isSearchExpanded && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault();
              setIsSearchExpanded(true);
            }
          }}
        >
          <Search
            strokeWidth={1.5}
            className={cn(
              'size-3.5 shrink-0 z-10 transition-colors duration-150',
              activeSearch
                ? 'absolute left-2.5 top-1/2 -translate-y-1/2 text-foreground'
                : 'absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-muted-foreground group-hover:text-foreground',
            )}
          />
          <Input
            ref={searchInputRef}
            placeholder="Search runs, models, sha..."
            aria-label="Search runs, models, sha..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onBlur={() => {
              if (!searchQuery) setIsSearchExpanded(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setSearchQuery('');
                setIsSearchExpanded(false);
              }
            }}
            className={cn(
              'h-full text-13 font-normal tracking-tight py-0 leading-none border-none bg-transparent focus-visible:ring-0 shadow-none w-full placeholder:text-muted-foreground transition-opacity duration-200 pl-8 pr-6 text-foreground',
              activeSearch ? 'opacity-100' : 'opacity-0 pointer-events-none',
            )}
          />
          {activeSearch && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {
                e.stopPropagation();
                setSearchQuery('');
                setIsSearchExpanded(false);
              }}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center justify-center size-5 text-foreground hover:opacity-80 hover:bg-muted transition-colors cursor-pointer rounded-md outline-none before:absolute before:-inset-1.5 md:before:hidden"
              aria-label="Clear search"
            >
              <X className="size-3 shrink-0 text-foreground" strokeWidth={1.5} />
            </button>
          )}
        </div>

        {/* Filter Funnel Popover matching LibraryFilterPopover */}
        <Popover open={filterOpen} onOpenChange={setFilterOpen}>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  size={activeFilterCount > 0 ? 'sm' : 'icon'}
                  className={cn(
                    'relative rounded-md border border-border bg-background text-foreground hover:bg-muted cursor-pointer transition-colors shrink-0 select-none inline-flex items-center before:absolute before:-inset-1.5 md:before:hidden',
                    activeFilterCount > 0
                      ? 'h-8 px-2.5 gap-1.5 border-primary text-primary'
                      : 'size-8',
                    filterOpen && 'bg-muted',
                  )}
                  aria-label="Filter runs"
                >
                  <FilterFunnelIcon
                    className={cn(
                      'size-4 shrink-0',
                      activeFilterCount > 0 ? 'text-primary' : 'text-foreground',
                    )}
                  />
                  {activeFilterCount > 0 && (
                    <span className="text-12 font-medium font-mono tabular-nums leading-none">
                      {activeFilterCount}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6}>
              Filter
            </TooltipContent>
          </Tooltip>
          <PopoverContent
            align="end"
            sideOffset={6}
            className="w-64 p-2 rounded-md border border-border bg-popover text-popover-foreground shadow-raised-200 z-50 font-sans flex flex-col gap-2 select-none"
          >
            <div className="flex items-center justify-between px-1">
              <span className="text-12 font-medium text-foreground">
                Run Status
              </span>
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter(null);
                    setDeviceFilter(null);
                  }}
                  className="text-11 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  Reset
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1 px-0.5">
              {(['completed', 'running', 'failed'] as const).map((st) => {
                const isSelected = statusFilter === st;
                return (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusFilter(isSelected ? null : st)}
                    className={cn(
                      'h-6 px-2 text-11 rounded-md border transition-colors cursor-pointer capitalize',
                      isSelected
                        ? 'border-primary bg-primary text-primary-foreground font-medium'
                        : 'border-border bg-background text-foreground hover:bg-muted',
                    )}
                  >
                    {st}
                  </button>
                );
              })}
            </div>

            <div className="-mx-2 border-t border-border my-0.5" />

            <div className="px-1">
              <span className="text-12 font-medium text-foreground">
                Hardware Compute
              </span>
            </div>
            <div className="flex flex-wrap gap-1 px-0.5">
              {['A100', 'RTX 4090'].map((dev) => {
                const isSelected = deviceFilter === dev;
                return (
                  <button
                    key={dev}
                    type="button"
                    onClick={() => setDeviceFilter(isSelected ? null : dev)}
                    className={cn(
                      'h-6 px-2 text-11 rounded-md border transition-colors cursor-pointer font-mono',
                      isSelected
                        ? 'border-primary bg-primary text-primary-foreground font-medium'
                        : 'border-border bg-background text-foreground hover:bg-muted',
                    )}
                  >
                    {dev}
                  </button>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>

        {/* Display Options Popover matching LibraryDisplayPopover */}
        <Popover open={displayOpen} onOpenChange={setDisplayOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className={cn('h-8 px-3 text-13', displayOpen && 'bg-muted')}
              aria-label="Display options"
            >
              <span>Display</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            sideOffset={6}
            className="w-72 p-2 rounded-md text-12 border border-border bg-popover text-popover-foreground shadow-raised-200 space-y-1.5 select-none font-sans"
          >
            <div>
              <button
                type="button"
                onClick={() => setColumnsOpen(!columnsOpen)}
                className="flex w-full items-center justify-between px-1 py-0.5 text-12 font-medium text-foreground cursor-pointer"
              >
                <span>Columns</span>
                {columnsOpen ? (
                  <ChevronUp className="size-3.5 text-foreground shrink-0" />
                ) : (
                  <ChevronDown className="size-3.5 text-foreground shrink-0" />
                )}
              </button>
              {columnsOpen && (
                <div className="flex flex-wrap items-center gap-1 pt-1 px-0.5">
                  <span className="h-6 px-2 text-11 font-medium rounded-md bg-primary text-primary-foreground border border-primary inline-flex items-center">
                    Run
                  </span>
                  {COLUMN_ITEMS.map((col) => {
                    const isSelected = Boolean(displayOptions.columns[col.key]);
                    return (
                      <button
                        key={col.key}
                        type="button"
                        onClick={() =>
                          setDisplayOptions({
                            ...displayOptions,
                            columns: {
                              ...displayOptions.columns,
                              [col.key]: !isSelected,
                            },
                          })
                        }
                        className={cn(
                          'h-6 px-2 text-11 rounded-md border transition-colors cursor-pointer inline-flex items-center',
                          isSelected
                            ? 'border-primary bg-primary text-primary-foreground font-medium'
                            : 'border-border bg-background text-foreground hover:bg-muted font-normal',
                        )}
                      >
                        {col.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="-mx-2 border-t border-border my-0.5" />

            <div>
              <div className="flex w-full items-center justify-between px-1 py-0.5 text-12 font-medium text-foreground">
                <button
                  type="button"
                  onClick={() => setOrderByOpen(!orderByOpen)}
                  className="text-12 font-medium text-foreground cursor-pointer"
                >
                  <span>Order by</span>
                </button>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      setDisplayOptions({
                        ...displayOptions,
                        orderDirection:
                          displayOptions.orderDirection === 'asc'
                            ? 'desc'
                            : 'asc',
                      })
                    }
                    className="p-0.5 text-foreground hover:bg-muted rounded cursor-pointer"
                    aria-label="Toggle sort direction"
                  >
                    {displayOptions.orderDirection === 'asc' ? (
                      <ArrowUpNarrowWide className="size-3.5 text-foreground" />
                    ) : (
                      <ArrowDownNarrowWide className="size-3.5 text-foreground" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrderByOpen(!orderByOpen)}
                    className="p-0.5 text-foreground hover:bg-muted rounded cursor-pointer"
                    aria-label={orderByOpen ? 'Collapse Order by' : 'Expand Order by'}
                  >
                    {orderByOpen ? (
                      <ChevronUp className="size-3.5 text-foreground" />
                    ) : (
                      <ChevronDown className="size-3.5 text-foreground" />
                    )}
                  </button>
                </div>
              </div>
              {orderByOpen && (
                <div className="space-y-0.5 pt-0.5">
                  {ORDER_BY_OPTIONS.map((opt) => {
                    const isSelected = displayOptions.orderBy === opt.value;
                    return (
                      <label
                        key={opt.value}
                        onClick={() =>
                          setDisplayOptions({
                            ...displayOptions,
                            orderBy: opt.value,
                          })
                        }
                        className="flex items-center gap-2 text-12 text-foreground cursor-pointer px-1 py-1 hover:bg-muted rounded-xs transition-colors"
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() =>
                            setDisplayOptions({
                              ...displayOptions,
                              orderBy: opt.value,
                            })
                          }
                          className="size-3.5 rounded-xs border-border"
                        />
                        <span className="text-foreground leading-none">
                          {opt.label}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>

        {isTrash ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={trashCount === 0}
            onClick={() => {
              emptyTrash();
              toast.success('Trash emptied');
            }}
            className="h-8 px-2.5 text-12 gap-1.5 rounded-md border-border text-destructive hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 cursor-pointer transition-colors shrink-0"
          >
            <Trash2 className="size-3.5 shrink-0" strokeWidth={1.5} />
            <span>Empty Trash</span>
          </Button>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                className="h-8 px-3 rounded-lg cursor-pointer font-medium text-13 shadow-none inline-flex items-center justify-center"
              >
                <span>New</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              sideOffset={4}
              onCloseAutoFocus={(e) => e.preventDefault()}
              className="w-56 p-1.5 rounded-lg border border-border bg-popover text-popover-foreground z-50 shadow-raised-200 select-none space-y-0.5"
            >
              <DropdownMenuItem
                onClick={() => setLogRunModalOpen(true)}
                className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
              >
                <Activity
                  className="size-4 text-foreground shrink-0"
                  strokeWidth={1.5}
                />
                <span className="text-foreground">Log Experiment Run...</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => {
                  setActiveView('raw-corpus');
                  toast.success('Switched to Raw Corpus');
                }}
                className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
              >
                <FileUp
                  className="size-4 text-foreground shrink-0"
                  strokeWidth={1.5}
                />
                <span className="text-foreground">Upload Dataset...</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => {
                  const nextNum = groups.length + 1;
                  const code = `EXP-0${nextNum}`;
                  const newId = `exp-0${nextNum}` as ExperimentsViewId;
                  addExperimentGroup({
                    id: newId,
                    code,
                    name: `${code}: New Study Group`,
                    hypothesis: 'Formulate hypothesis and link target dataset.',
                    runsCount: 0,
                  });
                  setActiveView(newId);
                  toast.success(`Created ${code}`);
                }}
                className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
              >
                <FolderPlus
                  className="size-4 text-foreground shrink-0"
                  strokeWidth={1.5}
                />
                <span className="text-foreground">New Experiment Group</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator className="my-1" />

              <DropdownMenuItem
                onClick={() => setLatexModalOpen(true)}
                className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
              >
                <Download
                  className="size-4 text-foreground shrink-0"
                  strokeWidth={1.5}
                />
                <span className="text-foreground">Export LaTeX Table...</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Inspector Toggle Button when collapsed */}
        {!isInspectorOpen && (
          <div className="flex items-center gap-1 ml-0.5 -mr-1 sm:-mr-2">
            <div className="h-4 w-px bg-border shrink-0" aria-hidden="true" />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={toggleInspector}
                  className="relative size-8 rounded-md text-foreground hover:bg-muted cursor-pointer transition-colors select-none shrink-0 before:absolute before:-inset-1.5 md:before:hidden"
                  aria-label="Expand inspector"
                >
                  <PanelRight
                    className="size-4 text-foreground shrink-0"
                    strokeWidth={1.5}
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" align="end" sideOffset={6}>
                Expand inspector
              </TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>
    </header>
  );
}
export default ExperimentsTopbar;
