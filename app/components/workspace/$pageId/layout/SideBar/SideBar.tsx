import {
  File,
  FileText,
  MessageSquareQuote,
  Search,
  Sparkle,
  Sparkles,
} from "lucide-react";
import React, { useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";

import { cn } from "~/lib/utils";
const sideBarItems = [
  {
    name: "Files",
    icon: FileText,
  },
  {
    name: "Search",
    icon: Search,
  },
  {
    name: "Ask AI",
    icon: Sparkles,
  },
  {
    name: "Review",
    icon: MessageSquareQuote,
  },
];
import SearchTab from "./Tabs/SearchTab";
import FilesTab from "./Tabs/FilesTab";
import ChatAiTab from "./Tabs/ChatAiTab";
import ReviewTab from "./Tabs/ReviewTab";

export default function SideBar() {
  const [activeTab, setActiveTab] = useState("Files");
  return (
    <div className="h-full flex w-full">
      <ul className="h-full flex flex-col p-2 gap-2 border-r border-secondary shrink-0">
        {sideBarItems.map((item) => (
          <Tooltip key={item.name}>
            <TooltipTrigger
              className={cn(
                "p-2  rounded text-primary  cursor-pointer",
                activeTab === item.name
                  ? "bg-primary/10 "
                  : "hover:bg-primary/10 "
              )}
              onClick={() => setActiveTab(item.name)}
            >
              <item.icon className="size-4" />
            </TooltipTrigger>
            <TooltipContent side="right">{item.name}</TooltipContent>
          </Tooltip>
        ))}
      </ul>
      <div className="flex-1 overflow-auto ">
        {activeTab === "Files" && <FilesTab />}
        {activeTab === "Search" && <SearchTab />}
        {activeTab === "Ask AI" && <ChatAiTab />}
        {activeTab === "Review" && <ReviewTab />}
      </div>
    </div>
  );
}
