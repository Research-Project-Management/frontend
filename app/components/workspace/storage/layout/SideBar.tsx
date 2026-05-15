import React, { useId } from "react";
import { motion, LayoutGroup } from "framer-motion";
import {
  Home,
  File,
  Star,
  Trash,
  Users,
  Clock,
  PanelLeftClose,
  HardDrive,
} from "lucide-react";
import { Link, useLocation, useParams } from "react-router";
import { cn } from "~/lib/utils";

export default function SideBar({ onToggle }: { onToggle?: () => void }) {
  const { workspaceId, projectId } = useParams();
  const location = useLocation();
  const id = useId();

  // Determine if we're in project or workspace context
  const basePath = projectId
    ? `/${workspaceId}/projects/${projectId}/storage`
    : `/${workspaceId}/storage`;

  // Storage-specific navigation
  const storageItems = [
    { label: "Home", icon: Home, to: basePath },
    { label: "My Drive", icon: File, to: `${basePath}/my-files` },
    { label: "Shared", icon: Users, to: `${basePath}/shared` },
    { label: "Starred", icon: Star, to: `${basePath}/starred` },
    { label: "Trash", icon: Trash, to: `${basePath}/trash` },
  ];

  return (
    <aside className="h-full w-60 overflow-x-hidden border-r border-border bg-card p-2 py-4">
      {/* Header */}
      <div className="mb-4 px-2 flex items-center justify-between font-semibold text-lg text-foreground">
        <span>Storage</span>
        <button
          onClick={onToggle}
          className="p-1 hidden rounded-sm cursor-pointer text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <PanelLeftClose className="size-5" />
        </button>
      </div>

      {/* Storage Navigation */}
      <LayoutGroup id={`storage-nav-${id}`}>
        <nav className="flex flex-col gap-1">
          {storageItems.map((item) => {
            const isActive = location.pathname === item.to;
            return (
              <Link
                to={item.to}
                key={item.label}
                className="group/item relative flex h-10 items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors hover:bg-accent/70"
              >
                {isActive && (
                  <motion.div
                    layoutId={`storage-nav-active-${id}`}
                    className="absolute inset-0 rounded-md bg-accent"
                    initial={false}
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  />
                )}
                <item.icon
                  className={cn(
                    "relative z-10 size-4 shrink-0",
                    isActive ? "text-primary" : "text-muted-foreground",
                  )}
                />
                <span
                  className={cn(
                    "relative z-10 min-w-0 truncate",
                    isActive
                      ? "font-semibold text-foreground"
                      : "font-medium text-muted-foreground group-hover/item:text-foreground",
                  )}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>
      </LayoutGroup>

      {/* Storage Info */}
      <div className="px-2 py-4 border-t border-secondary mt-4 hidden">
        <div className="text-xs text-muted-foreground font-semibold mb-3">
          Storage Usage
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Used</span>
            <span className="font-medium text-foreground">2.5 GB of 15 GB</span>
          </div>
          <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: "16.6%" }}
            />
          </div>
          <div className="flex items-center gap-1 pt-1">
            <HardDrive className="size-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              12.5 GB available
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}
