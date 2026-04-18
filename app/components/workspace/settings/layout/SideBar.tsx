import { Settings, Users, ShieldCheck, User } from "lucide-react";
import React, { useId } from "react";
import { motion, LayoutGroup } from "framer-motion";
import { Link, useLocation, useParams } from "react-router";
import { cn } from "~/lib/utils";

export default function SideBar() {
  const { workspaceId } = useParams();
  const location = useLocation();
  const id = useId();

  const basePath = `/${workspaceId}/settings`;

  const sidebarItems = [
    { label: "Profile", icon: User, to: `${basePath}/profile` },
    { label: "General", icon: Settings, to: basePath },
    { label: "Members", icon: Users, to: `${basePath}/members` },
    { label: "Roles", icon: ShieldCheck, to: `${basePath}/roles` },
  ];

  return (
    <aside className="w-60 border-r border-secondary h-full bg-background p-2 py-4 overflow-x-hidden">
      {/* Header */}
      <div className="mb-4 px-2 flex items-center font-semibold text-lg text-foreground">
        <span>Settings</span>
      </div>

      {/* Navigation */}
      <LayoutGroup id={`settings-nav-${id}`}>
        <nav className="flex flex-col gap-1">
          {sidebarItems.map((item) => {
            const isActive =
              location.pathname === item.to ||
              (item.to !== basePath &&
                location.pathname.startsWith(item.to + "/"));
            return (
              <Link
                to={item.to}
                key={item.label}
                className="flex items-center gap-2 p-2 rounded-sm text-sm relative group/item hover:bg-muted/30 transition-colors"
              >
                {isActive && (
                  <motion.div
                    layoutId={`settings-nav-active-${id}`}
                    className="absolute inset-0 bg-secondary rounded-sm"
                    initial={false}
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  />
                )}
                <item.icon
                  className={cn(
                    "size-4 relative z-10",
                    isActive ? "text-primary" : "text-primary/80",
                  )}
                />
                <span className="relative z-10">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </LayoutGroup>
    </aside>
  );
}
