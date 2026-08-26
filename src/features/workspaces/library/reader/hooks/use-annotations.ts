'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/shared/lib/api';
import { toast } from 'sonner';

export interface BoundingRect {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface PdfAnnotation {
  id: string;
  attachmentId: string;
  type: 'highlight' | 'underline' | 'note' | 'area';
  pageIndex: number;
  color: string;
  quoteText?: string;
  comment?: string;
  rectCoords?: BoundingRect | BoundingRect[];
  version: number;
  authorId: string;
  createdAt: string;
  updatedAt: string;
}

export const annotationKeys = {
  all: ['annotations'] as const,
  byAttachment: (workspaceId: string, attachmentId: string, pageIndex?: number) =>
    [...annotationKeys.all, workspaceId, attachmentId, pageIndex] as const,
  detail: (workspaceId: string, attachmentId: string, annotationId: string) =>
    [...annotationKeys.all, workspaceId, attachmentId, 'detail', annotationId] as const,
};

export function useAnnotations(workspaceId: string, attachmentId: string, pageIndex?: number) {
  const queryClient = useQueryClient();
  const queryKey = annotationKeys.byAttachment(workspaceId, attachmentId, pageIndex);

  const annotationsQuery = useQuery({
    queryKey,
    queryFn: async (): Promise<PdfAnnotation[]> => {
      const pageQuery = pageIndex !== undefined ? `?pageIndex=${pageIndex}` : '';
      const res = await apiGet<{ success: boolean; data: PdfAnnotation[] }>(
        `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/attachments/${encodeURIComponent(attachmentId)}/annotations${pageQuery}`,
      );
      return res.data || [];
    },
    enabled: Boolean(workspaceId && attachmentId),
  });

  const createMutation = useMutation({
    mutationFn: async (payload: {
      type?: 'highlight' | 'underline' | 'note' | 'area';
      pageIndex: number;
      color?: string;
      quoteText?: string;
      comment?: string;
      rectCoords?: BoundingRect | BoundingRect[];
    }) => {
      return apiPost<{ success: boolean; data: PdfAnnotation }>(
        `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/attachments/${encodeURIComponent(attachmentId)}/annotations`,
        payload,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: annotationKeys.all });
      toast.success('Annotation saved');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      expectedVersion,
      ...patch
    }: {
      id: string;
      expectedVersion: number;
      color?: string;
      quoteText?: string;
      comment?: string;
      rectCoords?: BoundingRect | BoundingRect[];
    }) => {
      return apiPatch<{ success: boolean; data: PdfAnnotation }>(
        `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/attachments/${encodeURIComponent(attachmentId)}/annotations/${id}`,
        { ...patch, expectedVersion },
        { headers: { 'If-Match': `"${expectedVersion}"` } },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: annotationKeys.all });
      toast.success('Annotation updated');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ id, expectedVersion }: { id: string; expectedVersion?: number }) => {
      const headers = expectedVersion ? { 'If-Match': `"${expectedVersion}"` } : undefined;
      return apiDelete<{ success: boolean; data: { deleted: boolean } }>(
        `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/attachments/${encodeURIComponent(attachmentId)}/annotations/${id}`,
        { headers },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: annotationKeys.all });
      toast.success('Annotation deleted');
    },
  });

  return {
    annotations: annotationsQuery.data || [],
    isLoading: annotationsQuery.isLoading,
    createAnnotation: createMutation.mutateAsync,
    updateAnnotation: updateMutation.mutateAsync,
    deleteAnnotation: deleteMutation.mutateAsync,
  };
}
