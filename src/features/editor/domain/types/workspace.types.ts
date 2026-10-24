/**
 * workspace.types.ts
 *
 * Strongly-typed Workspace Domain Models (Matt Pocock TypeScript Patterns).
 */

export type EditorMode = 'source' | 'visual';
export type SplitMode = 'single' | 'vertical' | 'horizontal';
export type ActiveSidePanel = 'explorer' | 'outline' | 'citations' | 'review' | 'ai' | 'search' | null;

export interface WorkspaceTab {
  readonly id: string;
  readonly title: string;
  readonly path?: string;
  readonly fileUrl?: string;
  readonly isDirty?: boolean;
  readonly isPinned?: boolean;
  readonly isRoot?: boolean;
  readonly lastAccessedAt?: number;
}

export type EditorTab = WorkspaceTab;

export interface WorkspaceLayoutConfig {
  readonly splitMode: SplitMode;
  readonly splitRatio: number;
  readonly editorMode: EditorMode;
  readonly activeSidePanel: ActiveSidePanel;
  readonly isPdfVisible: boolean;
}
