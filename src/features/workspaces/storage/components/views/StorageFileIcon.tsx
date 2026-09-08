'use client';

import React, { useState } from 'react';
import { Folder } from 'lucide-react';
import { resolveFileUrl } from '@/shared/utils/url';
import type { StorageItem } from '@/features/workspaces/storage/types/storage.types';
import { getFileType, getFileIcon, getFileColor } from '../../utils/file';

export function StorageFileIcon({
  item,
  variant = 'list',
}: {
  item: StorageItem;
  variant?: 'grid' | 'list';
}) {
  const [hasError, setHasError] = useState(false);
  const fileType = getFileType(item);
  const imageUrl = !hasError
    ? resolveFileUrl(
        item.thumbnail || (fileType === 'image' ? item.url : undefined),
      )
    : null;

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={item.filename}
        className={
          variant === 'grid'
            ? 'w-full h-full object-cover'
            : 'size-5 rounded object-cover shrink-0'
        }
        onError={() => setHasError(true)}
      />
    );
  }

  if (variant === 'grid') {
    return (
      <div className={getFileColor(fileType)}>
        {item.isFolder ? (
          <Folder className="size-12 shrink-0" />
        ) : (
          getFileIcon(fileType, 12)
        )}
      </div>
    );
  }

  return (
    <div
      className={`flex items-center justify-center shrink-0 ${getFileColor(
        fileType,
      )}`}
    >
      {getFileIcon(fileType, 5)}
    </div>
  );
}
