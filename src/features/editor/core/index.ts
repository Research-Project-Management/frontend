/**
 * src/features/editor/core/index.ts
 *
 * Core Workbench Subsystem Public Seam & Central Spine (Matt Pocock Deep Module).
 *
 * Responsibilities:
 * - Central Command Bus (IEditorCommandBus) & strongly-typed discriminated unions.
 * - CodeMirror 6 Host, Extension Compartments, Keymaps & Themes.
 * - Unified Workspace, Document, Layout & Collaboration Stores.
 * - Workbench Layout Shell (ActivityBar, Topbar, WorkbenchShell).
 */

// 1. Event Bus Spine
export {
  editorCommandBus,
  getActiveEditorEngine,
  setActiveEditorEngine,
  getActiveEditorContent,
  setActivePdfViewer,
  registerDefaultBridges,
  registerEditorEngine,
  unregisterEditorEngine,
  getEditorEngineForFile,
  getAllRegisteredEngines,
} from './bus/command-bus';
export { useEditorInstance } from './hooks/useEditorInstance';
export { useEditorScope } from './hooks/useEditorScope';
export {
  resolveEditorScope,
  resolveEditorScopeFromState,
  resolvePageScope,
  buildPageScopeHref,
  PERSONAL_SPACE_PARAM,
  PERSONAL_LIBRARY_SCOPE_KEY,
  type PageScope,
  type PageScopeInput,
  type PageSpaceKind,
  type PageEditorSubpath,
  type BuildPageEditorHrefOptions,
  type ResolvedEditorScope,
  type EditorScopeOverrides,
} from './coordinator/editor-scope';

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
  rehydrateEditorPageFromStorage,
} from './store/workspace.store';
export type {
  ActivityBarTab,
  EditorSplitMode,
  ActiveEditorPane,
  LayoutState,
  EditorTab,
  WorkspaceTab,
  HydratePageTabsOptions,
} from './store/workspace.store';
export {
  setEditorTabsStorageProvider,
  setEditorWindowStorageProvider,
  mergeEditorTabsWithStorage,
  saveEditorTabsForPage,
  flushPendingEditorTabSaves,
  loadEditorTabsForPage,
} from './store/editor-tabs-storage.adapter';
export type {
  PersistedSplitMode,
  StorageLike,
  SerializedEditorTab,
  PersistedPageTabsEntry,
  EditorTabsEnvelope,
  PersistedWindowPageState,
  EditorWindowStateMap,
  SaveEditorTabsOptions,
} from './store/editor-tabs-storage.adapter';

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

export * from '@/features/editor/domain/constants/editor.constants';

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
  useSafeQueryClient,
} from './queries/safe-query-client';

export type { CompileError } from '@/features/editor/domain/types/compiler.types';

// 3. Shell Presentation Layer
export { default as WorkbenchLayout } from './shell/WorkbenchLayout';
export { default as ActivityBar } from './shell/ActivityBar';
export { default as Topbar } from './shell/Topbar';
export { default as WorkbenchShell } from './shell/WorkbenchShell';
export { default as SidebarPanelHeader } from './shell/SidebarPanelHeader';
export { default as PrimarySidebar } from './shell/PrimarySidebar';

// 4. Core Engine Coordinators
export {
  sessionCoordinator,
  SessionCoordinator,
  shouldUseRealtimePersistence,
  type DocumentPersistencePort,
  type DocumentSessionOptions,
  type DocumentConflict,
  type ConflictListener,
} from './coordinator/session.coordinator';

export {
  workspaceCoordinator,
  WorkspaceCoordinator,
} from './coordinator/workspace.coordinator';

export {
  documentFacade,
  DocumentFacade,
  type ProjectFileReadModel,
  type ActiveDocumentDescriptor,
} from './coordinator/document.facade';

export {
  invariantMonitor,
  InvariantMonitor,
  type InvariantViolation,
  type InvariantReport,
} from './coordinator/invariant.monitor';
export { lruDocumentCache } from '@/features/editor/domain/document/lru-document-cache';

// 5. Pages Backend Services & API Contracts
export {
  pagesService,
} from '@/features/editor/sdk/pages.service';
export {
  PAGES_API_BASE,
} from '@/features/editor/sdk/pages/base';
