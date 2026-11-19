'use client';

import React, { useState } from 'react';
import {
  BookOpen,
  ChevronRight,
  FileText,
  Folder,
  FolderOpen,
  Loader2,
  Search,
} from 'lucide-react';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Input } from '@/shared/components/ui/input';
import { PlaneEmptyState } from '@/shared/components/ui/PlaneEmptyState';
import { cn } from '@/shared/lib/utils';
import {
  useLibraryContextItems,
  type LibraryCollectionNode,
} from '../../context/library';
import type { SourceEntry } from '../../context/source.port';

export interface LibraryTabProps {
  spaceId?: string | null;
  pending: ReadonlyMap<string, SourceEntry>;
  selectedIds?: ReadonlySet<string>;
  onToggle: (entry: SourceEntry) => void;
  onQuickAttach: (entry: SourceEntry) => void;
}

export function LibraryTab({
  spaceId = null,
  pending,
  selectedIds,
  onToggle,
  onQuickAttach,
}: LibraryTabProps) {
  const [selectedCollectionId, setSelectedCollectionId] = useState<
    string | undefined
  >(undefined);
  const [expandedCols, setExpandedCols] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');

  const { tree, papers, isLoading } = useLibraryContextItems({
    spaceId,
    collectionId: selectedCollectionId,
    search,
    enabled: true,
  });

  const renderCollectionTree = (nodes: LibraryCollectionNode[]) =>
    nodes.map((node) => {
      const hasChildren = node.children.length > 0;
      const isExp = expandedCols.has(node.id);
      const isSel = selectedCollectionId === node.id;
      return (
        <div key={node.id} className="space-y-0.5">
          <button
            type="button"
            onClick={() => setSelectedCollectionId(node.id)}
            className={cn(
              'w-full flex items-center gap-1.5 px-2 py-1 rounded-md text-12 text-left transition-colors cursor-pointer',
              isSel
                ? 'bg-primary/10 text-primary font-medium'
                : 'hover:bg-muted text-foreground/80',
            )}
          >
            {hasChildren ? (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  setExpandedCols((prev) => {
                    const next = new Set(prev);
                    if (next.has(node.id)) next.delete(node.id);
                    else next.add(node.id);
                    return next;
                  });
                }}
                className="p-0.5 hover:bg-muted rounded"
              >
                <ChevronRight
                  className={cn(
                    'size-3 text-muted-foreground transition-transform',
                    isExp && 'rotate-90',
                  )}
                />
              </span>
            ) : (
              <span className="size-4 shrink-0" />
            )}
            {isExp ? (
              <FolderOpen className="size-3.5 text-warning shrink-0" />
            ) : (
              <Folder className="size-3.5 text-warning shrink-0" />
            )}
            <span className="truncate flex-1">{node.name}</span>
          </button>
          {hasChildren && isExp && (
            <div className="pl-3">{renderCollectionTree(node.children)}</div>
          )}
        </div>
      );
    });

  return (
    <div className="flex-1 min-h-0 flex overflow-hidden">
      <div className="w-52 border-r border-border p-2.5 overflow-y-auto space-y-1 shrink-0 bg-muted/20">
        <button
          type="button"
          onClick={() => setSelectedCollectionId(undefined)}
          className={cn(
            'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-12 text-left cursor-pointer transition-colors',
            !selectedCollectionId
              ? 'bg-primary/10 text-primary font-medium'
              : 'hover:bg-muted text-foreground/80',
          )}
        >
          <BookOpen className="size-3.5 shrink-0" />
          <span>All Papers</span>
        </button>
        {renderCollectionTree(tree)}
      </div>

      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <div className="p-3 border-b border-border flex items-center gap-2">
          <Search className="size-3.5 text-muted-foreground shrink-0" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter library papers..."
            className="h-8 text-12 border-0 shadow-none focus-visible:ring-0 px-0"
          />
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground gap-2 text-12">
              <Loader2 className="size-4 animate-spin" />
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
            papers.map(({ itemId, title, subtitle, entry }) => {
              const isChecked =
                pending.has(entry.id) || Boolean(selectedIds?.has(entry.id));
              return (
                <div
                  key={itemId}
                  onClick={() => onToggle(entry)}
                  onDoubleClick={() => onQuickAttach(entry)}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-md border text-left cursor-pointer transition-colors',
                    isChecked
                      ? 'border-ai/40 bg-ai/5'
                      : 'border-transparent hover:bg-muted/60',
                  )}
                >
                  <Checkbox checked={isChecked} />
                  <FileText className="size-4 text-primary shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-12 font-medium text-foreground truncate">
                      {title}
                    </p>
                    {subtitle && (
                      <p className="text-11 text-muted-foreground truncate">
                        {subtitle}
                      </p>
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
