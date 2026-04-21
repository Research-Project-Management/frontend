import {
  LayoutDashboard,
  ChevronRight,
  Cloud,
  Ellipsis,
  Home,
  KanbanSquare,
  PanelLeftClose,
  PenLine,
  Pin,
  Plus,
  Settings,
  Layers2,
  RotateCcw,
  ChartBarBig,
  UserStar,
} from "lucide-react";
import React, { useState, useEffect } from "react";
import { Link, useLocation, useParams } from "react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useProjects } from "~/hooks/useWorkspace";
import type { Project } from "~/types/project";
import type { LucideIcon } from "lucide-react";

import {
  DialogTrigger,
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogContent,
} from "~/components/ui/dialog";
import CreateProject from "./CreateProject";
import {
  DropdownMenu,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";


type ProjectModuleKey =
  | "overview"
  | "tasks"
  | "cycles"
  | "pages"
  | "storage"
  | "stickies"
  | "settings";

const MODULE_ORDER: ProjectModuleKey[] = [
  "overview",
  "pages",
  "tasks",
  "cycles",
  "storage",
  "stickies",
  "settings",
];

const modulesConfig: Record<ProjectModuleKey, { label: string; icon: LucideIcon }> = {
  overview: { label: "Overview", icon: ChartBarBig },
  tasks: { label: "Tasks", icon: KanbanSquare },
  pages: { label: "Pages", icon: PenLine },
  cycles: { label: "Cycles", icon: RotateCcw },
  storage: { label: "Storage", icon: Cloud },
  settings: { label: "Settings", icon: Settings },
  stickies: { label: "Stickies", icon: Layers2 },
};

export default function SideBar({ onToggle }: { onToggle?: () => void }) {
  const { workspaceId } = useParams();
  const location = useLocation();
  const [open, setOpen] = useState(false);
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

  const { projects }: { projects?: Project[]; isLoading: boolean } = useProjects();
  
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
      JSON.stringify(Array.from(expandedProjects))
    );
  }, [expandedProjects]);

  // Expand active project on navigation
  useEffect(() => {
    if (projects) {
      const activeProject = projects.find(p => location.pathname.includes(`/projects/${p._id}`));
      if (activeProject && !expandedProjects.has(activeProject._id)) {
        setExpandedProjects(prev => new Set(prev).add(activeProject._id));
      }
    }
  }, [location.pathname, projects]);

  const toggleProject = (id: string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <aside className="w-60 border-r border-secondary h-full bg-background p-2 py-4 overflow-x-hidden">
      {/* Header */}
      <div className="mb-4 px-2 flex items-center justify-between font-semibold text-lg text-foreground">
        <span>Projects</span>
        <button
          onClick={onToggle}
          className="p-1 hidden rounded-sm cursor-pointer text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <PanelLeftClose className="size-5" />
        </button>
      </div>

      {/* Navigation */}
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

      {/* Projects Section */}
      <nav className="mt-4 select-none">
        <span className="flex gap-1 justify-between text-muted-foreground font-semibold items-center ml-2 text-sm">
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
            <p className="text-xs ml-2 font-medium text-muted-foreground/50">
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
                <div className="flex w-full justify-between items-center gap-2 p-2 rounded-sm hover:bg-accent transition-colors">
                  <CollapsibleTrigger asChild>
                    <button className="flex-1 text-sm font-medium text-foreground flex gap-1 items-center text-left cursor-pointer">
                      <span className="text-base">{project.avatar}</span>
                      <span>{project.name}</span>
                    </button>
                  </CollapsibleTrigger>

                  <div className="flex gap-1 items-center">
                    <CollapsibleTrigger asChild>
                      <button className="p-0.5 rounded-sm hover:bg-accent cursor-pointer">
                        <ChevronRight className="size-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-90" />
                      </button>
                    </CollapsibleTrigger>
                  </div>
                </div>
                <CollapsibleContent className="overflow-hidden space-y-1 data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up">
                  {MODULE_ORDER.filter((moduleKey) =>
                    projectModules.includes(moduleKey),
                  ).map((moduleKey) => {
                    const module = modulesConfig[moduleKey];
                    if (!module) return null;
                    const moduleLink = `/${workspaceId}/projects/${project._id}/${moduleKey}`;
                    const isModuleActive = location.pathname === moduleLink;
                    return (
                      <Link
                        to={moduleLink}
                        key={moduleKey}
                        className={`flex items-center gap-2 pl-8 pr-2 py-1.5 rounded-sm text-sm ${
                          isModuleActive
                            ? "bg-secondary text-primary font-medium"
                            : "hover:bg-accent text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <module.icon
                          className={`size-4 ${
                            isModuleActive
                              ? "text-primary"
                              : "text-muted-foreground"
                          }`}
                        />
                        <span>{module.label}</span>
                      </Link>
                    );
                  })}
                </CollapsibleContent>
              </Collapsible>
            )})}
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
