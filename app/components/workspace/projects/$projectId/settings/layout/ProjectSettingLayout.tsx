import { Outlet, useLocation, useParams, useNavigate } from "react-router";
import { useProjects } from "~/hooks/useWorkspace";
import { Settings, ChevronDown } from "lucide-react";
import Topbar from "../../overview/Topbar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";

export default function ProjectSettingLayout() {
  const { workspaceId, projectId } = useParams();
  const { projects } = useProjects();
  const currentProject = projects?.find((p) => p._id === projectId);
  const navigate = useNavigate();
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
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 text-xs font-semibold text-primary/80 bg-background hover:bg-secondary/40 px-3 py-1.5 rounded-sm transition-all cursor-pointer outline-none border border-border/50">
                {activeTab.label}
                <ChevronDown size={14} className="text-muted-foreground/60" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              {tabs.map((tab) => (
                <DropdownMenuItem
                  key={tab.label}
                  onClick={() => navigate(tab.to)}
                  className={activeTab.label === tab.label ? "bg-muted font-medium" : ""}
                >
                  {tab.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
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
