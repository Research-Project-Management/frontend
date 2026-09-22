'use client';

import React from 'react';

export interface VisualEditorProps {
  content?: string;
  onChange?: (val: string) => void;
  readOnly?: boolean;
}

/**
 * @deprecated Visual mode is now natively rendered via CodeMirror 6 In-place Widgets (UnifiedCodeMirrorEditor).
 */
export default function VisualEditor(_props: VisualEditorProps) {
  return null;
}
