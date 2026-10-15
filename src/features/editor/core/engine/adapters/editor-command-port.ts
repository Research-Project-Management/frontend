/**
 * editor-command-port.ts
 *
 * Facet & Port for dispatching IDE commands from CodeMirror 6 extensions.
 * Location: `features/editor/engines/adapters/editor-command-port.ts`
 *
 * Matt Pocock Codebase Design principles:
 * - Decouples CodeMirror extensions from coordinator singletons.
 * - Allows headless testing of extensions with in-memory dispatcher stand-ins.
 * - Bridges to editorCommandBus at application runtime.
 */

import { Facet } from '@codemirror/state';
import type { EditorCommand } from '@/features/editor/core/bus/command-bus.port';

export type CommandDispatcher = (command: EditorCommand) => void;

let defaultDispatcher: CommandDispatcher = () => {};

export function setDefaultCommandDispatcher(dispatcher: CommandDispatcher): void {
  defaultDispatcher = dispatcher;
}

export function getDefaultCommandDispatcher(): CommandDispatcher {
  return defaultDispatcher;
}

export const commandDispatcherFacet = Facet.define<CommandDispatcher, CommandDispatcher>({
  combine: (values) => values[values.length - 1] || defaultDispatcher,
});

export function dispatchEditorCommand(
  view: { state: { facet: <T>(f: Facet<T, T>) => T } } | null | undefined,
  command: EditorCommand
): void {
  const dispatcher = view?.state?.facet?.(commandDispatcherFacet) || defaultDispatcher;
  dispatcher(command);
}
