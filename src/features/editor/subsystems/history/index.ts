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
} from './model/draft-diff';
export {
  type ProjectCompilationSnapshot,
  type SnapshotProjectFile,
  type SnapshotLRUModel,
  type SnapshotDirtyItem,
} from './model/compilation-snapshot';
export {
  type VersionEventType,
  type CreateVersionInput,
  type CreateSnapshotInput,
  createVersionSchema,
  createSnapshotSchema,
  versionEventTypeSchema,
} from './model/history.types';

// 2. Presentation Layer (Thin Views & Modals)
export {
  default as ProjectHistoryModal,
  ProjectHistoryView,
  ProjectHistoryPage,
  type ProjectHistoryModalProps,
} from './ui/ProjectHistoryModal';
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
  openHistoryModal(projectId?: string, initialVersion?: number): void;
  compareVersions(baseVersion: number, targetVersion: number): void;
  restoreVersion(versionId: number): Promise<boolean>;
}
