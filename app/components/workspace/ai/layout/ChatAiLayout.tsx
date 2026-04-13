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
          <aside className="shrink-0 w-68 border-l border-border/60 bg-background flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3.5 border-b border-border/60">
              <h2 className="text-[11px] font-semibold tracking-widest uppercase text-muted-foreground/60">
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
