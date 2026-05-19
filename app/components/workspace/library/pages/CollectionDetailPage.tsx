import { useState } from "react";
import { Plus, ArrowLeft, BookOpen, Search, FolderOpen, MessageSquare } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router";
import { useWorkspace } from "~/query/workspace";
import {
  useCollectionPapers,
  useAddPaper,
  useDeletePaper,
} from "~/query/library";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Skeleton } from "~/components/ui/skeleton";
import PaperRow from "../components/PaperRow";
import PaperUploadDialog from "../components/PaperUploadDialog";

export default function CollectionDetailPage() {
  const { workspaceId: workspaceUrl, collectionId } = useParams();
  const navigate = useNavigate();
  const { workspace } = useWorkspace(workspaceUrl!);
  const workspaceId = workspace?._id ?? "";

  const { data, isLoading } = useCollectionPapers(
    workspaceId,
    collectionId ?? "",
  );
  const addPaperMutation = useAddPaper(workspaceId, collectionId ?? "");
  const deletePaperMutation = useDeletePaper(workspaceId, collectionId ?? "");

  const [uploadOpen, setUploadOpen] = useState(false);
  const [search, setSearch] = useState("");

  const collection = data?.collection;
  const papers = data?.papers ?? [];
  const filtered = papers.filter(
    (p) =>
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.authors.some((a) => a.toLowerCase().includes(search.toLowerCase())),
  );

  const handleAddPaper = (paperData: Parameters<typeof addPaperMutation.mutate>[0]) => {
    addPaperMutation.mutate(paperData, {
      onSuccess: () => setUploadOpen(false),
    });
  };

  const handleDeletePaper = (paperId: string) => {
    if (!confirm("Remove this paper from the collection?")) return;
    deletePaperMutation.mutate(paperId);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="px-6 py-4 border-b border-border shrink-0">
        <div className="flex items-center gap-2 mb-3">
          <Link
            to={`/${workspaceUrl}/library`}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-3.5" />
            Library
          </Link>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="flex size-9 shrink-0 items-center justify-center rounded-lg"
              style={{
                backgroundColor: `${collection?.color ?? "#3370ff"}18`,
              }}
            >
              <FolderOpen
                className="size-5"
                style={{ color: collection?.color ?? "#3370ff" }}
              />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-semibold text-foreground truncate">
                {isLoading ? (
                  <Skeleton className="h-5 w-40" />
                ) : (
                  collection?.name ?? "Collection"
                )}
              </h1>
              {collection?.description && (
                <p className="text-xs text-muted-foreground truncate">
                  {collection.description}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="relative hidden sm:block">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                placeholder="Search papers…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 w-48 text-sm"
              />
            </div>
            <Button size="sm" onClick={() => setUploadOpen(true)}>
              <Plus className="size-4 mr-1.5" />
              Add Paper
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                navigate(`/${workspaceUrl}/ai`, {
                  state: {
                    preloadCollection: {
                      id: collectionId,
                      name: collection?.name,
                    },
                  },
                })
              }
            >
              <MessageSquare className="size-4 mr-1.5" />
              Chat with AI
            </Button>
          </div>
        </div>
      </header>

      {/* Paper list */}
      <div className="flex-1 overflow-y-auto p-6 space-y-2">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10">
              <BookOpen className="size-7 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {search ? "No papers match your search" : "No papers yet"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {search
                  ? "Try a different keyword"
                  : "Upload a PDF to get started"}
              </p>
            </div>
            {!search && (
              <Button size="sm" onClick={() => setUploadOpen(true)}>
                <Plus className="size-4 mr-1.5" />
                Add first paper
              </Button>
            )}
          </div>
        ) : (
          filtered.map((paper) => (
            <PaperRow
              key={paper._id}
              paper={paper}
              onDelete={handleDeletePaper}
            />
          ))
        )}
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
    </div>
  );
}
