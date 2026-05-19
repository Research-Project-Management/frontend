import { useState, Fragment } from "react";
import {
  Plus,
  FolderOpen,
  FileText,
  ExternalLink,
  Trash2,
  User,
  CalendarDays,
  Tag,
  MessageSquare,
  BookOpen,
  Search,
  ChevronRight,
  MoreHorizontal,
} from "lucide-react";
import { useNavigate, useParams } from "react-router";
import { useWorkspace } from "~/query/workspace";
import {
  useCollectionPapers,
  useAddPaper,
  useDeletePaper,
  useCreateCollection,
  useCollections,
} from "~/query/library";
import CollectionCreateDialog from "../components/CollectionCreateDialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Skeleton } from "~/components/ui/skeleton";
import { cn } from "~/lib/utils";
import { API_URL } from "~/lib/api";
import PaperUploadDialog from "../components/PaperUploadDialog";
import type { Paper } from "~/types/library";
import { PaperTableRow } from "../components/PaperTableRow";
import { PaperDetailPanel } from "../components/PaperDetailPanel";

// ── Page ───────────────────────────────────────────────────────────────────────

export default function CollectionDetailPage() {
  const { workspaceId: workspaceUrl, collectionId } = useParams();
  const navigate = useNavigate();
  const { workspace } = useWorkspace(workspaceUrl!);
  const workspaceId = workspace?._id ?? "";

  const { data, isLoading } = useCollectionPapers(workspaceId, collectionId ?? "");
  const addPaperMutation = useAddPaper(workspaceId, collectionId ?? "");
  const deletePaperMutation = useDeletePaper(workspaceId, collectionId ?? "");
  const createSubMutation = useCreateCollection(workspaceId);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [subCreateOpen, setSubCreateOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedPaper, setSelectedPaper] = useState<Paper | null>(null);

  const collection = data?.collection;
  const papers = data?.papers ?? [];
  const filtered = papers.filter(
    (p) =>
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.authors.some((a) => a.toLowerCase().includes(search.toLowerCase())) ||
      (p.journal || "").toLowerCase().includes(search.toLowerCase()) ||
      (p.abstract || "").toLowerCase().includes(search.toLowerCase()),
  );

  const handleAddPaper = (paperData: Parameters<typeof addPaperMutation.mutate>[0]) => {
    addPaperMutation.mutate(paperData, { onSuccess: () => setUploadOpen(false) });
  };

  const handleDeletePaper = (paperId: string) => {
    if (!confirm("Remove this paper from the collection?")) return;
    deletePaperMutation.mutate(paperId);
    if (selectedPaper?._id === paperId) setSelectedPaper(null);
  };

  const { data: collections } = useCollections(workspaceId);
  const breadcrumbs = [];
  if (collections && collection) {
    let current = collection;
    const seen = new Set<string>();
    while (current) {
      if (seen.has(current._id)) break;
      seen.add(current._id);
      breadcrumbs.unshift(current);
      if (current.parent) {
        const p = collections.find(c => c._id === current.parent);
        if (p) current = p;
        else break;
      } else {
        break;
      }
    }
  }

  // Truncate if too many collections
  let visibleBreadcrumbs: Array<any> = breadcrumbs;
  if (breadcrumbs.length > 4) {
    visibleBreadcrumbs = [
      breadcrumbs[0],
      { isEllipsis: true, _id: "ellipsis" },
      breadcrumbs[breadcrumbs.length - 2],
      breadcrumbs[breadcrumbs.length - 1],
    ];
  }

  return (
    <div className="flex h-full overflow-hidden flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-10 shrink-0">
        <div className="flex items-center gap-2.5">
          {visibleBreadcrumbs.map((crumb, idx) => {
            if (crumb.isEllipsis) {
              return (
                <Fragment key={crumb._id}>
                  {idx > 0 && <ChevronRight className="size-3.5 text-muted-foreground/50 shrink-0" />}
                  <div className="flex items-center justify-center shrink-0">
                    <MoreHorizontal className="size-4 text-muted-foreground/60" />
                  </div>
                </Fragment>
              );
            }

            const isLast = idx === visibleBreadcrumbs.length - 1;
            return (
              <Fragment key={crumb._id}>
                {idx > 0 && <ChevronRight className="size-3.5 text-muted-foreground/50 shrink-0" />}
                <div 
                  className={cn(
                    "flex items-center gap-2", 
                    !isLast ? "cursor-pointer hover:underline" : ""
                  )}
                  onClick={() => {
                    if (!isLast) {
                      navigate(`/${workspaceUrl}/library/${crumb._id}`);
                    }
                  }}
                >
                  <FolderOpen className="size-4 shrink-0" style={{ color: crumb.color || "#3370ff" }} />
                  <span className="text-sm font-semibold text-primary truncate max-w-[150px]" title={crumb.name}>
                    {crumb.name}
                  </span>
                </div>
              </Fragment>
            );
          })}
          <span className="ml-1 text-xs text-muted-foreground tabular-nums bg-muted/50 px-1.5 py-0.5 rounded">
            {papers.length} papers
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Input
            placeholder="Search papers…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-64 text-sm hidden sm:block"
          />

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              onClick={() => setSubCreateOpen(true)}
            >
              New Subcollection
            </Button>
            <Button onClick={() => setUploadOpen(true)}>
              <Plus className="size-4 mr-1.5" />
              Add Paper
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                navigate(`/${workspaceUrl}/ai`, {
                  state: { preloadCollection: { id: collectionId, name: collection?.name } },
                })
              }
            >
              <img src="/Chat.svg" alt="Flux AI" className="size-4 mr-1.5" />
              Chat with Flux AI
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Table */}
        <div className="flex-1 min-w-0 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 space-y-1.5">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-9 rounded" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-center px-6">
              <p className="text-sm font-semibold text-foreground">
                {search ? "No papers match" : "No papers yet"}
              </p>
              <p className="text-xs text-muted-foreground">
                {search ? "Try a different keyword" : "Upload a PDF to get started"}
              </p>
              {!search && (
                <Button size="sm" onClick={() => setUploadOpen(true)}>
                  <Plus className="size-4 mr-1.5" />
                  Add first paper
                </Button>
              )}
            </div>
          ) : (
            <table className="w-full text-sm border-collapse table-fixed">
              <colgroup>
                <col className="w-8" />
                <col />
                <col className="w-[200px]" />
                <col className="w-[60px]" />
                <col className="w-[150px]" />
                <col className="w-[60px]" />
              </colgroup>
              <thead className="sticky top-0 z-10">
                <tr className="bg-card border-b border-border">
                  <th />
                  <th className="text-left py-1 pr-4 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Title
                  </th>
                  <th className="text-left py-1 pr-4 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Authors
                  </th>
                  <th className="text-left py-1 pr-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Year
                  </th>
                  <th className="text-left py-1 pr-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Journal
                  </th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((paper) => (
                  <PaperTableRow
                    key={paper._id}
                    paper={paper}
                    collection={null} // Omit collection column in collection view
                    isSelected={selectedPaper?._id === paper._id}
                    onSelect={setSelectedPaper}
                    onDelete={handleDeletePaper}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Detail panel */}
        {selectedPaper && <PaperDetailPanel paper={selectedPaper} collection={collection ?? null} workspaceId={workspaceId} />}
      </div>

      {workspaceId && (
        <PaperUploadDialog
          open={uploadOpen}
          onOpenChange={setUploadOpen}
          onSubmit={handleAddPaper}
          isPending={addPaperMutation.isPending}
          workspaceId={workspaceId}
        />
      )}

      {/* Create subcollection dialog */}
      <CollectionCreateDialog
        open={subCreateOpen}
        onOpenChange={setSubCreateOpen}
        onSubmit={(data) => {
          createSubMutation.mutate(
            { ...data, parent: collectionId },
            { onSuccess: () => setSubCreateOpen(false) },
          );
        }}
        isPending={createSubMutation.isPending}
        parentName={collection?.name}
      />
    </div>
  );
}
