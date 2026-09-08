'use client';

import React, { useState, useMemo } from 'react';
import {
  ListTree,
  Table2,
  Image as ImageIcon,
  Sigma,
  Search,
  X,
  ChevronRight,
  ExternalLink,
  ChevronDown,
  Layers,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { cn } from '@/shared/lib/utils';
import type {
  DocumentFulltext,
  DocumentSection,
  DocumentFigure,
  DocumentTable,
  DocumentFormula,
} from '../../types/reader.types';

type NavTab = 'outline' | 'figures' | 'tables' | 'formulas';

interface DocumentNavDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  fulltext: DocumentFulltext | null;
  isLoading: boolean;
  currentPage: number;
  onJumpToPage: (page: number, coords?: { x: number; y: number; width: number; height: number }) => void;
}

export default function DocumentNavDrawer({
  isOpen,
  onClose,
  fulltext,
  isLoading,
  currentPage,
  onJumpToPage,
}: DocumentNavDrawerProps) {
  const [activeTab, setActiveTab] = useState<NavTab>('outline');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedTableId, setExpandedTableId] = useState<string | null>(null);

  const sections = fulltext?.sections || [];
  const figures = fulltext?.figures || [];
  const tables = fulltext?.tables || [];
  const formulas = fulltext?.formulas || [];

  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return sections;
    const q = searchQuery.toLowerCase();
    return sections.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.num.toLowerCase().includes(q) ||
        s.imradCategory?.toLowerCase().includes(q),
    );
  }, [fulltext?.sections, searchQuery]);

  const filteredFigures = useMemo(() => {
    if (!searchQuery.trim()) return figures;
    const q = searchQuery.toLowerCase();
    return figures.filter(
      (f) =>
        f.label.toLowerCase().includes(q) ||
        f.caption.toLowerCase().includes(q),
    );
  }, [fulltext?.figures, searchQuery]);

  const filteredTables = useMemo(() => {
    if (!searchQuery.trim()) return tables;
    const q = searchQuery.toLowerCase();
    return tables.filter(
      (t) =>
        t.label.toLowerCase().includes(q) ||
        t.caption.toLowerCase().includes(q),
    );
  }, [fulltext?.tables, searchQuery]);

  const filteredFormulas = useMemo(() => {
    if (!searchQuery.trim()) return formulas;
    const q = searchQuery.toLowerCase();
    return formulas.filter(
      (f) =>
        f.text.toLowerCase().includes(q) ||
        (f.label && f.label.toLowerCase().includes(q)),
    );
  }, [fulltext?.formulas, searchQuery]);

  if (!isOpen) return null;

  const getImradBadgeVariant = (category?: string) => {
    switch (category) {
      case 'introduction':
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
      case 'methods':
        return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20';
      case 'results':
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
      case 'discussion':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
      case 'conclusion':
        return 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20';
      default:
        return 'bg-muted text-muted-foreground border-border/50';
    }
  };

  return (
    <aside
      className="absolute inset-y-0 left-0 z-30 flex w-[min(100%,360px)] flex-col border-r border-border bg-card select-none animate-in slide-in-from-left-2 duration-150"
      aria-label="Document Structure Drawer"
    >
      {/* Header Chrome */}
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-border px-3 bg-background">
        <div className="flex items-center gap-2">
          <Layers className="size-4 text-primary shrink-0" />
          <span className="text-xs font-semibold text-foreground tracking-tight">
            Structure & Entities
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 text-muted-foreground hover:text-foreground hover:bg-muted rounded-sm cursor-pointer"
          onClick={onClose}
          aria-label="Close outline drawer"
        >
          <X className="size-3.5" />
        </Button>
      </div>

      {/* Underline Tab Strip */}
      <div className="flex h-9 shrink-0 items-center border-b border-border px-2 bg-background gap-1">
        <button
          type="button"
          onClick={() => setActiveTab('outline')}
          className={cn(
            'relative flex items-center gap-1.5 h-full px-2 text-xs font-medium transition-colors cursor-pointer border-b-2',
            activeTab === 'outline'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          <ListTree className="size-3.5" />
          <span>Outline</span>
          <span className="text-[10px] font-mono text-muted-foreground">
            ({sections.length})
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('figures')}
          className={cn(
            'relative flex items-center gap-1.5 h-full px-2 text-xs font-medium transition-colors cursor-pointer border-b-2',
            activeTab === 'figures'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          <ImageIcon className="size-3.5" />
          <span>Figures</span>
          <span className="text-[10px] font-mono text-muted-foreground">
            ({figures.length})
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('tables')}
          className={cn(
            'relative flex items-center gap-1.5 h-full px-2 text-xs font-medium transition-colors cursor-pointer border-b-2',
            activeTab === 'tables'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          <Table2 className="size-3.5" />
          <span>Tables</span>
          <span className="text-[10px] font-mono text-muted-foreground">
            ({tables.length})
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('formulas')}
          className={cn(
            'relative flex items-center gap-1.5 h-full px-2 text-xs font-medium transition-colors cursor-pointer border-b-2',
            activeTab === 'formulas'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          <Sigma className="size-3.5" />
          <span>Math</span>
          <span className="text-[10px] font-mono text-muted-foreground">
            ({formulas.length})
          </span>
        </button>
      </div>

      {/* Filter / Search bar */}
      <div className="p-2 border-b border-border/70 bg-card">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Filter ${activeTab}...`}
            className="h-7 pl-8 text-xs bg-background border-border/70 rounded-sm focus-visible:ring-1 focus-visible:ring-primary"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3" />
            </button>
          ) : null}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1 divide-y divide-border/30">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-8 text-center gap-2">
            <div className="size-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-muted-foreground">Analyzing document layout...</span>
          </div>
        ) : null}

        {/* ── TAB 1: OUTLINE ── */}
        {activeTab === 'outline' && !isLoading ? (
          filteredSections.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              {sections.length === 0
                ? 'No structured sections detected in this document.'
                : 'No sections match your filter.'}
            </div>
          ) : (
            filteredSections.map((sec) => {
              const isCurrent = currentPage === sec.page;
              return (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => onJumpToPage(sec.page, sec.coords)}
                  className={cn(
                    'w-full text-left p-2 rounded-sm transition-colors flex items-start justify-between gap-2 group cursor-pointer border border-transparent',
                    isCurrent
                      ? 'bg-primary/10 border-primary/20 text-foreground'
                      : 'hover:bg-muted/60 text-foreground',
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {sec.num ? (
                        <span className="font-mono text-[11px] font-semibold text-primary shrink-0">
                          {sec.num}
                        </span>
                      ) : null}
                      <span className="text-xs font-medium leading-snug line-clamp-1">
                        {sec.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 mt-1">
                      {sec.imradCategory && sec.imradCategory !== 'other' ? (
                        <span
                          className={cn(
                            'text-[10px] font-mono px-1 py-0.2 rounded border uppercase tracking-wider',
                            getImradBadgeVariant(sec.imradCategory),
                          )}
                        >
                          {sec.imradCategory}
                        </span>
                      ) : null}
                      {sec.paragraphs && sec.paragraphs.length > 0 ? (
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {sec.paragraphs.length} {sec.paragraphs.length === 1 ? 'para' : 'paras'}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0 self-center tabular-nums">
                    p. {sec.page}
                  </span>
                </button>
              );
            })
          )
        ) : null}

        {/* ── TAB 2: FIGURES ── */}
        {activeTab === 'figures' && !isLoading ? (
          filteredFigures.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              {figures.length === 0
                ? 'No figures extracted from this document.'
                : 'No figures match your filter.'}
            </div>
          ) : (
            filteredFigures.map((fig) => {
              const isCurrent = currentPage === fig.page;
              return (
                <div
                  key={fig.id}
                  className={cn(
                    'p-2.5 rounded-sm border transition-colors space-y-1.5',
                    isCurrent ? 'bg-primary/5 border-primary/30' : 'bg-background border-border/70 hover:border-border',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <ImageIcon className="size-3.5 text-primary" />
                      {fig.label || `Figure`}
                    </span>
                    <button
                      type="button"
                      onClick={() => onJumpToPage(fig.page, fig.coords)}
                      className="inline-flex items-center gap-1 text-[11px] font-mono text-primary hover:underline cursor-pointer"
                    >
                      <span>p. {fig.page}</span>
                      <ExternalLink className="size-3" />
                    </button>
                  </div>
                  {fig.caption ? (
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                      {fig.caption}
                    </p>
                  ) : null}
                </div>
              );
            })
          )
        ) : null}

        {/* ── TAB 3: TABLES ── */}
        {activeTab === 'tables' && !isLoading ? (
          filteredTables.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              {tables.length === 0
                ? 'No tables extracted from this document.'
                : 'No tables match your filter.'}
            </div>
          ) : (
            filteredTables.map((tab) => {
              const isCurrent = currentPage === tab.page;
              const isExpanded = expandedTableId === tab.id;
              const hasMatrix = tab.rows && tab.rows.length > 0;

              return (
                <div
                  key={tab.id}
                  className={cn(
                    'p-2.5 rounded-sm border transition-colors space-y-2',
                    isCurrent ? 'bg-primary/5 border-primary/30' : 'bg-background border-border/70 hover:border-border',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Table2 className="size-3.5 text-primary" />
                      {tab.label || `Table`}
                    </span>
                    <button
                      type="button"
                      onClick={() => onJumpToPage(tab.page, tab.coords)}
                      className="inline-flex items-center gap-1 text-[11px] font-mono text-primary hover:underline cursor-pointer"
                    >
                      <span>p. {tab.page}</span>
                      <ExternalLink className="size-3" />
                    </button>
                  </div>

                  {tab.caption ? (
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                      {tab.caption}
                    </p>
                  ) : null}

                  {hasMatrix ? (
                    <div>
                      <button
                        type="button"
                        onClick={() => setExpandedTableId(isExpanded ? null : tab.id)}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        {isExpanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
                        <span>{isExpanded ? 'Hide Data Matrix' : 'Preview Data Matrix'}</span>
                        <span className="font-mono text-[10px]">({tab.rows?.length} rows)</span>
                      </button>

                      {isExpanded ? (
                        <div className="mt-2 overflow-x-auto border border-border/60 rounded-sm bg-muted/20 text-[11px]">
                          <table className="w-full border-collapse text-left">
                            {tab.headers && tab.headers.length > 0 ? (
                              <thead>
                                <tr className="border-b border-border/70 bg-muted/60">
                                  {tab.headers.map((h, idx) => (
                                    <th key={idx} className="p-1.5 font-semibold text-foreground">
                                      {h}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                            ) : null}
                            <tbody>
                              {tab.rows?.map((row, rIdx) => (
                                <tr key={rIdx} className="border-b border-border/30 hover:bg-muted/40">
                                  {row.map((cell, cIdx) => (
                                    <td key={cIdx} className="p-1.5 text-muted-foreground">
                                      {cell}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })
          )
        ) : null}

        {/* ── TAB 4: FORMULAS ── */}
        {activeTab === 'formulas' && !isLoading ? (
          filteredFormulas.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              {formulas.length === 0
                ? 'No mathematical formulas extracted from this document.'
                : 'No formulas match your filter.'}
            </div>
          ) : (
            filteredFormulas.map((form) => {
              const isCurrent = currentPage === form.page;
              return (
                <div
                  key={form.id}
                  className={cn(
                    'p-2.5 rounded-sm border transition-colors space-y-1.5',
                    isCurrent ? 'bg-primary/5 border-primary/30' : 'bg-background border-border/70 hover:border-border',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono font-semibold text-primary">
                      {form.label ? `Eq. ${form.label}` : form.id}
                    </span>
                    <button
                      type="button"
                      onClick={() => onJumpToPage(form.page, form.coords)}
                      className="inline-flex items-center gap-1 text-[11px] font-mono text-primary hover:underline cursor-pointer"
                    >
                      <span>p. {form.page}</span>
                      <ExternalLink className="size-3" />
                    </button>
                  </div>
                  <div className="p-2 bg-muted/40 rounded border border-border/50 font-mono text-[11px] text-foreground leading-relaxed overflow-x-auto whitespace-pre-wrap">
                    {form.text}
                  </div>
                </div>
              );
            })
          )
        ) : null}
      </div>
    </aside>
  );
}
