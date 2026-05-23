import { useMemo, useState } from "react";
import {
  BookOpen,
  ChevronRight,
  FileText,
  Folder,
  FolderOpen,
  Loader2,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Skeleton } from "~/components/ui/skeleton";
import { useChatMode } from "~/contexts/ChatModeContext";
import { cn } from "~/lib/utils";
import { useCollections, useCollectionPapers } from "~/query/library";
import type { Collection, Paper } from "~/types/library";

interface SourcePickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
}

type SelectedPaper = {
  id: string;
  name: string;
  ragDocId: string;
};

// ── Tree builder ──────────────────────────────────────────────────────────────

type TreeNode = Collection & { children: TreeNode[] };

function buildTree(collections: Collection[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  for (const c of collections) map.set(c._id, { ...c, children: [] });

  for (const node of map.values()) {
    if (node.parent && map.has(node.parent)) {
      map.get(node.parent)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function branchNameMatches(node: TreeNode, query: string): boolean {
  return (
    node.name.toLowerCase().includes(query) ||
    node.children.some((child) => branchNameMatches(child, query))
  );
}

const isIndexedPaper = (paper: Paper) =>
  paper.ragStatus === "indexed" && Boolean(paper.ragDocId);

const toSelectedPaper = (paper: Paper): SelectedPaper | null => {
  if (!paper.ragDocId || !isIndexedPaper(paper)) return null;
  return { id: paper._id, name: paper.title, ragDocId: paper.ragDocId };
};

const compactAuthors = (paper: Paper) => {
  if (!paper.authors.length) return "";
  const authors = paper.authors.slice(0, 2).join(", ");
  return paper.authors.length > 2 ? `${authors} +${paper.authors.length - 2}` : authors;
};

function PaperStatus({ paper }: { paper: Paper }) {
  if (paper.ragStatus === "pending") return <Loader2 className="size-3 animate-spin text-amber-500" />;
  if (paper.ragStatus === "failed") return <span className="size-2 rounded-full bg-destructive" />;
  if (isIndexedPaper(paper)) return <span className="size-2 rounded-full bg-emerald-500" />;
  return <span className="size-2 rounded-full bg-muted-foreground/35" />;
}

// ── CollectionTreeNode (recursive) ────────────────────────────────────────────

function CollectionTreeNode({
  node,
  depth,
  workspaceId,
  search,
  expandedIds,
  selected,
  onToggleExpanded,
  onTogglePaper,
  onTogglePapers,
}: {
  node: TreeNode;
  depth: number;
  workspaceId: string;
  search: string;
  expandedIds: Set<string>;
  selected: Map<string, SelectedPaper>;
  onToggleExpanded: (id: string) => void;
  onTogglePaper: (paper: Paper) => void;
  onTogglePapers: (papers: Paper[]) => void;
}) {
  const expanded = expandedIds.has(node._id);
  const { data, isLoading } = useCollectionPapers(workspaceId, node._id);
  const papers = data?.papers ?? [];
  const query = search.trim().toLowerCase();

  const visiblePapers = useMemo(() => {
    if (!query) return papers;
    return papers.filter(
      (p) =>
        p.title.toLowerCase().includes(query) ||
        p.authors.some((a) => a.toLowerCase().includes(query)) ||
        p.journal.toLowerCase().includes(query),
    );
  }, [papers, query]);

  const indexedPapers = papers.filter(isIndexedPaper);
  const visibleIndexedPapers = visiblePapers.filter(isIndexedPaper);
  const selectionScope = query ? visibleIndexedPapers : indexedPapers;
  const selectedCount = selectionScope.filter((p) => selected.has(p._id)).length;
  const allSelected = selectionScope.length > 0 && selectedCount === selectionScope.length;
  const someSelected = selectedCount > 0 && !allSelected;

  const hasChildren = node.children.length > 0;
  const childNameMatches = hasChildren && node.children.some((child) => branchNameMatches(child, query));

  // Filter: show if name matches, or has visible papers, or children may match
  const shouldShow =
    !query ||
    node.name.toLowerCase().includes(query) ||
    visiblePapers.length > 0 ||
    childNameMatches ||
    hasChildren;

  if (!shouldShow) return null;

  const indent = depth * 16;
  const forcedOpen = Boolean(query && hasChildren);
  const showChildren = hasChildren && (expanded || forcedOpen);
  const showContent = expanded || forcedOpen;

  return (
    <div>
      {/* Collection header row */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => onToggleExpanded(node._id)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggleExpanded(node._id);
          }
        }}
        className={cn(
          "group flex h-9 items-center gap-2 rounded-md px-2 text-sm transition-colors cursor-pointer",
          showContent ? "bg-muted/60" : "hover:bg-muted/50",
        )}
        style={{ paddingLeft: `${8 + indent}px` }}
      >
        <Checkbox
          checked={someSelected ? "indeterminate" : allSelected}
          disabled={isLoading || selectionScope.length === 0}
          onCheckedChange={() => onTogglePapers(selectionScope)}
          aria-label={`Select ${node.name}`}
          onClick={(e) => e.stopPropagation()}
        />

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpanded(node._id);
          }}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
        >
          {/* Caret */}
          <ChevronRight
            className={cn(
              "size-3.5 shrink-0 text-muted-foreground transition-transform",
              showContent && "rotate-90",
            )}
          />

          {/* Folder icon */}
          {showContent ? (
            <FolderOpen className="size-3.5 shrink-0" style={{ color: node.color || "#3370ff" }} />
          ) : (
            <Folder className="size-3.5 shrink-0" style={{ color: node.color || "#3370ff" }} />
          )}

          <span className="truncate text-sm font-medium text-foreground">{node.name}</span>

          <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">
            {isLoading ? "…" : `${indexedPapers.length}/${node.paperCount}`}
          </span>
        </button>
      </div>

      {/* Expanded content */}
      {showContent && (
        <div>
          {/* Papers */}
          <div style={{ paddingLeft: `${indent + 32}px` }} className="border-l border-border/50 ml-4 pl-2 py-0.5">
            {isLoading ? (
              <div className="space-y-1 py-1">
                {Array.from({ length: 2 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 rounded-md" />
                ))}
              </div>
            ) : visiblePapers.length === 0 && !hasChildren ? (
              <div className="px-2 py-2 text-xs text-muted-foreground">No papers</div>
            ) : (
              <div className="space-y-0.5 py-0.5">
                {visiblePapers.map((paper) => {
                  const indexed = isIndexedPaper(paper);
                  const checked = selected.has(paper._id);
                  const authors = compactAuthors(paper);

                  return (
                    <label
                      key={paper._id}
                      className={cn(
                        "flex min-h-8 cursor-pointer items-center gap-2 rounded-md px-2 py-1 transition-colors",
                        checked && "bg-primary/8",
                        indexed ? "hover:bg-muted" : "cursor-not-allowed opacity-50",
                      )}
                    >
                      <Checkbox
                        checked={checked}
                        disabled={!indexed}
                        onCheckedChange={() => onTogglePaper(paper)}
                        aria-label={`Select ${paper.title}`}
                      />
                      <FileText className="size-3.5 shrink-0 text-muted-foreground/60" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-medium text-foreground">{paper.title}</div>
                        {(authors || paper.year) && (
                          <div className="truncate text-[10px] text-muted-foreground">
                            {[authors, paper.year].filter(Boolean).join(" · ")}
                          </div>
                        )}
                      </div>
                      <PaperStatus paper={paper} />
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Subcollections (recursive) */}
          {showChildren && (
            <div>
              {node.children.map((child) => (
                <CollectionTreeNode
                  key={child._id}
                  node={child}
                  depth={depth + 1}
                  workspaceId={workspaceId}
                  search={search}
                  expandedIds={expandedIds}
                  selected={selected}
                  onToggleExpanded={onToggleExpanded}
                  onTogglePaper={onTogglePaper}
                  onTogglePapers={onTogglePapers}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── LibraryTree ───────────────────────────────────────────────────────────────

function LibraryTree({
  workspaceId,
  search,
  selected,
  expandedIds,
  onToggleExpanded,
  onTogglePaper,
  onTogglePapers,
}: {
  workspaceId: string;
  search: string;
  selected: Map<string, SelectedPaper>;
  expandedIds: Set<string>;
  onToggleExpanded: (collectionId: string) => void;
  onTogglePaper: (paper: Paper) => void;
  onTogglePapers: (papers: Paper[]) => void;
}) {
  const { data: collections, isLoading } = useCollections(workspaceId);

  const tree = useMemo(() => buildTree(collections ?? []), [collections]);

  if (isLoading) {
    return (
      <div className="space-y-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-9 rounded-md" />
        ))}
      </div>
    );
  }

  if (!collections?.length) {
    return (
      <div className="flex h-48 flex-col items-center justify-center text-center">
        <BookOpen className="mb-2 size-5 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">No collections</p>
        <p className="text-xs text-muted-foreground mt-1">
          Create a collection in the Library first
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {tree.map((node) => (
        <CollectionTreeNode
          key={node._id}
          node={node}
          depth={0}
          workspaceId={workspaceId}
          search={search}
          expandedIds={expandedIds}
          selected={selected}
          onToggleExpanded={onToggleExpanded}
          onTogglePaper={onTogglePaper}
          onTogglePapers={onTogglePapers}
        />
      ))}
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────

export default function SourcePickerModal({
  open,
  onOpenChange,
  workspaceId,
}: SourcePickerModalProps) {
  const { addSource, setFluxDataEnabled } = useChatMode();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Map<string, SelectedPaper>>(new Map());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [processing, setProcessing] = useState(false);

  const reset = () => {
    setSearch("");
    setSelected(new Map());
    setExpandedIds(new Set());
    setProcessing(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) reset();
    onOpenChange(nextOpen);
  };

  const handleToggleExpanded = (collectionId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(collectionId)) next.delete(collectionId);
      else next.add(collectionId);
      return next;
    });
  };

  const handleTogglePaper = (paper: Paper) => {
    const source = toSelectedPaper(paper);
    if (!source) return;
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(paper._id)) next.delete(paper._id);
      else next.set(paper._id, source);
      return next;
    });
  };

  const handleTogglePapers = (papers: Paper[]) => {
    const sources = papers
      .map(toSelectedPaper)
      .filter((p): p is SelectedPaper => Boolean(p));
    if (!sources.length) return;
    setSelected((prev) => {
      const next = new Map(prev);
      const allSelected = sources.every((p) => next.has(p.id));
      sources.forEach((p) => {
        if (allSelected) next.delete(p.id);
        else next.set(p.id, p);
      });
      return next;
    });
  };

  const handleConfirm = () => {
    if (!selected.size) return;
    setProcessing(true);
    selected.forEach((paper) => addSource(paper.ragDocId, paper.name));
    setFluxDataEnabled(true);
    toast.success(`Added ${selected.size} source${selected.size > 1 ? "s" : ""}`);
    setProcessing(false);
    handleOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[78vh] gap-0 overflow-hidden p-0 sm:max-w-xl">
        <div className="flex min-h-0 w-full flex-col">
          <DialogHeader className="border-b border-border px-4 py-3">
            <DialogTitle className="text-sm font-semibold">
              Library
            </DialogTitle>
          </DialogHeader>

          <div className="border-b border-border px-3 py-2.5">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search collections and papers…"
                className="h-8 pl-8 text-xs"
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
            <LibraryTree
              workspaceId={workspaceId}
              search={search}
              selected={selected}
              expandedIds={expandedIds}
              onToggleExpanded={handleToggleExpanded}
              onTogglePaper={handleTogglePaper}
              onTogglePapers={handleTogglePapers}
            />
          </div>

          <div className="flex items-center justify-between border-t border-border px-4 py-3">
            <span className="text-xs text-muted-foreground">
              {selected.size > 0 ? (
                <>{selected.size} paper{selected.size > 1 ? "s" : ""} selected</>
              ) : (
                "Select papers to add as AI context"
              )}
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={!selected.size || processing}
                onClick={handleConfirm}
              >
                {processing && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
                Add {selected.size > 0 ? selected.size : ""} source{selected.size !== 1 ? "s" : ""}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
