import React from "react";

import {
  CloudIcon,
  Square3Stack3DIcon,
  UsersIcon,
  InboxIcon,
  SparklesIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/solid";
import { Input } from "~/components/ui/input";
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
import { useWorkspaces } from "~/query/workspace";
import type { Workspace } from "~/types/workspace";
import useAuth from "~/hooks/useAuth";
import Loading from "~/components/ui/Loading";
import { Label } from "~/components/ui/label";
import { Separator } from "~/components/ui/separator";
import { Button } from "~/components/ui/button";
import { Cog, LayoutGrid, Plus, PlusCircle, User, LogOut, Settings } from "lucide-react";

const sidebarItems = [
  { label: "Projects", icon: Square3Stack3DIcon, to: "" },
  { label: "Chat AI", icon: SparklesIcon, to: "/ai" },
  { label: "Storage", icon: CloudIcon, to: "/storage" },
  { label: "Teams", icon: UsersIcon, to: "/team" },
];

export default function Wrapper({ children }: { children: React.ReactNode }) {
  const { isLoading: isUserLoading } = useAuth();
  const { isLoading: isWorkspacesLoading } = useWorkspaces();
  return (
    <div className="h-screen bg-secondary flex flex-col overflow-hidden">
      <TopBar />
      <div className="flex w-full flex-1 min-h-0 pb-2 pr-2">
        <SideBar />
        <div className="flex-1 min-w-0 border rounded-md overflow-hidden bg-white">
          {isUserLoading || isWorkspacesLoading ? <Loading /> : children}
        </div>
      </div>
    </div>
  );
}

export function TopBar() {
  const { user, isLoading } = useAuth();

  return (
    <nav className="px-4 py-2 flex w-full justify-between items-center ">
      <SelectWorkspaces />
      <div className="flex items-center relative">
        <MagnifyingGlassIcon className="size-4 text-primary/60 absolute left-3" />
        <Input
          type="text"
          placeholder="Search everything..."
          className="pl-9 min-w-xl bg-white border-none focus:ring-0 focus:border-none"
        />
      </div>
      <div className="flex items-center gap-3">
        <InboxIcon className="size-10 p-2 hover:bg-primary/10 rounded-sm text-primary/60 cursor-pointer" />
        {!isLoading && user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <img
                src={user.avatar || undefined}
                alt={user.name || "User Avatar"}
                className="size-8 rounded-sm cursor-pointer hover:ring-2 hover:ring-primary/20 transition-all"
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{user.name}</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <User className="mr-2 h-4 w-4" />
                <span>Profile</span>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                <span>Settings</span>
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
      defaultValue={workspaceId || ""}
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
            className="w-full justify-start text-xs text-primary/80 font-semibold"
            size="sm"
          >
            <PlusCircle className="mr-2 size-5" />
            Create
          </Button>
        </Link>
        <Link to="/manage">
          <Button
            variant="ghost"
            className="w-full justify-start text-xs text-primary/80 font-semibold"
            size="sm"
          >
            <LayoutGrid className="mr-2 size-5" />
            Manage
          </Button>
        </Link>
        <Separator className="my-1" />
        <Label className=" py-1 px-2 text-primary/60">Switch</Label>
        {workspaces.map((workspace: Workspace) => (
          <SelectItem key={workspace._id} value={workspace.url}>
            <div className="flex items-center  gap-2">
              <img
                src={workspace.avatar}
                alt={workspace.name}
                className="size-8 rounded-sm object-cover"
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
  return (
    <div className="flex flex-col p-2 gap-4">
      {sidebarItems.map((item) => (
        <ItemSideBar
          key={item.label}
          icon={item.icon}
          label={item.label}
          to={item.to}
        />
      ))}
    </div>
  );
}

export function ItemSideBar({
  icon: Icon,
  label,
  to = "#",
}: {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  label: string;
  to?: string;
}) {
  const { workspaceId } = useParams();
  const location = useLocation();

  const fullPath = `/${workspaceId}${to}`;

  const isActive = (() => {
    if (to === "") {
      // Projects: active khi không có /ai, /team, /storage
      const pathAfterWorkspace = location.pathname.replace(
        `/${workspaceId}`,
        ""
      );
      return (
        pathAfterWorkspace === "" ||
        pathAfterWorkspace === "/" ||
        (!pathAfterWorkspace.startsWith("/ai") &&
          !pathAfterWorkspace.startsWith("/team") &&
          !pathAfterWorkspace.startsWith("/storage"))
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
        "flex flex-col items-center space-y-2 p-1 rounded-sm cursor-pointer",
        isActive ? "text-primary" : "text-primary/60"
      )}
    >
      <Icon
        className={cn(
          "size-9 rounded-md p-2",
          isActive ? "bg-primary/10" : "hover:bg-primary/10"
        )}
      />
      <span className="text-xs font-medium">{label}</span>
    </Link>
  );
}
