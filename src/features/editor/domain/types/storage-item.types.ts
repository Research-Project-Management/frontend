/**
 * storage-item.types.ts
 *
 * Domain-owned shape of a storage file/folder node. The SDK layer imports and
 * re-exports this type so that `domain/` never depends on `sdk/`.
 */

export interface EditorStorageItem {
  id: string;
  filename: string;
  size?: number;
  mimeType?: string;
  isFolder: boolean;
  parentId?: string | null;
  url?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}
