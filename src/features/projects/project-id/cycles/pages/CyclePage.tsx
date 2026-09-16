'use client';

import { useState, useMemo, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { isWithinInterval, parseISO } from "date-fns";
import { useProjects } from '@/features/projects/shell/hooks/use-project';
import { useCycle, useCompleteCycle, type DerivedStatus } from '../hooks/use-cycle';
import type { Cycle } from '../types/cycle.types';
import { cycleFormSchema, type CycleFormData } from '../schemas/cycle.schema';
import { Skeleton } from "@/shared/components/ui";
import { Plus } from "lucide-react";
import { CycleIcon } from "@/shared/components/ui";

import { Item, ListViewGroup, EmptyState } from '../components/views/ListView';

// Modals
import { DeleteModal } from '../components/modals/DeleteModal';
import { CycleModal } from '../components/modals/CycleModal';
import { StatusModal, type StatusModalType } from '../components/modals/StatusModal';
import CycleTopBarActions from '../components/layout/Topbar';
import { Switcher } from '@/features/projects/project-id/components/layout/Switcher';
import { Button } from "@/shared/components/ui";

export function CyclePage() {
  const { projectId } = useParams() as { projectId: string };
  const router = useRouter();
  
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
  } = useCycle(projectId!);

  const completeMutation = useCompleteCycle();

  // UI Local States
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCycle, setEditingCycle] = useState<Cycle | null>(null);
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

  // Form State (React Hook Form)
  const form = useForm<CycleFormData>({
    resolver: zodResolver(cycleFormSchema),
    defaultValues: {
      name: "",
      description: "",
      status: "planned",
      startDate: "",
      endDate: "",
    },
  });

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
    const defaultDays = (projectData as any)?.settings?.cycles?.defaultDurationDays ?? 14;
    const today = new Date();
    const endDate = new Date();
    endDate.setDate(today.getDate() + defaultDays);

    form.reset({
      name: "",
      description: "",
      status: "planned",
      startDate: today.toISOString().slice(0, 10),
      endDate: endDate.toISOString().slice(0, 10),
    });
    setDialogOpen(true);
  };

  const openEdit = (cycle: Cycle) => {
    setEditingCycle(cycle);
    form.reset({
      name: cycle.name,
      description: cycle.description || "",
      status: (cycle.status as any) || "planned",
      startDate: cycle.startDate ? cycle.startDate.split("T")[0] : "",
      endDate: cycle.endDate ? cycle.endDate.split("T")[0] : "",
    });
    setDialogOpen(true);
  };

  const handleSave = (values: CycleFormData) => {
    // Rule: Basic Date Validation (only if both are provided)
    if (values.startDate && values.endDate && new Date(values.startDate) > new Date(values.endDate)) {
      toast.error("Start date cannot be after end date", { id: 'cycle-management' });
      return;
    }

    const parallelEnabled = (projectData as any)?.settings?.parallelCycles ?? false;

    // Rule: Check for overlaps and multiple active cycles if parallel is OFF
    if (!parallelEnabled) {
      // Check for overlap with ANY other cycle (including upcoming)
      if (values.startDate && values.endDate) {
        const hasOverlap = checkParallelConflict(values.startDate, values.endDate, editingCycle?.id);
        if (hasOverlap) {
          toast.error("Dates overlap with an existing cycle", { id: 'cycle-management' });
          return;
        }
      }

      // Check for multiple active cycles (based on dates)
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const newStart = new Date(values.startDate);
      const newEnd = new Date(values.endDate);
      const isNewActive = now >= newStart && now <= newEnd;

      if (isNewActive) {
        const otherActive = cycles.find(c => c.id !== editingCycle?.id && deriveStatus(c) === "active");
        if (otherActive) {
          toast.error(`"${otherActive.name}" is already active`, { id: 'cycle-management' });
          return;
        }
      }
    }

    const payload = {
      name: values.name.trim(),
      description: values.description?.trim(),
      startDate: values.startDate || undefined,
      endDate: values.endDate || undefined,
    };

    if (editingCycle) {
      updateMutation.mutate({ cycleId: editingCycle.id, projectId: projectId!, ...payload }, {
        onSuccess: () => { setDialogOpen(false); toast.success("Cycle updated", { id: 'cycle-management' }); },
        onError: (err: any) => toast.error(err?.message || err?.response?.data?.message || "Something went wrong", { id: 'cycle-management' }),
      });
    } else {
      createMutation.mutate({ projectId: projectId!, ...payload }, {
        onSuccess: () => { setDialogOpen(false); toast.success("Cycle created", { id: 'cycle-management' }); },
        onError: (err: any) => toast.error(err?.message || err?.response?.data?.message || "Something went wrong", { id: 'cycle-management' }),
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
        toast.success("Cycle deleted", { id: 'cycle-management' });
        setIsDeleteModalOpen(false);
        setCycleToDelete(null);
      },
      onError: (err: any) => toast.error(err?.message || err?.response?.data?.message || "Failed to delete cycle", { id: 'cycle-management' }),
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

  const confirmStatusAction = (payload?: { action: 'transfer' | 'backlog' | 'leave'; targetCycleId?: string }) => {
    if (!targetCycle) return;

    if (statusModalType === "start") {
      if (!targetCycle.startDate || !targetCycle.endDate) {
        toast.error("Set a date range to start this cycle", { id: 'cycle-management' });
        setStatusModalOpen(false);
        return;
      }
      updateMutation.mutate({
        cycleId: targetCycle.id,
        projectId: projectId!,
        status: "active",
      }, {
        onSuccess: () => {
          toast.success("Cycle started successfully", { id: 'cycle-management' });
          setStatusModalOpen(false);
          setTargetCycle(null);
        },
        onError: (err: any) => {
          const msg = err?.response?.data?.message || err?.message || "Failed to start cycle";
          toast.error(msg, { id: 'cycle-management' });
        }
      });
      return;
    }

    if (statusModalType === "complete") {
      completeMutation.mutate({
        cycleId: targetCycle.id,
        projectId: projectId!,
        action: payload?.action || 'backlog',
        targetCycleId: payload?.targetCycleId,
      }, {
        onSuccess: (res: any) => {
          const count = res?.transferredCount ?? 0;
          const extra = count > 0 ? ` (${count} work item(s) processed)` : '';
          toast.success(`Cycle completed successfully${extra}`, { id: 'cycle-management' });
          setStatusModalOpen(false);
          setTargetCycle(null);
        },
        onError: (err: any) => {
          const msg = err?.response?.data?.message || err?.message || "Failed to complete cycle";
          toast.error(msg, { id: 'cycle-management' });
        }
      });
    }
  };

  return (
    <div className="flex-1 flex min-h-0 flex-col h-full bg-background overflow-hidden">
      <header className="h-11 border-b border-border px-3 sm:px-4 flex items-center justify-between gap-2 sm:gap-3 bg-background shrink-0 text-13 w-full min-w-0 select-none sticky top-0 z-10">
        <Switcher
          project={projectData}
          moduleTitle="Cycles"
          moduleIcon={CycleIcon}
          count={cycles?.length}
        />
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-auto">
          <CycleTopBarActions
            onAddCycle={openCreate}
            searchQuery={searchTerm}
            onSearchChange={setSearchTerm}
            dateFilters={dateFilters}
            onDateFilterChange={setDateFilters}
          />
        </div>
      </header>
      <main className="w-full flex-1 overflow-y-auto px-6 py-4 scroll-smooth custom-scrollbar">
        <div>
          {isLoading ? (
            <div className="space-y-6">
              <Skeleton className="h-12 w-full rounded-md" />
            </div>
          ) : (
            <div className="mt-1">
              {cycles.length === 0 && !searchTerm ? (
                <div className="flex flex-col items-center justify-center py-32 text-center">
                  <CycleIcon className="size-10 text-muted-foreground mb-4 shrink-0" />
                  <h3 className="text-base font-semibold text-foreground mb-1.5">No cycles found</h3>
                  <p className="text-xs text-muted-foreground max-w-[400px] mb-6 leading-relaxed">
                    Research cycles help you track progress over time. Create your first cycle to start organizing your work items.
                  </p>
                  <Button onClick={openCreate} className="h-8 px-4 bg-primary hover:bg-primary-hover text-primary-foreground rounded-md gap-2 cursor-pointer text-xs">
                    <Plus className="size-4 shrink-0" />
                    <span>Create your first cycle</span>
                  </Button>
                </div>
              ) : (
                <div className="border border-border rounded-lg overflow-hidden flex flex-col bg-card">
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
                        key={cycle.id}
                        cycle={cycle}
                        status={status}
                        isReadOnly={status === "completed"}
                        isExpanded={expandedCycleId === cycle.id}
                        onToggleExpand={() =>
                          setExpandedCycleId(expandedCycleId === cycle.id ? null : cycle.id)
                        }
                        onNavigate={() => {
                          router.push(`/projects/${projectId}/cycles/${cycle.id}`);
                        }}
                        onEdit={() => openEdit(cycle)}
                        onDelete={() => handleDeleteRequest(cycle.id)}
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
        form={form as any}
        projectData={projectData}
        onSave={handleSave}
        isReadOnly={editingCycle ? deriveStatus(editingCycle) === "completed" : false}
        isSaving={editingCycle ? updateMutation.isPending : createMutation.isPending}
      />

      <DeleteModal 
        open={isDeleteModalOpen} 
        onOpenChange={setIsDeleteModalOpen} 
        onConfirm={confirmDelete}
        title={cycles.find(c => c.id === cycleToDelete)?.name || "this cycle"}
        isDeleting={deleteMutation.isPending}
      />

      <StatusModal 
        open={statusModalOpen}
        onOpenChange={setStatusModalOpen}
        type={statusModalType}
        title={targetCycle?.name}
        availableCycles={cycles.filter(c => c.id !== targetCycle?.id)}
        onConfirm={confirmStatusAction}
        isSubmitting={updateMutation.isPending || completeMutation.isPending}
      />
    </div>
  );
}
