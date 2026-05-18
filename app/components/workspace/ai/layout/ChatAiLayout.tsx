import { Outlet, useLocation, useNavigate, useParams } from "react-router";
import { History, PanelLeftClose, PanelLeftOpen, Plus } from "lucide-react";
import { useState } from "react";
import { ChatModeProvider, useChatMode } from "~/contexts/ChatModeContext";
import WikiChatFeatures from "../WikiChatFeatures";
import ChatHistoryModal from "./ChatHistoryModal";

export default function ChatAiLayout() {
  return (
    <ChatModeProvider>
      <ChatAiContent />
    </ChatModeProvider>
  );
}

function ChatAiContent() {
  const { mode } = useChatMode();
  const navigate = useNavigate();
  const location = useLocation();
  const { workspaceId, chatId } = useParams();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(true);

  const handleNewChat = () => {
    navigate(`/${workspaceId}/ai`, {
      state: { newChatKey: Date.now(), prevPath: location.pathname },
    });
  };

  return (
    <div className="flex-1 bg-background h-full flex overflow-hidden">
      <div className="flex-1 flex min-w-0 overflow-hidden">
        {mode === "wiki" && sourcesOpen && (
          <aside className="shrink-0 h-full w-60 border-r border-border bg-card flex flex-col overflow-hidden">
            <div className="mb-1 flex items-center gap-2 px-4 py-4">
              <h2 className="text-lg font-semibold text-foreground tracking-tight">
                Sources
              </h2>
            </div>

            <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 pb-4">
              <WikiChatFeatures />
            </div>
          </aside>
        )}

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <div className="flex h-12 shrink-0 items-center justify-end border-b border-border/60 bg-background/90 px-4 backdrop-blur">
            <div className="flex items-center gap-2">
              <button
                onClick={handleNewChat}
                className="inline-flex h-8 items-center gap-2 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <Plus className="size-4" />
                New chat
              </button>
              <button
                onClick={() => setHistoryOpen(true)}
                className="inline-flex h-8 items-center gap-2 rounded-md border border-border/60 bg-secondary/30 px-3 text-xs font-medium text-foreground/75 transition-colors hover:bg-secondary"
              >
                <History className="size-4" />
                History
              </button>
            </div>
          </div>

          <Outlet />
        </div>
      </div>

      <ChatHistoryModal
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        workspaceId={workspaceId}
        activeChatId={chatId}
      />
    </div>
  );
}
