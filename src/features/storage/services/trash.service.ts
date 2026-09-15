/**
 * @file trash.service.ts
 * @description Frontend service mirroring backend TrashController.
 * Handles trash listing, soft-delete restoration, permanent deletion, and batch retention actions.
 */

import { apiGet, apiPost, apiPut, apiDelete } from '@/shared/lib/api';
import type { StorageResponse } from '@/features/storage/types/storage.types';
import {
  FileQueryParams,
  buildQueryString,
  resolveQueryParams,
} from './drive.service';

export const getTrashedFiles = (
  scopeIdOrParams?: string | FileQueryParams | null,
  params?: FileQueryParams | string | null,
) => {
  return apiGet<StorageResponse>(`/api/files/trash${buildQueryString(resolveQueryParams(scopeIdOrParams, params))}`);
};

export const moveToTrash = (itemId: string) => {
  return apiPost(`/api/files/${itemId}/trash`);
};

export const restoreItem = (itemId: string) => {
  return apiPut(`/api/files/${itemId}/restore`);
};

export const permanentlyDeleteItem = (itemId: string) => {
  return apiDelete(`/api/files/${itemId}/permanent`);
};

export const batchRestoreItems = (ids: string[]) => {
  return apiPost(`/api/files/batch/restore`, { ids });
};

export const batchPermanentlyDeleteItems = (ids: string[]) => {
  return apiPost(`/api/files/batch/permanent`, { ids });
};
