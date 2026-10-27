'use client';

import { useAiUIStore } from '@/features/ai/store/ai-ui.store';
import { ChatModeProvider } from '@/features/ai/hooks/use-chat-mode';
import { Sidebar } from '@/features/ai/components/layout/Sidebar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { PanelLeft } from 'lucide-react';

export default function ChatAiLayout({ children }: { children?: React.ReactNode }) {
  return (
    <TooltipProvider>
      <ChatModeProvider>
        <ChatAiContent>{children}</ChatAiContent>
      </ChatModeProvider>
    </TooltipProvider>
  );
}

function ChatAiContent({ children }: { children?: React.ReactNode }) {
  const isSidebarOpen = useAiUIStore((s) => s.isSidebarOpen);
  const toggleSidebar = useAiUIStore((s) => s.toggleSidebar);

  return (
    <div className="flex-1 bg-background size-full flex overflow-hidden">
      {/* History sidebar — left */}
      {isSidebarOpen && <Sidebar />}

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Floating toggle sidebar button when sidebar is collapsed */}
        {!isSidebarOpen && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={toggleSidebar}
                className="absolute top-2.5 left-3.5 z-20 size-7 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
                aria-label="Open sidebar"
              >
                <PanelLeft className="size-4 shrink-0" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">
              Open sidebar
            </TooltipContent>
          </Tooltip>
        )}

        <div className="flex-1 overflow-hidden relative">
          {children}
        </div>
      </div>
    </div>
  );
}
