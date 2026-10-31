"use client";

import { useState, useEffect, useRef } from "react";
import { ShieldAlert, X, RotateCcw } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import {
  useUpdateLibraryItemMutation,
  useBatchRestoreItemsMutation,
  useDeleteLibraryItemsMutation,
} from "@/features/library/sdk/queries/catalog.queries";
import { useRetraction } from "@/features/library/sdk/queries/ingestion.queries";
import {
  useLibraryCommandStore,
  createRestoreCommand,
} from "@/features/library/core/manager/library-command.manager";
import type { Item } from "@/features/library/domain/types/library.types";
import { getTitleFieldForType } from "@/features/library/domain/types/item-types.types";
import { getItemDisplayTitle } from "@/features/library/domain/metadata";
import { buildInspectorFieldPatch } from "@/features/library/domain/item-field-schema";
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
  onUpdateItem?: (data: Partial<Item>, options?: { silent?: boolean }) => void;
  onClose?: () => void;
}

export function InspectorHeader({
  item,
  scopeId,
  canEdit = true,
  onUpdateItem,
  onClose,
}: InspectorHeaderProps) {
  const displayTitle = getItemDisplayTitle(item) || item.title || "";
  const [titleDraft, setTitleDraft] = useState(displayTitle);
  const focusedItemIdRef = useRef<string | null>(null);
  const [isRetractionModalOpen, setIsRetractionModalOpen] = useState(false);
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);

  const isTrash = Boolean(item.deletedAt);
  const effectiveCanEdit = canEdit && !isTrash;

  const updateMutation = useUpdateLibraryItemMutation(scopeId);
  const restoreMutation = useBatchRestoreItemsMutation(scopeId);
  const deleteMutation = useDeleteLibraryItemsMutation(scopeId);
  const executeCommand = useLibraryCommandStore((s) => s.executeCommand);
  const { unflagItem, isUnflagging } = useRetraction(scopeId);

  const isRetracted = isItemRetracted(item);
  const { title: retractionTitle } = getRetractionInfo(item);

  useEffect(() => {
    setTitleDraft(displayTitle);
  }, [item.id, item.itemType, displayTitle]);

  const handleCommitTitle = () => {
    if (!effectiveCanEdit) return;
    if (focusedItemIdRef.current && focusedItemIdRef.current !== item.id) {
      return;
    }
    const cleanTitle = titleDraft.replace(/\r?\n+/g, " ").trim();
    if (cleanTitle && cleanTitle !== displayTitle) {
      setTitleDraft(cleanTitle);
      const titleField = getTitleFieldForType(item.itemType);
      const patch = buildInspectorFieldPatch(item, titleField, cleanTitle);
      patch.title = cleanTitle;
      if (onUpdateItem) {
        onUpdateItem(patch, { silent: true });
      } else {
        updateMutation.mutate({
          itemId: item.id,
          data: patch,
          silent: true,
        });
      }
    } else if (!cleanTitle && displayTitle) {
      setTitleDraft(displayTitle);
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
              onFocus={() => {
                focusedItemIdRef.current = item.id;
              }}
              onBlur={handleCommitTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleCommitTitle();
                  (e.target as HTMLInputElement).blur();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  setTitleDraft(displayTitle);
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
            await executeCommand(
              createRestoreCommand({
                itemIds: [item.id],
                restoreMutation: { mutateAsync: restoreMutation.mutateAsync },
                deleteMutation: { mutateAsync: deleteMutation.mutateAsync },
              }),
              { silentToast: true },
            );
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
