'use client';

import dynamic from 'next/dynamic';
import React from 'react';

const EditorPage = dynamic(
  () => import('./EditorPage'),
  { ssr: false },
);

export default function ClientEditor() {
  return <EditorPage />;
}
