import React from "react";
import { Link, useNavigate } from "react-router";
import { usePagePresence, type PresenceUser } from "~/hooks/usePagePresence";
import { useRemoteCursors } from "~/hooks/useRemoteCursors";
import { useSocket } from "~/contexts/SocketProvider";
import { useAuth } from "~/hooks/useAuth";
import { toast } from "sonner";
import Menu from "./Menu";
import Flux from "@/assets/Flux.svg?react";
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
} from "~/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";
import { usePageContext } from "./PageContext";
import {
  useEditorSettingsStore,
  type LayoutMode,
} from "~/stores/editor-settings";

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

function PresenceAvatars() {
  const { user: currentUser } = useAuth();
  const socket = useSocket();
  const { currentPage, editorRef } = usePageContext();
  const users = usePagePresence(currentPage?._id);
  const remoteCursors = useRemoteCursors(currentPage?._id);
  const [followingSocketId, setFollowingSocketId] = React.useState<
    string | null
  >(null);
  const prevUsersRef = React.useRef<PresenceUser[]>([]);
  const isFirstRender = React.useRef(true);

  // Scroll editor to followed user whenever their cursor moves
  React.useEffect(() => {
    if (!followingSocketId) return;
    const cursor = remoteCursors.get(followingSocketId);
    if (cursor && editorRef.current) {
      editorRef.current.revealLineInCenter(cursor.line);
      editorRef.current.setPosition({
        lineNumber: cursor.line,
        column: cursor.column,
      });
    }
  }, [remoteCursors, followingSocketId]);

  // Join / leave toasts
  React.useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      prevUsersRef.current = users;
      return;
    }
    const prev = prevUsersRef.current;
    const prevIds = new Set(prev.map((u) => u.socketId));
    const currIds = new Set(users.map((u) => u.socketId));
    for (const u of users) {
      if (!prevIds.has(u.socketId) && u._id !== currentUser?._id) {
        toast(
          <div className="flex items-center gap-2">
            <div className="size-6 rounded-full overflow-hidden shrink-0">
              <UserAvatar name={u.name} avatar={u.avatar} />
            </div>
            <span className="text-sm">
              <span className="font-medium">{u.name}</span> in.
            </span>
          </div>,
          { duration: 3000 },
        );
      }
    }
    for (const u of prev) {
      if (!currIds.has(u.socketId) && u._id !== currentUser?._id) {
        toast(
          <div className="flex items-center gap-2">
            <div className="size-6 rounded-full overflow-hidden shrink-0">
              <UserAvatar name={u.name} avatar={u.avatar} />
            </div>
            <span className="text-sm">
              <span className="font-medium">{u.name}</span> out.
            </span>
          </div>,
          { duration: 3000 },
        );
      }
    }
    prevUsersRef.current = users;
  }, [users]);

  // Separate self from others, deduplicate others by _id
  const selfUser = users.find((u) => u.socketId === socket?.id);
  const seen = new Set<string>();
  const others = users.filter((u) => {
    if (u.socketId === socket?.id) return false;
    if (seen.has(u._id)) return false;
    seen.add(u._id);
    return true;
  });

  const allVisible = selfUser ? [selfUser, ...others] : others;
  if (allVisible.length === 0) return null;

  const shown = allVisible.slice(0, MAX_AVATARS);
  const overflow = allVisible.length - shown.length;

  return (
    <div className="flex items-center -space-x-1.5 mr-4">
      {shown.map((u) => {
        const isSelf = u.socketId === socket?.id;
        const cursor = remoteCursors.get(u.socketId);
        const isFollowing = followingSocketId === u.socketId;
        return (
          <Tooltip key={u.socketId}>
            <TooltipTrigger asChild>
              {isSelf ? (
                <div className="size-8 rounded-full overflow-hidden shrink-0 cursor-default">
                  <UserAvatar name={u.name} avatar={u.avatar} />
                </div>
              ) : (
                <button
                  onClick={() =>
                    setFollowingSocketId(isFollowing ? null : u.socketId)
                  }
                  className={cn(
                    "size-7 rounded-full ring-2 overflow-hidden shrink-0 transition-all",
                    isFollowing
                      ? "ring-blue-500 scale-110"
                      : "ring-background hover:ring-blue-500/80",
                  )}
                >
                  <UserAvatar name={u.name} avatar={u.avatar} />
                </button>
              )}
            </TooltipTrigger>
            <TooltipContent
              side="bottom"
              className="flex flex-col items-center gap-0.5 text-center"
            >
              <span>{isSelf ? `${u.name} (You)` : u.name}</span>
              {!isSelf && cursor && (
                <span className="text-[10px] text-muted-foreground font-mono">
                  Ln {cursor.line}, Col {cursor.column}
                </span>
              )}
              {!isSelf && (
                <span className="text-[10px] text-muted-foreground">
                  {isFollowing ? "Click to unfollow" : "Click to follow"}
                </span>
              )}
            </TooltipContent>
          </Tooltip>
        );
      })}
      {overflow > 0 && (
        <div className="size-7 rounded-full ring-2 ring-background bg-muted flex items-center justify-center text-[10px] font-semibold text-muted-foreground shrink-0">
          +{overflow}
        </div>
      )}
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
  const navigate = useNavigate();
  const { currentPage } = usePageContext();
  const {
    layout,
    setLayout,
    settingsPanelOpen,
    toggleSettingsPanel,
  } = useEditorSettingsStore();

  const projectName =
    currentPage && typeof currentPage.project === "object"
      ? currentPage.project.name
      : null;

  const LayoutIcon =
    LAYOUT_OPTIONS.find((o) => o.value === layout)?.icon ?? Columns2;

  return (
    <nav className="flex h-12 justify-between items-center px-2 py-1 border-b border-border bg-background shrink-0 z-10">
      {/* ── Left ── */}
      <div className="flex gap-1 items-center min-w-0">
        <Link
          to="/ws"
          className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/80 active:bg-accent transition-all duration-200 group font-medium text-sm mr-1 shrink-0"
          title="Back to Home"
        >
          <Flux className="size-5 text-primary group-hover:scale-105 transition-all duration-200 fill-current" />
          <span className="select-none font-semibold text-foreground/80 group-hover:text-foreground transition-colors duration-200">
            Home
          </span>
        </Link>
        <span className="h-4 w-px bg-border/60 mx-1 shrink-0" />
        <Menu />
      </div>
      {/* Center breadcrumb: Project / Page */}
      <div className="flex items-center text-sm font-medium">
        {/* Project name → back to project pages */}
        {projectName && (
          <button
            onClick={() => {
              const proj = currentPage?.project;
              if (proj && typeof proj === "object") {
                const ws = proj.workspace;
                const wsUrl = ws && typeof ws === "object" ? ws.url : null;
                if (wsUrl) {
                  navigate(`/${wsUrl}/projects/${proj._id}/pages`);
                  return;
                }
              }
              navigate(-1);
            }}
            title="Back to project"
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0 max-w-[150px] truncate"
          >
            {projectName}
          </button>
        )}

        {/* Separator / Page title */}
        {currentPage?.title && (
          <>
            {projectName && (
              <span className="text-muted-foreground/40 mx-1.5 select-none">/</span>
            )}
            <span className="px-1 py-0.5 text-foreground font-semibold truncate max-w-[200px]">
              {currentPage.title}
            </span>
          </>
        )}
      </div>

      {/* ── Right ── */}
      <div className="flex gap-1 items-center shrink-0">
        {/* Collaborator avatars */}
        <PresenceAvatars />

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
