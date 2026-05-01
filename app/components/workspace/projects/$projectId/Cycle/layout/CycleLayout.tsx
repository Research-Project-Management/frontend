import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router";
import { toast } from "sonner";
import { useProjects } from "~/hooks/useWorkspace";
import { useCycle, type DerivedStatus } from "~/hooks/useCycle";
import { Skeleton } from "~/components/ui/skeleton";
import { 
  Plus,
  RotateCcw
} from "lucide-react";

import { Item, ListViewGroup, EmptyState } from "../sections/ListViewSection";

// Modals
import { DeleteModal } from "../modals/DeleteModal";
import { CreateModal } from "../modals/CreateModal";
import { EditModal } from "../modals/EditModal";
import Topbar from "~/components/workspace/projects/$projectId/overview/Topbar";
import type { Cycle } from "~/types/task";
import TopBar from "./Topbar";

import { PHASE_CONFIG } from "~/types/task";
import { Button } from "~/components/ui/button";

const PHASES = Object.entries(PHASE_CONFIG).map(([id, config]) => ({
  id,
  ...config
}));

export function CycleLayout() {
  const { projectId, workspaceId } = useParams();
  const { projects } = useProjects();
  const currentProject = projects?.find((p: any) => p._id === projectId);
  
  const {
    cycles,
    projectData,
    isLoading,
    createMutation,
    updateMutation,
    deleteMutation,
    getGroupedCycles,
    checkParallelConflict,
    isCycleReadOnly,
  } = useCycle(projectId!, workspaceId);

  // UI Local States
  const [phases, setPhases] = useState(PHASES);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCycle, setEditingCycle] = useState<Cycle | null>(null);
  const [expandedCycleId, setExpandedCycleId] = useState<string | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [cycleToDelete, setCycleToDelete] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sectionsExpanded, setSectionsExpanded] = useState<Record<DerivedStatus, boolean>>({
    active: true,
    upcoming: true,
    completed: true,
  });

  // Form Local States
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formStart, setFormStart] = useState("");
  const [formEnd, setFormEnd] = useState("");
  const [formPhase, setFormPhase] = useState<string>(PHASES[0].id);
  const [formMembers, setFormMembers] = useState<string[]>([]);
  const [formLabels, setFormLabels] = useState<string[]>([]);

  // Derived Values (using reusable logic from useCycle)
  const groupedCycles = useMemo(() => getGroupedCycles(searchTerm), [cycles, searchTerm]);
  const hasParallelConflict = useMemo(() => 
    checkParallelConflict(formStart, formEnd, editingCycle?._id), 
    [formStart, formEnd, cycles, editingCycle, projectData]
  );

  // UI Handlers
  const toggleSection = (status: DerivedStatus) => {
    setSectionsExpanded((prev) => ({ ...prev, [status]: !prev[status] }));
  };

  const openCreate = () => {
    setEditingCycle(null);
    setFormName("");
    setFormDescription("");
    setFormPhase(PHASES[0].id);
    setFormStart("");
    setFormEnd("");
    setFormMembers([]);
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
    setFormMembers(cycle.members || []);
    setFormLabels(cycle.labels || []);
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!formName.trim()) { toast.error("Please enter a title"); return; }
    if (formStart && formEnd && new Date(formStart) > new Date(formEnd)) {
      toast.error("Start date cannot be after end date");
      return;
    }
    
    if (hasParallelConflict) {
       toast.error("Project only allows one active cycle at a time.");
       return;
    }

    const payload = {
      name: formName,
      description: formDescription,
      phase: formPhase as any,
      status: editingCycle?.status || "planned",
      startDate: formStart || undefined,
      endDate: formEnd || undefined,
      members: formMembers,
      labels: formLabels,
      milestones: editingCycle?.milestones || [],
    };

    if (editingCycle) {
      updateMutation.mutate({ cycleId: editingCycle._id, projectId: projectId!, ...payload } as any, {
        onSuccess: () => { setDialogOpen(false); toast.success("Updated successfully"); },
        onError: (err: any) => toast.error(err?.response?.data?.message || "Failed"),
      });
    } else {
      createMutation.mutate({ projectId: projectId!, ...payload } as any, {
        onSuccess: () => { setDialogOpen(false); toast.success("Created successfully"); },
        onError: (err: any) => toast.error(err?.response?.data?.message || "Failed"),
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
        toast.success("Deleted successfully");
        setIsDeleteModalOpen(false);
        setCycleToDelete(null);
      },
      onError: () => toast.error("Failed to delete"),
    });
  };

  const navigate = useNavigate();

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background overflow-hidden">
      <Topbar
        project={currentProject ? { name: currentProject.name, avatar: currentProject.avatar } : undefined}
        title="Cycles"
        Icon={RotateCcw}
        actions={
          <TopBar 
            onAddCycle={openCreate} 
            searchQuery={searchTerm}
            onSearchChange={setSearchTerm}
          />
        }
      />
      <main className="flex-1 overflow-y-auto scroll-smooth custom-scrollbar">
        <div className="px-6 py-4">
          {isLoading ? (
            <div className="space-y-6">
              <Skeleton className="h-12 w-full rounded-sm" />
            </div>
          ) : (
            <div className="mt-2">
              {cycles.length === 0 && !searchTerm ? (
                <div className="flex flex-col items-center justify-center py-20 border border-dashed border-zinc-200 rounded-sm bg-white text-center">
                  <RotateCcw className="size-10 text-zinc-200 mb-4" strokeWidth={1.5} />
                  <h3 className="text-[16px] font-semibold text-zinc-900 mb-1.5">No cycles found</h3>
                  <p className="text-[13px] text-zinc-500 max-w-[400px] mb-6 leading-relaxed">
                    Research cycles help you track progress over time. Create your first cycle to start organizing your tasks.
                  </p>
                  <Button onClick={openCreate} className="h-9 px-4 bg-black text-white hover:bg-black/90 rounded-sm shadow-none gap-2">
                    <Plus className="size-4" />
                    <span>Create your first cycle</span>
                  </Button>
                </div>
              ) : (
                <div className="border border-border/80 overflow-hidden flex flex-col divide-y divide-border/80">
                  {(["active", "upcoming", "completed"] as DerivedStatus[]).map((status) => (
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
                        phases={phases}
                        isReadOnly={status === "completed"}
                        isExpanded={expandedCycleId === cycle._id}
                        onToggleExpand={() =>
                          setExpandedCycleId(expandedCycleId === cycle._id ? null : cycle._id)
                        }
                        onNavigate={() => {
                          navigate(`/${workspaceId}/projects/${projectId}/cycles/${cycle._id}`);
                        }}
                        onEdit={() => openEdit(cycle)}
                        onDelete={() => handleDeleteRequest(cycle._id)}
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

      {!editingCycle ? (
        <CreateModal 
          open={dialogOpen}
          onOpenChange={setDialogOpen}
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
          formMembers={formMembers}
          setFormMembers={setFormMembers}
          formLabels={formLabels}
          setFormLabels={setFormLabels}
          phases={phases}
          setPhases={setPhases}
          projectData={projectData}
          onSave={handleSave}
          isSaving={createMutation.isPending}
          hasParallelConflict={hasParallelConflict}
        />
      ) : (
        <EditModal 
          open={dialogOpen}
          onOpenChange={setDialogOpen}
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
          formMembers={formMembers}
          setFormMembers={setFormMembers}
          formLabels={formLabels}
          setFormLabels={setFormLabels}
          phases={phases}
          setPhases={setPhases}
          projectData={projectData}
          onSave={handleSave}
          isReadOnly={isCycleReadOnly(editingCycle)}
          isSaving={updateMutation.isPending}
          hasParallelConflict={hasParallelConflict}
        />
      )}

      <DeleteModal 
        open={isDeleteModalOpen} 
        onOpenChange={setIsDeleteModalOpen} 
        onConfirm={confirmDelete}
        title={cycles.find(c => c._id === cycleToDelete)?.name || "this cycle"}
      />
    </div>
  );
}
