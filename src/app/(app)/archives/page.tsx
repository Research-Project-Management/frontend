import type { Metadata } from 'next';
import { Suspense } from 'react';
import ArchivePage from '@/features/projects/shell/pages/ArchivePage';

export const metadata: Metadata = {
  title: 'Archived Projects · Flux',
  description: 'Manage and restore your archived research projects.',
};

export default function ArchivesRoute() {
  return (
    <Suspense fallback={<div className="h-full flex items-center justify-center text-xs text-muted-foreground">Loading archives...</div>}>
      <ArchivePage />
    </Suspense>
  );
}
