import { useState, useMemo } from "react";
import { useParams } from "react-router";
import { useWorkspace, useProjects } from "~/hooks/useWorkspace";
import { useProjectDetails } from "~/query/project";
import { useTags } from "~/query/sticky";
import { useProjectCycles, useCreateCycle, useUpdateCycle, useDeleteCycle } from "~/query/cycle";
import type { Cycle } from "~/types/task";
import { Skeleton } from "~/components/ui/skeleton";
import { 
  isToday,
  isAfter, isBefore, parseISO
} from "date-fns";
import { toast } from "sonner";
import { 
  Search, 
  Book, 
  Settings, 
  Database, 
  BarChart3, 
  FileText, 
  RefreshCw, 
  GraduationCap,
  RotateCcw
} from "lucide-react";
import { SearchIcon, BooksIcon, PuzzleIcon, DataIcon, AnalysisIcon, WritingIcon, RevisionIcon, SubmissionIcon } from "../components/ScientificIcons";

import { Item, ListViewGroup, EmptyState, type DerivedStatus } from "../sections/ListViewSection";
import { Target } from "lucide-react";

// Modals
import { DeleteModal } from "../modals/DeleteModal";
import { CreateModal } from "../modals/CreateModal";
import { EditModal } from "../modals/EditModal";
import Topbar from "~/components/workspace/projects/$projectId/overview/Topbar";
import TopBar from "./TopBar";

const INITIAL_PHASES = [
  { id: "search", icon: <SearchIcon />, label: "Topic Selection", color: "#4bce97" },
  { id: "book", icon: <BooksIcon />, label: "Literature Review", color: "#9f8fef" },
  { id: "settings", icon: <PuzzleIcon />, label: "Methodology", color: "#579dff" },
  { id: "database", icon: <DataIcon />, label: "Data Collection", color: "#f5cd47" },
  { id: "analysis", icon: <AnalysisIcon />, label: "Data Analysis", color: "#fea362" },
  { id: "writing", icon: <WritingIcon />, label: "Writing", color: "#f87168" },
  { id: "refresh", icon: <RevisionIcon />, label: "Review & Revision", color: "#60c6d2" },
  { id: "cap", icon: <SubmissionIcon />, label: "Submission / Defense", color: "#44546f" },
];

export function CycleLayout() {
  const { projectId, workspaceId } = useParams();
  const { projects } = useProjects();
  const currentProject = projects?.find((p: any) => p._id === projectId);
  const [phases, setPhases] = useState(INITIAL_PHASES);
  const { data, isLoading } = useProjectCycles(projectId!);
  const createMutation = useCreateCycle();
  const updateMutation = useUpdateCycle();
  const deleteMutation = useDeleteCycle();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCycle, setEditingCycle] = useState<Cycle | null>(null);
  const [expandedCycleId, setExpandedCycleId] = useState<string | null>(null);
  const [sectionsExpanded, setSectionsExpanded] = useState<Record<DerivedStatus, boolean>>({
    active: true,
    upcoming: true,
    completed: true,
  });

  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formStart, setFormStart] = useState("");
  const [formEnd, setFormEnd] = useState("");
  const [formPhase, setFormPhase] = useState<string>("search");
  const [formMembers, setFormMembers] = useState<string[]>([]);
  const [formLabels, setFormLabels] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [cycleToDelete, setCycleToDelete] = useState<string | null>(null);

  const { data: projectData } = useProjectDetails(projectId!);
  const { data: workspaceTags = [] } = useTags(workspaceId!);
  const cycles = data?.cycles || [];

  const groupedCycles = useMemo(() => {
    const groups: Record<DerivedStatus, Cycle[]> = { active: [], upcoming: [], completed: [] };
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    cycles.forEach((cycle) => {
      let status: DerivedStatus = "upcoming";
      
      // Manual end always wins
      if (cycle.ended_at) {
        status = "completed";
      } else if (cycle.startDate && cycle.endDate) {
        const start = parseISO(cycle.startDate);
        const end = parseISO(cycle.endDate);
        start.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);

        if (isBefore(now, start)) {
          status = "upcoming";
        } else if (isAfter(now, end)) {
          status = "completed";
        } else {
          status = "active";
        }
      } else {
        // Fallback for cycles without dates
        status = cycle.status === "completed" ? "completed" : cycle.status === "active" ? "active" : "upcoming";
      }
      groups[status].push(cycle);
    });
    return groups;
  }, [cycles]);

  const toggleSection = (status: DerivedStatus) => {
    setSectionsExpanded((prev) => ({ ...prev, [status]: !prev[status] }));
  };

  const openCreate = () => {
    setEditingCycle(null);
    setFormName("");
    setFormDescription("");
    setFormPhase(phases[0]?.id || "selection");
    setFormStart("");
    setFormEnd("");
    setFormMembers([]);
    setFormLabels([]);
    setSearchTerm("");
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
    setSearchTerm("");
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!formName.trim()) { toast.error("Please enter a title"); return; }
    if (formStart && formEnd && new Date(formStart) > new Date(formEnd)) {
      toast.error("Start date cannot be after end date");
      return;
    }

    // Parallel cycle constraint check
    if (projectData && projectData.parallel_cycles_enabled === false) {
      const now = new Date();
      now.setHours(0, 0, 0, 0);

      // 1. Calculate if the being-saved cycle is Active
      let isNewActive = false;
      if (formStart && formEnd) {
        const start = new Date(formStart);
        const end = new Date(formEnd);
        start.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);
        isNewActive = !isBefore(now, start) && !isAfter(now, end);
      }

      // 2. If it's active, check for existing active cycles
      if (isNewActive) {
        const existingActive = cycles.find((c) => {
          if (editingCycle && c._id === editingCycle._id) return false;
          if (!c.startDate || !c.endDate) return false;
          const s = parseISO(c.startDate);
          const e = parseISO(c.endDate);
          s.setHours(0, 0, 0, 0);
          e.setHours(0, 0, 0, 0);
          return !isBefore(now, s) && !isAfter(now, e);
        });

        if (existingActive) {
          toast.error(`Project only allows one active cycle at a time. (Existing: ${existingActive.name})`, {
            id: "parallel-error",
          });
          return;
        }
      }
    }
    const payload = {
      name: formName,
      description: formDescription,
      phase: formPhase as any, // Flexible for now as requested
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

  const handleDelete = (cycleId: string) => {
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


  const isEditingReadOnly = useMemo(() => {
    if (!editingCycle) return false;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    if (editingCycle.ended_at) return true;
    if (editingCycle.startDate && editingCycle.endDate) {
      const end = parseISO(editingCycle.endDate);
      end.setHours(0, 0, 0, 0);
      return isAfter(now, end);
    }
    return editingCycle.status === "completed";
  }, [editingCycle]);

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
            <div className="border border-border/80 overflow-hidden flex flex-col divide-y divide-border/80 mt-2">
              {(["active", "upcoming", "completed"] as DerivedStatus[]).map((status) => (
                <ListViewGroup
                  key={status}
                  status={status}
                  count={groupedCycles[status].length}
                  isExpanded={sectionsExpanded[status]}
                  onToggle={() => toggleSection(status)}
                >
                  {groupedCycles[status].length === 0 ? (
                    <EmptyState status={status} />
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
                        onEdit={() => openEdit(cycle)}
                        onDelete={() => handleDelete(cycle._id)}
                      />
                    ))
                  )}
                </ListViewGroup>
              ))}
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
          workspaceTags={workspaceTags}
          onSave={handleSave}
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
          workspaceTags={workspaceTags}
          onSave={handleSave}
          isReadOnly={isEditingReadOnly}
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
