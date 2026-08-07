'use client';

import { useParams, usePathname } from 'next/navigation';

import { Settings, Users, Layout } from "lucide-react";
import Link from "next/link";

export default function ProjectSettingSidebar() {
  const { workspaceId, projectId } = useParams();
  const pathname = usePathname();

  const basePath = `/${workspaceId}/projects/${projectId}/settings`;

  const sidebarItems = [
    { label: "General", icon: Settings, to: basePath },
    { label: "Team", icon: Users, to: `${basePath}/team` },
    { label: "Modules", icon: Layout, to: `${basePath}/modules` },
  ];

  return (
    <aside className="h-full w-60 overflow-x-hidden border-r border-border bg-card p-2 py-4">
      {/* Header */}
      <div className="mb-4 px-2 flex items-center font-semibold text-lg text-foreground">
        <span>Settings</span>
      </div>

      {/* Navigation */}
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
              className={`flex h-10 items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors ${
                isActive
                  ? "bg-accent text-foreground font-semibold"
                  : "text-muted-foreground font-medium hover:bg-accent/70 hover:text-foreground"
              }`}
            >
              <item.icon
                className={`size-4 shrink-0 ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}
              />
              <span className="min-w-0 truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
