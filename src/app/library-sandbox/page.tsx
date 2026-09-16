import type { Metadata } from 'next';
import { Suspense } from 'react';
import LibraryPage from '@/features/library/pages/LibraryPage';

export const metadata: Metadata = {
  title: 'Library & Reader Sandbox · Flux',
  description: 'Isolated testing environment for Library and Reader features.',
};

export default function LibrarySandboxPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full w-full items-center justify-center bg-background text-sm text-muted-foreground">
          Đang tải môi trường Library Sandbox...
        </div>
      }
    >
      <LibraryPage />
    </Suspense>
  );
}
