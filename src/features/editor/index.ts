/**
 * Public API Surface for features/editor
 * Conforms to ADR 002 Deep Modules & Hexagonal Architecture
 */

// Pages
export { default as EditorPage } from './pages/EditorPage';
export { default as StandaloneViewerPage } from './pages/StandaloneViewerPage';
export { default as ClientEditor } from './pages/ClientEditor';
export { default as ClientStandaloneViewer } from './pages/ClientStandaloneViewer';

// Stores
export { useEditorStore } from './store/editor.store';
export { useTabsStore } from './store/tabs.store';
export { useCompilerStore } from './store/compiler.store';
export { useSettingsStore } from './store/settings.store';
export { useCollaborationStore } from './store/collaboration.store';

// Types
export type * from './types/core.types';
