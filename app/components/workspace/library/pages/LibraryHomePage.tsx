import { useState } from "react";
import { Plus, Library, Search } from "lucide-react";
import { useParams } from "react-router";
import { useWorkspace } from "~/query/workspace";
import {
  useCollections,
  useCreateCollection,
  useUpdateCollection,
  useDeleteCollection,
} from "~/query/library";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Skeleton } from "~/components/ui/skeleton";
import CollectionCard from "../components/CollectionCard";
import CollectionCreateDialog from "../components/CollectionCreateDialog";

export default function LibraryHomePage() {
  const { workspaceId: workspaceUrl } = useParams();
  const { workspace } = useWorkspace(workspaceUrl!);
  const workspaceId = workspace?._id ?? "";

  const { data: collections, isLoading } = useCollections(workspaceId);
  const createMutation = useCreateCollection(workspaceId);
  const updateMutation = useUpdateCollection(workspaceId);
  const deleteMutation = useDeleteCollection(workspaceId);

  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = (collections ?? []).filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()),
  );

  const handleCreate = (data: {
    name: string;
    description: string;
    color: string;
  }) => {
    createMutation.mutate(data, {
      onSuccess: () => setCreateOpen(false),
    });
  };

  const handleRename = (id: string, name: string) => {
    updateMutation.mutate({ collectionId: id, name });
  };

  const handleDelete = (id: string) => {
    if (!confirm("Delete this collection and all its papers?")) return;
    deleteMutation.mutate(id);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <div className="flex items-center gap-2.5">
          <Library className="size-5 text-primary" />
          <h1 className="text-lg font-semibold">Library</h1>
          {collections && (
            <span className="text-xs text-muted-foreground bg-accent px-1.5 py-0.5 rounded-full">
              {collections.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative hidden sm:block">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Search collections…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 w-52 text-sm"
            />
          </div>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4 mr-1.5" />
            New Collection
          </Button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-36 rounded-xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10">
              <Library className="size-8 text-primary" />
            </div>
            <div>
              <p className="text-base font-semibold text-foreground">
                {search ? "No collections found" : "No collections yet"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {search
                  ? "Try a different keyword"
                  : "Create a collection to organize your research papers"}
              </p>
            </div>
            {!search && (
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="size-4 mr-1.5" />
                Create first collection
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((collection) => (
              <CollectionCard
                key={collection._id}
                collection={collection}
                onDelete={handleDelete}
                onRename={handleRename}
              />
            ))}
          </div>
        )}
      </div>

      <CollectionCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSubmit={handleCreate}
        isPending={createMutation.isPending}
      />
    </div>
  );
}
