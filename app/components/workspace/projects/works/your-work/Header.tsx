import { useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";

const TABS = ["Summary", "Assigned", "Created", "Activity"] as const;

type HeaderTab = (typeof TABS)[number];

export default function Header() {
  const [activeTab, setActiveTab] = useState<HeaderTab>("Summary");

	return (
    <header className="border-b border-border bg-background/90 backdrop-blur-sm">
      <div className="px-6 h-12 flex items-center justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-1 text-sm font-medium text-primary hover:bg-muted/50 px-2 py-1 rounded-sm transition-colors cursor-pointer outline-none">
              {activeTab}
              <ChevronDown size={16} className="text-muted-foreground/60" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            {TABS.map((tab) => (
              <DropdownMenuItem
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={activeTab === tab ? "bg-muted font-medium" : ""}
              >
                {tab}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
	);
}
