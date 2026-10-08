/**
 * Public API Surface for features/editor
 * Conforms to ADR 002 Deep Modules & 5-Tier Pure Client Architecture
 */

// Layer 5: UI Shell & Features
export { default as EditorPage } from './ui/shell/EditorPage';
export { default as ClientEditor } from './ui/shell/ClientEditor';
export { WorkbenchShell } from './ui/shell/WorkbenchShell';
export { ModernWorkbenchLayout } from './ui/shell/ModernWorkbenchLayout';
export { Topbar } from './ui/shell/Topbar';
export { ActivityBar } from './ui/shell/ActivityBar';
export { StatusBar } from './ui/shell/StatusBar';
export { default as StandaloneViewerPage } from './ui/shell/StandaloneViewerPage';
export { default as ClientStandaloneViewer } from './ui/shell/ClientStandaloneViewer';

export { EditorArea } from './ui/features/editor/EditorArea';
export { CodeMirrorView } from './ui/features/editor/CodeMirrorView';
export { EditorToolbar } from './ui/features/editor/EditorToolbar';
export { EditorTabs } from './ui/features/editor/EditorTabs';
export { EditorBreadcrumbs } from './ui/features/editor/EditorBreadcrumbs';
export { SourceVisualSwitcher } from './ui/features/editor/SourceVisualSwitcher';
export { CollaboratorCursors } from './ui/features/editor/CollaboratorCursors';
export { createDiagnosticsGutter } from './ui/features/editor/DiagnosticsGutter';
export { PdfViewer } from './ui/features/preview/PdfViewer';
export { PdfToolbar } from './ui/features/preview/PdfToolbar';
export { PdfSurface } from './ui/features/preview/PdfSurface';
export { CompilerLogs } from './ui/features/preview/CompilerLogs';
export { PdfFindBar } from './ui/features/preview/PdfFindBar';
export { PrimarySidebar } from './ui/features/sidebar/PrimarySidebar';
export { OutlineTab } from './ui/features/sidebar/OutlineTab';
export { BottomDockPanel } from './ui/features/panel/BottomDockPanel';

export * from './ui/modals';
export * from './ui/hooks';

// Layer 4: State & Stores
export * from './store';

// Layer 3: Coordinators Spine & Infrastructure Services
export * from './coordinators';

// Layer 2: Runtime Engines & Presets
export * from './engines';

// Layer 1: Domain Core, Types & Pure Algorithms
export * from './domain';

// Explicit re-exports to resolve TS2308 ambiguity
export { historyKeys } from './coordinators';
export type { DiffChunk } from './domain';
export { runLatexLinter } from './engines';
export type { LaTeXEngine } from './domain';

