import { Outlet } from "react-router";
import SideBar from "./SideBar";
import TopBar from "./TopBar";
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
      {/* Left Sidebar - Chat History */}
      <aside className="shrink-0">
        <SideBar />
      </aside>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        <header className="border-b bg-background/80 backdrop-blur-sm z-20">
          <TopBar />
        </header>

        <main className="flex-1 flex min-h-0 overflow-hidden">
          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex-1 overflow-y-auto">
              <div className="mx-auto w-full max-w-4xl h-full p-6">
                <Outlet />
              </div>
            </div>
          </div>

          {/* Right Panel - Sources (Wiki Mode Only) */}
          {mode === "wiki" && (
            <aside className="w-80 border-l bg-secondary/10 overflow-y-auto animate-in slide-in-from-right duration-300">
              <div className="p-6">
                <h2 className="text-[11px] font-bold mb-6 flex items-center gap-2 text-muted-foreground uppercase tracking-widest">
                    <span className="p-1.5 rounded-lg bg-secondary text-primary border border-border">
                        <WikiChatFeaturesIcon />
                    </span>
                    Sources
                </h2>
                <WikiChatFeatures />
              </div>
            </aside>
          )}
        </main>
      </div>
    </div>
  );
}

function WikiChatFeaturesIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 22h14a2 2 0 0 0 2-2V7.5L14.5 2H6a2 2 0 0 0-2 2v4"/><polyline points="14 2 14 8 20 8"/><path d="M2 15h10"/><path d="m9 18 3-3-3-3"/></svg>
    )
}
