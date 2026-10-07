/**
 * editor-command-bus.ts
 *
 * Bridge export for IEditorCommandBus.
 * Points to unified coordinators/command-bus singleton.
 */

export * from '../../coordinators/command-bus';
export { editorCommandBus as default } from '../../coordinators/command-bus';
