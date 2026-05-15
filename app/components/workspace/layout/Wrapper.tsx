import React, { useState, useId } from "react";
import { motion, LayoutGroup } from "framer-motion";
import Flux from "~/assets/Flux.svg?react";

import {
  CloudIcon,
  Square3Stack3DIcon,
  InboxIcon,
  SparklesIcon,
  MagnifyingGlassIcon,
  Cog6ToothIcon,
} from "@heroicons/react/24/solid";
import { Link, useParams, useLocation, useNavigate } from "react-router";
import { cn } from "~/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { useQuery } from "@tanstack/react-query";
import { fetchUser, logoutUser } from "~/query/user";
import { useWorkspaces, fetchProjectsByWorkspaceId } from "~/query/workspace";
import type { Workspace } from "~/types/workspace";
import useAuth from "~/hooks/useAuth";
import Loading from "~/components/ui/Loading";
import { Label } from "~/components/ui/label";
import { Separator } from "~/components/ui/separator";
import { Button } from "~/components/ui/button";
import {
  Cog,
  LayoutGrid,
  Plus,
  PlusCircle,
  User,
  LogOut,
  Settings,
  ChevronDown,
} from "lucide-react";
import SearchCommandPalette from "./SearchCommandPalette";
import { Avatar } from "./Avatar";

const sidebarItems = [
  { label: "Projects", icon: Square3Stack3DIcon, to: "" },
  { label: "Chat AI", icon: SparklesIcon, to: "/ai" },
  { label: "Storage", icon: CloudIcon, to: "/storage" },
  { label: "Settings", icon: Cog6ToothIcon, to: "/settings" },
];

export default function Wrapper({ children }: { children: React.ReactNode }) {
  const { isLoading: isUserLoading } = useAuth();
  return (
    <div className="h-dvh bg-secondary flex flex-col overflow-hidden">
      <TopBar />
      <div className="flex w-full flex-1 min-h-0 flex-col gap-2 p-2 pt-0 md:flex-row md:pl-0">
        <SideBar />
        <div className="order-1 flex-1 min-w-0 overflow-hidden rounded-lg border border-border bg-background shadow-sm md:order-2">
          {isUserLoading ? <Loading /> : children}
        </div>
      </div>
    </div>
  );
}

export function TopBar() {
  const { user, isLoading } = useAuth();
  const { workspaceId, projectId } = useParams();
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const { workspaces } = useWorkspaces();
  const currentWorkspace = (workspaces ?? []).find(
    (w: any) => w.url === workspaceId,
  ) as any;

  // Fetch projects for project switcher
  const { data: projectsData } = useQuery({
    queryKey: ["projects-header", workspaceId],
    queryFn: () => fetchProjectsByWorkspaceId(workspaceId!),
    enabled: !!workspaceId,
    staleTime: 60_000,
  });
  const projects = projectsData?.projects;

  // Fetch current project name if in a project route
  const { data: project } = useQuery({
    queryKey: ["project-header", projectId],
    queryFn: async () => {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/project/${projectId}`,
        { credentials: "include" },
      );
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!projectId,
    staleTime: 60_000,
  });

  const projectName = project?.project?.name || project?.name;

  return (
    <nav className="grid w-full grid-cols-[1fr_auto] items-center gap-2 px-3 py-2 sm:grid-cols-[1fr_auto_1fr] sm:px-4">
      {/* Left: Search button */}
      <div className="flex min-w-0 items-center">
        <button
          onClick={() => setSearchOpen(true)}
          className="flex min-w-0 items-center gap-2 rounded-md px-2.5 py-2 text-foreground transition-colors hover:bg-accent hover:text-primary sm:px-3 sm:py-1.5"
        >
          <MagnifyingGlassIcon className="size-5" />
          <span className="text-xs font-medium hidden sm:inline">Search</span>
          <kbd className="hidden sm:inline-flex text-[10px] bg-muted text-muted-foreground/80 px-1.5 py-0.5 rounded font-mono ml-1">
            Ctrl + K
          </kbd>
        </button>
      </div>

      {/* Center: Breadcrumb in white rounded container */}
      <div className="order-3 col-span-2 flex min-w-0 items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-2 py-1.5 shadow-sm sm:order-none sm:col-span-1 sm:px-3">
        {/* Flux Logo */}
        <Link
          to={`/${workspaceId}`}
          className="shrink-0 hover:opacity-80 transition-opacity"
        >
          <Flux className="size-5" />
        </Link>

        {/* Workspace dropdown */}
        {currentWorkspace && (
          <>
            <span className="text-primary/20 text-sm select-none">/</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 hover:bg-muted rounded-md px-2 py-1 transition-colors cursor-pointer outline-none">
                  <Avatar
                    src={currentWorkspace.avatar}
                    name={currentWorkspace.name}
                    className="size-5 rounded"
                    fallbackType="workspace"
                  />
                  <span className="max-w-[44vw] truncate text-sm font-semibold text-foreground sm:max-w-[140px]">
                    {currentWorkspace.name}
                  </span>
                  <ChevronDown className="size-3 text-primary/40" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="w-52">
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  Actions
                </DropdownMenuLabel>
                <DropdownMenuItem onClick={() => navigate("/create")}>
                  <PlusCircle className="mr-2 size-4" />
                  Create Workspace
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/manage")}>
                  <LayoutGrid className="mr-2 size-4" />
                  Manage Workspaces
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  Switch
                </DropdownMenuLabel>
                {(workspaces ?? []).map((ws: any) => (
                  <DropdownMenuItem
                    key={ws._id}
                    onClick={() => navigate(`/${ws.url}`)}
                    className={ws.url === workspaceId ? "bg-muted" : ""}
                  >
                    <Avatar
                      src={ws.avatar}
                      name={ws.name}
                      className="mr-2 size-5 rounded-sm"
                      fallbackType="workspace"
                    />
                    <span className="truncate">{ws.name}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}

        {/* Project dropdown */}
        {projectId && projectName && (
          <>
            <span className="text-primary/20 text-sm select-none">/</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1.5 hover:bg-muted rounded-md px-2 py-1 transition-colors cursor-pointer outline-none">
                  <span className="max-w-[34vw] truncate text-sm font-medium text-muted-foreground sm:max-w-[140px]">
                    {projectName}
                  </span>
                  <ChevronDown className="size-3 text-primary/40" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="w-52">
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  Actions
                </DropdownMenuLabel>
                <DropdownMenuItem onClick={() => navigate(`/${workspaceId}`)}>
                  <PlusCircle className="mr-2 size-4" />
                  Create Project
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  Switch
                </DropdownMenuLabel>
                {(projects ?? []).map((p: any) => (
                  <DropdownMenuItem
                    key={p._id}
                    onClick={() =>
                      navigate(`/${workspaceId}/projects/${p._id}/overview`)
                    }
                    className={p._id === projectId ? "bg-muted" : ""}
                  >
                    <span className="truncate">{p.name}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>

      {/* Right: Inbox + User */}
      <div className="flex min-w-0 items-center justify-end gap-3">
        <InboxIcon className="size-10 p-2 hover:bg-primary/10 rounded-sm text-primary/60 cursor-pointer hidden" />
        {!isLoading && user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div className="size-8 cursor-pointer hover:ring-2 hover:ring-primary/20 transition-all rounded-sm overflow-hidden">
                <Avatar
                  src={user.avatar}
                  name={user.name!}
                  className="size-full"
                  fallbackType="user"
                />
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {user.name}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() =>
                  workspaceId && navigate(`/${workspaceId}/settings/profile`)
                }
              >
                <User className="mr-2 h-4 w-4" />
                <span>Profile</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logoutUser} variant="destructive">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      <SearchCommandPalette open={searchOpen} onOpenChange={setSearchOpen} />
    </nav>
  );
}

export function SelectWorkspaces() {
  const navigate = useNavigate();
  const { workspaceId } = useParams();

  const { workspaces, isLoading: workspacesLoading } = useWorkspaces();
  return (
    <Select
      onValueChange={(url) => navigate(`/${url}`)}
      value={workspaceId ?? ""}
      disabled={workspacesLoading || !workspaces || workspaces.length === 0}
    >
      <SelectTrigger
        size="sm"
        className="w-[150px] p-1 focus-visible:ring hover:ring-1 ring-primary/10 border-transparent focus-visible:border-transparent"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="w-[200px] p-2">
        <Label className=" py-1 px-2 text-primary/60">Workspaces</Label>
        <Link to="/create">
          <Button
            variant="ghost"
            className="w-full justify-start text-xs text-foreground font-semibold"
            size="sm"
          >
            <PlusCircle className="mr-2 size-5" />
            Create
          </Button>
        </Link>
        <Link to="/manage">
          <Button
            variant="ghost"
            className="w-full justify-start text-xs text-foreground font-semibold"
            size="sm"
          >
            <LayoutGrid className="mr-2 size-5" />
            Manage
          </Button>
        </Link>
        <Separator className="my-1" />
        <Label className=" py-1 px-2 text-primary/60">Switch</Label>
        {(workspaces ?? []).map((workspace: any) => (
          <SelectItem key={workspace._id} value={workspace.url}>
            <div className="flex items-center  gap-2">
              <img
                src={workspace.avatar}
                alt={workspace.name}
                className="size-6 rounded-sm object-cover"
              />
              <span className="font-semibold truncate ">{workspace.name}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function SideBar() {
  const id = useId();
  return (
    <LayoutGroup id={id}>
      <div className="order-2 flex h-14 shrink-0 items-center justify-around gap-1 rounded-lg border border-border bg-background/95 p-1 shadow-sm backdrop-blur md:order-1 md:h-auto md:w-20 md:flex-col md:justify-start md:border-0 md:bg-transparent md:p-2 md:shadow-none">
        {sidebarItems.map((item) => (
          <ItemSideBar
            key={item.label}
            icon={item.icon}
            label={item.label}
            to={item.to}
            instanceId={id}
          />
        ))}
      </div>
    </LayoutGroup>
  );
}

export function ItemSideBar({
  icon: Icon,
  label,
  to = "#",
  instanceId,
}: {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  label: string;
  to?: string;
  instanceId: string;
}) {
  const { workspaceId } = useParams();
  const location = useLocation();

  const fullPath = `/${workspaceId}${to}`;

  const isActive = (() => {
    if (to === "") {
      // Projects: active khi không có /ai, /team, /storage
      const pathAfterWorkspace = location.pathname.replace(
        `/${workspaceId}`,
        "",
      );
      return (
        pathAfterWorkspace === "" ||
        pathAfterWorkspace === "/" ||
        (!pathAfterWorkspace.startsWith("/ai") &&
          !pathAfterWorkspace.startsWith("/team") &&
          !pathAfterWorkspace.startsWith("/storage") &&
          !pathAfterWorkspace.startsWith("/settings"))
      );
    }
    // Các route khác: kiểm tra exact hoặc startsWith
    return (
      location.pathname === fullPath ||
      location.pathname.startsWith(`${fullPath}/`)
    );
  })();

  return (
    <Link
      to={fullPath}
      className={cn(
        "group relative flex h-12 min-w-0 flex-1 cursor-pointer flex-col items-center justify-center gap-1 rounded-md px-1.5 md:h-14 md:w-full md:flex-none",
        isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <div className="relative flex size-9 items-center justify-center">
        {isActive && (
          <motion.div
            layoutId={`sidebar-active-${instanceId}`}
            className="absolute inset-0 rounded-md bg-accent"
            initial={false}
            transition={{ type: "spring", stiffness: 450, damping: 35 }}
          />
        )}
        {!isActive && (
          <div className="absolute inset-0 rounded-md bg-primary/5 opacity-0 transition-opacity group-hover:opacity-100" />
        )}
        <Icon
          className={cn(
            "size-full p-2 relative z-10 transition-transform group-hover:scale-110",
            isActive ? "text-primary" : "text-muted-foreground",
          )}
        />
      </div>
      <span className="z-10 max-w-full whitespace-nowrap text-[11px] font-medium leading-tight">
        {label}
      </span>
    </Link>
  );
}
