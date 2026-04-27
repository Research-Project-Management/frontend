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
  UserStar,
  Layers2,
  RotateCcw,
  ChartBarBig,
} from "lucide-react";
import React, { useState, useId } from "react";
import { motion, LayoutGroup } from "framer-motion";
import { Link, useLocation, useParams } from "react-router";
import { cn } from "~/lib/utils";
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
  | "my-note"
  | "settings";

const MODULE_ORDER: ProjectModuleKey[] = [
  "overview",
  "pages",
  "tasks",
  "cycles",
  "storage",
  "my-note",
  "settings",
];

const modulesConfig: Record<ProjectModuleKey, { label: string; icon: LucideIcon }> = {
  overview: { label: "Overview", icon: ChartBarBig },
  tasks: { label: "Tasks", icon: KanbanSquare },
  cycles: { label: "Cycles", icon: RotateCcw },
  pages: { label: "Pages", icon: PenLine },
  storage: { label: "Storage", icon: Cloud },
  settings: { label: "Settings", icon: Settings },
  "my-note": { label: "My Notes", icon: Layers2 },
};

export default function SideBar({ onToggle }: { onToggle?: () => void }) {
  const { workspaceId } = useParams();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const id = useId();
  const sidebarItems = [
    { label: "Home", icon: Home, to: "/" + workspaceId },
    {
      label: "Your works",
      icon: UserStar,
      to: "/" + workspaceId + "/works",
    },
    {
      label: "All Pages",
      icon: PenLine,
      to: "/" + workspaceId + "/pages",
    },
    {
      label: "Stickies",
      icon: Layers2,
      to: "/" + workspaceId + "/stickies",
    },
  ];

  const { projects }: { projects: Project[]; isLoading: boolean } = useProjects();

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
      <LayoutGroup id={`sb-nav-${id}`}>
        <nav className="flex flex-col gap-1">
          {sidebarItems.map((item) => {
            const isActive = location.pathname === item.to;
            return (
              <Link
                to={item.to}
                key={item.label}
                className="flex items-center gap-2 p-2 rounded-sm relative group/item hover:bg-muted/30 transition-colors"
              >
                {isActive && (
                  <motion.div
                    layoutId={`sb-nav-active-${id}`}
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
                <span
                  className={cn(
                    "text-sm relative z-10",
                    isActive
                      ? "font-medium text-primary"
                      : "font-medium text-primary/90",
                  )}
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
          {projects &&
            projects.map((project, index) => (
              <Collapsible
                className="w-full group"
                key={project._id}
                defaultOpen={index === 0}
              >
                <div className="flex w-full justify-between items-center gap-2 p-2 rounded-sm hover:bg-accent transition-colors">
                  <CollapsibleTrigger asChild>
                    <Link 
                      to={`/${workspaceId}/projects/${project._id}/overview`}
                      className="flex-1 text-sm font-medium text-foreground flex gap-1 items-center text-left cursor-pointer hover:text-primary transition-colors"
                    >
                      <span className="text-base">{project.avatar}</span>
                      <span>{project.name}</span>
                    </Link>
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
                  {MODULE_ORDER.filter((moduleKey) => {
                    if (moduleKey === "my-note") {
                      return project.modules.includes("my-note") || project.modules.includes("stickies");
                    }
                    return project.modules.includes(moduleKey);
                  }).map((moduleKey) => {
                    const module = modulesConfig[moduleKey];
                    if (!module) return null;
                    const moduleLink = `/${workspaceId}/projects/${project._id}/${moduleKey}`;
                    const isModuleActive = location.pathname === moduleLink;
                    return (
                      <Link
                        to={moduleLink}
                        key={moduleKey}
                        className="flex items-center gap-2 pl-8 pr-2 py-1.5 rounded-sm text-sm relative group/module hover:bg-muted/30 transition-colors"
                      >
                        {isModuleActive && (
                          <motion.div
                            layoutId={`sb-module-active-${project._id}`}
                            className="absolute inset-0 bg-secondary rounded-sm"
                            initial={false}
                            transition={{ type: "spring", stiffness: 500, damping: 35 }}
                          />
                        )}
                        <module.icon
                          className={cn(
                            "size-4 relative z-10",
                            isModuleActive
                              ? "text-primary"
                              : "text-muted-foreground",
                          )}
                        />
                        <span className="relative z-10">{module.label}</span>
                      </Link>
                    );
                  })}
                </CollapsibleContent>
              </Collapsible>
            ))}
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
