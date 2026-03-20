import { Settings, Users, Layout } from "lucide-react";
import { Link, useLocation, useParams } from "react-router";

export default function ProjectSettingSidebar() {
  const { workspaceId, projectId } = useParams();
  const location = useLocation();

  const basePath = `/${workspaceId}/projects/${projectId}/settings`;

  const sidebarItems = [
    { label: "General", icon: Settings, to: basePath },
    { label: "Team", icon: Users, to: `${basePath}/team` },
    { label: "Modules", icon: Layout, to: `${basePath}/modules` },
  ];

  return (
    <aside className="w-60 border-r border-secondary h-full bg-background p-2 py-4 overflow-x-hidden">
      {/* Header */}
      <div className="mb-4 px-2 flex items-center font-semibold text-lg text-foreground">
        <span>Settings</span>
      </div>

      {/* Navigation */}
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
              className={`flex items-center gap-2 p-2 rounded-sm text-sm ${
                isActive
                  ? "bg-secondary text-primary font-medium"
                  : "text-primary/90 font-medium hover:bg-secondary/60"
              }`}
            >
              <item.icon
                className={`size-4 ${
                  isActive ? "text-primary" : "text-primary/80"
                }`}
              />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
