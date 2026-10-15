import type { Collection } from '@/features/library/types/library.types';

export type TreeNode = Collection & { children: TreeNode[] };

export interface CollectionActionHandlers {
  onStartRename: (id: string, name: string) => void;
  onSubmitRename: (id: string) => void;
  onRenameValueChange: (v: string) => void;
  onDelete: (id: string) => void;
  onDeleteWithItems: (id: string) => void;
  onMove: (collectionId: string, newParentId: string | null) => void;
  onCopy: (collectionId: string, targetParentId: string | null) => void;
  onCreateSub: (parentId: string, parentName: string) => void;
  onExportBibtex?: (id: string, name: string) => void;
  onExportBundle?: (id: string, name: string) => void;
  onLinkClick?: () => void;
  onDropItems?: (itemIds: string[], targetCollectionId: string | null) => void;
}
