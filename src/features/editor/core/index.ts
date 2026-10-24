/**
 * src/features/editor/core/index.ts
 *
 * Core Workbench Subsystem Public Seam & Central Spine (Matt Pocock Deep Module).
 *
 * Responsibilities:
 * - Central Command Bus (IEditorCommandBus) & strongly-typed discriminated unions.
 * - CodeMirror 6 Host, Extension Compartments, Keymaps & Themes.
 * - Unified Workspace, Document, Layout, Connectivity & Collaboration Stores.
 * - Modern Workbench Layout Shell (ActivityBar, Topbar, WorkbenchShell).
 */

// 1. Event Bus Spine
export {
  editorCommandBus,
  getActiveEditorEngine,
  setActiveEditorEngine,
  getActiveEditorContent,
  getActivePdfViewer,
  setActivePdfViewer,
  registerDefaultBridges,
  registerEditorEngine,
  unregisterEditorEngine,
  getEditorEngineForFile,
  subscribeEditorEngineChanges,
} from './bus/command-bus';

export type {
  IEditorCommandBus,
  EditorCommand,
  CommandBusMiddleware,
  LatexFormatType,
  SidebarPanelName,
  DialogName,
  EditorDiagnosticItem,
} from './bus/command-bus.port';
export type { IEditorEngine, EditorEngine } from '@/features/editor/domain/types/ports/editor-engine.port';

// 2. Workbench Stores
export {
  useWorkspaceStore,
} from './store/workspace.store';
export type {
  ActivityBarTab,
  EditorSplitMode,
  ActiveEditorPane,
  LayoutState,
  EditorTab,
  WorkspaceTab,
} from './store/workspace.store';

export {
  usePageStore,
} from './store/editor.store';

export {
  useSettingsStore,
} from './store/settings.store';
export type {
  TrackChangesViewMode,
  CompilerEngine,
  CompileMode,
  LayoutMode,
  EditorTheme,
  KeybindingMode,
  SettingsTab,
} from './store/settings.store';

export {
  useConnectivityStore,
} from './store/connectivity.store';

export {
  useDocumentCollaborationStore,
} from './store/collaboration.store';
export type {
  CollaboratorPresenceInfo,
  PendingComment,
  DocumentCollaborationState,
} from './store/collaboration.store';

export {
  useSearchStore,
} from './store/search.store';

export {
  useViewerStore,
  useCompileStore,
} from '@/features/editor/subsystems/compiler';
export type { CompileError } from '@/features/editor/domain/types/compiler.types';

// 3. Shell Presentation Layer
export { default as ModernWorkbenchLayout } from './shell/ModernWorkbenchLayout';
export { default as ActivityBar } from './shell/ActivityBar';
export { default as Topbar } from './shell/Topbar';
export { default as WorkbenchShell } from './shell/WorkbenchShell';
export { default as OfflineBanner } from './shell/OfflineBanner';
export { default as SidebarPanelHeader } from './shell/SidebarPanelHeader';
export { default as PrimarySidebar } from './shell/PrimarySidebar';

// 4. Core Engine Coordinators
export {
  sessionCoordinator,
  SessionCoordinatorRegistry,
  shouldUseRealtimePersistence,
  type DocumentPersistencePort,
  type DocumentSessionOptions,
  type DraftSnapshot,
  type DocumentConflict,
  type ConflictListener,
} from './coordinator/session.coordinator';

export {
  workspaceCoordinator,
  WorkspaceCoordinatorRegistry,
} from './coordinator/workspace.coordinator';

export {
  visibilityCoordinator,
  type VisibilityLifecycleState,
} from './coordinator/visibility.coordinator';

// 5. Manuscript Backend Services & API Contracts
export {
  manuscriptService,
  pageService,
} from '@/features/editor/sdk/manuscript.service';
export {
  MANUSCRIPTS_API_BASE,
} from '@/features/editor/sdk/manuscript/base';
