import React from "react";
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

export default function SideBar({ onToggle }: { onToggle?: () => void }) {
  const { workspaceId, projectId } = useParams();
  const location = useLocation();

  // Determine if we're in project or workspace context
  const basePath = projectId
    ? `/${workspaceId}/project/${projectId}/storage`
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
    <aside className="w-60 border-r border-secondary h-full bg-white p-2 py-4 overflow-x-hidden">
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
      <nav className="flex flex-col gap-1">
        {storageItems.map((item) => {
          const isActive = location.pathname === item.to;
          return (
            <Link
              to={item.to}
              key={item.label}
              className={`flex items-center gap-2 p-2 rounded-sm ${
                isActive
                  ? "bg-secondary text-primary font-medium"
                  : "hover:bg-secondary/60"
              }`}
            >
              <item.icon
                className={`size-4 ${
                  isActive ? "text-primary" : "text-primary/80"
                }`}
              />
              <span
                className={`text-sm ${
                  isActive
                    ? "font-medium text-primary"
                    : "font-medium text-primary/90"
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

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
