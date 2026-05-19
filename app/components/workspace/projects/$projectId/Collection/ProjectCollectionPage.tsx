import { useState } from "react";
import { Plus, BookMarked, Search, FolderOpen, Trash2, Import, BookOpen } from "lucide-react";
import { useParams } from "react-router";
import { useWorkspace } from "~/query/workspace";
import {
  useProjectCollections,
  useCreateProjectCollection,
  useDeleteProjectCollection,
  useImportLibraryCollection,
  useCollections,
} from "~/query/library";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "~/components/ui/dialog";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import type { ProjectCollection } from "~/types/library";
import { API_URL } from "~/lib/api";

// ── Create project collection dialog ─────────────────────────────────────────

function CreatePCDialog({
  open,
  onOpenChange,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (name: string) => void;
  isPending: boolean;
}) {
  const [name, setName] = useState("");
  const reset = () => setName("");
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>New Collection</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="pc-name">Name *</Label>
            <Input
              id="pc-name"
              placeholder="e.g. Reference Papers"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && name.trim() && onSubmit(name.trim())}
              autoFocus
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={() => onSubmit(name.trim())} disabled={!name.trim() || isPending}>
            {isPending ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Import from Library dialog ────────────────────────────────────────────────

function ImportLibraryDialog({
  open,
  onOpenChange,
  onImport,
  workspaceId,
  isPending,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onImport: (collectionId: string) => void;
  workspaceId: string;
  isPending: boolean;
}) {
  const { data: collections } = useCollections(workspaceId);
  const [selected, setSelected] = useState("");

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) setSelected(""); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Import className="size-4" />
            Import from Library
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <Label>Library Collection</Label>
            <Select value={selected} onValueChange={setSelected}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a collection…" />
              </SelectTrigger>
              <SelectContent>
                {(collections ?? []).map((c) => (
                  <SelectItem key={c._id} value={c._id}>
                    <span className="flex items-center gap-2">
                      <span
                        className="size-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: c.color }}
                      />
                      {c.name}
                      <span className="text-muted-foreground text-xs">
                        ({c.paperCount} papers)
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">
            All papers from the selected Library collection will be linked to this project collection.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={() => onImport(selected)} disabled={!selected || isPending}>
            {isPending ? "Importing…" : "Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Project Collection Card ───────────────────────────────────────────────────

function PCCard({
  pc,
  onDelete,
  workspaceId,
}: {
  pc: ProjectCollection;
  onDelete: (id: string) => void;
  workspaceId: string;
}) {
  const activePapers = pc.papers.filter((p) => p.paper !== null);

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3 hover:shadow-sm hover:border-primary/20 transition-all duration-150">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <FolderOpen className="size-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">
              {pc.name}
            </p>
            {pc.sourceCollection && (
              <p className="text-xs text-muted-foreground truncate">
                ↳ from Library: {pc.sourceCollection.name}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={() => onDelete(pc._id)}
          className="shrink-0 flex size-7 items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          title="Delete collection"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>

      {/* Paper list preview */}
      {activePapers.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">No papers yet</p>
      ) : (
        <div className="space-y-1.5">
          {activePapers.slice(0, 4).map((ref) => (
            <div key={ref.paper!._id} className="flex items-center gap-2 group/paper">
              <BookOpen className="size-3.5 text-muted-foreground shrink-0" />
              <a
                href={
                  ref.paper!.fileUrl?.startsWith("/api/files/")
                    ? `${API_URL}${ref.paper!.fileUrl}`
                    : ref.paper!.fileUrl
                }
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-foreground truncate hover:text-primary hover:underline transition-colors"
              >
                {ref.paper!.title}
              </a>
            </div>
          ))}
          {activePapers.length > 4 && (
            <p className="text-xs text-muted-foreground pl-5">
              +{activePapers.length - 4} more
            </p>
          )}
        </div>
      )}

      {/* Footer count */}
      <p className="text-xs text-muted-foreground">
        {activePapers.length} {activePapers.length === 1 ? "paper" : "papers"}
      </p>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ProjectCollectionPage() {
  const { workspaceId: workspaceUrl, projectId } = useParams();
  const { workspace } = useWorkspace(workspaceUrl!);
  const workspaceId = workspace?._id ?? "";

  const { data: projectCollections, isLoading } = useProjectCollections(
    projectId ?? "",
  );
  const createMutation = useCreateProjectCollection(projectId ?? "");
  const deleteMutation = useDeleteProjectCollection(projectId ?? "");
  const importMutation = useImportLibraryCollection(projectId ?? "");

  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importTargetPcId, setImportTargetPcId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const filtered = (projectCollections ?? []).filter((pc) =>
    pc.name.toLowerCase().includes(search.toLowerCase()),
  );

  const handleCreate = (name: string) => {
    createMutation.mutate({ name }, { onSuccess: () => setCreateOpen(false) });
  };

  const handleDelete = (id: string) => {
    if (!confirm("Delete this project collection?")) return;
    deleteMutation.mutate(id);
  };

  const handleImport = (collectionId: string) => {
    if (!importTargetPcId) return;
    importMutation.mutate(
      { pcId: importTargetPcId, collectionId },
      {
        onSuccess: () => {
          setImportOpen(false);
          setImportTargetPcId(null);
        },
      },
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <div className="flex items-center gap-2.5">
          <BookMarked className="size-5 text-primary" />
          <h1 className="text-lg font-semibold">Collection</h1>
          {projectCollections && (
            <span className="text-xs text-muted-foreground bg-accent px-1.5 py-0.5 rounded-full">
              {projectCollections.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative hidden sm:block">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 w-44 text-sm"
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              // Import into existing or create first
              if ((projectCollections ?? []).length > 0) {
                setImportTargetPcId(projectCollections![0]._id);
                setImportOpen(true);
              } else {
                alert("Create a collection first, then import from Library.");
              }
            }}
          >
            <Import className="size-4 mr-1.5" />
            Import from Library
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4 mr-1.5" />
            New Collection
          </Button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10">
              <BookMarked className="size-7 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {search ? "No collections match" : "No collections yet"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {search
                  ? "Try a different keyword"
                  : "Create a collection or import from the workspace Library"}
              </p>
            </div>
            {!search && (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}>
                  <Plus className="size-4 mr-1" />
                  New Collection
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((pc) => (
              <PCCard
                key={pc._id}
                pc={pc}
                onDelete={handleDelete}
                workspaceId={workspaceId}
              />
            ))}
          </div>
        )}
      </div>

      <CreatePCDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSubmit={handleCreate}
        isPending={createMutation.isPending}
      />

      {workspaceId && (
        <ImportLibraryDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          onImport={handleImport}
          workspaceId={workspaceId}
          isPending={importMutation.isPending}
        />
      )}
    </div>
  );
}
