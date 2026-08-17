'use client';

import { useState } from "react";
import type { ReactNode } from "react";
import { BookOpen, Check, FolderOpen, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/shared/lib/api";
import { getErrorMessage } from "@/shared/utils/error.util";
import { Button } from "@/shared/components/ui";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/components/ui";
import type { StorageItem } from '@/features/workspaces/storage/types/storage.types';

export interface StoragePdfMetadata {
  title?: string;
  author?: string;
  authors?: string[];
  year?: string | number;
  doi?: string;
  abstract?: string;
  keywords?: string;
  journal?: string;
  publisher?: string;
}

interface AddToLibraryPopoverProps {
  item: StorageItem;
  workspaceId: string;
  metadata?: StoragePdfMetadata | null;
  trigger: ReactNode;
}

interface SimpleCollection {
  _id: string;
  name: string;
  icon?: string;
  color?: string;
}

const toAuthors = (metadata?: StoragePdfMetadata | null) => {
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
    const parsed = parseInt(year, 10);
    return Number.isNaN(parsed) ? null : parsed;
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
  const qc = useQueryClient();

  const { data: collectionsData, isLoading } = useQuery({
    queryKey: ['storage', 'library-collections', workspaceId],
    queryFn: () => apiGet<{ collections: SimpleCollection[] }>(`/api/library/${workspaceId}/collections`),
    enabled: !!workspaceId && open,
  });

  const collections = collectionsData?.collections || [];
  const selectedCollection = collections.find((c) => c._id === collectionId);

  const ingestMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiPost(`/api/library/papers/${workspaceId}/ingest`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['papers', workspaceId] });
      toast.success(`Added to ${selectedCollection?.name || 'Library'}.`);
      setOpen(false);
      setCollectionId("");
    },
    onError: (err) => {
      toast.error(getErrorMessage(err) || "Failed to add PDF to Library");
    },
  });

  const handleAdd = async () => {
    if (!collectionId || !item.url) return;

    ingestMutation.mutate({
      source: "storage",
      fileId: item._id,
      collectionId,
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
    });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align="end"
        onCloseAutoFocus={(e) => e.preventDefault()}
        className="w-72 p-3"
      >
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
                className="w-full flex items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-accent cursor-pointer"
              >
                <FolderOpen
                  className="size-4 shrink-0"
                  style={{ color: collection.color || "var(--primary)" }}
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
          className="mt-3 w-full cursor-pointer"
          disabled={!collectionId || ingestMutation.isPending}
          onClick={handleAdd}
        >
          {ingestMutation.isPending && (
            <Loader2 className="size-3.5 mr-1.5 animate-spin" />
          )}
          Add PDF
        </Button>
      </PopoverContent>
    </Popover>
  );
}
