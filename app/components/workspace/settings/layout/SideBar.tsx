import React from "react";
import {
  PanelLeftClose,
  UsersIcon,
  Calculator,
  ShieldCheck,
} from "lucide-react";
import { Link, useLocation, useParams } from "react-router";

export default function SideBar() {
  const { workspaceId, settingId } = useParams();
  const location = useLocation();

  const basePath = settingId
    ? `/${workspaceId}/settings/${settingId}/settings`
    : `/${workspaceId}/settings`;

  // Storage-specific navigation
  const sidebarItems = [
    { label: "General", icon: Calculator, to: basePath },
    { label: "Members", icon: UsersIcon, to: `${basePath}/members` },
    { label: "Roles", icon: ShieldCheck, to: `/${workspaceId}/roles` },
  ];

  return (
    <aside className="w-60 border-r border-secondary h-full bg-white p-2 py-4 overflow-x-hidden">
      {/* Header */}
      <div className="mb-4 px-2 flex items-center justify-between font-semibold text-lg text-foreground">
        <span>Settings</span>
        <button className="p-1 hidden rounded-sm cursor-pointer text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
          <PanelLeftClose className="size-5" />
        </button>
      </div>

      {/* Settings Navigation */}
      <nav className="flex flex-col gap-1">
        {sidebarItems.map((item) => {
          const isActive =
            location.pathname === item.to ||
            location.pathname.startsWith(item.to + "/");
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
    </aside>
  );
}
