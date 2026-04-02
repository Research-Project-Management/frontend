import { Link, Outlet, useLocation, useParams } from "react-router";

export default function ProjectSettingLayout() {
  const { workspaceId, projectId } = useParams();
  const location = useLocation();

  const basePath = `/${workspaceId}/projects/${projectId}/settings`;

  const tabs = [
    { label: "General", to: basePath },
    { label: "Team", to: `${basePath}/team` },
    { label: "Modules", to: `${basePath}/modules` },
  ];

  return (
    <div className="flex-1 min-w-0 flex flex-col h-full bg-background overflow-hidden relative">
      <header className="flex flex-col border-b border-border z-10 shrink-0">
        <div 
          className="flex items-center w-full max-w-3xl mx-auto px-8" 
          style={{ paddingLeft: "calc(var(--header-offset, 0px) + 2rem)" }}
        >
          {tabs.map((tab) => {
            const isActive =
              location.pathname === tab.to ||
              (tab.to !== basePath && location.pathname.startsWith(tab.to + "/"));
            return (
              <Link
                key={tab.label}
                to={tab.to}
                className={`flex-1 text-center pt-4 pb-3 border-b-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto w-full relative">
        <div className="h-full bg-background">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
