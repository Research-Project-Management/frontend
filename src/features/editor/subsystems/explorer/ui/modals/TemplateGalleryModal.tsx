'use client';

/**
 * TemplateGalleryModal.tsx
 *
 * Unified Academic & Custom LaTeX Page Template Gallery (Overleaf parity).
 */

import React from 'react';
import {
  BookOpen,
  FileArchive,
  FileCheck,
  FileText,
  GraduationCap,
  Layout,
  Loader2,
  Mail,
  Plus,
  Presentation,
  Scroll,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { PlaneEmptyState } from '@/shared/components/ui/PlaneEmptyState';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { cn } from '@/shared/lib/utils';
import type { TemplateCategory } from '@/features/editor/sdk/pages/templates.client';
import {
  useTemplateGallery,
  type GalleryCategoryFilter,
  type GalleryScopeFilter,
} from '../../hooks/useTemplateGallery';

export interface TemplateGalleryModalProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  spaceId?: string;
  initialCategory?: string;
}

const CATEGORIES = [
  { id: 'all', label: 'All templates', icon: Layout },
  { id: 'journal', label: 'Journal articles', icon: BookOpen },
  { id: 'conference', label: 'Conferences', icon: Layout },
  { id: 'thesis', label: 'Theses', icon: GraduationCap },
  { id: 'book', label: 'Books', icon: BookOpen },
  { id: 'presentation', label: 'Presentations', icon: Presentation },
  { id: 'report', label: 'Reports', icon: Scroll },
  { id: 'cv', label: 'CVs & résumés', icon: FileText },
  { id: 'poster', label: 'Posters', icon: Layout },
  { id: 'assignment', label: 'Assignments', icon: FileCheck },
  { id: 'letter', label: 'Formal letters', icon: Mail },
] as const;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function TemplateGalleryModal(props: TemplateGalleryModalProps = {}) {
  const g = useTemplateGallery(props);

  return (
    <Dialog open={g.open} onOpenChange={g.setOpen}>
      <DialogContent
        showCloseButton={false}
        className="w-[95vw] sm:max-w-4xl lg:max-w-5xl max-h-[88vh] h-[82vh] sm:h-[620px] flex flex-col p-0 overflow-hidden rounded-md bg-background border border-border/80 shadow-raised-400 text-foreground select-none"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <DialogTitle className="text-14 font-semibold text-foreground tracking-tight">
              Template gallery
            </DialogTitle>
            <div className="hidden sm:flex items-center rounded-md bg-muted p-0.5 border border-border text-11">
              {(
                [
                  ['all', 'All'],
                  ['personal', 'Personal'],
                  ...(g.isProjectSpace ? [['project', 'Project'] as const] : []),
                ] as ReadonlyArray<readonly [GalleryScopeFilter, string]>
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => g.setScope(key)}
                  className={cn(
                    'px-2 py-0.5 rounded-sm transition-colors cursor-pointer',
                    g.scope === key
                      ? 'bg-background text-foreground font-medium shadow-xs'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => g.setOpen(false)}
            aria-label="Close template gallery"
            className="size-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <X className="size-4" strokeWidth={1.5} />
          </button>
        </div>
        <DialogDescription className="sr-only">
          Browse, preview, publish, and instantiate LaTeX page templates
        </DialogDescription>

        {/* 3-Column Body */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Column 1: Categories Sidebar */}
          <nav
            aria-label="Template categories"
            className="hidden md:flex w-44 bg-muted/20 border-r border-border/60 p-2 flex-col gap-0.5 overflow-y-auto shrink-0"
          >
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const active = g.category === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    g.setCategory(cat.id as GalleryCategoryFilter);
                    g.setSelectedId(null);
                  }}
                  className={cn(
                    'w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-12 text-left cursor-pointer transition-colors',
                    active
                      ? 'bg-background text-foreground font-medium shadow-xs border border-border/60'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/60 border border-transparent',
                  )}
                >
                  <Icon className="size-3.5 shrink-0" strokeWidth={1.5} />
                  <span className="truncate">{cat.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Column 2: Search & Template List */}
          <div className="w-72 sm:w-80 border-r border-border flex flex-col bg-background shrink-0 min-h-0">
            <div className="p-2.5 border-b border-border shrink-0">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  value={g.search}
                  onChange={(e) => g.setSearch(e.target.value)}
                  placeholder="Search templates, tags, classes…"
                  aria-label="Search templates"
                  className="w-full h-8 pl-8 pr-7 text-12 rounded-md border border-border bg-background focus:border-ring focus:ring-1 focus:ring-ring text-foreground placeholder:text-muted-foreground outline-none select-text"
                />
                {g.search && (
                  <button
                    type="button"
                    onClick={() => g.setSearch('')}
                    aria-label="Clear search"
                    className="absolute right-2 top-1/2 -translate-y-1/2 size-4 flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5">
              {g.loadingList ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-md border border-border/60 bg-card space-y-2"
                  >
                    <Skeleton className="h-3.5 w-40 rounded-sm" />
                    <Skeleton className="h-3 w-full rounded-sm opacity-70" />
                  </div>
                ))
              ) : g.items.length === 0 ? (
                <PlaneEmptyState
                  isCompact
                  variant="search"
                  title="No templates found"
                  description="Try another category or clear your search."
                />
              ) : (
                g.items.map((tpl) => {
                  const isSelected = g.selected?.id === tpl.id;
                  return (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => g.setSelectedId(tpl.id)}
                      className={cn(
                        'w-full text-left p-2.5 rounded-md border transition-colors cursor-pointer flex flex-col gap-1',
                        isSelected
                          ? 'border-primary bg-primary/[0.06]'
                          : 'border-border/60 hover:border-border hover:bg-muted/40',
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-foreground truncate">
                          {tpl.name}
                        </span>
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 font-mono shrink-0 rounded-sm"
                        >
                          {tpl.scope === 'project'
                            ? 'Project'
                            : tpl.scope === 'personal'
                              ? 'Personal'
                              : tpl.compiler}
                        </Badge>
                      </div>
                      {tpl.description && (
                        <p className="text-11 text-muted-foreground line-clamp-2 leading-relaxed">
                          {tpl.description}
                        </p>
                      )}
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground/80 pt-0.5">
                        <span className="truncate">
                          {tpl.author ? tpl.author : tpl.category}
                        </span>
                        <span className="font-mono shrink-0">
                          {tpl.compiler} · {tpl.fileCount}{' '}
                          {tpl.fileCount === 1 ? 'file' : 'files'}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Column 3: Multi-File Preview Pane */}
          <div className="flex-1 flex flex-col min-w-0 bg-background overflow-hidden">
            {g.selected ? (
              <>
                <div className="px-4 py-2.5 border-b border-border bg-muted/20 flex items-center justify-between gap-2 shrink-0">
                  <div className="flex items-center gap-2 min-w-0 overflow-x-auto">
                    {g.files.length > 0 ? (
                      g.files.map((f) => (
                        <button
                          key={f.path}
                          type="button"
                          onClick={() => g.setPreviewPath(f.path)}
                          className={cn(
                            'px-2 py-0.5 rounded-sm text-11 font-mono transition-colors cursor-pointer shrink-0 border',
                            g.activeFile?.path === f.path
                              ? 'bg-background text-foreground font-medium border-border shadow-xs'
                              : 'bg-transparent text-muted-foreground hover:text-foreground border-transparent',
                          )}
                        >
                          {f.path}
                        </button>
                      ))
                    ) : (
                      <span className="text-11 font-mono text-muted-foreground">
                        {g.selected.mainFile}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {g.selected.isCustom && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={g.busy}
                        onClick={g.deleteSelected}
                        title="Delete template"
                        aria-label="Delete template"
                        className="h-7 px-2 text-11 text-muted-foreground hover:text-destructive cursor-pointer"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </div>
                </div>

                <div className="flex-1 overflow-auto p-4 bg-muted/5 font-mono text-xs text-foreground/90 leading-relaxed whitespace-pre select-text">
                  {g.loadingDetail && !g.activeFile ? (
                    <div className="space-y-2">
                      <Skeleton className="h-3.5 w-56 rounded-sm" />
                      <Skeleton className="h-3.5 w-80 rounded-sm" />
                      <Skeleton className="h-3.5 w-64 rounded-sm" />
                    </div>
                  ) : g.activeFile?.type === 'FILE' ? (
                    <div className="h-full flex flex-col items-center justify-center text-center font-sans text-muted-foreground gap-2">
                      <FileArchive className="size-7 opacity-60" />
                      <div className="text-xs font-medium text-foreground">
                        {g.activeFile.path}
                      </div>
                      <div className="text-11">
                        Binary asset ({g.activeFile.mimeType} ·{' '}
                        {formatBytes(g.activeFile.sizeBytes)}) — linked zero-copy
                        when instantiated
                      </div>
                    </div>
                  ) : (
                    g.activeFile?.content || '% Empty file'
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground p-6">
                Select a template to preview its files
              </div>
            )}
          </div>
        </div>

        {/* Inline Publish Bar (Flat Precision SaaS Style: h-8, text-12, rounded-md) */}
        {g.publishOpen && g.canPublishPage && (
          <div className="px-5 py-2.5 border-t border-border bg-muted/30 flex flex-wrap items-center gap-2 shrink-0">
            <input
              type="text"
              value={g.publishName}
              onChange={(e) => g.setPublishName(e.target.value)}
              placeholder="Template name…"
              aria-label="Template name"
              className="flex-1 min-w-44 h-8 px-2.5 text-12 rounded-md border border-border bg-background focus:border-ring focus:ring-1 focus:ring-ring text-foreground outline-none select-text"
            />
            <select
              value={g.publishCategory}
              onChange={(e) =>
                g.setPublishCategory(e.target.value as TemplateCategory)
              }
              aria-label="Template category"
              className="h-8 px-2 text-12 rounded-md border border-border bg-background text-foreground outline-none cursor-pointer"
            >
              {CATEGORIES.filter((c) => c.id !== 'all').map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
              <option value="other">Other</option>
            </select>
            {g.isProjectSpace && (
              <div className="flex items-center rounded-md bg-muted p-0.5 border border-border text-11 h-8">
                {(
                  [
                    ['project', 'Project'],
                    ['personal', 'Personal'],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => g.setPublishScope(key)}
                    className={cn(
                      'px-2 h-full rounded-sm transition-colors cursor-pointer',
                      g.publishScope === key
                        ? 'bg-background text-foreground font-medium shadow-xs'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
            <Button
              type="button"
              size="sm"
              disabled={g.busy || !g.publishName.trim()}
              onClick={g.publishCurrentPage}
              className="h-8 px-3 text-12 font-medium cursor-pointer"
            >
              {g.existingForPage ? 'Update template' : 'Save template'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={g.busy}
              onClick={() => g.setPublishOpen(false)}
              className="h-8 px-2 text-12 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              Close
            </Button>
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-2.5 border-t border-border bg-background flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 shrink-0">
          <div>
            {g.canPublishPage && !g.publishOpen && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={g.busy}
                onClick={g.openPublishBar}
                className="h-8 gap-1.5 px-2.5 text-12 font-medium text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <Plus className="size-3.5" />
                <span>Save current page as template</span>
              </Button>
            )}
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={g.busy}
              onClick={() => g.setOpen(false)}
              className="h-8 px-3.5 text-12 font-medium cursor-pointer"
            >
              Cancel
            </Button>

            <Button
              type="button"
              size="sm"
              disabled={!g.selected || g.busy}
              onClick={g.instantiate}
              className="h-8 gap-1.5 px-3.5 text-12 font-medium cursor-pointer"
            >
              {g.busy ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <FileCheck className="size-3.5" />
              )}
              <span>{g.busy ? 'Creating…' : 'Use template'}</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
