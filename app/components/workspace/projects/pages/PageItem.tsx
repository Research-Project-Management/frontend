import {
  FileText,
  MoreHorizontal,
  Pencil,
  Trash2,
  ExternalLink,
  Clock,
} from "lucide-react";
import React, { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import type { Page } from "~/types/page";
import { useDeletePage, useUpdatePageTitle } from "~/query/page";
import { toast } from "sonner";

interface PageItemProps {
  page: Page;
  viewMode: "grid" | "list";
}

// Decorative "text lines" widths for the paper thumbnail preview
const LINE_WIDTHS = [100, 85, 92, 78, 95, 70, 88, 60, 76, 83, 65, 90];

function relativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function PageItem({ page, viewMode }: PageItemProps) {
  const navigate = useNavigate();
  const { workspaceId } = useParams();
  const projectId =
    typeof page.project === "string" ? page.project : page.project._id;
  const projectName =
    typeof page.project === "string" ? "—" : page.project.name;

  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [newTitle, setNewTitle] = useState(page.title);

  const deleteMutation = useDeletePage();
  const updateTitleMutation = useUpdatePageTitle();

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newTitle.trim();
    if (!trimmed || trimmed === page.title) {
      setIsRenameOpen(false);
      return;
    }
    try {
      await updateTitleMutation.mutateAsync({
        pageId: page._id,
        title: trimmed,
      });
      toast.success("Renamed successfully");
      setIsRenameOpen(false);
    } catch {
      toast.error("Failed to rename");
    }
  };

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync({ pageId: page._id, projectId });
      toast.success("Deleted");
      setIsDeleteOpen(false);
    } catch {
      toast.error("Failed to delete");
    }
  };

  const mainFileId =
    page.mainFile && typeof page.mainFile === "object"
      ? page.mainFile._id
      : ((page.mainFile as string | null | undefined) ?? null);
  const mainFileTitle =
    page.mainFile && typeof page.mainFile === "object"
      ? page.mainFile.title
      : null;

  const openEditor = () => {
    // Prefer project-scoped URL so PageLayout gets workspaceId & projectId in params
    if (workspaceId && projectId) {
      const base = `/${workspaceId}/projects/${projectId}/pages/${page._id}`;
      navigate(mainFileId ? `${base}?file=${mainFileId}` : base);
    } else {
      // Fallback to global editor route
      navigate(mainFileId ? `/editor/${page._id}?file=${mainFileId}` : `/editor/${page._id}`);
    }
  };

  const ActionMenu = () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 opacity-0 group-hover:opacity-100 transition-opacity data-[state=open]:opacity-100"
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={openEditor}>
          <ExternalLink className="size-4 mr-2" />
          Open
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            setNewTitle(page.title);
            setIsRenameOpen(true);
          }}
        >
          <Pencil className="size-4 mr-2" />
          Rename
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => setIsDeleteOpen(true)}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="size-4 mr-2" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const Dialogs = () => (
    <>
      {/* Rename */}
      <Dialog open={isRenameOpen} onOpenChange={setIsRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename document</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRename}>
            <div className="py-4">
              <Label htmlFor="rename-title" className="sr-only">
                Title
              </Label>
              <Input
                id="rename-title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Document title"
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsRenameOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updateTitleMutation.isPending}>
                {updateTitleMutation.isPending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete document</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>"{page.title}"</strong>?
              This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDeleteOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );

  // ── Grid card ──────────────────────────────────────────────────────────────

  if (viewMode === "grid") {
    return (
      <>
        <div className="group cursor-pointer" onClick={openEditor}>
          {/* Paper thumbnail */}
          <div className="relative bg-background border border-border rounded-lg overflow-hidden group-hover:shadow-md group-hover:border-primary/30 transition-all aspect-3/4">
            {page.pdfThumbnail ? (
              /* Last compiled PDF — first page preview */
              <img
                src={page.pdfThumbnail}
                alt={`${page.title} preview`}
                className="absolute inset-0 w-full h-full object-cover object-top"
                draggable={false}
              />
            ) : (
              /* Fallback: decorative text lines */
              <>
                <div className="absolute inset-0 flex flex-col justify-center gap-1.5 px-4 py-6 pointer-events-none">
                  {LINE_WIDTHS.map((w, i) => (
                    <div
                      key={i}
                      className="h-px bg-foreground/10 rounded-full"
                      style={{ width: `${w}%` }}
                    />
                  ))}
                </div>
                {/* Center icon + main file label */}
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
                  <FileText className="size-8 text-muted-foreground/15" />
                  {mainFileTitle && (
                    <span className="text text-muted-foreground/50 bg-muted/50 px-1.5 py-0.5 rounded font-mono">
                      {mainFileTitle}
                    </span>
                  )}
                </div>
              </>
            )}

            {/* Hover overlay */}
            <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/5 transition-colors flex items-center justify-center">
              <span className="opacity-0 group-hover:opacity-100 group-hover:translate-y-0 -translate-y-1 transition-all bg-primary text-primary-foreground text-xs px-3 py-1.5 rounded-full font-medium shadow">
                Open
              </span>
            </div>

            {/* Action button */}
            <div
              className="absolute top-1.5 right-1.5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="[&>button]:bg-background/80 [&>button]:backdrop-blur-sm [&>button]:hover:bg-background">
                <ActionMenu />
              </div>
            </div>
          </div>

          {/* Info below card */}
          <div className="mt-2 px-0.5">
            <p className="text font-medium truncate group-hover:text-primary transition-colors leading-snug">
              {page.title}
            </p>
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {projectName}
            </p>
            <p className="text-xs text-muted-foreground/60 flex items-center gap-1 mt-0.5">
              {relativeTime(page.updatedAt)}
            </p>
          </div>
        </div>
        <Dialogs />
      </>
    );
  }

  // ── List row ───────────────────────────────────────────────────────────────

  return (
    <>
      <div
        className="relative grid grid-cols-[1fr_200px_160px_60px] gap-4 px-5 py-3 items-center bg-card hover:bg-muted/40 border border-border/50 hover:border-primary/20 rounded-xl transition-all duration-200 cursor-pointer group hover:shadow-sm"
        onClick={openEditor}
      >
        {/* Title */}
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-200">
            <FileText className="size-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">
              {page.title}
            </p>
            <p className="text-xs text-muted-foreground/60 truncate mt-0.5">
              By {page.author?.name || "Author"}
            </p>
          </div>
        </div>

        {/* Project */}
        <div className="truncate">
          {projectName !== "—" ? (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/5 text-primary border border-primary/10 truncate max-w-full">
              {projectName}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground/40 font-mono">—</span>
          )}
        </div>

        {/* Date */}
        <span className="text-xs text-muted-foreground/80 flex items-center gap-1.5 font-medium">
          <Clock className="size-3.5 text-muted-foreground/40 shrink-0" />
          {relativeTime(page.updatedAt)}
        </span>

        {/* Actions — stopPropagation so click doesn't open editor */}
        <div onClick={(e) => e.stopPropagation()} className="flex justify-end">
          <ActionMenu />
        </div>
      </div>
      <Dialogs />
    </>
  );
}
