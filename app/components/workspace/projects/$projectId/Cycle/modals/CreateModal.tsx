import React, { useMemo, useRef } from "react";
import { LabelsDisplay } from "../components/LabelsDisplay";
import {
  Dialog,
  DialogContent,
  DialogFooter
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { CalendarDays, Plus, X } from "lucide-react";
import { format, parseISO } from "date-fns";

// Internal Sections
import { PhaseSection } from "../sections/PhaseSection";
import { MembersSection } from "../sections/MembersSection";
import { LabelsSection } from "../sections/LabelsSection";
import { DatesSection } from "../sections/DatesSection";
import { PhaseIconRenderer } from "../components/PhaseIconRenderer";
import { useParams } from "react-router";
import { useLabels } from "~/hooks/useLabels";

interface CreateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formName: string;
  setFormName: (v: string) => void;
  formDescription: string;
  setFormDescription: (v: string) => void;
  formStart: string;
  setFormStart: (v: string) => void;
  formEnd: string;
  setFormEnd: (v: string) => void;
  formPhase: string;
  setFormPhase: (v: string) => void;
  formMembers: string[];
  setFormMembers: React.Dispatch<React.SetStateAction<string[]>>;
  formLabels: string[];
  setFormLabels: React.Dispatch<React.SetStateAction<string[]>>;
  phases: any[];
  setPhases: (v: any[]) => void;
  projectData?: any;
  onSave: () => void;
  isSaving?: boolean;
  hasParallelConflict?: boolean;
}

export const CreateModal = ({
  open,
  onOpenChange,
  formName,
  setFormName,
  formDescription,
  setFormDescription,
  formStart,
  setFormStart,
  formEnd,
  setFormEnd,
  formPhase,
  setFormPhase,
  formMembers,
  setFormMembers,
  formLabels,
  setFormLabels,
  phases,
  setPhases,
  projectData,
  onSave,
  isSaving = false,
  hasParallelConflict = false,
}: CreateModalProps) => {
  const { workspaceId, projectId } = useParams();
  const { workspaceLabels } = useLabels(workspaceId!, "cycle", projectId);
  const labelsTriggerRef = useRef<HTMLButtonElement>(null);
  const phaseTriggerRef = useRef<HTMLButtonElement>(null);

  const currentPhaseConfig = useMemo(() => {
    return phases.find(p => p.id === formPhase) || phases[0];
  }, [phases, formPhase]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-[780px] flex flex-col p-0 overflow-hidden rounded-sm border-0 shadow-2xl bg-white max-h-[90vh]">
        <div className="flex items-center justify-between pl-9 pr-5 py-4 border-b border-gray-100">
          <span className="text-sm font-semibold text-[#172b4d]">Create Cycle</span>
          <Button variant="ghost" size="icon" className="size-8 text-gray-500 hover:text-gray-900" onClick={() => onOpenChange(false)}>
            <X className="size-4" />
          </Button>
        </div>

        <div className="px-9 pt-3 pb-1">
          <textarea
            rows={1}
            value={formName}
            onChange={(e) => {
              setFormName(e.target.value);
              e.currentTarget.style.height = "auto";
              e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`;
            }}
            placeholder="Enter cycle title..."
            className="w-full resize-none rounded-md border border-transparent bg-transparent px-2 py-1 text-[24px] font-bold leading-tight outline-none placeholder:text-[#999] hover:bg-[#091e420f] focus:bg-white focus:border-[#d9d9d9] text-[#172b4d] transition-all"
            autoFocus
          />
        </div>

        <div className="px-9 space-y-4 max-h-[500px] overflow-y-auto custom-scrollbar pb-3 pt-1">
          {/* Quick-add action buttons row */}
          <div className="flex flex-wrap items-center gap-2">
            <PhaseSection phases={phases} setPhases={setPhases} formPhase={formPhase} setFormPhase={setFormPhase} triggerRef={phaseTriggerRef} />

            <MembersSection
              projectData={projectData}
              formMembers={formMembers}
              setFormMembers={setFormMembers}
            />

            <LabelsSection
              formLabels={formLabels}
              setFormLabels={setFormLabels}
              triggerRef={labelsTriggerRef}
            />

            <DatesSection
              formStart={formStart}
              formEnd={formEnd}
              setFormStart={setFormStart}
              setFormEnd={setFormEnd}
            />
          </div>

          {/* Details row — Phase / Members / Labels / Dates all side-by-side */}
          <div className="flex flex-wrap items-start gap-x-6 gap-y-4">
            {/* Phase */}
            <div className="flex shrink-0 flex-col gap-1.5">
              <span className="text-[13px] font-semibold text-[#5e6c84]">Research Phase</span>
              <button
                type="button"
                onClick={() => phaseTriggerRef.current?.click()}
                className="h-9 px-3 bg-white border border-[#d9d9d9] rounded-md flex items-center gap-2 text-[#333] font-medium text-[14px] cursor-pointer hover:bg-[#f7f7f7] transition-colors"
              >
                <PhaseIconRenderer
                  phaseId={formPhase}
                  icon={currentPhaseConfig?.icon}
                  color={currentPhaseConfig?.color}
                  size="sm"
                  className="!bg-transparent !size-5"
                />
                <span className="whitespace-nowrap">{currentPhaseConfig?.label}</span>
              </button>
            </div>

            {/* Members — overlapping avatars, max 5 visible + overflow badge */}
            {formMembers.length > 0 && (() => {
              const allMembers = (projectData?.members || projectData?.project?.members || []).filter((m: any) => formMembers.includes(m.user?._id || m.user));
              const MAX_VISIBLE = 5;
              const visible = allMembers.slice(0, MAX_VISIBLE);
              const overflow = allMembers.length - MAX_VISIBLE;
              return (
                <div className="flex shrink-0 flex-col gap-1.5">
                  <span className="text-[13px] font-semibold text-[#5e6c84]">Members</span>
                  <div className="flex h-9 items-center">
                    <div className="flex -space-x-2.5">
                      {visible.map((m: any) => {
                        const user = typeof m.user === 'object' ? m.user : { _id: m.user, name: 'User' };
                        return (
                          <Popover key={user._id}>
                            <PopoverTrigger asChild>
                              <button className="rounded-full ring-2 ring-white shadow-sm transition-transform hover:scale-110 active:scale-95 outline-none">
                                <Avatar className="size-7">
                                  {user.avatar && <AvatarImage src={user.avatar} className="object-cover" />}
                                  <AvatarFallback className="bg-zinc-100 text-zinc-600 text-[10px] font-bold">
                                    {user.name?.charAt(0).toUpperCase() || 'U'}
                                  </AvatarFallback>
                                </Avatar>
                              </button>
                            </PopoverTrigger>
                            <PopoverContent align="start" side="top" sideOffset={8} className="z-140 w-48 rounded-xl border-border/50 p-1.5 shadow-xl bg-white">
                              <div className="px-3 py-2 border-b border-gray-50 mb-1">
                                <span className="text-[13px] font-semibold text-[#172b4d] truncate block">{user.name}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => setFormMembers(prev => prev.filter(id => id !== user._id))}
                                className="flex w-full items-center rounded-lg px-3 py-2 text-left text-[14px] text-[#c9372c] transition-colors hover:bg-[#fff1f0] font-medium"
                              >
                                Remove from cycle
                              </button>
                            </PopoverContent>
                          </Popover>
                        );
                      })}
                      {overflow > 0 && (
                        <div className="size-7 rounded-full ring-2 ring-white bg-[#e2e4e9] flex items-center justify-center text-[10px] font-bold text-[#44546f]">
                          +{overflow}
                        </div>
                      )}
                    </div>
                    <MembersSection
                      projectData={projectData}
                      formMembers={formMembers}
                      setFormMembers={setFormMembers}
                      trigger={
                        <button className="ml-1.5 size-7 rounded-full bg-[#e5e7eb] text-[#172b4d] flex items-center justify-center hover:bg-[#d9dde3] transition-colors shrink-0">
                          <Plus className="size-3" />
                        </button>
                      }
                    />
                  </div>
                </div>
              );
            })()}

            {/* Labels — dynamic: shows as many chips as fit, then +N */}
            {formLabels.length > 0 && (
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className="text-[13px] font-semibold text-[#5e6c84]">Labels</span>
                <LabelsDisplay
                  tags={workspaceLabels.filter(t => formLabels.includes(t._id))}
                  onOpen={() => labelsTriggerRef.current?.click()}
                />
              </div>
            )}

            {/* Dates */}
            {(formStart || formEnd) && (
              <div className="flex shrink-0 flex-col gap-1.5">
                <span className="text-[13px] font-semibold text-[#5e6c84]">Dates</span>
                <DatesSection formStart={formStart} formEnd={formEnd} setFormStart={setFormStart} setFormEnd={setFormEnd} trigger={
                  <div className="inline-flex h-9 w-fit items-center gap-2 rounded-md bg-[#f1f2f4] px-3 text-[13px] font-medium text-[#172b4d] transition-colors cursor-pointer hover:bg-[#e2e4e9] whitespace-nowrap">
                    <CalendarDays className="size-3.5 shrink-0 text-[#44546f]" />
                    <span>
                      {formStart && formEnd
                        ? `${format(parseISO(formStart), 'dd MMM yyyy')} - ${format(parseISO(formEnd), 'dd MMM yyyy')}`
                        : "Set dates"}
                    </span>
                    <button onClick={(e) => { e.stopPropagation(); setFormStart(""); setFormEnd(""); }} className="ml-0.5 size-4 rounded-full hover:bg-black/10 flex items-center justify-center transition-colors">
                      <X className="size-2.5 text-[#5e6c84]" />
                    </button>
                  </div>
                } />
                {hasParallelConflict && (
                  <p className="text-[11px] font-medium text-[#c9372c] animate-in fade-in slide-in-from-top-1">
                    Conflicts with another active cycle.
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-3">
              <svg width="18" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-[#44546f]"><line x1="21" y1="6" x2="3" y2="6"></line><line x1="15" y1="12" x2="3" y2="12"></line><line x1="17" y1="18" x2="3" y2="18"></line></svg>
              <h3 className="text-[17px] font-bold text-[#172b4d]">Description</h3>
            </div>
            <textarea
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="Add a more detailed description..."
              className="min-h-[100px] w-full resize-none rounded-sm border border-[#d0d7e2] px-4 py-3 text-[15px] text-[#172b4d] outline-none hover:bg-[#091e420f] focus:bg-white transition-all"
            />
          </div>
        </div>
        <DialogFooter className="px-9 py-4 flex items-center justify-end gap-2 border-t border-[#ececec] bg-white shrink-0">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSaving} className="h-9 px-4 text-[#44546f] hover:bg-[#091e420f] transition-colors">Cancel</Button>
          <Button onClick={onSave} disabled={!formName.trim() || isSaving} className="h-9 bg-black px-5 text-white hover:bg-black/90 shadow-none font-medium transition-all active:scale-95">
            {isSaving ? "Create cycle" : "Create cycle"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
