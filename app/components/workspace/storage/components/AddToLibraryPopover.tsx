import { useState } from "react";
import type { ReactNode } from "react";
import { BookOpen, Check, FolderOpen, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { useAddPaper, useCollections } from "~/query/library";
import type { StorageItem } from "../types";
import type { PdfMetadata } from "./FilePreviewSidebar";

interface AddToLibraryPopoverProps {
  item: StorageItem;
  workspaceId: string;
  metadata?: PdfMetadata | null;
  trigger: ReactNode;
}

const toAuthors = (metadata?: PdfMetadata | null) => {
  if (metadata?.authors?.length) return metadata.authors;
  if (metadata?.author) {
    return metadata.author
      .split(/,|;|\band\b/i)
      .map((author) => author.trim())
      .filter(Boolean);
  }
  return [];
};

const toKeywords = (keywords?: string) =>
  keywords
    ? keywords
        .split(/,|;/)
        .map((keyword) => keyword.trim())
        .filter(Boolean)
    : [];

const toYear = (year?: string | number) => {
  if (typeof year === "number") return year;
  if (typeof year === "string") {
    const parsed = Number.parseInt(year, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

export default function AddToLibraryPopover({
  item,
  workspaceId,
  metadata,
  trigger,
}: AddToLibraryPopoverProps) {
  const [open, setOpen] = useState(false);
  const [collectionId, setCollectionId] = useState("");
  const { data: collections = [], isLoading } = useCollections(workspaceId);
  const addPaperMutation = useAddPaper(workspaceId, collectionId);

  const selectedCollection = collections.find((c) => c._id === collectionId);

  const handleAdd = () => {
    if (!collectionId || !selectedCollection || !item.url) return;

    addPaperMutation.mutate(
      {
        title: metadata?.title || item.filename.replace(/\.pdf$/i, ""),
        authors: toAuthors(metadata),
        year: toYear(metadata?.year),
        doi: metadata?.doi || "",
        abstract: metadata?.abstract || "",
        keywords: toKeywords(metadata?.keywords),
        journal: metadata?.journal || "",
        publisher: metadata?.publisher || "",
        fileUrl: item.url,
        filename: item.filename,
        mimeType: item.mimeType || "application/pdf",
        size: item.size || 0,
        tags: [],
      },
      {
        onSuccess: () => {
          toast.success(`Added to ${selectedCollection.name}. Indexing in background...`);
          setOpen(false);
          setCollectionId("");
        },
        onError: () => toast.error("Failed to add PDF to Library"),
      },
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-3">
        <div className="flex items-center gap-2 pb-2">
          <BookOpen className="size-4 text-primary" />
          <p className="text-sm font-semibold">Add to Library</p>
        </div>

        <div className="max-h-56 overflow-y-auto space-y-1 py-1">
          {isLoading ? (
            <div className="flex items-center gap-2 px-2 py-3 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              Loading collections...
            </div>
          ) : collections.length === 0 ? (
            <p className="px-2 py-3 text-xs text-muted-foreground">
              No library collections yet.
            </p>
          ) : (
            collections.map((collection) => (
              <button
                key={collection._id}
                onClick={() => setCollectionId(collection._id)}
                className="w-full flex items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-accent"
              >
                <FolderOpen
                  className="size-4 shrink-0"
                  style={{ color: collection.color || "#3370ff" }}
                />
                <span className="min-w-0 flex-1 truncate text-xs font-medium">
                  {collection.name}
                </span>
                {collectionId === collection._id && (
                  <Check className="size-3.5 text-primary" />
                )}
              </button>
            ))
          )}
        </div>

        <Button
          size="sm"
          className="mt-3 w-full"
          disabled={!collectionId || addPaperMutation.isPending}
          onClick={handleAdd}
        >
          {addPaperMutation.isPending && (
            <Loader2 className="size-3.5 mr-1.5 animate-spin" />
          )}
          Add PDF
        </Button>
      </PopoverContent>
    </Popover>
  );
}
