'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ItemsService } from '../clients/items.client';
import type {
  Item,
  DroppedField,
  FieldMappingChange,
  CreatorRoleChange,
  TypeConversionPreview,
} from '@/features/library/types/core.types';
import { mapBackendItem } from '@/features/library/domain/metadata/mapper';
import { itemKeys, normalizeSpaceId } from '@/features/library/sdk/query-keys';
import {
  patchItemAcrossScopeCaches,
  invalidateLibraryCatalogDependencies,
  resolveCachedItemFromScope,
} from './cache-patcher.queries';

export type {
  DroppedField,
  FieldMappingChange,
  CreatorRoleChange,
  TypeConversionPreview,
};


export function useItemTypeConversionPreviewQuery(
  spaceId: string,
  itemId: string | undefined,
  targetType: string | undefined,
  enabled = true,
) {
  const effectiveSpaceId = normalizeSpaceId(spaceId);

  return useQuery({
    queryKey: itemKeys.typeConversionPreview(effectiveSpaceId, itemId, targetType),
    queryFn: () =>
      ItemsService.previewConvertType(
        effectiveSpaceId,
        itemId!,
        targetType!,
        true,
      ).then(
        (res: unknown): TypeConversionPreview =>
          (res as { preview?: TypeConversionPreview; data?: TypeConversionPreview })
            ?.preview ??
          (res as { data?: TypeConversionPreview })?.data ??
          (res as TypeConversionPreview),
      ),
    enabled: Boolean(enabled && itemId && targetType),
  });
}

export function useItemTypeConversion(spaceId?: string) {
  const queryClient = useQueryClient();
  const effectiveSpaceId = normalizeSpaceId(spaceId);

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
    }) => {
      const resolvedExpectedVersion =
        expectedVersion ??
        resolveCachedItemFromScope(queryClient, effectiveSpaceId, itemId)?.version;
      return ItemsService.convertType(
        effectiveSpaceId,
        itemId,
        targetType,
        resolvedExpectedVersion,
        retainUnmappedInExtra,
      );
    },
    onSuccess: (data, variables) => {
      const rawUpdated =
        (data as { item?: unknown; data?: unknown })?.item ??
        (data as { data?: unknown })?.data ??
        data;
      if (rawUpdated && typeof rawUpdated === 'object' && 'id' in rawUpdated) {
        const mapped = mapBackendItem(rawUpdated as Record<string, unknown>) as Item;
        patchItemAcrossScopeCaches(queryClient, effectiveSpaceId, variables.itemId, mapped);
      }
      void invalidateLibraryCatalogDependencies(queryClient, effectiveSpaceId, {
        itemId: variables.itemId,
        itemsList: true,
        counts: true,
        smartCollections: true,
      });
      if (!variables.silent) {
        toast.success('Item type converted', {
          description: variables.retainUnmappedInExtra
            ? 'Unmapped fields have been preserved in Extra.'
            : undefined,
          id: 'type-conversion',
        });
      }
    },
    onError: (err: Error, variables) => {
      queryClient.invalidateQueries({
        queryKey: itemKeys.byId(effectiveSpaceId, variables.itemId),
      });
      toast.error('Conversion failed', {
        description: err.message || 'Could not convert item type.',
        id: 'type-conversion',
      });
    },
  });

  return {
    convertAsync: convertMutation.mutateAsync,
    isConverting: convertMutation.isPending,
  };
}

