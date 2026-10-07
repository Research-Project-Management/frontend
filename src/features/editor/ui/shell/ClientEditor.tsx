'use client';

/**
 * ClientEditor.tsx
 *
 * Dynamic Client-only wrapper for Next.js SSR avoidance.
 * Location: `features/editor/ui/shell/ClientEditor.tsx`
 */

import dynamic from 'next/dynamic';
import React from 'react';

const EditorPage = dynamic(
  () => import('./EditorPage'),
  { ssr: false },
);

export default function ClientEditor() {
  return <EditorPage />;
}
