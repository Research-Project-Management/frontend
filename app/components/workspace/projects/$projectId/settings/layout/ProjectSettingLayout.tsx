import { Link, Outlet, useLocation, useParams } from "react-router";
import { useProjects } from "~/hooks/useWorkspace";
import { Settings } from "lucide-react";
import Topbar from "../../overview/Topbar";

export default function ProjectSettingLayout() {
  const { workspaceId, projectId } = useParams();
  const location = useLocation();
  const { projects } = useProjects();
  const currentProject = projects?.find((p: { _id: string | undefined; }) => p._id === projectId);
  const basePath = `/${workspaceId}/projects/${projectId}/settings`;

  const tabs = [
    { label: "General", to: basePath },
    { label: "Team", to: `${basePath}/team` },
    { label: "Modules", to: `${basePath}/modules` },
  ];

  const activeTab = tabs.find((tab) => {
    if (tab.to === basePath) return location.pathname === basePath;
    return location.pathname.startsWith(tab.to);
  }) || tabs[0];

  return (
    <div className="flex-1 min-w-0 flex flex-col h-full bg-background overflow-hidden relative">
      <Topbar
        project={currentProject ? { name: currentProject.name, avatar: currentProject.avatar } : undefined}
        title="Settings"
        Icon={Settings}
        centerContent={
          <nav className="flex h-full max-w-full items-stretch overflow-x-auto">
            {tabs.map((tab) => {
              const isActive = activeTab.to === tab.to;

              return (
                <Link
                  key={tab.to}
                  to={tab.to}
                  className={`relative flex h-full min-w-[110px] items-center justify-center px-4 text-center text-sm font-medium whitespace-nowrap transition-colors ${
                    isActive
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab.label}
                  <span
                    className={`absolute inset-x-0 bottom-[-1px] h-0.5 transition-opacity ${
                      isActive ? "bg-foreground opacity-100" : "bg-transparent opacity-0"
                    }`}
                  />
                </Link>
              );
            })}
          </nav>
        }
      />

      <div className="flex-1 min-h-0 overflow-y-auto w-full relative">
        <div className="h-full bg-background">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
