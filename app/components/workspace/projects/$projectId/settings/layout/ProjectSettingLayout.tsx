import { Link, Outlet, useLocation, useParams } from "react-router";
import { motion, LayoutGroup, AnimatePresence } from "framer-motion";

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
        <LayoutGroup id="project-settings-tabs">
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
                  className={`relative flex-1 text-center pt-4 pb-3 text-sm font-medium transition-colors ${isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                    }`}
                >
                  <span className="relative z-10">{tab.label}</span>
                  {isActive && (
                    <motion.div
                      layoutId="activeTabUnderline"
                      className="absolute bottom-[-2px] left-0 right-0 h-[2px] bg-primary z-20"
                      transition={{ type: "spring", stiffness: 500, damping: 35 }}
                    />
                  )}
                </Link>
              );
            })}
          </div>
        </LayoutGroup>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto w-full relative">
        <div className="h-full bg-background">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="h-full w-full"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
