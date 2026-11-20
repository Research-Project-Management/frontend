'use client';

import React, { useId, useState } from 'react';
import {
  BookOpen,
  ChevronRight,
  FileText,
  Folder,
  FolderOpen,
  Loader2,
  Plus,
  Search,
} from 'lucide-react';
import { toast } from 'sonner';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Input } from '@/shared/components/ui/input';
import { PlaneEmptyState } from '@/shared/components/ui/PlaneEmptyState';
import { cn } from '@/shared/lib/utils';
import {
  loadCollectionSources,
  useLibraryContextItems,
  type LibraryCollectionNode,
  type LibraryPaperFilter,
} from '../../context/library';
import type { LibraryReadiness, SourceEntry } from '../../context/source.port';

export interface LibraryTabProps {
  spaceId?: string | null;
  pending: ReadonlyMap<string, SourceEntry>;
  selectedIds?: ReadonlySet<string>;
  onToggle: (entry: SourceEntry) => void;
  onQuickAttach: (entry: SourceEntry) => void;
  onAttachMany?: (entries: SourceEntry[]) => void;
}

const READINESS_META: Record<
  LibraryReadiness,
  { label: string; title: string; className: string }
> = {
  indexed: {
    label: 'Full-text',
    title: 'Full text is indexed for fast Q&A',
    className:
      'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
  },
  pdf: {
    label: 'PDF',
    title: 'PDF attached; will be auto-indexed on demand when asked',
    className:
      'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20',
  },
  metadata: {
    label: 'Metadata',
    title: 'Metadata & notes only (no PDF full-text)',
    className: 'bg-muted text-muted-foreground border-border/70',
  },
};

export function LibraryTab({
  spaceId = null,
  pending,
  selectedIds,
  onToggle,
  onQuickAttach,
  onAttachMany,
}: LibraryTabProps) {
  const [selectedCollectionId, setSelectedCollectionId] = useState<
    string | undefined
  >(undefined);
  const [expandedCols, setExpandedCols] = useState<Set<string>>(new Set());
  const [attachingColId, setAttachingColId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<LibraryPaperFilter>('all');
  const listId = useId();

  const { tree, papers, counts, isLoading } = useLibraryContextItems({
    spaceId,
    collectionId: selectedCollectionId,
    search,
    filter,
    enabled: true,
  });

  const handleAttachCollection = async (
    node: LibraryCollectionNode,
    e: React.MouseEvent,
  ) => {
    e.stopPropagation();
    if (!onAttachMany || attachingColId) return;
    setAttachingColId(node.id);
    try {
      const entries = await loadCollectionSources(node.id, spaceId, {
        maxItems: 20,
      });
      if (entries.length === 0) {
        toast.info(`No papers in "${node.name}"`);
        return;
      }
      onAttachMany(entries);
      toast.success(
        `Selected ${entries.length} paper${entries.length === 1 ? '' : 's'} from "${node.name}"`,
      );
    } catch {
      toast.error(`Failed to load papers from "${node.name}"`);
    } finally {
      setAttachingColId(null);
    }
  };

  const renderCollectionTree = (nodes: LibraryCollectionNode[]) =>
    nodes.map((node) => {
      const hasChildren = node.children.length > 0;
      const isExp = expandedCols.has(node.id);
      const isSel = selectedCollectionId === node.id;
      const isBusy = attachingColId === node.id;

      return (
        <div key={node.id} className="space-y-0.5">
          <div
            className={cn(
              'group flex items-center gap-1 rounded-md px-1 py-0.5 transition-colors',
              isSel
                ? 'bg-primary/10 text-primary font-medium'
                : 'hover:bg-muted text-foreground/80',
            )}
          >
            {hasChildren ? (
              <button
                type="button"
                aria-expanded={isExp}
                aria-label={`${isExp ? 'Collapse' : 'Expand'} ${node.name}`}
                onClick={() => {
                  setExpandedCols((prev) => {
                    const next = new Set(prev);
                    if (next.has(node.id)) next.delete(node.id);
                    else next.add(node.id);
                    return next;
                  });
                }}
                className="relative before:absolute before:-inset-2 md:before:hidden p-1 hover:bg-muted rounded cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary shrink-0"
              >
                <ChevronRight
                  className={cn(
                    'size-3 text-muted-foreground transition-transform motion-reduce:transition-none',
                    isExp && 'rotate-90',
                  )}
                  aria-hidden="true"
                />
              </button>
            ) : (
              <span className="size-5 shrink-0" aria-hidden="true" />
            )}

            <button
              type="button"
              onClick={() => setSelectedCollectionId(node.id)}
              className="flex-1 min-w-0 flex items-center gap-1.5 py-1 pr-1 text-12 text-left cursor-pointer rounded-sm outline-none focus-visible:ring-1 focus-visible:ring-primary"
            >
              {isExp ? (
                <FolderOpen
                  className="size-3.5 text-muted-foreground shrink-0"
                  aria-hidden="true"
                />
              ) : (
                <Folder
                  className="size-3.5 text-muted-foreground shrink-0"
                  aria-hidden="true"
                />
              )}
              <span className="truncate flex-1">{node.name}</span>
            </button>

            {onAttachMany && (
              <button
                type="button"
                disabled={Boolean(attachingColId)}
                onClick={(e) => void handleAttachCollection(node, e)}
                title={`Attach all papers in ${node.name}`}
                aria-label={`Attach collection ${node.name}`}
                className={cn(
                  'shrink-0 size-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-background/80 cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary transition-opacity',
                  isBusy || isSel
                    ? 'opacity-100'
                    : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
                )}
              >
                {isBusy ? (
                  <Loader2 className="size-3 animate-spin" aria-hidden="true" />
                ) : (
                  <Plus className="size-3" aria-hidden="true" />
                )}
              </button>
            )}
          </div>
          {hasChildren && isExp && (
            <div className="pl-3">{renderCollectionTree(node.children)}</div>
          )}
        </div>
      );
    });

  const filterPills: ReadonlyArray<{
    id: LibraryPaperFilter;
    label: string;
    count: number;
  }> = [
    { id: 'all', label: 'All', count: counts.all },
    { id: 'pdf', label: 'Has PDF', count: counts.pdf },
    { id: 'indexed', label: 'Full-text', count: counts.indexed },
  ];

  return (
    <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
      <div className="w-full md:w-56 max-h-36 md:max-h-none border-b md:border-b-0 md:border-r border-border p-2.5 overflow-y-auto space-y-1 shrink-0 bg-muted/20">
        <button
          type="button"
          onClick={() => setSelectedCollectionId(undefined)}
          className={cn(
            'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-12 text-left cursor-pointer transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary',
            !selectedCollectionId
              ? 'bg-primary/10 text-primary font-medium'
              : 'hover:bg-muted text-foreground/80',
          )}
        >
          <BookOpen className="size-3.5 shrink-0" aria-hidden="true" />
          <span>All Papers</span>
        </button>
        {renderCollectionTree(tree)}
      </div>

      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <div className="px-3 py-2 border-b border-border flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-[180px]">
            <Search
              className="size-3.5 text-muted-foreground shrink-0"
              aria-hidden="true"
            />
            <Input
              aria-label="Filter library papers"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, author, year, DOI, tag..."
              className="h-8 text-12 border-0 shadow-none focus-visible:ring-0 px-0"
            />
          </div>

          <div
            role="group"
            aria-label="Filter by paper availability"
            className="flex items-center gap-1 shrink-0"
          >
            {filterPills.map((pill) => {
              const active = filter === pill.id;
              return (
                <button
                  key={pill.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setFilter(pill.id)}
                  className={cn(
                    'px-2 py-0.5 rounded-full text-11 font-medium border transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary',
                    active
                      ? 'bg-primary/10 text-primary border-primary/30'
                      : 'bg-background text-muted-foreground border-border/70 hover:text-foreground',
                  )}
                >
                  {pill.label}{' '}
                  <span className="opacity-70">{pill.count}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {isLoading ? (
            <div
              role="status"
              aria-live="polite"
              className="flex items-center justify-center py-12 text-muted-foreground gap-2 text-12"
            >
              <Loader2
                className="size-4 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
              <span>Loading library papers...</span>
            </div>
          ) : papers.length === 0 ? (
            <PlaneEmptyState
              variant="citations"
              title="No library papers"
              description="Add papers to your library or adjust your search filter."
              isCompact
            />
          ) : (
            papers.map(({ itemId, title, subtitle, readiness, tags, entry }) => {
              const isChecked =
                pending.has(entry.id) || Boolean(selectedIds?.has(entry.id));
              const rowId = `${listId}-${itemId}`;
              const badge = READINESS_META[readiness];
              return (
                <div
                  key={itemId}
                  onClick={() => onToggle(entry)}
                  onDoubleClick={() => onQuickAttach(entry)}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-md border text-left transition-colors cursor-pointer',
                    isChecked
                      ? 'bg-primary/10 ring-1 ring-inset ring-primary/30 border-transparent'
                      : 'border-transparent hover:bg-muted/60',
                  )}
                >
                  <Checkbox
                    id={rowId}
                    checked={isChecked}
                    className="pointer-events-none"
                    aria-label={`Select ${title}`}
                  />
                  <FileText
                    className="size-4 text-foreground shrink-0"
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <p className="text-12 font-medium text-foreground truncate flex-1">
                        {title}
                      </p>
                      <span
                        title={badge.title}
                        className={cn(
                          'shrink-0 px-1.5 py-0.5 rounded text-10 font-medium border leading-none',
                          badge.className,
                        )}
                      >
                        {badge.label}
                      </span>
                    </div>
                    {(subtitle || tags.length > 0) && (
                      <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
                        {subtitle && (
                          <p className="text-11 text-muted-foreground truncate">
                            {subtitle}
                          </p>
                        )}
                        {tags.slice(0, 2).map((tag) => (
                          <span
                            key={tag}
                            className="shrink-0 px-1.5 py-0 rounded bg-muted text-10 text-muted-foreground truncate max-w-[90px]"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
