'use client';

import { useParams, usePathname } from 'next/navigation';

import { Settings, Users, ShieldCheck, User } from "lucide-react";
import React, { useId } from "react";
import { motion, LayoutGroup } from "framer-motion";
import Link from "next/link";
import { cn } from "@/shared/lib/utils";

export default function SideBar() {
  const { workspaceId } = useParams();
  const pathname = usePathname();
  const id = useId();

  const basePath = `/${workspaceId}/settings`;

  const sidebarItems = [
    { label: "Profile", icon: User, to: `${basePath}/profile` },
    { label: "General", icon: Settings, to: basePath },
    { label: "Members", icon: Users, to: `${basePath}/members` },
    { label: "Roles", icon: ShieldCheck, to: `${basePath}/roles` },
  ];

  return (
    <aside className="h-full w-60 overflow-x-hidden border-r border-border bg-card p-2 py-4">
      {/* Header */}
      <div className="mb-4 px-2 flex items-center font-semibold text-lg text-foreground">
        <span>Settings</span>
      </div>

      {/* Navigation */}
      <LayoutGroup id={`settings-nav-${id}`}>
        <nav className="flex flex-col gap-1">
          {sidebarItems.map((item) => {
            const isActive =
              pathname === item.to ||
              (item.to !== basePath &&
                pathname.startsWith(item.to + "/"));
            return (
              <Link
                href={item.to}
                key={item.label}
                className="group/item relative flex h-10 items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors hover:bg-accent/70"
              >
                {isActive && (
                  <motion.div
                    layoutId={`settings-nav-active-${id}`}
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
    </aside>
  );
}
