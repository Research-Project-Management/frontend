'use client';

import { useState } from "react";
import type { ReactNode } from "react";
import { BookOpen, Check, FolderOpen, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { previewServices } from "../../services/preview.service";
import { toAuthors, toKeywords, toYear } from "../../utils/preview.util";
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
  id: string;
  name: string;
  icon?: string;
  color?: string;
}

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
    queryFn: () => previewServices.getCollections(workspaceId),
    enabled: !!workspaceId && open,
  });

  const collections = collectionsData?.collections || [];
  const selectedCollection = collections.find((c) => c.id === collectionId);

  const ingestMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      previewServices.ingestPaper(workspaceId, data),
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
      fileId: item.id,
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
            collections.map((collection) => {
              const cId = collection.id;
              return (
                <button
                  key={cId}
                  onClick={() => setCollectionId(cId || '')}
                  className="w-full flex items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-accent cursor-pointer"
                >
                  <FolderOpen
                    className="size-4 shrink-0"
                    style={{ color: collection.color || "var(--primary)" }}
                  />
                  <span className="min-w-0 flex-1 truncate text-xs font-medium">
                    {collection.name}
                  </span>
                  {collectionId === cId && (
                    <Check className="size-3.5 text-foreground" />
                  )}
                </button>
              );
            })
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
