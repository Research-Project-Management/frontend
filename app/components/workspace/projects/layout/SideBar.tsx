import {
  ChevronRight,
  Cloud,
  Home,
  KanbanSquare,
  PanelLeftClose,
  PenLine,
  Pin,
  Plus,
  Settings,
  StickyNote,
  Layers2,
  RotateCcw,
  ChartBarBig,
  UserStar,
  BookMarked,
  type LucideIcon,
} from "lucide-react";

import { useEffect, useState, useId } from "react";
import { motion, LayoutGroup } from "framer-motion";
import { Link, useLocation, useParams } from "react-router";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useProjects } from "~/hooks/useWorkspace";
import type { Project } from "~/types/project";

import {
  DialogTrigger,
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogContent,
} from "~/components/ui/dialog";
import CreateProject from "./CreateProject";

type ProjectModuleKey =
  | "overview"
  | "tasks"
  | "cycles"
  | "pages"
  | "storage"
  | "stickies"
  | "collection"
  | "settings";

const MODULE_ORDER: ProjectModuleKey[] = [
  "overview",
  "pages",
  "tasks",
  "cycles",
  "storage",
  "collection",
  "stickies",
  "settings",
];

const modulesConfig: Record<
  ProjectModuleKey,
  { label: string; icon: LucideIcon }
> = {
  overview: { label: "Overview", icon: ChartBarBig },
  pages: { label: "Pages", icon: PenLine },
  tasks: { label: "Tasks", icon: KanbanSquare },
  cycles: { label: "Cycles", icon: RotateCcw },
  storage: { label: "Storage", icon: Cloud },
  collection: { label: "Collection", icon: BookMarked },
  settings: { label: "Settings", icon: Settings },
  "stickies": { label: "Notes", icon: StickyNote },
};

export default function SideBar({ onToggle }: { onToggle?: () => void }) {
  const { workspaceId } = useParams();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const id = useId();
  const sidebarItems = [
    {
      label: "Home",
      icon: Home,
      to: "/" + workspaceId,
      matchPrefixes: ["/" + workspaceId],
    },
    {
      label: "Your Work",
      icon: UserStar,
      to: "/" + workspaceId + "/works/your-work",
      matchPrefixes: ["/" + workspaceId + "/works/your-work"],
    },
    {
      label: "All Pages",
      icon: PenLine,
      to: "/" + workspaceId + "/pages",
      matchPrefixes: ["/" + workspaceId + "/pages"],
    },
    {
      label: "Stickies",
      icon: Layers2,
      to: "/" + workspaceId + "/stickies",
      matchPrefixes: ["/" + workspaceId + "/stickies"],
    },
  ];

  const { projects }: { projects?: Project[]; isLoading: boolean } =
    useProjects();

  // Persistent state for expanded projects
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("sidebar_expanded_projects");
      return saved ? new Set(JSON.parse(saved)) : new Set();
    }
    return new Set();
  });

  // Save to localStorage when changed
  useEffect(() => {
    localStorage.setItem(
      "sidebar_expanded_projects",
      JSON.stringify(Array.from(expandedProjects)),
    );
  }, [expandedProjects]);

  // Expand active project on navigation
  useEffect(() => {
    const activeProject = projects?.find((project) =>
      location.pathname.includes(`/projects/${project._id}`),
    );

    if (!activeProject) return;

    setExpandedProjects((prev) => {
      if (prev.has(activeProject._id)) return prev;
      return new Set(prev).add(activeProject._id);
    });
  }, [location.pathname, projects]);

  const toggleProject = (id: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <aside className="h-full w-60 overflow-x-hidden border-r border-border bg-card p-2 py-4">
      {/* Header */}
      <div className="mb-4 px-2 flex items-center justify-between font-semibold text-lg text-foreground">
        <span>Projects</span>
        <button
          onClick={onToggle}
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground lg:hidden"
        >
          <PanelLeftClose className="size-5" />
        </button>
      </div>

      {/* Navigation */}
      <LayoutGroup id={`sb-nav-${id}`}>
        <nav className="flex flex-col gap-1">
          {sidebarItems.map((item) => {
            const isActive = item.matchPrefixes.some((prefix) => {
              if (item.label === "Home") {
                return (
                  location.pathname === prefix || location.pathname === prefix + "/"
                );
              }
              return (
                location.pathname === prefix ||
                location.pathname.startsWith(prefix + "/")
              );
            });
            return (
              <Link
                to={item.to}
                key={item.label}
                className="group/item relative flex h-10 items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors hover:bg-accent/70"
              >
                {isActive && (
                  <motion.div
                    layoutId={`sb-nav-active-${id}`}
                    className="absolute inset-0 rounded-md bg-accent"
                    initial={false}
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  />
                )}
                <item.icon
                  className={`relative z-10 size-4 shrink-0 ${
                    isActive ? "text-primary" : "text-muted-foreground"
                  }`}
                />
                <span
                className={`relative z-10 min-w-0 truncate text-sm ${
                    isActive
                      ? "font-semibold text-foreground"
                      : "font-medium text-muted-foreground group-hover/item:text-foreground"
                  }`}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>
      </LayoutGroup>

      {/* Projects Section */}
      <nav className="mt-4 select-none">
        <span className="ml-2 flex items-center justify-between gap-1 text-sm font-semibold text-muted-foreground">
          Projects
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <button className="p-1 rounded-sm cursor-pointer text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                <Plus className="size-4" />
              </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl">
              <DialogHeader>
                <DialogTitle className="text-xl font-semibold">
                  New Project
                </DialogTitle>
              </DialogHeader>
              <CreateProject onSuccess={() => setOpen(false)} />
            </DialogContent>
          </Dialog>
        </span>
        <div className="flex flex-col mt-2 gap-1">
          {projects && projects.length === 0 && (
            <p className="ml-2 text-xs font-medium text-muted-foreground/50">
              No projects found
            </p>
          )}
          {(projects ?? []).map((project) => {
            const isOpen = expandedProjects.has(project._id);
            const projectModules = project.modules ?? [];

            return (
              <Collapsible
                className="w-full group"
                key={project._id}
                open={isOpen}
                onOpenChange={() => toggleProject(project._id)}
              >
                <div className="flex h-10 w-full items-center justify-between gap-2 rounded-md px-2.5 transition-colors hover:bg-accent/70">
                  <CollapsibleTrigger asChild>
                    <Link 
                      to={`/${workspaceId}/projects/${project._id}/overview`}
                      className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left text-sm font-medium text-foreground transition-colors hover:text-primary"
                    >
                      <span className="shrink-0 text-base leading-none">{project.avatar}</span>
                      <span className="min-w-0 truncate">{project.name}</span>
                    </Link>
                  </CollapsibleTrigger>

                  <div className="flex gap-1 items-center">
                    <CollapsibleTrigger asChild>
                      <button className="rounded-md p-1 hover:bg-accent">
                        <ChevronRight className="size-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-90" />
                      </button>
                    </CollapsibleTrigger>
                  </div>
                </div>
                <CollapsibleContent className="overflow-hidden space-y-1 data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up">
                  {MODULE_ORDER.filter((moduleKey) =>
                    projectModules.includes(moduleKey)
                  ).map((moduleKey) => {
                    const module = modulesConfig[moduleKey];
                    if (!module) return null;
                    const moduleLink = `/${workspaceId}/projects/${project._id}/${moduleKey}`;
                    const isModuleActive = location.pathname === moduleLink || location.pathname.startsWith(moduleLink + "/");
                    return (
                      <Link
                        to={moduleLink}
                        key={moduleKey}
                        className={`flex h-9 items-center gap-2 rounded-md pl-8 pr-2.5 text-sm transition-colors ${
                          isModuleActive
                            ? "bg-accent text-foreground font-semibold"
                            : "text-muted-foreground hover:bg-accent/70 hover:text-foreground"
                        }`}
                      >
                        <module.icon
                          className={`size-4 shrink-0 ${
                            isModuleActive
                              ? "text-primary"
                              : "text-muted-foreground"
                          }`}
                        />
                        <span className="min-w-0 truncate">{module.label}</span>
                      </Link>
                    );
                  })}
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      </nav>

      {/* Pinned Section */}
      <nav className="hidden gap-2 flex-col pt-4 border-t border-secondary mt-4">
        <div className="flex gap-1 justify-between text-muted-foreground font-semibold items-center ml-2 text-sm">
          <span>Pinned</span>
          <Pin className="size-4" />
        </div>
        <p className="text-xs ml-2 font-medium text-muted-foreground/50">
          Nothing here
        </p>
      </nav>
    </aside>
  );
}
