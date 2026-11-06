"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CitationService,
  AttachmentsService,
  UploadService,
  ExportsService,
} from "../clients/attachments-annotations.client";
import { resolveLibraryUrl, resolveLibraryRawPath } from "../clients/http.client";
import type { ItemAttachment, CslStyle } from "@/features/library/domain/types/core.types";

export type UploadedMultipartFile = Awaited<ReturnType<typeof UploadService.uploadMultipart>>;

export function formatCitationItem(
  scopeId: string | undefined,
  itemId: string,
  style?: CslStyle,
) {
  return CitationService.formatCitation(scopeId, itemId, style);
}

export function batchFormatCitations(
  scopeId: string | undefined,
  itemIds: string[],
  style?: CslStyle,
) {
  return CitationService.batchFormat(scopeId, itemIds, style);
}

export function exportLibraryBibliography(
  scopeId: string | undefined,
  params: Parameters<typeof ExportsService.exportLibrary>[1],
) {
  return ExportsService.exportLibrary(scopeId, params);
}

export function uploadLibraryFileMultipart(
  scopeId: string | undefined,
  file: File,
  options?: Parameters<typeof UploadService.uploadMultipart>[2],
) {
  return UploadService.uploadMultipart(scopeId, file, options);
}

export function resolveAttachmentDownloadUrl(
  fileId: string,
  scopeId?: string,
): string {
  return resolveLibraryUrl(
    "extraction",
    `/files/${encodeURIComponent(fileId)}/content`,
    scopeId,
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
  normalizeScopeId,
} from "@/features/library/sdk/query-keys";
import { invalidateLibraryCatalogDependencies } from "./cache-patcher";

export { attachmentKeys, citationKeys, exportKeys };

// ── Citation & Export Queries ─────────────────────────────────────────────────

export function useCitationStyles(scopeId?: string, options?: { enabled?: boolean }) {
  const query = useQuery({
    queryKey: citationKeys.styles(scopeId),
    queryFn: () => CitationService.getStyles(scopeId),
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

  return {
    ...query,
    styles,
  };
}

export function useCslCitation(
  scopeId?: string,
  itemId?: string,
  style: CslStyle = 'apa',
  index: number = 1,
) {
  return useQuery({
    queryKey: citationKeys.item(scopeId, itemId, style, index),
    queryFn: () => CitationService.formatCitation(scopeId, itemId || '', style, index),
    enabled: Boolean(itemId),
    staleTime: 1000 * 60 * 30,
  });
}

export function useSearchCslStyles(
  query: string = '',
  limit: number = 30,
  options?: { enabled?: boolean; scopeId?: string },
) {
  const effectiveScope = normalizeScopeId(options?.scopeId);
  return useQuery({
    queryKey: [...citationKeys.all, 'styles-search', effectiveScope, query, limit] as const,
    queryFn: () => CitationService.searchStyles(query, limit, effectiveScope),
    enabled: options?.enabled ?? true,
    staleTime: 1000 * 60 * 60,
  });
}

export function useExportItemCitationQuery(
  scopeId: string | undefined,
  itemId: string | undefined,
  format: 'bibtex' | 'ris',
  options?: { enabled?: boolean },
) {
  const effectiveScope = normalizeScopeId(scopeId);
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
      AttachmentsService.list(scopeId || "", itemId || ""),
    enabled: Boolean(itemId),
  });

  const addMutation = useMutation({
    mutationFn: (data: Partial<ItemAttachment>) =>
      AttachmentsService.create(
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
          queryKey: readerQueryKeys.item(scopeId, itemId),
        });
      }
      invalidateLibraryCatalogDependencies(queryClient, scopeId, {
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
      await AttachmentsService.delete(scopeId || "", attachmentId);
      return { itemId: callerItemId };
    },
    onSuccess: (result) => {
      const effectiveItemId = result.itemId || itemId;
      queryClient.invalidateQueries({
        queryKey: attachmentKeys.byItem(scopeId, effectiveItemId),
      });
      if (effectiveItemId) {
        queryClient.invalidateQueries({
          queryKey: readerQueryKeys.item(scopeId, effectiveItemId),
        });
      }
      invalidateLibraryCatalogDependencies(queryClient, scopeId, {
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
        scopeId || "",
        itemId || "",
        attachmentId,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: attachmentKeys.byItem(scopeId, itemId),
      });
      if (itemId) {
        queryClient.invalidateQueries({
          queryKey: readerQueryKeys.item(scopeId, itemId),
        });
      }
      invalidateLibraryCatalogDependencies(queryClient, scopeId, {
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

export function useBatchRenameAttachmentsMutation(scopeId?: string) {
  const queryClient = useQueryClient();
  const effectiveScope = normalizeScopeId(scopeId);

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
            attachmentId?: string;
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
        itemIdOrInput.attachmentId,
      );
    },
  });
}
