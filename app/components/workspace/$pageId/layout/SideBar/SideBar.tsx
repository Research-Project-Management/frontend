import {
  FileText,
  History,
  MessageSquareQuote,
  Search,
  Sparkles,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";

import SearchTab from "./Tabs/SearchTab";
import FilesTab from "./Tabs/FilesTab";
import ChatAiTab from "./Tabs/ChatAiTab";
import ReviewTab from "./Tabs/ReviewTab";
import HistoryTab from "./Tabs/HistoryTab";

const sideBarItems = [
  { name: "Files", icon: FileText },
  { name: "Search", icon: Search },
  { name: "Review", icon: MessageSquareQuote },
  { name: "History", icon: History },
  { name: "Flux AI", icon: Sparkles },
] as const;

type Tab = (typeof sideBarItems)[number]["name"];

function PanelContent({ tab, onClose }: { tab: Tab; onClose: () => void }) {
  if (tab === "Files") return <FilesTab onClose={onClose} />;
  if (tab === "Search") return <SearchTab onClose={onClose} />;
  if (tab === "Flux AI") return <ChatAiTab onClose={onClose} />;
  if (tab === "Review") return <ReviewTab onClose={onClose} />;
  if (tab === "History") return <HistoryTab onClose={onClose} />;
  return null;
}

const STORAGE_KEY = "flux:sidebar:active-panel";
const validTabs = new Set(sideBarItems.map((i) => i.name));

function loadPanel(): Tab | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (typeof parsed === "string" && validTabs.has(parsed as Tab)) {
        return parsed as Tab;
      }
      if (Array.isArray(parsed)) {
        const first = parsed.find(
          (t): t is Tab => typeof t === "string" && validTabs.has(t as Tab),
        );
        if (first) return first;
      }
    }
  } catch { }
  return "Files";
}

export default function SideBar() {
  const [activePanel, setActivePanel] = useState<Tab | null>(loadPanel);

  const togglePanel = (name: Tab) => {
    setActivePanel(name);
  };

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(activePanel));
  }, [activePanel]);

  useEffect(() => {
    const handler = (e: Event) => {
      const tab = (e as CustomEvent<Tab>).detail;
      if (validTabs.has(tab)) setActivePanel(tab);
    };
    document.addEventListener("flux:open-panel", handler);
    return () => document.removeEventListener("flux:open-panel", handler);
  }, []);

  return (
    <div className="flex h-full w-full overflow-hidden border-r border-border bg-card">
      {/* Icon strip */}
      <ul className="flex h-full w-13 shrink-0 flex-col items-center gap-1 border-r border-border bg-card px-1.5 py-2">
        {sideBarItems.map((item) => {
          const isOpen = activePanel === item.name;
          return (
            <li key={item.name}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => togglePanel(item.name)}
                    className={cn(
                      "flex size-10 items-center justify-center rounded-md transition-colors",
                      isOpen
                        ? "bg-accent text-primary"
                        : "text-muted-foreground hover:bg-accent/70 hover:text-foreground",
                    )}
                  >
                    <item.icon className="size-4" strokeWidth={1.8} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">{item.name}</TooltipContent>
              </Tooltip>
            </li>
          );
        })}
      </ul>

      {/* Stacked panels */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {activePanel === null ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-xs px-3 text-center leading-relaxed">
            Click an icon to open a panel
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <PanelContent
              tab={activePanel}
              onClose={() => setActivePanel(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
