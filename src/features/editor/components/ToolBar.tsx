'use client';
import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/features/auth";
import { toast } from "sonner";
import Menu from "./Menu";

import {
  Columns2,
  PanelLeft,
  PanelRight,
  Settings,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/components/ui";
import { cn } from "@/shared/lib/utils";
import { usePageContext } from "@/features/editor/store/page-context";
import { useUpdatePageTitle } from '@/features/workspaces/projects/all-drafts/services/page.services';
import {
  useEditorSettingsStore,
  type LayoutMode,
} from "@/features/editor/store/editor-settings.store";

const MAX_AVATARS = 4;

function UserAvatar({ name, avatar }: { name: string; avatar: string | null }) {
  if (avatar) {
    return <img src={avatar} alt={name} className="size-full object-cover" />;
  }
  return (
    <div className="size-full rounded-full bg-primary/20 flex items-center justify-center font-semibold text-primary text-[10px]">
      {name.charAt(0).toUpperCase()}
    </div>
  );
}



const LAYOUT_OPTIONS: {
  value: LayoutMode;
  icon: React.ElementType;
  label: string;
}[] = [
    { value: "editor-only", icon: PanelLeft, label: "Editor only" },
    { value: "split", icon: Columns2, label: "Editor & PDF" },
    { value: "viewer-only", icon: PanelRight, label: "PDF only" },
  ];

export default function ToolBar() {
  const navigate = useRouter();
  const { currentPage } = usePageContext();
  const {
    layout,
    setLayout,
    settingsPanelOpen,
    toggleSettingsPanel,
  } = useEditorSettingsStore();

  const updateTitleMutation = useUpdatePageTitle();
  const [isEditing, setIsEditing] = React.useState(false);
  const [editTitle, setEditTitle] = React.useState("");

  const handleCommit = () => {
    const trimmed = editTitle.trim();
    if (!trimmed || trimmed === currentPage?.title) {
      setIsEditing(false);
      return;
    }
    updateTitleMutation.mutate(
      { pageId: currentPage!._id, title: trimmed },
      {
        onSuccess: () => {
          setIsEditing(false);
          toast.success("Page renamed successfully");
        },
        onError: () => {
          setIsEditing(false);
        },
      }
    );
  };

  const projectName =
    currentPage && typeof currentPage.projectId === "object"
      ? currentPage.projectId.name
      : null;

  const LayoutIcon =
    LAYOUT_OPTIONS.find((o) => o.value === layout)?.icon ?? Columns2;

  return (
    <nav className="relative flex h-12 justify-between items-center px-2 py-1 border-b border-border bg-background shrink-0 z-10">
      {/* ΓöÇΓöÇ Left ΓöÇΓöÇ */}
      <div className="flex gap-1 items-center min-w-0">
        <Menu />
      </div>
      {/* Center breadcrumb: Logo / Project / Page */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center">
        <button onClick={() => navigate.push("/ws")}>
          <img src="/Flux.svg" className="size-5 mr-2" alt="Flux" />
        </button>

        {/* Project name ΓåÆ back to project pages */}
        {projectName && (
          <>
            <span className="text-muted-foreground/40 mx-1 text-sm select-none">/</span>
            <button
              onClick={() => {
                const proj = currentPage?.projectId;
                if (proj && typeof proj === "object") {
                  const ws = proj.workspaceId;
                  const wsUrl = ws && typeof ws === "object" ? ws.url : null;
                  if (wsUrl) {
                    navigate.push(`/${wsUrl}/projects/${proj._id}/pages`);
                    return;
                  }
                }
                navigate.back();
              }}
              title="Back to project"
              className="mx-1 p-1 text-sm rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors shrink-0 max-w-44 truncate"
            >
              {projectName}
            </button>
          </>
        )}

        {/* Page title (current document) */}
        {currentPage?.title && (
          <>
            <span className="text-muted-foreground/40 mx-1 text-sm select-none">/</span>
            {isEditing ? (
              <input
                autoFocus
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onBlur={handleCommit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCommit();
                  if (e.key === "Escape") setIsEditing(false);
                }}
                className="h-7 px-2 py-0.5 text-sm bg-muted focus:bg-background border border-primary/30 focus:border-primary rounded-md outline-none text-foreground font-medium transition-all"
                style={{ width: `${Math.max(80, editTitle.length * 8 + 16)}px`, maxWidth: "200px" }}
              />
            ) : (
              <span
                onClick={() => {
                  setIsEditing(true);
                  setEditTitle(currentPage.title);
                }}
                title="Click to rename page"
                className="text-sm mx-1 font-medium text-foreground cursor-pointer hover:bg-primary/10 hover:text-primary rounded px-1.5 py-0.5 -mx-1.5 transition-colors select-none truncate max-w-44"
              >
                {currentPage.title}
              </span>
            )}
          </>
        )}
      </div>

      {/* ΓöÇΓöÇ Right ΓöÇΓöÇ */}
      <div className="flex gap-1 items-center shrink-0">
        {/* Collaborator avatars */}


        {/* Layout switcher */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              title="Layout"
              className="p-1.5 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
            >
              <LayoutIcon strokeWidth={1.5} className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            {LAYOUT_OPTIONS.map(({ value, icon: Icon, label }) => (
              <DropdownMenuItem
                key={value}
                onClick={() => setLayout(value)}
                className={cn(layout === value && "font-semibold text-primary")}
              >
                <Icon className="size-4 mr-2" strokeWidth={1.5} />
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Settings panel toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={toggleSettingsPanel}
              title="Settings"
              className={cn(
                "p-1.5 rounded transition-colors",
                settingsPanelOpen
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground hover:text-primary hover:bg-primary/10",
              )}
            >
              <Settings className="size-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Settings</TooltipContent>
        </Tooltip>
      </div>
    </nav>
  );
}
