'use client';

import dynamic from 'next/dynamic';
import React from 'react';

const StandaloneViewerPage = dynamic(
  () => import('./StandaloneViewerPage'),
  { ssr: false },
);

export default function ClientStandaloneViewer() {
  return <StandaloneViewerPage />;
}
