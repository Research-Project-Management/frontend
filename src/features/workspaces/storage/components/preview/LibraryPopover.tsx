'use client';

import { useState } from "react";
import type { ReactNode } from "react";
import { BookOpen, Check, FolderOpen, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/components/ui";
import { usePapers, useCollections } from '@/features/workspaces/library';
import type { StorageItem } from '@/features/workspaces/storage/types/storage.types';
import type { PdfMetadata } from "@/features/editor/services/pdf.services";

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
      .map((author: string) => author.trim())
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

export default function LibraryPopover({
  item,
  workspaceId,
  metadata,
  trigger,
}: AddToLibraryPopoverProps) {
  const [open, setOpen] = useState(false);
  const [collectionId, setCollectionId] = useState("");
  const { state: { collections, isLoading }, actions: { create: createCollection } } = useCollections(workspaceId);
  const { actions: { addPaper }, state: { isAdding } } = usePapers({ workspaceId, collectionId });

  const selectedCollection = collections.find((c) => c._id === collectionId);

  const handleAdd = async () => {
    if (!collectionId || !selectedCollection || !item.url) return;

    try {
      await addPaper({
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
        labels: [],
      });
      toast.success(`Added to ${selectedCollection.name}. Indexing in background...`);
      setOpen(false);
      setCollectionId("");
    } catch (err) {
      toast.error("Failed to add PDF to Library");
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-3">
        <div className="flex items-center gap-2 pb-2">
          <BookOpen className="size-4 text-muted-foreground" />
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
                  <Check className="size-3.5 text-foreground" />
                )}
              </button>
            ))
          )}
        </div>

        <Button
          size="sm"
          className="mt-3 w-full"
          disabled={!collectionId || isAdding}
          onClick={handleAdd}
        >
          {isAdding && (
            <Loader2 className="size-3.5 mr-1.5 animate-spin" />
          )}
          Add PDF
        </Button>
      </PopoverContent>
    </Popover>
  );
}
