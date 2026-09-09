'use client';

import { useState } from 'react';
import { resolveFileUrl } from '@/shared/utils/url';
import { getFileType } from '../utils/file';
import type { StorageItem } from '../types/storage.types';

export function useStorageItemThumbnail(item: StorageItem) {
  const [hasError, setHasError] = useState(false);
  const fileType = getFileType(item);
  const imageUrl = !hasError
    ? resolveFileUrl(item.thumbnail || (fileType === 'image' ? item.url : undefined))
    : null;

  return { imageUrl, fileType, onError: () => setHasError(true) };
}
