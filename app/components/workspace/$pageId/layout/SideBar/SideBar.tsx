import {
  FileText,
  History,
  ListTree,
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
import OutlineTab from "./Tabs/OutlineTab";
import HistoryTab from "./Tabs/HistoryTab";

const sideBarItems = [
  { name: "Files", icon: FileText },
  { name: "Outline", icon: ListTree },
  { name: "Search", icon: Search },
  { name: "Ask AI", icon: Sparkles },
  { name: "Review", icon: MessageSquareQuote },
  { name: "History", icon: History },
] as const;

type Tab = (typeof sideBarItems)[number]["name"];

function PanelContent({ tab, onClose }: { tab: Tab; onClose: () => void }) {
  if (tab === "Files") return <FilesTab onClose={onClose} />;
  if (tab === "Outline") return <OutlineTab onClose={onClose} />;
  if (tab === "Search") return <SearchTab onClose={onClose} />;
  if (tab === "Ask AI") return <ChatAiTab onClose={onClose} />;
  if (tab === "Review") return <ReviewTab onClose={onClose} />;
  if (tab === "History") return <HistoryTab onClose={onClose} />;
  return null;
}

const STORAGE_KEY = "flux:sidebar:open-panels";
const validTabs = new Set(sideBarItems.map((i) => i.name));

function loadPanels(): Tab[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown[];
      const tabs = parsed.filter(
        (t): t is Tab => typeof t === "string" && validTabs.has(t as Tab),
      );
      if (tabs.length > 0) return tabs;
    }
  } catch {}
  return ["Files"];
}

export default function SideBar() {
  const [openPanels, setOpenPanels] = useState<Tab[]>(loadPanels);

  const MAX_PANELS = 2;

  const togglePanel = (name: Tab) => {
    setOpenPanels((prev) => {
      if (prev.includes(name)) return prev.filter((t) => t !== name);
      const next = [...prev, name];
      return next.length > MAX_PANELS
        ? next.slice(next.length - MAX_PANELS)
        : next;
    });
  };

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(openPanels));
  }, [openPanels]);

  useEffect(() => {
    const handler = (e: Event) => {
      const tab = (e as CustomEvent<Tab>).detail;
      setOpenPanels((prev) => {
        if (prev.includes(tab)) return prev;
        const next = [...prev, tab];
        return next.length > MAX_PANELS
          ? next.slice(next.length - MAX_PANELS)
          : next;
      });
    };
    document.addEventListener("flux:open-panel", handler);
    return () => document.removeEventListener("flux:open-panel", handler);
  }, []);

  return (
    <div className="h-full flex w-full overflow-hidden">
      {/* Icon strip */}
      <ul className="h-full flex flex-col pt-2 pb-2 px-1.5 gap-1 border-r border-border shrink-0">
        {sideBarItems.map((item) => {
          const isOpen = openPanels.includes(item.name);
          return (
            <Tooltip key={item.name}>
              <TooltipTrigger asChild>
                <li
                  onClick={() => togglePanel(item.name)}
                  className={cn(
                    "p-2 rounded cursor-pointer transition-colors",
                    isOpen
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:bg-primary/10 hover:text-primary",
                  )}
                >
                  <item.icon className="size-4" />
                </li>
              </TooltipTrigger>
              <TooltipContent side="right">{item.name}</TooltipContent>
            </Tooltip>
          );
        })}
      </ul>

      {/* Stacked panels */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {openPanels.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-xs px-3 text-center leading-relaxed">
            Click an icon to open a panel
          </div>
        ) : (
          openPanels.map((tab) => (
            <div
              key={tab}
              className="flex flex-col min-h-0 flex-1 border-b border-border last:border-0 overflow-hidden"
            >
              <PanelContent tab={tab} onClose={() => togglePanel(tab)} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
