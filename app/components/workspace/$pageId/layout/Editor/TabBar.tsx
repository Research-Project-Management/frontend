import React from "react";
import { useNavigate, useParams } from "react-router";
import { X } from "lucide-react";
import { cn } from "~/lib/utils";
import { useEditorTabsStore } from "~/stores/editor-tabs";
import type { EditorTab } from "~/stores/editor-tabs";

// ── File icon colour helpers ──────────────────────────────────────────────

const EXT_COLORS: Record<string, string> = {
  tex: "text-sky-400",
  bib: "text-amber-400",
  cls: "text-purple-400",
  sty: "text-purple-400",
  md: "text-blue-400",
  txt: "text-muted-foreground",
};

function fileColor(title: string): string {
  const ext = title.split(".").pop()?.toLowerCase() ?? "";
  return EXT_COLORS[ext] ?? "text-muted-foreground";
}

// ── Single Tab ────────────────────────────────────────────────────────────

interface TabItemProps {
  tab: EditorTab;
  isActive: boolean;
  projectId: string;
}

function TabItem({ tab, isActive, projectId }: TabItemProps) {
  const navigate = useNavigate();
  const { closeTab } = useEditorTabsStore();

  const handleActivate = (e: React.MouseEvent) => {
    // Middle-click → close
    if (e.button === 1) {
      e.preventDefault();
      return;
    }
    if (!isActive) {
      navigate(`/editor/${tab.id}`);
    }
  };

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    closeTab(projectId, tab.id, (nextId) => {
      if (nextId) {
        navigate(`/editor/${nextId}`);
      } else {
        // No tabs left — go back to workspace/project pages
        navigate(-1);
      }
    });
  };

  const handleAuxClick = (e: React.MouseEvent) => {
    if (e.button === 1) {
      e.preventDefault();
      handleClose(e);
    }
  };

  return (
    <div
      role="tab"
      aria-selected={isActive}
      onClick={handleActivate}
      onAuxClick={handleAuxClick}
      className={cn(
        "group/tab relative flex items-center gap-1.5 h-full px-3 cursor-pointer select-none",
        "border-r border-border/50 min-w-0 max-w-[180px] shrink-0",
        "transition-colors",
        isActive
          ? "bg-background text-foreground"
          : "bg-muted/30 text-muted-foreground hover:bg-muted/60 hover:text-foreground",
      )}
    >
      {/* Active indicator — top border */}
      {isActive && (
        <span className="absolute inset-x-0 top-0 h-[2px] bg-primary rounded-b-sm" />
      )}

      {/* File colour dot */}
      <span
        className={cn(
          "size-[5px] rounded-full shrink-0 mt-px",
          fileColor(tab.title).replace("text-", "bg-"),
        )}
      />

      {/* Title */}
      <span className="text-[12px] truncate leading-none">{tab.title}</span>

      {/* Close button */}
      <button
        onClick={handleClose}
        onAuxClick={(e) => e.preventDefault()}
        className={cn(
          "ml-auto shrink-0 rounded p-0.5 transition-colors",
          isActive
            ? "opacity-60 hover:opacity-100 hover:bg-secondary"
            : "opacity-0 group-hover/tab:opacity-60 group-hover/tab:hover:opacity-100 hover:bg-secondary",
        )}
      >
        <X className="size-3" />
      </button>
    </div>
  );
}

// ── Tab Bar ───────────────────────────────────────────────────────────────

interface TabBarProps {
  projectId: string;
}

export default function TabBar({ projectId }: TabBarProps) {
  const { pageId } = useParams<{ pageId: string }>();
  const { getTabs } = useEditorTabsStore();
  const tabs = getTabs(projectId);

  if (tabs.length === 0) return null;

  return (
    <div
      role="tablist"
      aria-label="Open files"
      className="flex h-8 bg-muted/20 border-b border-border overflow-x-auto shrink-0 scrollbar-none"
    >
      {tabs.map((tab) => (
        <TabItem
          key={tab.id}
          tab={tab}
          isActive={tab.id === pageId}
          projectId={projectId}
        />
      ))}
    </div>
  );
}
