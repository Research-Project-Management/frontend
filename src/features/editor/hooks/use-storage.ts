'use client';

/**
 * use-storage.ts
 *
 * Clean Presentational Storage Hooks for Editor Files Explorer:
 * - Decoupled from legacy backend storage/R2 endpoints
 */

import { useState } from 'react';
import { toast } from 'sonner';
import type { EditorStorageItem } from '../services/storage.service';

function createMockMutation<TArgs, TRes>(fn: (args: TArgs) => Promise<TRes>) {
  const handler = (args: TArgs) => fn(args);
  handler.mutate = (
    args: TArgs,
    opts?: { onSuccess?: (data: TRes) => void; onError?: (err: any) => void },
  ) => {
    fn(args)
      .then((data) => opts?.onSuccess?.(data))
      .catch((err) => opts?.onError?.(err));
  };
  handler.mutateAsync = fn;
  handler.isPending = false;
  return handler as any;
}

export function useEditorStorage(_pageId?: string | null, _parentId?: string | null) {
  const [items, setItems] = useState<EditorStorageItem[]>([]);

  const uploadFile = createMockMutation(
    async ({
      file,
    }: {
      file: File;
      projectId?: string;
      pageId?: string;
      parentId?: string | null;
    }): Promise<EditorStorageItem> => {
      const newItem: EditorStorageItem = {
        id: `file-${Date.now()}`,
        filename: file.name,
        size: file.size,
        mimeType: file.type,
        isFolder: false,
        createdAt: new Date().toISOString(),
      };
      setItems((prev) => [...prev, newItem]);
      toast.success(`Đã tải lên "${file.name}"`);
      return newItem;
    },
  );

  const createFolder = createMockMutation(
    async ({ name }: { name: string; parentId?: string | null }): Promise<EditorStorageItem> => {
      const newFolder: EditorStorageItem = {
        id: `folder-${Date.now()}`,
        filename: name,
        isFolder: true,
        createdAt: new Date().toISOString(),
      };
      setItems((prev) => [...prev, newFolder]);
      toast.success(`Đã tạo thư mục "${name}"`);
      return newFolder;
    },
  );

  const renameFile = createMockMutation(
    async (args: { itemId?: string; fileId?: string; newName?: string; name?: string }): Promise<void> => {
      const id = args.itemId || args.fileId;
      const name = args.newName || args.name;
      if (id && name) {
        setItems((prev) =>
          prev.map((i) => (i.id === id ? { ...i, filename: name } : i)),
        );
      }
      toast.success('Đã đổi tên');
    },
  );

  const deleteFile = createMockMutation(
    async (itemId: string): Promise<void> => {
      setItems((prev) => prev.filter((i) => i.id !== itemId));
      toast.success('Đã xóa tệp');
    },
  );

  const moveItem = createMockMutation(
    async (): Promise<void> => {
      toast.success('Đã di chuyển');
    },
  );

  return {
    children: items,
    files: items,
    isLoading: false,
    refetch: async () => {},
    uploadFile,
    createFolder,
    renameFile,
    deleteFile,
    moveItem,
    uploadFileMutation: uploadFile,
    createFolderMutation: createFolder,
    renameMutation: renameFile,
    deleteMutation: deleteFile,
    moveMutation: moveItem,
  };
}
