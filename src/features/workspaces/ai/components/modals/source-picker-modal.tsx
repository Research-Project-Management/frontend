'use client';

import { useMemo, useState } from 'react';
import {
  BookOpen,
  ChevronRight,
  FileText,
  Folder,
  FolderOpen,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui';
import { Button } from '@/shared/components/ui';
import { Checkbox } from '@/shared/components/ui';
import { Input } from '@/shared/components/ui';
import { Skeleton } from '@/shared/components/ui';
import { useChatMode } from '../../hooks/use-chat-mode';
import { cn } from '@/shared/lib/utils';
import { useCollections } from '@/features/workspaces/library/hooks/data/use-collections';
import { usePapers } from '@/features/workspaces/library/hooks/data/use-papers';
import type { Collection, Paper } from '@/features/workspaces/library/types/library.types';

export interface SourcePickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
}

type SelectedPaper = {
  id: string;
  name: string;
  ragDocId: string;
};

type TreeNode = Collection & { children: TreeNode[] };

function buildTree(collections: Collection[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  for (const c of collections) map.set(c.id, { ...c, children: [] });

  for (const node of map.values()) {
    const parentId = node.parentId || node.parent;
    if (parentId && map.has(parentId)) {
      map.get(parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

function branchNameMatches(node: TreeNode, query: string): boolean {
  return (
    node.name.toLowerCase().includes(query) ||
    node.children.some((child: TreeNode) => branchNameMatches(child, query))
  );
}

const isIndexedPaper = (paper: Paper): paper is Paper & { ragDocId: string } =>
  paper.ragStatus === 'indexed' && typeof paper.ragDocId === 'string' && paper.ragDocId.length > 0;

const toSelectedPaper = (paper: Paper): SelectedPaper | null => {
  if (!isIndexedPaper(paper)) return null;
  return { id: paper.id, name: paper.title, ragDocId: paper.ragDocId };
};

const compactAuthors = (paper: Paper) => {
  if (!paper.authors.length) return '';
  if (paper.authors.length === 1) return paper.authors[0];
  return `${paper.authors[0]} et al.`;
};

export function SourcePickerModal({
  open,
  onOpenChange,
  workspaceId,
}: SourcePickerModalProps) {
  const { addSource, sources, setFluxDataEnabled } = useChatMode();
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | undefined>(undefined);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [pendingSelection, setPendingSelection] = useState<Map<string, SelectedPaper>>(new Map());

  const { state: collectionsState } = useCollections(workspaceId);
  const { state: papersState } = usePapers({
    workspaceId,
    collectionId: selectedCollectionId,
  });

  const collections = collectionsState.collections;
  const collectionsLoading = collectionsState.isLoading;

  const activePapers = useMemo(() => {
    const raw = selectedCollectionId
      ? papersState.collectionPapers?.papers ?? []
      : papersState.allPapers ?? [];
    return (raw as Paper[]).filter(isIndexedPaper);
  }, [papersState, selectedCollectionId]);

  const papersLoading = selectedCollectionId
    ? papersState.isLoadingCollection
    : papersState.isLoadingAll;

  const tree = useMemo(() => buildTree(collections), [collections]);

  const handleToggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectCollection = (id?: string) => {
    setSelectedCollectionId(id);
  };

  const togglePaper = (p: Paper) => {
    const item = toSelectedPaper(p);
    if (!item) return;

    setPendingSelection((prev) => {
      const next = new Map(prev);
      if (next.has(item.ragDocId)) {
        next.delete(item.ragDocId);
      } else {
        next.set(item.ragDocId, item);
      }
      return next;
    });
  };

  const isSelected = (ragDocId: string) => {
    return pendingSelection.has(ragDocId) || sources.some((s) => s.id === ragDocId);
  };

  const handleApply = () => {
    let addedCount = 0;
    pendingSelection.forEach((p) => {
      if (!sources.some((s) => s.id === p.ragDocId)) {
        addSource(p.ragDocId, p.name);
        addedCount++;
      }
    });

    if (addedCount > 0) {
      setFluxDataEnabled(true);
      toast.success(`Attached ${addedCount} paper(s) to AI context`);
    }

    setPendingSelection(new Map());
    onOpenChange(false);
  };

  const renderTree = (nodes: TreeNode[]) => {
    return nodes.map((node) => {
      const isExp = expanded.has(node.id);
      const isSel = selectedCollectionId === node.id;
      const hasChildren = node.children.length > 0;

      if (search && !branchNameMatches(node, search.toLowerCase())) {
        return null;
      }

      return (
        <div key={node.id} className="space-y-0.5">
          <button
            type="button"
            onClick={() => handleSelectCollection(node.id)}
            className={cn(
              'w-full flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-colors text-left',
              isSel ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted text-foreground/80',
            )}
          >
            {hasChildren ? (
              <span
                onClick={(e) => handleToggleExpand(node.id, e)}
                className="p-0.5 hover:bg-muted rounded"
              >
                <ChevronRight
                  className={cn('size-3 text-muted-foreground transition-transform', isExp && 'rotate-90')}
                />
              </span>
            ) : (
              <span className="size-4" />
            )}

            {isExp ? (
              <FolderOpen className="size-3.5 text-amber-500 shrink-0" />
            ) : (
              <Folder className="size-3.5 text-amber-500 shrink-0" />
            )}

            <span className="truncate flex-1">{node.name}</span>
          </button>

          {hasChildren && isExp && <div className="pl-3">{renderTree(node.children)}</div>}
        </div>
      );
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border/40">
          <DialogTitle className="text-base font-semibold">Select Sources from Library</DialogTitle>
        </DialogHeader>

        <div className="flex-1 grid grid-cols-1 md:grid-cols-5 divide-y md:divide-y-0 md:divide-x divide-border/40 overflow-hidden min-h-[350px]">
          {/* Collections tree */}
          <div className="md:col-span-2 p-3 flex flex-col overflow-hidden bg-muted/20">
            <div className="mb-2">
              <Input
                placeholder="Filter collections..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-7 text-xs"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-1">
              <button
                type="button"
                onClick={() => handleSelectCollection(undefined)}
                className={cn(
                  'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-left transition-colors',
                  selectedCollectionId === undefined
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'hover:bg-muted text-foreground/80',
                )}
              >
                <BookOpen className="size-3.5 text-primary shrink-0" />
                <span className="truncate">All Library Papers</span>
              </button>

              {collectionsLoading ? (
                <div className="p-2 space-y-1.5">
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-6 w-3/4" />
                </div>
              ) : (
                renderTree(tree)
              )}
            </div>
          </div>

          {/* Papers list in collection */}
          <div className="md:col-span-3 p-3 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto space-y-2">
              {papersLoading ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="size-5 animate-spin text-primary" />
                </div>
              ) : activePapers.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  No indexed papers found in this collection.
                </div>
              ) : (
                activePapers.map((paper) => {
                  const checked = isSelected(paper.ragDocId);
                  const alreadyAdded = sources.some((s) => s.id === paper.ragDocId);

                  return (
                    <div
                      key={paper.id}
                      onClick={() => !alreadyAdded && togglePaper(paper)}
                      className={cn(
                        'flex items-start gap-2.5 p-2.5 rounded-lg border text-xs transition-colors cursor-pointer',
                        alreadyAdded
                          ? 'border-border/40 bg-secondary/20 opacity-60 cursor-default'
                          : checked
                          ? 'border-primary/40 bg-primary/5'
                          : 'border-border/40 hover:bg-secondary/40',
                      )}
                    >
                      <Checkbox
                        checked={checked}
                        disabled={alreadyAdded}
                        onCheckedChange={() => !alreadyAdded && togglePaper(paper)}
                        className="mt-0.5"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <FileText className="size-3.5 text-primary shrink-0" />
                          <p className="font-medium text-foreground truncate">{paper.title}</p>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                          {[compactAuthors(paper), paper.year].filter(Boolean).join(' • ')}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border/40 flex items-center justify-between bg-muted/20">
          <span className="text-xs text-muted-foreground">
            {pendingSelection.size} new paper(s) selected
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleApply} disabled={pendingSelection.size === 0}>
              Attach Selected Sources
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default SourcePickerModal;
