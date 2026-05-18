import { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import { toast } from "sonner";
import { isWithinInterval, parseISO } from "date-fns";
import { useProjects } from "~/hooks/useWorkspace";
import { useCycle, type DerivedStatus } from "~/hooks/useCycle";
import { useLabels } from "~/hooks/useLabels";
import { Skeleton } from "~/components/ui/skeleton";
import { 
  Plus,
  RotateCcw
} from "lucide-react";

import { Item, ListViewGroup, EmptyState } from "../sections/ListViewSection";

// Modals
import { DeleteModal } from "../modals/DeleteModal";
import { CycleModal } from "../modals/CycleModal";
import { StatusModal, type StatusModalType } from "../modals/StatusModal";
import Topbar from "~/components/workspace/projects/$projectId/overview/Topbar";
import type { Cycle, CycleMilestone } from "~/types/task";
import TopBar from "./Topbar";

import { PHASE_CONFIG } from "~/types/task";
import { Button } from "~/components/ui/button";

const PHASES = Object.entries(PHASE_CONFIG).map(([id, config]) => ({
  id,
  ...config
}));

export function CycleLayout() {
  const { projectId, workspaceId } = useParams();
  const navigate = useNavigate();
  
  const {
    cycles,
    projectData,
    isLoading,
    createMutation,
    updateMutation,
    deleteMutation,
    getGroupedCycles,
    deriveStatus,
    checkParallelConflict,
  } = useCycle(projectId!, workspaceId);

  const { workspaceLabels: allLabels } = useLabels(workspaceId!, "cycle", projectId);

  // UI Local States
  const [phases, setPhases] = useState(PHASES);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCycle, setEditingCycle] = useState<Cycle | null>(null);
  const [labelDetailsCycleIds, setLabelDetailsCycleIds] = useState<Set<string>>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(`cycle-labels-expanded-${projectId}`);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    }
    return new Set();
  });

  useEffect(() => {
    localStorage.setItem(`cycle-labels-expanded-${projectId}`, JSON.stringify(Array.from(labelDetailsCycleIds)));
  }, [labelDetailsCycleIds, projectId]);

  const toggleLabelDetails = (cycleId: string) => {
    setLabelDetailsCycleIds((prev) => {
      const next = new Set(prev);
      if (next.has(cycleId)) {
        next.delete(cycleId);
      } else {
        next.add(cycleId);
      }
      return next;
    });
  };
  const [expandedCycleId, setExpandedCycleId] = useState<string | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [cycleToDelete, setCycleToDelete] = useState<string | null>(null);
  
  // Status Modal States
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [statusModalType, setStatusModalType] = useState<StatusModalType>("start");
  const [targetCycle, setTargetCycle] = useState<Cycle | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [sectionsExpanded, setSectionsExpanded] = useState<Record<DerivedStatus, boolean>>({
    active: true,
    planned: true,
    completed: true,
  });
  const [dateFilters, setDateFilters] = useState<{
    startDate?: { start: string; end: string; label: string };
    dueDate?: { start: string; end: string; label: string };
  }>({});

  // Form Local States
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formStart, setFormStart] = useState("");
  const [formEnd, setFormEnd] = useState("");
  const [formPhase, setFormPhase] = useState<string>(PHASES[0].id);
  const [formStatus, setFormStatus] = useState<string>("planned");
  const [formLabels, setFormLabels] = useState<string[]>([]);

  // Derived Values
  const groupedCycles = useMemo(() => {
    const filtered = cycles.filter((c) => {
      // Search filter
      if (searchTerm && !c.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;

      // Start Date Filter
      if (dateFilters.startDate && c.startDate) {
        const start = parseISO(dateFilters.startDate.start);
        const end = parseISO(dateFilters.startDate.end);
        const cycleDate = parseISO(c.startDate);
        if (!isWithinInterval(cycleDate, { start, end })) return false;
      } else if (dateFilters.startDate && !c.startDate) {
        return false;
      }

      // End Date Filter
      if (dateFilters.dueDate && c.endDate) {
        const start = parseISO(dateFilters.dueDate.start);
        const end = parseISO(dateFilters.dueDate.end);
        const cycleDate = parseISO(c.endDate);
        if (!isWithinInterval(cycleDate, { start, end })) return false;
      } else if (dateFilters.dueDate && !c.endDate) {
        return false;
      }

      return true;
    });

    return getGroupedCycles("", filtered); // Pass empty search since we filtered manually
  }, [cycles, searchTerm, dateFilters, getGroupedCycles]);



  // UI Handlers
  const toggleSection = (status: DerivedStatus) => {
    setSectionsExpanded((prev) => ({ ...prev, [status]: !prev[status] }));
  };

  const openCreate = () => {
    setEditingCycle(null);
    setFormName("");
    setFormDescription("");
    setFormPhase(PHASES[0].id);
    setFormStatus("planned");
    setFormStart("");
    setFormEnd("");
    setFormLabels([]);
    setDialogOpen(true);
  };

  const openEdit = (cycle: Cycle) => {
    setEditingCycle(cycle);
    setFormName(cycle.name);
    setFormDescription(cycle.description || "");
    setFormPhase(cycle.phase);
    setFormStart(cycle.startDate ? cycle.startDate.split("T")[0] : "");
    setFormEnd(cycle.endDate ? cycle.endDate.split("T")[0] : "");
    setFormLabels(cycle.labels || []);
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!formName.trim()) {
      toast.error("Please enter a title");
      return;
    }

    // Rule: Basic Date Validation (only if both are provided)
    if (formStart && formEnd && new Date(formStart) > new Date(formEnd)) {
      toast.error("Start date cannot be after end date");
      return;
    }

    const parallelEnabled = (projectData as any)?.settings?.parallelCycles ?? false;

    // Rule: Check for overlaps and multiple active cycles if parallel is OFF
    if (!parallelEnabled) {
      // Check for overlap with ANY other cycle (including upcoming)
      if (formStart && formEnd) {
        const hasOverlap = checkParallelConflict(formStart, formEnd, editingCycle?._id);
        if (hasOverlap) {
          toast.error("Dates overlap with an existing cycle");
          return;
        }
      }

      // Check for multiple active cycles (based on dates)
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const newStart = new Date(formStart);
      const newEnd = new Date(formEnd);
      const isNewActive = now >= newStart && now <= newEnd;

      if (isNewActive) {
        const otherActive = cycles.find(c => c._id !== editingCycle?._id && deriveStatus(c) === "active");
        if (otherActive) {
          toast.error(`"${otherActive.name}" is already active`);
          return;
        }
      }
    }

    const payload = {
      name: formName,
      description: formDescription,
      phase: formPhase as any,
      startDate: formStart || undefined,
      endDate: formEnd || undefined,
      labels: formLabels,
    };

    if (editingCycle) {
      updateMutation.mutate({ cycleId: editingCycle._id, projectId: projectId!, ...payload }, {
        onSuccess: () => { setDialogOpen(false); toast.success("Cycle updated"); },
        onError: (err: any) => toast.error(err?.response?.data?.message || "Something went wrong"),
      });
    } else {
      createMutation.mutate({ projectId: projectId!, ...payload }, {
        onSuccess: () => { setDialogOpen(false); toast.success("Cycle created"); },
        onError: (err: any) => toast.error(err?.response?.data?.message || "Something went wrong"),
      });
    }
  };

  const handleDeleteRequest = (cycleId: string) => {
    setCycleToDelete(cycleId);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = () => {
    if (!cycleToDelete) return;
    deleteMutation.mutate({ cycleId: cycleToDelete, projectId: projectId! }, {
      onSuccess: () => {
        toast.success("Cycle deleted");
        setIsDeleteModalOpen(false);
        setCycleToDelete(null);
      },
      onError: () => toast.error("Failed to delete cycle"),
    });
  };



  const handleStartCycle = (cycle: Cycle) => {
    setTargetCycle(cycle);
    setStatusModalType("start");
    setStatusModalOpen(true);
  };

  const handleEndCycle = (cycle: Cycle) => {
    setTargetCycle(cycle);
    setStatusModalType("complete");
    setStatusModalOpen(true);
  };

  const confirmStatusAction = () => {
    if (!targetCycle) return;

    if (statusModalType === "start") {
      if (!targetCycle.startDate || !targetCycle.endDate) {
        toast.error("Set a date range to start this cycle");
        setStatusModalOpen(false);
        return;
      }
    }

    updateMutation.mutate({
      cycleId: targetCycle._id,
      projectId: projectId!,
      status: statusModalType === "start" ? "active" : "completed",
    }, {
      onSuccess: () => {
        toast.success(`Cycle ${statusModalType === "start" ? "started" : "completed"} successfully`);
        setStatusModalOpen(false);
        setTargetCycle(null);
      },
      onError: (err: any) => {
        const msg = err?.response?.data?.message || err?.message || `Failed to ${statusModalType} cycle`;
        toast.error(msg);
      }
    });
  };

  return (
    <div className="flex-1 flex min-h-0 flex-col h-full bg-background overflow-hidden">
      <div className="z-50 bg-background">
        <Topbar
          project={projectData ? { name: projectData.name, avatar: projectData.avatar } : undefined}
          title="Cycles"
          Icon={RotateCcw}
          actions={
            <TopBar
              onAddCycle={openCreate}
              searchQuery={searchTerm}
              onSearchChange={setSearchTerm}
              dateFilters={dateFilters}
              onDateFilterChange={setDateFilters}
            />
          }
        />
      </div>
      <main className="flex-1 overflow-y-auto scroll-smooth custom-scrollbar">
        <div className="px-4 py-4">
          {isLoading ? (
            <div className="space-y-6">
              <Skeleton className="h-12 w-full rounded-sm" />
            </div>
          ) : (
            <div className="mt-2">
              {cycles.length === 0 && !searchTerm ? (
                <div className="flex flex-col items-center justify-center py-32 text-center">
                  <RotateCcw className="size-10 text-zinc-200 mb-4" strokeWidth={1.5} />
                  <h3 className="text-[16px] font-semibold text-foreground mb-1.5">No cycles found</h3>
                  <p className="text-[13px] text-zinc-500 max-w-[400px] mb-6 leading-relaxed">
                    Research cycles help you track progress over time. Create your first cycle to start organizing your tasks.
                  </p>
                  <Button onClick={openCreate} className="h-9 px-4 bg-primary text-primary-foreground hover:bg-primary/90 rounded-sm shadow-none gap-2">
                    <Plus className="size-4" />
                    <span>Create your first cycle</span>
                  </Button>
                </div>
              ) : (
                <div className="border border-border/80 overflow-hidden flex flex-col bg-white">
                  {(["active", "planned", "completed"] as DerivedStatus[]).map((status) => (
                <ListViewGroup
                  key={status}
                  status={status}
                  count={groupedCycles[status].length}
                  isExpanded={sectionsExpanded[status]}
                  onToggle={() => toggleSection(status)}
                >
                  {groupedCycles[status].length === 0 ? (
                    <EmptyState status={status} searchTerm={searchTerm} />
                  ) : (
                    groupedCycles[status].map((cycle) => (
                      <Item
                        key={cycle._id}
                        cycle={cycle}
                        status={status}
                        phases={phases}
                        isReadOnly={status === "completed"}
                        isExpanded={expandedCycleId === cycle._id}
                        onToggleExpand={() =>
                          setExpandedCycleId(expandedCycleId === cycle._id ? null : cycle._id)
                        }
                        onNavigate={() => {
                          navigate(`/${workspaceId}/projects/${projectId}/cycles/${cycle._id}`);
                        }}
                        allLabels={allLabels}
                        showLabelDetails={labelDetailsCycleIds.has(cycle._id)}
                        onToggleLabelDetails={toggleLabelDetails}
                        onEdit={() => openEdit(cycle)}
                        onDelete={() => handleDeleteRequest(cycle._id)}
                        onStart={() => handleStartCycle(cycle)}
                        onComplete={() => handleEndCycle(cycle)}
                      />
                    ))
                  )}
                </ListViewGroup>
              ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      <CycleModal 
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode={editingCycle ? 'edit' : 'create'}
        formName={formName}
        setFormName={setFormName}
        formDescription={formDescription}
        setFormDescription={setFormDescription}
        formStart={formStart}
        setFormStart={setFormStart}
        formEnd={formEnd}
        setFormEnd={setFormEnd}
        formPhase={formPhase}
        setFormPhase={setFormPhase}
        formStatus={formStatus}
        setFormStatus={setFormStatus}
        formLabels={formLabels}
        setFormLabels={setFormLabels}
        phases={phases}
        setPhases={setPhases}
        projectData={projectData}
        onSave={handleSave}
        isReadOnly={editingCycle ? deriveStatus(editingCycle) === "completed" : false}
        isSaving={editingCycle ? updateMutation.isPending : createMutation.isPending}
      />

      <DeleteModal 
        open={isDeleteModalOpen} 
        onOpenChange={setIsDeleteModalOpen} 
        onConfirm={confirmDelete}
        title={cycles.find(c => c._id === cycleToDelete)?.name || "this cycle"}
        isDeleting={deleteMutation.isPending}
      />

      <StatusModal 
        open={statusModalOpen}
        onOpenChange={setStatusModalOpen}
        type={statusModalType}
        title={targetCycle?.name}
        onConfirm={confirmStatusAction}
        isSubmitting={updateMutation.isPending}
      />
    </div>
  );
}