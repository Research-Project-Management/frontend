import { useMemo, useState } from "react";
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  FileText,
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
  if (paper.ragStatus === "pending") {
    return <Loader2 className="size-3 animate-spin text-amber-500" />;
  }
  if (paper.ragStatus === "failed") {
    return <span className="size-2 rounded-full bg-destructive" />;
  }
  if (isIndexedPaper(paper)) {
    return <span className="size-2 rounded-full bg-emerald-500" />;
  }
  return <span className="size-2 rounded-full bg-muted-foreground/35" />;
}

function CollectionTreeNode({
  collection,
  workspaceId,
  search,
  expanded,
  selected,
  onToggleExpanded,
  onTogglePaper,
  onTogglePapers,
}: {
  collection: Collection;
  workspaceId: string;
  search: string;
  expanded: boolean;
  selected: Map<string, SelectedPaper>;
  onToggleExpanded: (collectionId: string) => void;
  onTogglePaper: (paper: Paper) => void;
  onTogglePapers: (papers: Paper[]) => void;
}) {
  const { data, isLoading } = useCollectionPapers(workspaceId, collection._id);
  const papers = data?.papers ?? [];
  const query = search.trim().toLowerCase();

  const visiblePapers = useMemo(() => {
    if (!query) return papers;
    return papers.filter(
      (paper) =>
        paper.title.toLowerCase().includes(query) ||
        paper.authors.some((author) => author.toLowerCase().includes(query)) ||
        paper.journal.toLowerCase().includes(query),
    );
  }, [papers, query]);

  const indexedPapers = papers.filter(isIndexedPaper);
  const visibleIndexedPapers = visiblePapers.filter(isIndexedPaper);
  const selectionScope = query ? visibleIndexedPapers : indexedPapers;
  const selectedCount = selectionScope.filter((paper) => selected.has(paper._id)).length;
  const allSelected =
    selectionScope.length > 0 && selectedCount === selectionScope.length;
  const someSelected = selectedCount > 0 && !allSelected;
  const shouldShow = !query || collection.name.toLowerCase().includes(query) || visiblePapers.length > 0;

  if (!shouldShow) return null;

  return (
    <div className="select-none">
      <div
        className={cn(
          "group flex h-10 items-center gap-2 rounded-md px-2 text-sm transition-colors",
          expanded && "bg-muted/60",
          "hover:bg-muted",
        )}
      >
        <Checkbox
          checked={someSelected ? "indeterminate" : allSelected}
          disabled={isLoading || selectionScope.length === 0}
          onCheckedChange={() => onTogglePapers(selectionScope)}
          aria-label={`Select ${collection.name}`}
        />

        <button
          type="button"
          onClick={() => onToggleExpanded(collection._id)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          {expanded ? (
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          )}
          <FolderOpen
            className="size-4 shrink-0"
            style={{ color: collection.color || "#3370ff" }}
          />
          <span className="truncate font-medium text-foreground">{collection.name}</span>
          <span className="ml-auto shrink-0 text-xs text-muted-foreground">
            {isLoading ? "..." : `${indexedPapers.length}/${collection.paperCount}`}
          </span>
        </button>
      </div>

      {expanded && (
        <div className="ml-[31px] border-l border-border/70 py-1 pl-3">
          {isLoading ? (
            <div className="space-y-1">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-8 rounded-md" />
              ))}
            </div>
          ) : visiblePapers.length === 0 ? (
            <div className="px-2 py-2 text-xs text-muted-foreground">No papers</div>
          ) : (
            <div className="space-y-0.5">
              {visiblePapers.map((paper) => {
                const indexed = isIndexedPaper(paper);
                const checked = selected.has(paper._id);
                const authors = compactAuthors(paper);

                return (
                  <label
                    key={paper._id}
                    className={cn(
                      "flex min-h-9 cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 transition-colors",
                      checked && "bg-primary/8",
                      indexed ? "hover:bg-muted" : "cursor-not-allowed opacity-60",
                    )}
                  >
                    <Checkbox
                      checked={checked}
                      disabled={!indexed}
                      onCheckedChange={() => onTogglePaper(paper)}
                      aria-label={`Select ${paper.title}`}
                    />
                    <FileText className="size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm text-foreground">{paper.title}</div>
                      {(authors || paper.year) && (
                        <div className="truncate text-[11px] text-muted-foreground">
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
      )}
    </div>
  );
}

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

  const visibleCollections = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (collections ?? []).filter(
      (collection) => !query || collection.name.toLowerCase().includes(query) || collection.paperCount > 0,
    );
  }, [collections, search]);

  if (isLoading) {
    return (
      <div className="space-y-1">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-10 rounded-md" />
        ))}
      </div>
    );
  }

  if (!collections?.length) {
    return (
      <div className="flex h-48 flex-col items-center justify-center text-center">
        <BookOpen className="mb-2 size-5 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">No collections</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {visibleCollections.map((collection) => (
        <CollectionTreeNode
          key={collection._id}
          collection={collection}
          workspaceId={workspaceId}
          search={search}
          expanded={expandedIds.has(collection._id)}
          selected={selected}
          onToggleExpanded={onToggleExpanded}
          onTogglePaper={onTogglePaper}
          onTogglePapers={onTogglePapers}
        />
      ))}
    </div>
  );
}

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
    setExpandedIds((previous) => {
      const next = new Set(previous);
      if (next.has(collectionId)) next.delete(collectionId);
      else next.add(collectionId);
      return next;
    });
  };

  const handleTogglePaper = (paper: Paper) => {
    const source = toSelectedPaper(paper);
    if (!source) return;

    setSelected((previous) => {
      const next = new Map(previous);
      if (next.has(paper._id)) next.delete(paper._id);
      else next.set(paper._id, source);
      return next;
    });
  };

  const handleTogglePapers = (papers: Paper[]) => {
    const sources = papers
      .map(toSelectedPaper)
      .filter((paper): paper is SelectedPaper => Boolean(paper));
    if (!sources.length) return;

    setSelected((previous) => {
      const next = new Map(previous);
      const allSelected = sources.every((paper) => next.has(paper.id));
      sources.forEach((paper) => {
        if (allSelected) next.delete(paper.id);
        else next.set(paper.id, paper);
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
            <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
              <BookOpen className="size-4 text-primary" />
              Library
            </DialogTitle>
          </DialogHeader>

          <div className="border-b border-border px-4 py-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search"
                className="h-8 pl-8 text-sm"
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
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
              {selected.size} selected
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
                {processing && <Loader2 className="size-4 animate-spin" />}
                Add
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
