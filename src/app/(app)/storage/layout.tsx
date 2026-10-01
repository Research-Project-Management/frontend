'use client';

import dynamic from 'next/dynamic';
import Sidebar from '@/features/storage/components/layout/Sidebar';

import { usePreviewStore } from '@/features/storage/store/use-preview-store';
import { useStorageUIStore } from '@/features/storage/store/storage-ui.store';
import { cn } from "@/shared/lib/utils";

const Preview = dynamic(
  () => import('@/features/storage/components/preview/Preview'),
  { ssr: false }
);

const VersionHistoryModal = dynamic(
  () => import('@/features/storage/components/modal/VersionHistoryModal'),
  { ssr: false }
);

const ScientificViewerModal = dynamic(
  () => import('@/features/storage/components/preview/ScientificViewerModal'),
  { ssr: false }
);

export default function Layout({ children }: { children?: React.ReactNode }) {
  const isPreviewOpen = usePreviewStore((s) => !!s.selectedItem);
  const versionModalItem = useStorageUIStore((s) => s.versionModalItem);
  const closeVersionModal = useStorageUIStore((s) => s.closeVersionModal);
  const scientificViewerItem = useStorageUIStore((s) => s.scientificViewerItem);
  const closeScientificViewer = useStorageUIStore((s) => s.closeScientificViewer);

  return (
    <div className="flex flex-col md:flex-row h-full w-full bg-transparent overflow-hidden relative">
      <aside className="shrink-0 relative z-20">
        <Sidebar />
      </aside>

      <div className="flex-1 min-w-0 flex flex-col overflow-hidden relative">
        <main className={cn("flex-1 min-h-0 flex overflow-hidden relative", isPreviewOpen ? "pr-0" : "")}>
          <div className="h-full flex-1 w-full relative z-10 overflow-y-auto">
            {children}
          </div>
          {isPreviewOpen && <Preview />}
        </main>
      </div>

      {versionModalItem && (
        <VersionHistoryModal
          open={!!versionModalItem}
          onOpenChange={(open) => {
            if (!open) closeVersionModal();
          }}
          file={versionModalItem}
        />
      )}

      {scientificViewerItem && (
        <ScientificViewerModal
          open={!!scientificViewerItem}
          onOpenChange={(open) => {
            if (!open) closeScientificViewer();
          }}
          file={scientificViewerItem}
        />
      )}
    </div>
  );
}
