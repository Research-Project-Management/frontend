"use client";

import { useState, useEffect } from "react";
import { ShieldAlert, X, RotateCcw } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import { useUpdateLibraryItemMutation } from "@/features/library/sdk/queries/catalog.queries";
import { useRetraction } from "@/features/library/sdk/queries/ingestion.queries";
import { useBatchRestoreItemsMutation } from "@/features/library/sdk/queries/catalog.queries";
import type { Item } from "@/features/library/domain/types/library.types";
import dynamic from "next/dynamic";
import {
  isItemRetracted,
  getRetractionInfo,
} from "@/features/library/domain/retraction";

const RetractionNoticeModal = dynamic(
  () => import("@/features/library/ui/modals/RetractionNoticeModal").then((m) => m.RetractionNoticeModal),
  { ssr: false },
);
const DeleteModal = dynamic(
  () => import("@/features/library/ui/modals/DeleteModal"),
  { ssr: false },
);

interface InspectorHeaderProps {
  item: Item;
  scopeId?: string;
  canEdit?: boolean;
  onClose?: () => void;
}

export function InspectorHeader({
  item,
  scopeId,
  canEdit = true,
  onClose,
}: InspectorHeaderProps) {
  const [titleDraft, setTitleDraft] = useState(item.title || "");
  const [isRetractionModalOpen, setIsRetractionModalOpen] = useState(false);
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);

  const isTrash = Boolean(item.deletedAt);
  const effectiveCanEdit = canEdit && !isTrash;

  const updateMutation = useUpdateLibraryItemMutation(scopeId);
  const restoreMutation = useBatchRestoreItemsMutation(scopeId);
  const { unflagItem, isUnflagging } = useRetraction(scopeId);

  const isRetracted = isItemRetracted(item);
  const { nature: retractionNature, title: retractionTitle } =
    getRetractionInfo(item);

  useEffect(() => {
    setTitleDraft(item.title || "");
  }, [item.title]);

  const handleCommitTitle = () => {
    if (!effectiveCanEdit) return;
    const cleanTitle = titleDraft.replace(/\r?\n+/g, " ").trim();
    if (cleanTitle && cleanTitle !== item.title) {
      setTitleDraft(cleanTitle);
      updateMutation.mutate({
        itemId: item.id,
        data: { title: cleanTitle },
      });
    } else if (!cleanTitle && item.title) {
      setTitleDraft(item.title);
    }
  };

  return (
    <div className="sticky top-0 z-10 flex flex-col shrink-0 select-none bg-background">
      {/* ── Title Header: EXACTLY h-11 (44px) with border-b matching LibraryTopbar and InspectorTabs ── */}
      <div className="h-11 px-1 sm:px-1.5 flex items-center gap-1 w-full min-w-0 border-b border-border bg-background shrink-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <input
              type="text"
              value={titleDraft}
              placeholder="Untitled Document"
              aria-label="Document Title"
              readOnly={!effectiveCanEdit}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={handleCommitTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleCommitTitle();
                  (e.target as HTMLInputElement).blur();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  setTitleDraft(item.title || "");
                  (e.target as HTMLInputElement).blur();
                }
              }}
              className={cn(
                "flex-1 min-w-0 h-8 text-13 font-semibold tracking-tight text-foreground font-sans select-text rounded-md outline-none truncate transition-colors",
                "px-1.5 border",
                effectiveCanEdit
                  ? [
                      "cursor-pointer hover:bg-muted hover:border-border",
                      "border-transparent focus:cursor-text focus:bg-background focus:border-primary focus:ring-1 focus:ring-ring focus:hover:bg-background",
                    ]
                  : ["border-transparent cursor-default"],
              )}
            />
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={6}>
            {titleDraft || "Untitled Document"}
          </TooltipContent>
        </Tooltip>

        {/* ♻️ Restore Action Icon on Header (Quick restore for trashed item) */}
        {isTrash && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => setIsRestoreModalOpen(true)}
                disabled={restoreMutation.isPending}
                className="size-7 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer shrink-0 transition-colors disabled:opacity-50 relative before:absolute before:-inset-1.5 md:before:hidden"
                aria-label="Restore reference to library"
              >
                <RotateCcw className="size-3.5 shrink-0" strokeWidth={1.5} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6}>
              Restore reference to library
            </TooltipContent>
          </Tooltip>
        )}

        {/* 🚨 Sleek Retraction Badge on Header (Click to open Retraction Notice Modal) */}
        {isRetracted && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => setIsRetractionModalOpen(true)}
                className="size-7 flex items-center justify-center bg-destructive/10 text-destructive border border-destructive/25 rounded-md hover:bg-destructive/20 hover:border-destructive/40 transition-colors cursor-pointer shrink-0 select-none relative before:absolute before:-inset-1.5 md:before:hidden"
                aria-label="View retraction notice details"
              >
                <ShieldAlert
                  className="size-3.5 text-destructive shrink-0"
                  strokeWidth={1.5}
                />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6}>
              {`${retractionTitle}. Click to view details.`}
            </TooltipContent>
          </Tooltip>
        )}

        {onClose && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onClose}
                className="md:hidden size-7 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer shrink-0 relative before:absolute before:-inset-2 md:before:hidden"
                aria-label="Close inspector"
              >
                <X className="size-4 shrink-0" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6}>
              Close inspector
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* ♻️ Restore Confirmation Modal */}
      {isTrash && (
        <DeleteModal
          open={isRestoreModalOpen}
          onOpenChange={setIsRestoreModalOpen}
          title="Restore reference"
          description="Are you sure you want to restore this reference to your active library?"
          itemName={item.title || "Untitled Document"}
          confirmLabel="Restore"
          cancelLabel="Cancel"
          buttonVariant="primary"
          icon={<RotateCcw className="size-4 shrink-0 text-primary" strokeWidth={1.5} />}
          isDeleting={restoreMutation.isPending}
          onConfirm={async () => {
            await restoreMutation.mutateAsync([item.id]);
            setIsRestoreModalOpen(false);
          }}
        />
      )}

      {/* 🚨 Retraction Notice Modal Dialog */}
      {isRetracted && isRetractionModalOpen && (
        <RetractionNoticeModal
          open={isRetractionModalOpen}
          onOpenChange={setIsRetractionModalOpen}
          item={item}
          canEdit={effectiveCanEdit}
          onDismiss={async () => {
            await unflagItem(item.id);
          }}
          isDismissing={isUnflagging}
        />
      )}
    </div>
  );
}
