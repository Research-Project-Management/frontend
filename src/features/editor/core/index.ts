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
  getActiveEditorInstance,
  registerDefaultBridges,
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
export type { IEditorEngine } from '@/features/editor/domain/types/ports/editor-engine.port';

// 2. Workbench Stores
export {
  useWorkspaceStore,
} from './store/workspace.store';

export {
  usePageStore,
  useDocumentEditorStore,
} from './store/editor.store';

export {
  useLayoutStore,
} from './store/layout.store';
export type { ActivityBarTab } from './store/layout.store';

export {
  useSettingsStore,
  useDocumentSettingsStore,
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
  useCollaborationStore,
  useDocumentCollaborationStore,
} from './store/collaboration.store';
export type {
  CollaboratorPresenceInfo,
  PendingComment,
  DocumentCollaborationState,
} from './store/collaboration.store';

export {
  useTabsStore,
} from './store/tabs.store';
export type { EditorTab } from './store/tabs.store';

export {
  useSearchStore,
} from './store/search.store';

export {
  useViewerStore,
} from '@/features/editor/subsystems/compiler/coordinator/viewer.store';

export {
  useCompilerStore,
  useCompileStore,
} from '@/features/editor/subsystems/compiler/coordinator/compiler.store';
export type { CompileError } from '@/features/editor/subsystems/compiler/coordinator/compiler.store';

// 3. Shell Presentation Layer
export { default as ModernWorkbenchLayout } from './shell/ModernWorkbenchLayout';
export { default as ActivityBar } from './shell/ActivityBar';
export { default as Topbar } from './shell/Topbar';
export { default as WorkbenchShell } from './shell/WorkbenchShell';
export { default as OfflineBanner } from './shell/OfflineBanner';
export { default as SidebarPanelHeader, SidebarPanelHeader as NamedSidebarPanelHeader } from './shell/SidebarPanelHeader';
export { default as PrimarySidebar, PrimarySidebar as NamedPrimarySidebar } from './shell/PrimarySidebar';

// 4. Core Engine Coordinators
export {
  sessionCoordinator,
  SessionCoordinatorRegistry,
  shouldUseRealtimePersistence,
  type DraftSnapshot,
  type DocumentConflict,
  type ConflictListener,
} from './coordinator/session.coordinator';
export type { DocumentPersistencePort } from '@/features/editor/domain/document/persistence-port';

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
