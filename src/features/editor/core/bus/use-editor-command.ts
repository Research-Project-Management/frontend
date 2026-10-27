/**
 * src/features/editor/core/bus/use-editor-command.ts
 *
 * Observer Hook Pattern encapsulating `editorCommandBus.subscribe` lifecycle
 * with automatic latest-handler ref stabilization and unmount cleanup.
 */

import { useEffect, useRef } from 'react';
import { editorCommandBus } from './command-bus';
import type { EditorCommand } from './command-bus.port';

export function useEditorCommand<TType extends EditorCommand['type']>(
  commandType: TType,
  handler: (cmd: Extract<EditorCommand, { type: TType }>) => void,
  enabled = true,
): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!enabled) return;
    return editorCommandBus.subscribe(commandType, (cmd) => {
      handlerRef.current(cmd);
    });
  }, [commandType, enabled]);
}
