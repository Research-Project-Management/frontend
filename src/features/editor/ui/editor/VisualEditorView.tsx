'use client';

/**
 * VisualEditorView.tsx
 *
 * Modern Lossless CodeMirror 6 Visual View (Overleaf Parity).
 * Location: `features/editor/ui/editor/VisualEditorView.tsx`
 *
 * Redirects to unified CodeMirrorView with Visual Mode extensions active.
 * Replaces legacy lossy contentEditable/regex converter with AST/Widget decorators.
 * Preserves 100% of underlying LaTeX code, comments, formatting, and real-time Yjs CRDT sync.
 */

import React, { useEffect } from 'react';
import { CodeMirrorView } from './CodeMirrorView';
import { useSettingsStore, editorCommandBus } from '@/features/editor/core';
import { filestore } from '@/features/editor/sdk/manuscript/filestore.api';

export interface VisualEditorViewProps {
  fileId?: string;
  filePath?: string;
  projectId?: string;
  value: string;
  onChange?: (nextLatex: string) => void;
  readOnly?: boolean;
  currentUserId?: string;
  collaborators?: unknown[];
}

export function VisualEditorView({
  fileId = 'default',
  filePath = 'main.tex',
  projectId,
  value,
  onChange,
  readOnly = false,
}: VisualEditorViewProps) {
  useEffect(() => {
    useSettingsStore.getState().setEditorMode('visual');
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'F1') {
      e.preventDefault();
      editorCommandBus.dispatch({ type: 'dialog:open', dialog: 'shortcuts' });
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && (file.type.startsWith('image/') || file.name.endsWith('.png') || file.name.endsWith('.jpg'))) {
      if (projectId) {
        filestore.upload(projectId, file, file.name);
      }
    }
  };

  return (
    <div
      className="w-full h-full flex flex-col min-h-0 min-w-0 overflow-hidden"
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      onKeyDown={handleKeyDown}
      contentEditable={readOnly ? false : true}
      suppressContentEditableWarning
    >
      <CodeMirrorView
        fileId={fileId}
        filePath={filePath}
        projectId={projectId}
        value={value}
        onChange={onChange}
        readOnly={readOnly}
      />
    </div>
  );
}

export default VisualEditorView;
