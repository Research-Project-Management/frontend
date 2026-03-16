import {
  ChartBarBig,
  ChevronRight,
  Cloud,
  Ellipsis,
  Home,
  KanbanSquare,
  Layout,
  PanelLeftClose,
  PenLine,
  Pin,
  Plus,
  Settings,
  UserStar,
  Layers2,
  RotateCcw,
} from "lucide-react";
import React, { useState } from "react";
import { Link, useLocation, useParams } from "react-router";
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
import DropMenu from "./DropMenu";

type ModuleKey =
  | "overview"
  | "tasks"
  | "cycles"
  | "pages"
  | "storage"
  | "settings"
  | "stickies";

const modulesConfig: Record<ModuleKey, { label: string; icon: LucideIcon }> = {
  overview: { label: "Overview", icon: ChartBarBig },
  tasks: { label: "Tasks", icon: KanbanSquare },
  cycles: { label: "Cycles", icon: RotateCcw },
  pages: { label: "Pages", icon: PenLine },
  storage: { label: "Storage", icon: Cloud },
  settings: { label: "Settings", icon: Settings },
  stickies: { label: "Stickies", icon: Layers2 },
};

export default function SideBar({ onToggle }: { onToggle?: () => void }) {
  const { workspaceId } = useParams();
  const location = useLocation();
  const [open, setOpen] = useState(false);
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

  const { projects, isLoading }: { projects: Project[]; isLoading: boolean } =
    useProjects();

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
          const isActive = location.pathname === item.to;
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
          {projects &&
            projects.map((project, index) => (
              <Collapsible
                className="w-full group"
                key={project._id}
                defaultOpen={index === 0}
              >
                <div className="flex w-full justify-between items-center gap-2 p-2 rounded-sm hover:bg-accent transition-colors">
                  <CollapsibleTrigger asChild>
                    <button className="flex-1 text-sm font-medium text-foreground flex gap-1 items-center text-left cursor-pointer">
                      <span className="text-base">{project.avatar}</span>
                      <span>{project.name}</span>
                    </button>
                  </CollapsibleTrigger>

                  <div className="flex gap-1 items-center">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          onClick={(e) => e.stopPropagation()}
                          className="p-1 rounded-sm cursor-pointer text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                        >
                          <Ellipsis className="size-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropMenu project={project} />
                    </DropdownMenu>
                    <CollapsibleTrigger asChild>
                      <button className="p-0.5 rounded-sm hover:bg-accent cursor-pointer">
                        <ChevronRight className="size-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-90" />
                      </button>
                    </CollapsibleTrigger>
                  </div>
                </div>
                <CollapsibleContent className="overflow-hidden space-y-1 data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up">
                  {project.modules.map((moduleKey: string) => {
                    const module = modulesConfig[moduleKey as ModuleKey];
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
