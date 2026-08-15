'use client';

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { useProjectDetails } from '@/features/workspaces/projects/shell/services/project.services';
import { useUpdateProject } from "@/features/workspaces/projects/shell/services/project.services";
import { Button, Skeleton, Switch } from "@/shared/components/ui";
import { Loader2, LayoutDashboard, Settings, FileText, CheckSquare, HardDrive, StickyNote, RefreshCcw } from "lucide-react";
import { cn } from "@/shared/lib/utils";

const ALL_MODULES = [
  { id: "overview", label: "Overview", icon: LayoutDashboard, locked: true },
  { id: "pages", label: "Pages", icon: FileText, locked: false },
  { id: "tasks", label: "Tasks", icon: CheckSquare, locked: false },
  { id: "cycles", label: "Cycles", icon: RefreshCcw, locked: false },
  { id: "storage", label: "Storage", icon: HardDrive, locked: false },
  { id: "stickies", label: "Stickies", icon: StickyNote, locked: false },
  { id: "settings", label: "Settings", icon: Settings, locked: true },
];

export default function ModulesPage() {
  const { projectId } = useParams() as { projectId: string };
  const { data: projectData, isLoading, isError } = useProjectDetails(projectId);
  const updateMutation = useUpdateProject();

  const [activeModules, setActiveModules] = useState<string[]>([]);

  const p = (projectData as any)?.project || projectData;

  useEffect(() => {
    if (p?.modules) {
      setActiveModules(p.modules);
    }
  }, [p]);

  if (isLoading) {
    return <div className="p-8"><Skeleton className="h-64 w-full rounded-xl" /></div>;
  }

  if (isError || !p) {
    return <div className="p-8 text-zinc-500">Error loading project.</div>;
  }

  const toggleModule = (moduleId: string) => {
    const isLocked = ALL_MODULES.find(m => m.id === moduleId)?.locked;
    if (isLocked) return;

    setActiveModules((prev) => {
      if (prev.includes(moduleId)) {
        return prev.filter((id) => id !== moduleId);
      } else {
        return [...prev, moduleId];
      }
    });
  };

  const handleSave = () => {
    updateMutation.mutate({
      projectId,
      modules: activeModules
    }, {
      onSuccess: () => toast.success("Modules updated successfully")
    });
  };

  const hasChanges = JSON.stringify(activeModules.sort()) !== JSON.stringify([...(p?.modules || [])].sort());

  return (
    <div className="flex-1 p-6 max-w-4xl mx-auto space-y-8 h-full bg-background">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[17px] font-semibold text-foreground">Project Modules</h2>
          <p className="text-[13px] text-muted-foreground mt-1">
            Enable or disable features for this project.
          </p>
        </div>
        <Button 
          onClick={handleSave} 
          disabled={!hasChanges || updateMutation.isPending}
          className="h-9 rounded-lg px-4 text-xs font-medium cursor-pointer"
        >
          {updateMutation.isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
          Save Changes
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {ALL_MODULES.map((mod) => {
          const isActive = activeModules.includes(mod.id);
          const Icon = mod.icon;
          return (
            <div 
              key={mod.id}
              className={cn(
                "flex items-center justify-between p-4 rounded-lg border",
                isActive ? "border-border bg-card" : "border-transparent bg-muted/40",
                mod.locked && "opacity-75"
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn("p-2 rounded-lg", isActive ? "bg-muted text-foreground" : "bg-muted/60 text-muted-foreground")}>
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-[13px] font-semibold text-foreground">{mod.label}</h3>
                  <p className="text-[11px] text-muted-foreground">{mod.locked ? "Required module" : "Optional module"}</p>
                </div>
              </div>
              <Switch 
                checked={isActive}
                onCheckedChange={() => toggleModule(mod.id)}
                disabled={mod.locked || updateMutation.isPending}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
