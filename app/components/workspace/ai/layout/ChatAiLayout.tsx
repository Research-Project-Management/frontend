import { Outlet, useParams } from "react-router";
import { PanelRightClose, PanelRightOpen } from "lucide-react";
import { useState } from "react";
import { ChatModeProvider, useChatMode } from "~/contexts/ChatModeContext";
import WikiChatFeatures from "../WikiChatFeatures";
import SideBar from "./SideBar";

export default function ChatAiLayout() {
  return (
    <ChatModeProvider>
      <ChatAiContent />
    </ChatModeProvider>
  );
}

function ChatAiContent() {
  const { mode } = useChatMode();
  const { workspaceId, chatId } = useParams();
  const [sourcesOpen, setSourcesOpen] = useState(false);

  const showSources = mode === "wiki";

  return (
    <div className="flex-1 bg-background h-full flex overflow-hidden">
      {/* History sidebar — left */}
      <SideBar />

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Sources toggle button — floats top-right, only in wiki mode */}
        {showSources && !sourcesOpen && (
          <div className="absolute top-3 right-4 z-10">
            <button
              onClick={() => setSourcesOpen(true)}
              title="Show sources"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#dadce0] bg-white px-3 text-[12px] font-medium text-[#5f6368] shadow-sm hover:bg-[#f1f3f4] hover:text-[#202222] transition-colors"
            >
              <PanelRightOpen className="size-3.5" />
              Sources
            </button>
          </div>
        )}

        <Outlet />
      </div>

      {/* Sources panel — right side, wiki mode only */}
      {showSources && sourcesOpen && (
        <aside className="shrink-0 h-full w-82 border-l border-[#dadce0] bg-white flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-4 border-b border-[#dadce0]">
            <h2 className="text-[13px] font-semibold text-[#202222] tracking-tight">
              Sources
            </h2>
            <button
              onClick={() => setSourcesOpen(false)}
              className="rounded-lg p-1.5 text-[#5f6368] hover:bg-[#f1f3f4] hover:text-[#202222] transition-colors"
              title="Close sources"
            >
              <PanelRightClose className="size-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-3">
            <WikiChatFeatures />
          </div>
        </aside>
      )}
    </div>
  );
}
