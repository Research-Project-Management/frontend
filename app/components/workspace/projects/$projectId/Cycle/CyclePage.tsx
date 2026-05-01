import { useState } from "react";
import { useParams } from "react-router";
import { useProjectCycles, useCreateCycle, useUpdateCycle, useDeleteCycle } from "~/query/cycle";
import type { Cycle, CyclePhase, CycleStatus, CycleMilestone } from "~/types/task";
import { PHASE_CONFIG } from "~/types/task";
import { Skeleton } from "~/components/ui/skeleton";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Plus,
  CalendarDays,
  CheckCircle2,
  Circle,
  Trash2,
  ChevronDown,
  ChevronRight,
  Target,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import Topbar from "../overview/Topbar";
import { useProjects } from "~/hooks/useWorkspace";
import { PhaseIconRenderer } from "./components/PhaseIconRenderer";
import { useProjectDetails } from "~/query/project";

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-500 ease-out"
        style={{
          width: `${value}%`,
          backgroundColor: value === 100 ? "#22c55e" : value > 50 ? "#3b82f6" : "#eab308",
        }}
      />
    </div>
  );
}

function StatusBadge({ status }: { status: CycleStatus }) {
  const config: Record<CycleStatus, { label: string; className: string }> = {
    planned: { label: "Planned", className: "bg-muted text-muted-foreground" },
    active: { label: "Active", className: "bg-primary/10 text-primary" },
    completed: { label: "Completed", className: "bg-green-500/10 text-green-600" },
    cancelled: { label: "Cancelled", className: "bg-destructive/10 text-destructive" },
  };
  const c = config[status];
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${c.className}`}>
      {c.label}
    </span>
  );
}

export default function CyclePage() {
  const { projectId } = useParams();
  const { data, isLoading } = useProjectCycles(projectId!);
  const createMutation = useCreateCycle();
  const updateMutation = useUpdateCycle();
  const deleteMutation = useDeleteCycle();

  const { projects } = useProjects();
  const currentProject = projects?.find((p: any) => p._id === projectId);
  const { data: projectDetails } = useProjectDetails(projectId!);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCycle, setEditingCycle] = useState<Cycle | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formPhase, setFormPhase] = useState<CyclePhase>("custom");
  const [formStatus, setFormStatus] = useState<CycleStatus>("planned");
  const [formStart, setFormStart] = useState("");
  const [formEnd, setFormEnd] = useState("");
  const [formMilestones, setFormMilestones] = useState<CycleMilestone[]>([]);

  const cycles = data?.cycles || [];

  const openCreate = () => {
    setEditingCycle(null);
    setFormName("");
    setFormDescription("");
    setFormPhase("custom");
    setFormStatus("planned");
    setFormStart("");
    setFormEnd("");
    setFormMilestones([]);
    setDialogOpen(true);
  };

  const openEdit = (cycle: Cycle) => {
    setEditingCycle(cycle);
    setFormName(cycle.name);
    setFormDescription(cycle.description || "");
    setFormPhase(cycle.phase);
    setFormStatus(cycle.status);
    setFormStart(cycle.startDate ? cycle.startDate.split("T")[0] : "");
    setFormEnd(cycle.endDate ? cycle.endDate.split("T")[0] : "");
    setFormMilestones(cycle.milestones || []);
    setDialogOpen(true);
  };

  const handleSave = () => {
    const payload = {
      name: formName,
      description: formDescription,
      phase: formPhase,
      status: formStatus,
      startDate: formStart || undefined,
      endDate: formEnd || undefined,
      milestones: formMilestones,
    };

    if (editingCycle) {
      updateMutation.mutate(
        { cycleId: editingCycle._id, projectId: projectId!, ...payload } as any,
        {
          onSuccess: () => {
            setDialogOpen(false);
            toast.success("Cycle updated");
          },
        },
      );
    } else {
      createMutation.mutate(
        { projectId: projectId!, ...payload } as any,
        {
          onSuccess: () => {
            setDialogOpen(false);
            toast.success("Cycle created");
          },
        },
      );
    }
  };

  const handleDelete = (cycleId: string) => {
    if (!confirm("Delete this cycle? Tasks will be unlinked.")) return;
    deleteMutation.mutate(
      { cycleId, projectId: projectId! },
      { onSuccess: () => toast.success("Cycle deleted") },
    );
  };

  const toggleMilestone = (cycle: Cycle, milestoneIdx: number) => {
    const updated = [...cycle.milestones];
    updated[milestoneIdx] = {
      ...updated[milestoneIdx],
      completed: !updated[milestoneIdx].completed,
    };
    updateMutation.mutate({
      cycleId: cycle._id,
      projectId: projectId!,
      milestones: updated,
    } as any);
  };

  const addMilestoneToForm = () => {
    setFormMilestones([...formMilestones, { title: "", completed: false }]);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="flex-1 p-6 space-y-4 animate-in fade-in duration-300">
          <div className="flex items-center justify-between">
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-8 w-28 rounded-lg" />
          </div>
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Topbar
        project={currentProject ? { name: currentProject.name, avatar: currentProject.avatar } : undefined}
        title="Cycles"
        Icon={RotateCcw}
        actions={
          <Button onClick={openCreate} size="sm" className="h-8 gap-1.5 text-xs">
            <Plus className="size-3.5" />
            New Cycle
          </Button>
        }
      />

      <div className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Cycle timeline */}
        {cycles.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-border rounded-xl">
            <Target className="size-10 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground mb-4">
              No research cycles yet. Create your first cycle to track progress.
            </p>
            <Button onClick={openCreate} variant="outline" size="sm" className="gap-1.5">
              <Plus className="size-3.5" />
              Create Cycle
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {cycles.map((cycle, idx) => {
              const phaseConfig = PHASE_CONFIG[cycle.phase];
              const isExpanded = expandedId === cycle._id;
              const completedMilestones = cycle.milestones?.filter((m) => m.completed).length || 0;
              const totalMilestones = cycle.milestones?.length || 0;

              return (
                <div
                  key={cycle._id}
                  className="border border-border rounded-xl bg-card overflow-hidden transition-shadow hover:shadow-sm"
                >
                  {/* Cycle header */}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : cycle._id)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/30 transition-colors text-left"
                  >
                    {isExpanded ? (
                      <ChevronDown className="size-4 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronRight className="size-4 text-muted-foreground shrink-0" />
                    )}

                    {/* Phase icon */}
                    <PhaseIconRenderer 
                      phaseId={cycle.phase}
                      icon={phaseConfig.icon}
                      color={phaseConfig.color}
                      size="md"
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground truncate">
                          {cycle.name}
                        </span>
                        <StatusBadge status={cycle.status} />
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span
                          className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                          style={{
                            color: phaseConfig.color,
                            backgroundColor: `${phaseConfig.color}10`,
                          }}
                        >
                          {phaseConfig.label}
                        </span>
                        {(cycle.startDate || cycle.endDate) && (
                          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <CalendarDays className="size-3" />
                            {cycle.startDate &&
                              new Date(cycle.startDate).toLocaleDateString("en-GB", {
                                day: "2-digit",
                                month: "2-digit",
                              })}
                            {cycle.startDate && cycle.endDate && " → "}
                            {cycle.endDate &&
                              new Date(cycle.endDate).toLocaleDateString("en-GB", {
                                day: "2-digit",
                                month: "2-digit",
                              })}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-4 shrink-0">
                      {totalMilestones > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {completedMilestones}/{totalMilestones} milestones
                        </span>
                      )}
                      <div className="w-20">
                        <ProgressBar value={cycle.stats?.progress || 0} />
                      </div>
                      <span className="text-xs font-medium text-muted-foreground w-8 text-right">
                        {cycle.stats?.progress || 0}%
                      </span>
                    </div>
                  </button>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-1 border-t border-border space-y-4 animate-in slide-in-from-top-1 fade-in duration-200">
                      {cycle.description && (
                        <p className="text-sm text-muted-foreground">{cycle.description}</p>
                      )}

                      {/* Task stats */}
                      <div className="flex items-center gap-6 text-sm">
                        <span className="text-muted-foreground">
                          <strong className="text-foreground">{cycle.stats?.totalTasks || 0}</strong> tasks
                        </span>
                        <span className="text-muted-foreground">
                          <strong className="text-green-600">{cycle.stats?.completedTasks || 0}</strong> completed
                        </span>
                      </div>

                      {/* Milestones */}
                      {cycle.milestones && cycle.milestones.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                            Milestones
                          </h4>
                          <div className="space-y-1.5">
                            {cycle.milestones.map((ms, mi) => (
                              <button
                                key={mi}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleMilestone(cycle, mi);
                                }}
                                className="flex items-center gap-2 w-full text-left hover:bg-accent/30 rounded-lg px-2 py-1.5 transition-colors group"
                              >
                                {ms.completed ? (
                                  <CheckCircle2 className="size-4 text-green-500 shrink-0" />
                                ) : (
                                  <Circle className="size-4 text-muted-foreground group-hover:text-primary shrink-0" />
                                )}
                                <span
                                  className={`text-sm flex-1 ${ms.completed ? "line-through text-muted-foreground" : "text-foreground"}`}
                                >
                                  {ms.title}
                                </span>
                                {ms.dueDate && (
                                  <span className="text-[10px] text-muted-foreground shrink-0">
                                    {new Date(ms.dueDate).toLocaleDateString("en-GB")}
                                  </span>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-2 pt-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEdit(cycle)}
                          className="text-xs h-7"
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(cycle._id)}
                          className="text-xs h-7 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="size-3 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingCycle ? "Edit Cycle" : "New Research Cycle"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Literature Review Phase"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label>Description</Label>
              <textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Describe the goals of this cycle..."
                className="w-full px-3 py-2 text-sm bg-transparent border border-input rounded-lg resize-none h-20 focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Research Phase</Label>
                <select
                  value={formPhase}
                  onChange={(e) => setFormPhase(e.target.value as CyclePhase)}
                  className="w-full px-3 py-2 text-sm bg-transparent border border-input rounded-lg focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {Object.entries(PHASE_CONFIG).map(([key, val]) => (
                    <option key={key} value={key}>
                      {val.icon} {val.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label>Status</Label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value as CycleStatus)}
                  className="w-full px-3 py-2 text-sm bg-transparent border border-input rounded-lg focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="planned">Planned</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={formStart}
                  onChange={(e) => setFormStart(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={formEnd}
                  onChange={(e) => setFormEnd(e.target.value)}
                />
              </div>
            </div>

            {/* Milestones */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Milestones</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={addMilestoneToForm}
                  className="h-6 text-xs gap-1"
                >
                  <Plus className="size-3" />
                  Add
                </Button>
              </div>
              <div className="space-y-2">
                {formMilestones.map((ms, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      value={ms.title}
                      onChange={(e) => {
                        const updated = [...formMilestones];
                        updated[i] = { ...updated[i], title: e.target.value };
                        setFormMilestones(updated);
                      }}
                      placeholder="Milestone title"
                      className="flex-1"
                    />
                    <Input
                      type="date"
                      value={ms.dueDate?.split("T")[0] || ""}
                      onChange={(e) => {
                        const updated = [...formMilestones];
                        updated[i] = { ...updated[i], dueDate: e.target.value };
                        setFormMilestones(updated);
                      }}
                      className="w-36"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setFormMilestones(formMilestones.filter((_, idx) => idx !== i));
                      }}
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!formName.trim()}>
              {editingCycle ? "Save Changes" : "Create Cycle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

