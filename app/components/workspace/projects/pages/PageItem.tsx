import {
  FileText,
  MoreHorizontal,
  Eye,
  Folder,
  Pencil,
  Trash2,
  Archive,
  CheckCircle2,
  FileEdit,
  ExternalLink,
} from "lucide-react";
import React, { useState } from "react";
import { pdfjs, Document, Page as PDFPage } from "react-pdf";
import { Link, useNavigate } from "react-router";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
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

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PageItemProps {
  page: Page;
  viewMode: "grid" | "list";
}

const statusColors: Record<string, string> = {
  draft: "bg-yellow-500/10 text-yellow-600 border-yellow-600/20",
  approved: "bg-green-500/10 text-green-600 border-green-600/20",
  archived: "bg-gray-500/10 text-gray-600 border-gray-600/20",
  published: "bg-blue-500/10 text-blue-600 border-blue-600/20",
};

export default function PageItem({ page, viewMode }: PageItemProps) {
  const navigate = useNavigate();
  const projectId =
    typeof page.project === "string" ? page.project : page.project._id;
  const projectName =
    typeof page.project === "string" ? page.project : page.project.name;
  const formattedDate = new Date(page.updatedAt).toLocaleDateString();

  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [newTitle, setNewTitle] = useState(page.title);

  const deleteMutation = useDeletePage();
  const updateTitleMutation = useUpdatePageTitle();

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || newTitle === page.title) {
      setIsRenameDialogOpen(false);
      return;
    }

    try {
      await updateTitleMutation.mutateAsync({
        pageId: page._id,
        title: newTitle.trim(),
      });
      toast.success("Page renamed successfully");
      setIsRenameDialogOpen(false);
    } catch (error) {
      toast.error("Failed to rename page");
    }
  };

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync({
        pageId: page._id,
        projectId,
      });
      toast.success("Page deleted successfully");
      setIsDeleteDialogOpen(false);
    } catch (error) {
      toast.error("Failed to delete page");
    }
  };

  const handleMenuClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  if (viewMode === "grid") {
    return (
      <>
        <Link
          to={`/editor/${page._id}`}
          className="bg-card border border-border rounded-xl overflow-hidden hover:border-primary/30 hover:shadow-lg transition-all cursor-pointer group flex flex-col"
        >
          {/* PDF Preview */}
          <div className="relative aspect-[3/4] bg-muted/30 overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center scale-[0.6] origin-top">
              <Document
                file="https://ontheline.trincoll.edu/images/bookdown/sample-local-pdf.pdf"
                loading={
                  <div className="flex items-center justify-center h-full">
                    <FileText className="w-12 h-12 text-muted-foreground/20" />
                  </div>
                }
                error={
                  <div className="flex items-center justify-center h-full">
                    <FileText className="w-12 h-12 text-muted-foreground/20" />
                  </div>
                }
              >
                <PDFPage
                  width={450}
                  pageNumber={1}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                  className="shadow-sm"
                />
              </Document>
            </div>

            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors" />

            {/* Status badge */}
            <div className="absolute top-2 left-2">
              <span
                className={`text-[10px] px-2 py-1 rounded-md font-medium backdrop-blur-sm border ${
                  statusColors[page.status] ||
                  "bg-gray-500/10 text-gray-600 border-gray-600/20"
                }`}
              >
                {page.status}
              </span>
            </div>

            {/* Action menu */}
            <div className="absolute top-2 right-2" onClick={handleMenuClick}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 bg-background/80 backdrop-blur-sm hover:bg-background opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.preventDefault();
                      navigate(`/editor/${page._id}`);
                    }}
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Open
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.preventDefault();
                      setNewTitle(page.title);
                      setIsRenameDialogOpen(true);
                    }}
                  >
                    <Pencil className="w-4 h-4 mr-2" />
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.preventDefault();
                      setIsDeleteDialogOpen(true);
                    }}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Info */}
          <div className="p-3 bg-card">
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <h3 className="text-sm font-medium text-foreground truncate flex-1 group-hover:text-primary transition-colors">
                {page.title}
              </h3>
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5 truncate max-w-[70%]">
                <Folder className="w-3 h-3 shrink-0" />
                <span className="truncate">{projectName}</span>
              </div>
              <span className="shrink-0">{formattedDate}</span>
            </div>
          </div>
        </Link>

        {/* Rename Dialog */}
        <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rename Page</DialogTitle>
              <DialogDescription>
                Enter a new name for this page
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleRename}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Page Title</Label>
                  <Input
                    id="title"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Enter page title"
                    autoFocus
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsRenameDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={updateTitleMutation.isPending}>
                  {updateTitleMutation.isPending ? "Saving..." : "Save"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Dialog */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Page</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete "{page.title}"? This action
                cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDeleteDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // List view - Match Recent component style
  return (
    <>
      <Link
        to={`/editor/${page._id}`}
        className="flex items-center gap-4 px-2 transition-all duration-200 cursor-pointer group"
      >
        {/* Project Icon */}
        <div className="h-8 w-8 flex items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors shrink-0">
          <FileText className="h-4 w-4" />
        </div>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="font-medium hover:underline underline-offset-2 text-gray-900 group-hover:text-primary transition-all truncate">
              {page.title}
            </h3>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-md font-medium capitalize border ${
                statusColors[page.status] ||
                "bg-gray-500/10 text-gray-600 border-gray-600/20"
              }`}
            >
              {page.status}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="font-medium">{projectName}</span>
            <span>•</span>
            <span>{formattedDate}</span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Eye className="w-3 h-3" />
              {page.views || 0}
            </span>
          </div>
        </div>

        {/* Hover Indicator */}
        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
          <ExternalLink className="h-4 w-4 text-gray-400 group-hover:text-primary" />
        </div>
      </Link>

      <div onClick={handleMenuClick} className="shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreHorizontal className="w-4 h-4 text-gray-500" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={(e) => {
                e.preventDefault();
                navigate(`/editor/${page._id}`);
              }}
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Open
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => {
                e.preventDefault();
                setNewTitle(page.title);
                setIsRenameDialogOpen(true);
              }}
            >
              <Pencil className="w-4 h-4 mr-2" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={(e) => {
                e.preventDefault();
                setIsDeleteDialogOpen(true);
              }}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Rename Dialog */}
      <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Page</DialogTitle>
            <DialogDescription>
              Enter a new name for this page
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRename}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">Page Title</Label>
                <Input
                  id="title"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Enter page title"
                  autoFocus
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsRenameDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updateTitleMutation.isPending}>
                {updateTitleMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Page</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{page.title}"? This action cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
