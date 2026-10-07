/**
 * Public API Surface for features/editor
 * Conforms to ADR 002 Deep Modules & Hexagonal Architecture
 */

// Block 7: UI Shell
export { default as EditorPage } from './ui/shell/EditorPage';
export { default as ClientEditor } from './ui/shell/ClientEditor';
export { WorkbenchShell } from './ui/shell/WorkbenchShell';
export { ModernWorkbenchLayout } from './ui/shell/ModernWorkbenchLayout';
export { Topbar } from './ui/shell/Topbar';
export { ActivityBar } from './ui/shell/ActivityBar';
export { StatusBar } from './ui/shell/StatusBar';
export { default as StandaloneViewerPage } from './ui/shell/StandaloneViewerPage';
export { default as ClientStandaloneViewer } from './ui/shell/ClientStandaloneViewer';

// Block 6: UI Features
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

// Modals
export * from './ui/modals';

// Block 5: Coordinators
export * from './coordinators';

// Block 4: Engines
export * from './engines/codemirror-preset';
export * from './engines/yjs-codemirror-adapter';
export * from './engines/latex-language';
export * from './engines/latex-macros';
export * from './engines/latex-linter';
export * from './engines/latex-math-preview';
export * from './engines/inline-diff';
export * from './engines/latex-folding';
export * from './engines/latex-error-lens';

// Block 3: IO & Adapters
export * from './io/yjs-persistence-adapter';

// Block 2: Domain (Core Business Logic)
export * from './domain/lru-document-cache';
export * from './domain/latex-dag-engine';
export * from './domain/latex-symbols-core';
export * from './domain/latex-symbols-index';
export * from './domain/compilation-snapshot';

// Block 1: State & Stores
export { useEditorStore } from './store/editor.store';
export { useTabsStore } from './store/tabs.store';
export { useCompilerStore } from './store/compiler.store';
export { useSettingsStore } from './store/settings.store';
export { useCollaborationStore } from './store/collaboration.store';
export { useLayoutStore } from './store/layout.store';

// Types & Schemas (Single Source of Truth)
export * from './types';
export * from './schemas';
