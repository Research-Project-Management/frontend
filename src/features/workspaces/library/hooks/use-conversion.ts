'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ItemService } from '../services/item.service';
import { itemKeys } from './use-items';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DroppedField {
  field: string;
  /** Human-readable label returned by the BE registry */
  label: string;
  value: unknown;
}

export interface FieldMappingChange {
  fromField: string;
  toField: string;
  value: unknown;
  rule: 'direct' | 'base-semantic' | 'special-rule';
}

export interface CreatorRoleChange {
  creator: Record<string, unknown>;
  fromRole: string;
  toRole: string;
  reason: 'preserved' | 'primary-fallback' | 'secondary-fallback';
}

export interface TypeConversionPreview {
  sourceType: string;
  targetType: string;
  preservedFields: string[];
  mappedFields: FieldMappingChange[];
  droppedFields: DroppedField[];
  creatorChanges: CreatorRoleChange[];
  projectedItem: Record<string, any>;
  unmappedRetained: Record<string, any>;
  /** true = at least one field with data won't appear in the target form */
  hasLoss: boolean;
}

// ── useItemTypeConversion ─────────────────────────────────────────────────────
/**
 * Hooks for item type conversion (preview + commit).
 * Backed by POST /items/:id/convert-type/preview and POST /items/:id/convert-type
 *
 * `previewAsync` is an on-demand call (not tied to a query key),
 * allowing callers to check `hasLoss` before deciding whether to show a modal.
 */
export function useItemTypeConversion(workspaceId: string) {
  const queryClient = useQueryClient();

  const previewMutation = useMutation({
    mutationFn: ({
      itemId,
      targetType,
      retainUnmappedInExtra = true,
    }: {
      itemId: string;
      targetType: string;
      retainUnmappedInExtra?: boolean;
    }) =>
      ItemService.previewConvertType(
        workspaceId,
        itemId,
        targetType,
        retainUnmappedInExtra,
      ).then((res: unknown): TypeConversionPreview => (res as { preview?: TypeConversionPreview; data?: TypeConversionPreview })?.preview ?? (res as { data?: TypeConversionPreview })?.data ?? (res as TypeConversionPreview)),
    onError: (err: any) => {
      toast.error('Preview failed', {
        description: err?.message || 'Failed to preview type conversion.',
        id: 'type-conversion-preview',
      });
    },
  });

  const convertMutation = useMutation({
    mutationFn: ({
      itemId,
      targetType,
      expectedVersion,
      retainUnmappedInExtra = true,
      silent = false,
    }: {
      itemId: string;
      targetType: string;
      expectedVersion?: number;
      retainUnmappedInExtra?: boolean;
      silent?: boolean;
    }) =>
      ItemService.convertType(
        workspaceId,
        itemId,
        targetType,
        expectedVersion,
        retainUnmappedInExtra,
      ),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: itemKeys.byId(workspaceId, variables.itemId),
      });
      queryClient.invalidateQueries({ queryKey: itemKeys.all(workspaceId) });
      if (!variables.silent) {
        toast.success('Item type converted', {
          description: variables.retainUnmappedInExtra ? 'Unmapped fields have been preserved in Extra.' : undefined,
          id: 'type-conversion',
        });
      }
    },
    onError: (err: any) => {
      toast.error('Conversion failed', {
        description: err?.message || 'Could not convert item type.',
        id: 'type-conversion',
      });
    },
  });

  return {
    /** On-demand preview — call before deciding whether to show modal */
    previewAsync: previewMutation.mutateAsync,
    /** Execute the conversion */
    convertAsync: convertMutation.mutateAsync,
    isPreviewing: previewMutation.isPending,
    isConverting: convertMutation.isPending,
    previewData: previewMutation.data as TypeConversionPreview | undefined,
    conversionResult: convertMutation.data,
  };
}

export const useConversion = useItemTypeConversion;
