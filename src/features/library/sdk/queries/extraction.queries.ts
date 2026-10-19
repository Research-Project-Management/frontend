"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  libraryServices,
  UploadService,
  ExportsService,
} from "../library.client";
import type { ItemAttachment } from "@/features/library/domain/types/library.types";
import {
  itemKeys,
  libraryKeys,
  attachmentKeys,
  normalizeScopeId,
} from "@/features/library/sdk/query-keys";

export { attachmentKeys };

// useAttachments
/**
 * Fetch and mutate item attachments.
 * Backed by GET /items/:itemId/attachments, POST /items/:itemId/attachments, DELETE /attachments/:id
 */
export function useAttachments(
  scopeIdOrOptions?: string | { scopeId?: string; projectId?: string },
  itemId?: string,
) {
  const scopeId = normalizeScopeId(
    typeof scopeIdOrOptions === "string"
      ? scopeIdOrOptions
      : scopeIdOrOptions?.scopeId || scopeIdOrOptions?.projectId || "user",
  );

  const queryClient = useQueryClient();

  const attachmentsQuery = useQuery({
    queryKey: attachmentKeys.byItem(scopeId, itemId || ""),
    queryFn: () =>
      libraryServices.attachments.list(scopeId || "", itemId || ""),
    enabled: Boolean(itemId),
  });

  const addMutation = useMutation({
    mutationFn: (data: Partial<ItemAttachment>) =>
      libraryServices.attachments.create(
        scopeId || "",
        itemId || "",
        data as Record<string, unknown>,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: attachmentKeys.byItem(scopeId, itemId),
      });
      if (itemId) {
        queryClient.invalidateQueries({
          queryKey: itemKeys.byId(scopeId, itemId),
        });
      }
      queryClient.invalidateQueries({
        queryKey: itemKeys.all(scopeId),
      });
      toast.success("Attachment added", { id: "attachment-mutation" });
    },
    onError: (err: Error) => {
      toast.error("Failed to add attachment", {
        description: err.message || "Please try again.",
        id: "attachment-mutation",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async ({
      attachmentId,
      itemId: callerItemId,
    }: {
      attachmentId: string;
      itemId?: string;
    }) => {
      await libraryServices.attachments.delete(scopeId || "", attachmentId);
      return { itemId: callerItemId };
    },
    onSuccess: (result) => {
      const effectiveItemId = result.itemId || itemId;
      queryClient.invalidateQueries({
        queryKey: attachmentKeys.byItem(scopeId, effectiveItemId),
      });
      if (effectiveItemId) {
        queryClient.invalidateQueries({
          queryKey: itemKeys.byId(scopeId, effectiveItemId),
        });
      }
      queryClient.invalidateQueries({
        queryKey: itemKeys.all(scopeId),
      });
      toast.success("Attachment deleted", { id: "attachment-mutation" });
    },
    onError: (err: Error) => {
      toast.error("Failed to delete attachment", {
        description: err.message || "Please try again.",
        id: "attachment-mutation",
      });
    },
  });

  const captureSnapshotMutation = useMutation({
    mutationFn: (url?: string) =>
      libraryServices.attachments.captureSnapshot(
        scopeId || "",
        itemId || "",
        url,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: attachmentKeys.byItem(scopeId, itemId),
      });
      queryClient.invalidateQueries({
        queryKey: itemKeys.all(scopeId),
      });
      toast.success("Web Snapshot captured", { id: "snapshot-mutation" });
    },
    onError: (err: Error) => {
      toast.error("Failed to capture snapshot", {
        description: err.message || "Please verify the URL is accessible.",
        id: "snapshot-mutation",
      });
    },
  });

  const setPrimaryMutation = useMutation({
    mutationFn: (attachmentId: string) =>
      libraryServices.attachments.setPrimary(
        scopeId || "",
        itemId || "",
        attachmentId,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: attachmentKeys.byItem(scopeId, itemId),
      });
      queryClient.invalidateQueries({
        queryKey: itemKeys.all(scopeId),
      });
      toast.success("Set as primary document", {
        id: "primary-attachment-mutation",
      });
    },
    onError: (err: Error) => {
      toast.error("Failed to set primary document", {
        description: err.message || "Please try again.",
        id: "primary-attachment-mutation",
      });
    },
  });

  return {
    attachments: attachmentsQuery.data ?? [],
    isLoading: attachmentsQuery.isLoading,
    error: attachmentsQuery.error,
    // Mutations
    add: addMutation.mutateAsync,
    remove: deleteMutation.mutateAsync,
    captureSnapshot: captureSnapshotMutation.mutateAsync,
    setPrimary: setPrimaryMutation.mutateAsync,
    isAdding: addMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isCapturingSnapshot: captureSnapshotMutation.isPending,
    isSettingPrimary: setPrimaryMutation.isPending,
  };
}

// useRenameAttachment
export function useRenameAttachment(scopeId?: string) {
  const queryClient = useQueryClient();
  const effectiveScope = normalizeScopeId(scopeId);

  return useMutation({
    mutationFn: ({
      attachmentId,
      filename,
      pattern,
    }: {
      attachmentId: string;
      filename?: string;
      pattern?: string;
    }) =>
      libraryServices.attachments.rename(effectiveScope, attachmentId, {
        filename,
        pattern,
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({
        queryKey: libraryKeys.attachments(effectiveScope),
      });
      queryClient.invalidateQueries({ queryKey: itemKeys.all(effectiveScope) });
      toast.success("File renamed", {
        description: `Renamed to "${res.newFilename}"`,
        id: "attachment-rename",
      });
    },
    onError: (err: Error) => {
      toast.error("Rename failed", {
        description: err.message || "Could not rename file.",
        id: "attachment-rename",
      });
    },
  });
}

// useUploadAttachmentMutation
export function useUploadAttachmentMutation(scopeId?: string) {
  const effectiveScope = normalizeScopeId(scopeId);

  return useMutation({
    mutationFn: (
      fileOrInput:
        | File
        | {
            file: File;
            scopeId?: string;
            onProgress?: (percent: number) => void;
            signal?: AbortSignal;
          },
    ) => {
      if (
        fileOrInput instanceof File ||
        (typeof fileOrInput === "object" &&
          "name" in fileOrInput &&
          !("file" in fileOrInput))
      ) {
        return UploadService.uploadMultipart(effectiveScope, fileOrInput as File);
      }
      const { file, scopeId: overrideScope, onProgress, signal } = fileOrInput;
      const targetScope = overrideScope
        ? normalizeScopeId(overrideScope)
        : effectiveScope;
      return UploadService.uploadMultipart(targetScope, file, {
        onProgress,
        signal,
      });
    },
  });
}

// useDownloadAnnotatedPdfMutation
export function useDownloadAnnotatedPdfMutation(scopeId?: string) {
  const effectiveScope = normalizeScopeId(scopeId);

  return useMutation({
    mutationFn: (
      itemIdOrInput:
        | string
        | {
            itemId: string;
            filename?: string;
            fallbackFilename?: string;
            scopeId?: string;
          },
    ) => {
      if (typeof itemIdOrInput === "string") {
        return ExportsService.downloadAnnotatedPdf(
          effectiveScope,
          itemIdOrInput,
        );
      }
      const targetScope = itemIdOrInput.scopeId
        ? normalizeScopeId(itemIdOrInput.scopeId)
        : effectiveScope;
      const fallbackFilename =
        itemIdOrInput.filename ||
        itemIdOrInput.fallbackFilename ||
        `annotated_${itemIdOrInput.itemId}.pdf`;
      return ExportsService.downloadAnnotatedPdf(
        targetScope,
        itemIdOrInput.itemId,
        fallbackFilename,
      );
    },
  });
}
