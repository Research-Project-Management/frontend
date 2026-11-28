"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CitationService, ExportsService } from "../clients/citations.client";
import { AttachmentsService, UploadService } from "../clients/attachments.client";
import { resolveLibraryUrl, resolveLibraryRawPath } from "../clients/http.client";
import type { ItemAttachment, CslStyle } from "@/features/library/types/core.types";

export type UploadedMultipartFile = Awaited<ReturnType<typeof UploadService.uploadMultipart>>;

export const formatCitationItem = CitationService.formatCitation;
export const batchFormatCitations = CitationService.batchFormat;
export const exportLibraryBibliography = ExportsService.exportLibrary;
export const uploadLibraryFileMultipart = UploadService.uploadMultipart;

export function resolveAttachmentDownloadUrl(
  fileId: string,
  spaceId?: string,
): string {
  return resolveLibraryUrl(
    "extraction",
    `/files/${encodeURIComponent(fileId)}/content`,
    spaceId,
  );
}

export function resolveAttachmentRawPath(rawUrl: string): string {
  return resolveLibraryRawPath(rawUrl, "extraction");
}
import {
  itemKeys,
  libraryKeys,
  attachmentKeys,
  citationKeys,
  exportKeys,
  readerQueryKeys,
  normalizeSpaceId,
} from "@/features/library/sdk/query-keys";
import { invalidateLibraryCatalogDependencies } from "./cache-patcher.queries";

export { attachmentKeys, citationKeys, exportKeys };

// ── Citation & Export Queries ─────────────────────────────────────────────────

export function useCitationStyles(spaceId?: string, options?: { enabled?: boolean }) {
  const query = useQuery({
    queryKey: citationKeys.styles(spaceId),
    queryFn: () => CitationService.getStyles(spaceId),
    enabled: options?.enabled ?? true,
    staleTime: 1000 * 60 * 60 * 24,
  });

  const rawData = query.data;
  const styles: string[] = Array.isArray(rawData)
    ? rawData
        .map((s: unknown) => {
          if (typeof s === 'string') return s;
          if (s && typeof s === 'object' && 'id' in s) {
            return String((s as { id: string }).id);
          }
          return '';
        })
        .filter(Boolean)
    : [];

  return Object.assign(query, { styles });
}

export function useCslCitation(
  spaceId?: string,
  itemId?: string,
  style: CslStyle = 'apa',
  index: number = 1,
) {
  return useQuery({
    queryKey: citationKeys.item(spaceId, itemId, style, index),
    queryFn: () => CitationService.formatCitation(spaceId, itemId || '', style, index),
    enabled: Boolean(itemId),
    staleTime: 1000 * 60 * 30,
  });
}

export function useSearchCslStyles(
  query: string = '',
  limit: number = 30,
  options?: { enabled?: boolean; spaceId?: string },
) {
  const effectiveScope = normalizeSpaceId(options?.spaceId);
  return useQuery({
    queryKey: [...citationKeys.all, 'styles-search', effectiveScope, query, limit] as const,
    queryFn: () => CitationService.searchStyles(query, limit, effectiveScope),
    enabled: options?.enabled ?? true,
    staleTime: 1000 * 60 * 60,
  });
}

export function useExportItemCitationQuery(
  spaceId: string | undefined,
  itemId: string | undefined,
  format: 'bibtex' | 'ris',
  options?: { enabled?: boolean },
) {
  const effectiveScope = normalizeSpaceId(spaceId);
  return useQuery({
    queryKey: [...exportKeys.all, 'item-citation', effectiveScope, itemId || '', format] as const,
    queryFn: () =>
      ExportsService.exportLibrary(effectiveScope, {
        format,
        itemIds: itemId ? [itemId] : [],
      }),
    enabled: (options?.enabled ?? true) && Boolean(itemId),
    staleTime: 1000 * 60 * 5,
  });
}

// ── Attachments & Extraction Queries ──────────────────────────────────────────

export function useAttachments(
  spaceIdOrOptions?: string | { spaceId?: string; projectId?: string },
  itemId?: string,
) {
  const spaceId = normalizeSpaceId(
    typeof spaceIdOrOptions === "string"
      ? spaceIdOrOptions
      : spaceIdOrOptions?.spaceId || spaceIdOrOptions?.projectId || "user",
  );

  const queryClient = useQueryClient();

  const attachmentsQuery = useQuery({
    queryKey: attachmentKeys.byItem(spaceId, itemId || ""),
    queryFn: () =>
      AttachmentsService.list(spaceId || "", itemId || ""),
    enabled: Boolean(itemId),
  });

  const addMutation = useMutation({
    mutationFn: (data: Partial<ItemAttachment>) =>
      AttachmentsService.create(
        spaceId || "",
        itemId || "",
        data as Record<string, unknown>,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: attachmentKeys.byItem(spaceId, itemId),
      });
      if (itemId) {
        queryClient.invalidateQueries({
          queryKey: readerQueryKeys.item(spaceId, itemId),
        });
      }
      invalidateLibraryCatalogDependencies(queryClient, spaceId, {
        itemId,
        itemsList: true,
        counts: true,
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
      await AttachmentsService.delete(spaceId || "", attachmentId);
      return { itemId: callerItemId };
    },
    onSuccess: (result) => {
      const effectiveItemId = result.itemId || itemId;
      queryClient.invalidateQueries({
        queryKey: attachmentKeys.byItem(spaceId, effectiveItemId),
      });
      if (effectiveItemId) {
        queryClient.invalidateQueries({
          queryKey: readerQueryKeys.item(spaceId, effectiveItemId),
        });
      }
      invalidateLibraryCatalogDependencies(queryClient, spaceId, {
        itemId: effectiveItemId,
        itemsList: true,
        counts: true,
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

  const setPrimaryMutation = useMutation({
    mutationFn: (attachmentId: string) =>
      AttachmentsService.setPrimary(
        spaceId || "",
        itemId || "",
        attachmentId,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: attachmentKeys.byItem(spaceId, itemId),
      });
      if (itemId) {
        queryClient.invalidateQueries({
          queryKey: readerQueryKeys.item(spaceId, itemId),
        });
      }
      invalidateLibraryCatalogDependencies(queryClient, spaceId, {
        itemId,
        itemsList: true,
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
    add: addMutation.mutateAsync,
    remove: deleteMutation.mutateAsync,
    setPrimary: setPrimaryMutation.mutateAsync,
    isAdding: addMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isSettingPrimary: setPrimaryMutation.isPending,
  };
}

export function useRenameAttachment(spaceId?: string) {
  const queryClient = useQueryClient();
  const effectiveScope = normalizeSpaceId(spaceId);

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
      AttachmentsService.rename(effectiveScope, attachmentId, {
        filename,
        pattern,
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({
        queryKey: libraryKeys.attachmentsAll(effectiveScope),
      });
      if (res?.attachment?.itemId) {
        queryClient.invalidateQueries({
          queryKey: libraryKeys.attachments(effectiveScope, res.attachment.itemId),
        });
        queryClient.invalidateQueries({
          queryKey: readerQueryKeys.item(effectiveScope, res.attachment.itemId),
        });
      }
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

export function useBatchRenameAttachmentsMutation(spaceId?: string) {
  const queryClient = useQueryClient();
  const effectiveScope = normalizeSpaceId(spaceId);

  return useMutation({
    mutationFn: (dto: {
      itemIds?: string[];
      attachmentIds?: string[];
      pattern?: string;
    }) => AttachmentsService.batchRename(effectiveScope, dto),
    onSuccess: (res) => {
      queryClient.invalidateQueries({
        queryKey: libraryKeys.attachmentsAll(effectiveScope),
      });
      queryClient.invalidateQueries({ queryKey: itemKeys.all(effectiveScope) });
      toast.success("Attachments renamed", {
        description: `Renamed ${res.renamedCount ?? 0} attachment(s) from parent metadata.`,
        id: "attachment-batch-rename",
      });
    },
    onError: (err: Error) => {
      toast.error("Batch rename failed", {
        description: err.message || "Could not batch rename attachments.",
        id: "attachment-batch-rename",
      });
    },
  });
}

export function useUploadAttachmentMutation(spaceId?: string) {
  const effectiveScope = normalizeSpaceId(spaceId);

  return useMutation({
    mutationFn: (
      fileOrInput:
        | File
        | {
            file: File;
            spaceId?: string;
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
      const { file, spaceId: overrideScope, onProgress, signal } = fileOrInput;
      const targetScope = overrideScope
        ? normalizeSpaceId(overrideScope)
        : effectiveScope;
      return UploadService.uploadMultipart(targetScope, file, {
        onProgress,
        signal,
      });
    },
  });
}

export function useDownloadAnnotatedPdfMutation(spaceId?: string) {
  const effectiveScope = normalizeSpaceId(spaceId);

  return useMutation({
    mutationFn: (
      itemIdOrInput:
        | string
        | {
            itemId: string;
            filename?: string;
            fallbackFilename?: string;
            attachmentId?: string;
            spaceId?: string;
          },
    ) => {
      if (typeof itemIdOrInput === "string") {
        return ExportsService.downloadAnnotatedPdf(
          effectiveScope,
          itemIdOrInput,
        );
      }
      const targetScope = itemIdOrInput.spaceId
        ? normalizeSpaceId(itemIdOrInput.spaceId)
        : effectiveScope;
      const fallbackFilename =
        itemIdOrInput.filename ||
        itemIdOrInput.fallbackFilename ||
        `annotated_${itemIdOrInput.itemId}.pdf`;
      return ExportsService.downloadAnnotatedPdf(
        targetScope,
        itemIdOrInput.itemId,
        fallbackFilename,
        itemIdOrInput.attachmentId,
      );
    },
  });
}
