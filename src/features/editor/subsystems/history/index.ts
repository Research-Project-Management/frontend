/**
 * src/features/editor/subsystems/history/index.ts
 *
 * History Subsystem Public Seam & Facade Port (Matt Pocock Deep Module).
 *
 * Responsibilities:
 * - Version Timeline Management and Milestone Snapshots.
 * - Myers Line & Side-by-Side Unified Diff Viewers.
 * - Local Draft Recovery and Diff Comparison Engine.
 * - Consistent In-Memory Project Compilation Snapshot Engine.
 */

// 1. Models & Domain Algorithms
export {
  computeDraftDiffSummary,
  type DraftDiffSummary,
  type DraftDiffLine,
} from '@/features/editor/domain/document/draft-diff';
export {
  type ProjectCompilationSnapshot,
  type SnapshotProjectFile,
  type SnapshotLRUModel,
  type SnapshotDirtyItem,
} from '@/features/editor/domain/document/compilation-snapshot';
export {
  type VersionEventType,
  type CreateVersionInput,
  type CreateSnapshotInput,
  createVersionSchema,
  createSnapshotSchema,
  versionEventTypeSchema,
} from '@/features/editor/domain/types/history.types';

// 2. Presentation Layer (Pages & Views)
export {
  default as HistoryPage,
  ProjectHistoryPage,
  ProjectHistoryView,
  ProjectHistoryModal,
  type HistoryPageProps,
  type ProjectHistoryModalProps,
} from './ui/HistoryPage';
export {
  SideBySideDiffViewer,
  alignHunkForSplitView,
  type SideBySideDiffViewerProps,
  type AlignedSplitRow,
} from './ui/SideBySideDiffViewer';
export {
  UnifiedDiffViewer,
  type UnifiedDiffViewerProps,
} from './ui/UnifiedDiffViewer';
export {
  VersionTimelineSidebar,
  formatVersionTime,
  type VersionTimelineSidebarProps,
} from './ui/VersionTimelineSidebar';
export {
  DiffContentPane,
  type DiffContentPaneProps,
} from './ui/DiffContentPane';

// 3. Subsystem Deep Interface Port (The Seam)
export interface HistorySubsystemPort {
  readonly name: 'history';
  openHistoryPage(projectId?: string, initialVersion?: number): void;
  compareVersions(baseVersion: number, targetVersion: number): void;
  restoreVersion(versionId: number): Promise<boolean>;
}
