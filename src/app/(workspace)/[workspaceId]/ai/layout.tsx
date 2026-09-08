'use client';

import { PanelRightClose, PanelRightOpen } from 'lucide-react';
import { useState } from 'react';
import { ChatModeProvider, useChatMode } from '@/features/workspaces/ai/hooks/use-chat-mode';
import { Panel } from '@/features/workspaces/ai/components/layout/panel';
import { Sidebar } from '@/features/workspaces/ai/components/layout/Sidebar';
import { TooltipProvider } from '@/shared/components/ui/tooltip';

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
  const { mode } = useChatMode();
  const [sourcesOpen, setSourcesOpen] = useState(false);

  const showSources = mode === 'wiki';

  return (
    <div className="flex-1 bg-background h-full flex overflow-hidden">
      {/* History sidebar — left */}
      <Sidebar />

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Sources toggle button — floats top-right, only in wiki mode */}
        {showSources && !sourcesOpen && (
          <div className="absolute top-3 right-4 z-10">
            <button
              onClick={() => setSourcesOpen(true)}
              title="Show sources"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-xs font-medium text-foreground shadow-none hover:bg-muted transition-colors cursor-pointer"
            >
              <PanelRightOpen className="size-3.5 shrink-0" />
              Sources
            </button>
          </div>
        )}

        {children}
      </div>

      {/* Sources panel — right side, wiki mode only */}
      {showSources && sourcesOpen && (
        <aside className="shrink-0 h-full w-80 border-l border-border bg-card flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground tracking-tight">
              Sources
            </h2>
            <button
              onClick={() => setSourcesOpen(false)}
              className="rounded-md p-1.5 text-foreground hover:bg-muted transition-colors cursor-pointer"
              title="Close sources"
            >
              <PanelRightClose className="size-4 shrink-0" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-3">
            <Panel />
          </div>
        </aside>
      )}
    </div>
  );
}
