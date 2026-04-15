import { Outlet } from "react-router";
import SideBar from "./SideBar";
import { ChatModeProvider, useChatMode } from "~/contexts/ChatModeContext";
import WikiChatFeatures from "../WikiChatFeatures";

export default function ChatAiLayout() {
  return (
    <ChatModeProvider>
      <ChatAiContent />
    </ChatModeProvider>
  );
}

function ChatAiContent() {
  const { mode } = useChatMode();

  return (
    <div className="flex-1 bg-background h-full flex overflow-hidden">
      {/* Left Sidebar */}
      <aside className="shrink-0">
        <SideBar />
      </aside>

      {/* Main Chat Area */}
      <div className="flex-1 flex min-w-0 overflow-hidden">
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Outlet />
        </div>

        {/* Right Panel — Sources (Wiki Mode Only) */}
        {mode === "wiki" && (
          <aside className="shrink-0 w-68 border-l-2 border-border/80 bg-sidebar flex flex-col overflow-hidden shadow-[-4px_0_12px_0_rgba(0,0,0,0.06)]">
            {/* Header */}
            <div className="px-4 py-3.5 bg-sidebar">
              <h2 className="text-[11px] font-bold tracking-widest uppercase text-foreground/70">
                Sources
              </h2>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4">
              <WikiChatFeatures />
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
