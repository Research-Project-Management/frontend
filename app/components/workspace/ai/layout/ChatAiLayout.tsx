import { Outlet } from "react-router";
import SideBar from "./SideBar";
import TopBar from "./TopBar";
import { ChatModeProvider, useChatMode } from "~/contexts/ChatModeContext";
import WikiChatFeatures from "../WikiChatFeatures";
import { useState } from "react";
import { PanelRightClose, PanelRightOpen } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";

export default function ChatAiLayout() {
  return (
    <ChatModeProvider>
      <ChatAiContent />
    </ChatModeProvider>
  );
}

function ChatAiContent() {
  const { mode } = useChatMode();
  const [sourcesCollapsed, setSourcesCollapsed] = useState(false);

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
            <div className="flex-1 overflow-hidden">
              <Outlet />
            </div>
          </div>

          {/* Right Panel - Sources (Wiki Mode Only) */}
          {mode === "wiki" && (
            <aside
              className={`relative shrink-0 border-l bg-secondary/10 flex overflow-hidden transition-[width] duration-300 ease-in-out ${
                sourcesCollapsed ? "w-10" : "w-72"
              }`}
            >
              {/* Toggle button on left edge */}

              {/* Content — hidden when collapsed */}
              <div
                className={`flex-1 overflow-y-auto transition-opacity duration-200 ${
                  sourcesCollapsed
                    ? "opacity-0 pointer-events-none"
                    : "opacity-100"
                }`}
              >
                <div className="p-4 pt-3">
                  <h2 className="text-xs font-semibold mb-4 flex items-center gap-2 text-muted-foreground/70 uppercase tracking-widest">
                    Sources
                  </h2>
                  <WikiChatFeatures />
                </div>
              </div>

              {/* Collapsed label */}
              {sourcesCollapsed && (
                <div className="flex-1 flex items-center justify-center">
                  <span
                    className="text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-widest"
                    style={{ writingMode: "vertical-rl", rotate: "180deg" }}
                  >
                    Sources
                  </span>
                </div>
              )}
            </aside>
          )}
        </main>
      </div>
    </div>
  );
}

function WikiChatFeaturesIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 22h14a2 2 0 0 0 2-2V7.5L14.5 2H6a2 2 0 0 0-2 2v4" />
      <polyline points="14 2 14 8 20 8" />
      <path d="M2 15h10" />
      <path d="m9 18 3-3-3-3" />
    </svg>
  );
}
