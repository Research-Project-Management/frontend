'use client';

import { ChatSidebar, useAiUIStore } from '@/features/ai';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';
import { PanelLeft } from 'lucide-react';

export default function ChatAiLayout({
  children,
}: {
  children?: React.ReactNode;
}) {
  return <ChatAiContent>{children}</ChatAiContent>;
}

function ChatAiContent({ children }: { children?: React.ReactNode }) {
  const isSidebarOpen = useAiUIStore((s) => s.isSidebarOpen);
  const toggleSidebar = useAiUIStore((s) => s.toggleSidebar);

  return (
    <div className="flex-1 bg-background size-full flex overflow-hidden relative">
      {/* Mobile backdrop for slide-over sidebar */}
      {isSidebarOpen && (
        <div
          onClick={toggleSidebar}
          className="fixed inset-0 z-40 bg-foreground/25 dark:bg-background/60 md:hidden"
          aria-hidden="true"
        />
      )}

      {/* History sidebar — left */}
      {isSidebarOpen && <ChatSidebar />}

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Floating toggle sidebar button when sidebar is collapsed */}
        {!isSidebarOpen && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={toggleSidebar}
                className="absolute top-2.5 left-3.5 z-20 size-8 relative before:absolute before:-inset-1.5 md:before:hidden flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ai"
                aria-label="Open sidebar"
              >
                <PanelLeft className="size-4 shrink-0" aria-hidden="true" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-12">
              Open sidebar
            </TooltipContent>
          </Tooltip>
        )}

        <div className="flex-1 overflow-hidden relative">{children}</div>
      </div>
    </div>
  );
}
