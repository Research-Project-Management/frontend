/**
 * outline.types.ts
 *
 * Types for document section outline extraction and code navigation.
 * Matches backend document/outline module.
 */

export interface OutlineItem {
  id: string;
  level: number;
  levelName: string;
  title: string;
  line: number;
  file?: string;
  pageId?: string;
  children?: OutlineItem[];
}

export interface ExtractOutlineInput {
  source?: string;
  includeChildren?: boolean;
}
