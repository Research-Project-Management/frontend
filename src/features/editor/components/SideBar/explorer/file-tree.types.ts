export interface UnifiedTreeNode {
  id: string;
  name: string;
  isFolder: boolean;
  itemType: "page" | "asset";
  isMain?: boolean;
  data?: any;
  children: UnifiedTreeNode[];
  path?: string;
  rawPage?: any;
}
