/**
 * src/features/editor/index.ts
 *
 * Public entrypoint and barrel export for the Editor Feature.
 * Exposes core workbench primitives, shell components, coordinators, and stores.
 */

export * from './core';
export { default as ClientEditor } from './core/shell/ClientEditor';
export {
  resetEditorWorkspace,
  type ResetEditorWorkspaceOptions,
} from './editor-workspace-lifecycle';
