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
  ChevronDown,
  Columns2,
  Image,
  Loader2,
  Moon,
  MoreHorizontal,
  PanelLeft,
  PanelRight,
  Play,
  RefreshCw,
  Sun,
  Zap,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { Separator } from "~/components/ui/separator";
import { cn } from "~/lib/utils";
import { usePageContext } from "./PageContext";
import {
  useEditorSettingsStore,
  type CompileMode,
  type LaTeXEngine,
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
              <span className="font-medium">{u.name}</span> đã tham gia
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
              <span className="font-medium">{u.name}</span> đã rời khỏi
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
    <div className="flex items-center -space-x-1.5 mr-1">
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

const ENGINE_LABELS: Record<LaTeXEngine, string> = {
  pdflatex: "pdfLaTeX",
  xelatex: "XeLaTeX",
  lualatex: "LuaLaTeX",
};

export default function ToolBar() {
  const navigate = useNavigate();
  const { currentPage, isCompiling, compileRef } = usePageContext();
  const {
    layout,
    setLayout,
    editorTheme,
    setEditorTheme,
    engine,
    setEngine,
    compileMode,
    setCompileMode,
    autoCompile,
    setAutoCompile,
  } = useEditorSettingsStore();

  const COMPILE_MODE_OPTIONS: {
    value: CompileMode;
    label: string;
    icon: React.ElementType;
    description: string;
  }[] = [
    {
      value: "normal",
      label: "Normal",
      icon: Image,
      description: "With images",
    },
    { value: "fast", label: "Fast", icon: Zap, description: "No images" },
  ];

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
        <Menu />
      </div>
      {/* Center */}
      <div className="flex items-center">
        <button
          onClick={() => {
            navigate("/ws");
          }}
        >
          <Flux className="size-5 mr-2" />
        </button>
        <span className="text-muted-foreground/40 mx-1 text-sm select-none">
          /
        </span>
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
          title="Back"
          className="mx-1 p-1 text-sm rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors shrink-0"
        >
          Pages
        </button>

        {projectName && (
          <>
            <span className="text-muted-foreground/40 mx-1 text-sm select-none">
              /
            </span>
            <span className="text-sm mx-1 font-medium text-foreground truncate max-w-44">
              {projectName}
            </span>
          </>
        )}
      </div>

      {/* ── Right ── */}
      <div className="flex gap-1 items-center shrink-0">
        {/* Collaborator avatars */}
        <PresenceAvatars />

        {/* Compile split button */}
        <div className="flex items-center">
          <button
            onClick={() => compileRef.current?.()}
            disabled={isCompiling}
            title={`Compile (Ctrl+Enter) — ${compileMode === "fast" ? "Fast: no images" : "Normal: with images"}`}
            className="flex items-center gap-1.5 h-8 px-3 rounded-l-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            {isCompiling ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Play className="size-3.5 fill-white" />
            )}
            {isCompiling ? "Compiling…" : `Compile`}
            {!isCompiling && (
              <span className="opacity-60 font-normal">
                · {compileMode === "fast" ? "Fast" : "Normal"}
              </span>
            )}
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                disabled={isCompiling}
                className="flex items-center justify-center h-8 w-5 rounded-r-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60 border-l border-primary-foreground/20"
              >
                <ChevronDown className="size-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {COMPILE_MODE_OPTIONS.map(
                ({ value, label, icon: Icon, description }) => (
                  <DropdownMenuItem
                    key={value}
                    onClick={() => setCompileMode(value)}
                    className={cn(
                      compileMode === value && "font-semibol text-primary",
                      "text-xs",
                    )}
                  >
                    {label}
                    <span className="ml-auto text-xs text-muted-foreground">
                      {description}
                    </span>
                  </DropdownMenuItem>
                ),
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Separator orientation="vertical" className="h-5 mx-1" />

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

        {/* ··· Settings dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              title="Settings"
              className="p-1.5 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
            >
              <MoreHorizontal className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            {/* Engine */}
            <DropdownMenuLabel className="text-[11px] text-muted-foreground font-normal uppercase tracking-wide pb-1">
              Compiler engine
            </DropdownMenuLabel>
            {(Object.keys(ENGINE_LABELS) as LaTeXEngine[]).map((eng) => (
              <DropdownMenuItem
                key={eng}
                onClick={() => setEngine(eng)}
                className={cn(engine === eng && "font-semibold text-primary")}
              >
                {ENGINE_LABELS[eng]}
                {engine === eng && (
                  <span className="ml-auto text-[10px] text-primary">✓</span>
                )}
              </DropdownMenuItem>
            ))}

            <DropdownMenuSeparator />

            {/* Auto-compile */}
            <DropdownMenuItem onClick={() => setAutoCompile(!autoCompile)}>
              <RefreshCw
                className={cn(
                  "size-3.5 mr-2",
                  autoCompile &&
                    "text-primary animate-spin animation-duration-[3s]",
                )}
              />
              Auto-compile
              <span
                className={cn(
                  "ml-auto text-[11px] font-medium",
                  autoCompile ? "text-primary" : "text-muted-foreground",
                )}
              >
                {autoCompile ? "ON" : "OFF"}
              </span>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            {/* Dark mode */}
            <DropdownMenuItem
              onClick={() =>
                setEditorTheme(editorTheme === "light" ? "dark" : "light")
              }
            >
              {editorTheme === "light" ? (
                <Moon className="size-3.5 mr-2" />
              ) : (
                <Sun className="size-3.5 mr-2" />
              )}
              Editor theme
              <span className="ml-auto text-[11px] text-muted-foreground capitalize">
                {editorTheme}
              </span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  );
}
