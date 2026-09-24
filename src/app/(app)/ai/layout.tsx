'use client';

import { useAiUIStore } from '@/features/ai/store';
import { PanelRightClose } from 'lucide-react';
import { ChatModeProvider } from '@/features/ai/hooks/use-chat-mode';
import { Panel } from '@/features/ai/components/layout/panel';
import { Sidebar } from '@/features/ai/components/layout/Sidebar';
import { AiTopbar } from '@/features/ai/components/topbar/AiTopbar';
import { TooltipProvider } from '@/shared/components/ui';

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
  const { isSourcesOpen, setSourcesOpen } = useAiUIStore();

  return (
    <div className="flex-1 bg-background size-full flex overflow-hidden">
      {/* History sidebar — left */}
      <Sidebar />

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <AiTopbar />

        <div className="flex-1 overflow-hidden relative">
          {children}
        </div>
      </div>

      {/* Sources panel — right side */}
      {isSourcesOpen && (
        <aside className="shrink-0 h-full w-80 border-l border-border bg-card flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border h-11 shrink-0">
            <h2 className="text-13 font-semibold text-foreground tracking-tight">
              Sources
            </h2>
            <button
              type="button"
              onClick={() => setSourcesOpen(false)}
              className="rounded-md p-1 text-foreground hover:bg-muted transition-colors cursor-pointer"
              title="Close sources"
              aria-label="Close sources panel"
            >
              <PanelRightClose className="size-4 shrink-0" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto overflow-x-hidden p-3">
            <Panel />
          </div>
        </aside>
      )}
    </div>
  );
}
