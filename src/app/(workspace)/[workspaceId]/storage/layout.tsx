'use client';

import Sidebar from '@/features/workspaces/storage/components/layout/Sidebar';
import Preview from '@/features/workspaces/storage/components/preview/Preview';
import { usePreviewStore } from '@/features/workspaces/storage/store/use-preview-store';
import { cn } from '@/shared/lib/utils';

export default function Layout({ children }: { children?: React.ReactNode }) {
    const isPreviewOpen = usePreviewStore(s => !!s.selectedItem);

    return (
        <div className="flex h-full w-full bg-background overflow-hidden relative">
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
        </div>
    );
}
