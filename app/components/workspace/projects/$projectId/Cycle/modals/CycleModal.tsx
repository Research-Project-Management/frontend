import React, { useMemo, useRef } from "react";
import { LabelsDisplay } from "../components/LabelsDisplay";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { CalendarDays, Plus, X, Lock, ArrowRight, PlayCircle, CheckCircle2 } from "lucide-react";
import { format, parseISO } from "date-fns";

// Internal Sections
import { PhaseSection } from "../sections/PhaseSection";
import { LabelsSection } from "../sections/LabelsSection";
import { DatesSection } from "../sections/DatesSection";
import { PhaseIconRenderer } from "../components/PhaseIconRenderer";
import { useParams } from "react-router";
import { useLabels } from "~/hooks/useLabels";
import { cn } from "~/lib/utils";

interface CycleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
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
  formStatus: string;
  setFormStatus: (v: string) => void;
  formLabels: string[];
  setFormLabels: React.Dispatch<React.SetStateAction<string[]>>;
  phases: any[];
  setPhases: (v: any[]) => void;
  projectData?: any;
  onSave: () => void;
  onComplete?: () => void;
  isReadOnly?: boolean;
  isSaving?: boolean;
}

export const CycleModal = ({
  open,
  onOpenChange,
  mode,
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
  formStatus,
  setFormStatus,
  formLabels,
  setFormLabels,
  phases,
  setPhases,
  projectData,
  onSave,
  onComplete,
  isReadOnly = false,
  isSaving = false,
}: CycleModalProps) => {
  const { workspaceId, projectId } = useParams();
  const { workspaceLabels } = useLabels(workspaceId!, "cycle", projectId);
  const labelsTriggerRef = useRef<HTMLButtonElement>(null);
  const phaseTriggerRef = useRef<HTMLButtonElement>(null);

  const currentPhaseConfig = useMemo(() => {
    return phases.find(p => p.id === formPhase) || phases[0];
  }, [phases, formPhase]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-[720px] flex flex-col p-0 overflow-hidden rounded-sm border-0 shadow-2xl bg-white max-h-[90vh]">


        <div className="flex items-center justify-between pl-5 pr-5 py-4 border-b border-border">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-zinc-600">
                {mode === 'create' ? 'Create Cycle' : (isReadOnly ? 'Cycle Details' : 'Edit Cycle')}
              </span>
              {isReadOnly && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-zinc-100 rounded-sm text-[10px] font-bold text-zinc-500 border border-zinc-200 uppercase tracking-tight">
                  <Lock className="size-2.5" /> Read Only
                </div>
              )}
            </div>
          </div>
          <Button variant="ghost" size="icon" className="size-8 text-zinc-500 hover:text-zinc-900" onClick={() => onOpenChange(false)}>
            <X className="size-5" />
          </Button>
        </div>

        <div className={`px-9 pt-3 pb-1 ${isReadOnly ? 'opacity-90' : ''}`}>
          <div className={`w-full rounded-sm border border-transparent px-3 py-1.5 transition-all ${isReadOnly ? 'cursor-default' : 'hover:bg-zinc-100 focus-within:bg-white focus-within:border-black'}`}>
            <textarea
              rows={1}
              value={formName}
              readOnly={isReadOnly}
              onChange={(e) => {
                if (isReadOnly) return;
                setFormName(e.target.value);
                const target = e.currentTarget;
                target.style.height = "auto";
                target.style.height = `${target.scrollHeight}px`;
              }}
              placeholder="Enter cycle title..."
              className="w-full resize-none bg-transparent p-0 text-[24px] font-semibold leading-tight text-zinc-800 outline-none placeholder:text-zinc-400 block"
              autoFocus={mode === 'create' && !isReadOnly}
              style={{ height: 'auto' }}
            />
          </div>
        </div>

        <div className={`px-9 space-y-5 max-h-[500px] overflow-y-auto custom-scrollbar pb-5 pt-1 ${isReadOnly ? 'opacity-95' : ''}`}>
          {/* Quick-add action buttons row */}
          {!isReadOnly && (
            <div className="flex flex-wrap items-center gap-2">
              <PhaseSection phases={phases} setPhases={setPhases} formPhase={formPhase} setFormPhase={setFormPhase} triggerRef={phaseTriggerRef} />
              <LabelsSection formLabels={formLabels} setFormLabels={setFormLabels} triggerRef={labelsTriggerRef} />
              <DatesSection formStart={formStart} formEnd={formEnd} setFormStart={setFormStart} setFormEnd={setFormEnd} />
            </div>
          )}

          {/* Details row — Phase / Labels / Dates all side-by-side */}
          <div className="flex flex-wrap items-start gap-x-8 gap-y-4">
            {/* Phase */}
            <div className="flex shrink-0 flex-col gap-1.5">
              <span className="text-[12px] font-bold text-zinc-400 uppercase tracking-wider">Research Phase</span>
              <button
                type="button"
                disabled={isReadOnly}
                onClick={() => phaseTriggerRef.current?.click()}
                className={`h-9 px-3 bg-zinc-100 border border-border rounded-sm flex items-center gap-2 text-zinc-900 font-medium text-[14px] ${isReadOnly ? 'cursor-default' : 'cursor-pointer hover:bg-zinc-200'} transition-colors`}
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

            {/* Labels */}
            {formLabels.length > 0 && (
              <div className="flex shrink-0 flex-col gap-1.5">
                <span className="text-[12px] font-bold text-zinc-400 uppercase tracking-wider">Labels</span>
                <LabelsDisplay
                  tags={workspaceLabels.filter(t => formLabels.includes(t._id))}
                  onOpen={() => labelsTriggerRef.current?.click()}
                  disabled={isReadOnly}
                  showAddButton={!isReadOnly}
                />
              </div>
            )}

            {/* Dates */}
            {(formStart || formEnd) && (
              <div className="flex shrink-0 flex-col gap-1.5">
                <span className="text-[12px] font-bold text-zinc-400 uppercase tracking-wider">Dates</span>
                <DatesSection formStart={formStart} formEnd={formEnd} setFormStart={setFormStart} setFormEnd={setFormEnd} trigger={
                  <div className={`inline-flex h-9 w-fit items-center gap-2 rounded-sm bg-zinc-100 px-3 text-[13px] font-medium text-zinc-900 ${isReadOnly ? 'cursor-default' : 'cursor-pointer hover:bg-zinc-200'} transition-colors whitespace-nowrap`}>
                    <CalendarDays className="size-3.5 shrink-0 text-zinc-500" />
                    <div className="flex items-center gap-2">
                      {formStart && formEnd ? (
                        <>
                          <span>{format(parseISO(formStart), 'dd MMM yyyy')}</span>
                          <ArrowRight className="size-3 text-zinc-400" />
                          <span>{format(parseISO(formEnd), 'dd MMM yyyy')}</span>
                        </>
                      ) : (
                        <>
                          <span className="text-zinc-500">Start date</span>
                          <ArrowRight className="size-3 text-zinc-400" />
                          <span className="text-zinc-500">End date</span>
                        </>
                      )}
                    </div>
                    {!isReadOnly && (
                      <button onClick={(e) => { e.stopPropagation(); setFormStart(""); setFormEnd(""); }} className="ml-0.5 size-4 rounded-full hover:bg-black/10 flex items-center justify-center transition-colors">
                        <X className="size-2.5 text-zinc-500" />
                      </button>
                    )}
                  </div>
                } />
              </div>
            )}
          </div>

          {/* Description */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-500"><line x1="21" y1="6" x2="3" y2="6"></line><line x1="15" y1="12" x2="3" y2="12"></line><line x1="17" y1="18" x2="3" y2="18"></line></svg>
              <h3 className="text-[16px] font-bold text-zinc-900">Description</h3>
            </div>
            <textarea
              value={formDescription}
              readOnly={isReadOnly}
              onChange={(e) => {
                if (isReadOnly) return;
                setFormDescription(e.target.value);
              }}
              placeholder={isReadOnly ? "No description provided." : "Add a more detailed description..."}
              className={`min-h-[120px] w-full resize-none rounded-sm border border-zinc-200 px-4 py-3 text-[15px] text-zinc-900 outline-none ${isReadOnly ? 'bg-transparent cursor-default' : 'hover:bg-zinc-50 focus:bg-white focus:border-black'} transition-all`}
            />
          </div>
        </div>

        <DialogFooter className="px-9 py-4 flex items-center justify-end gap-2 border-t border-border bg-white shrink-0">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSaving} className="h-9 px-4 text-zinc-500 hover:bg-zinc-100 transition-colors">
            {isReadOnly ? 'Close' : 'Cancel'}
          </Button>
          {!isReadOnly && (
            <Button onClick={onSave} disabled={!formName.trim() || isSaving} className="h-9 bg-black px-6 text-white hover:bg-black/90 shadow-none font-medium transition-all active:scale-95">
              {isSaving ? (mode === 'create' ? "Creating..." : "Saving...") : (mode === 'create' ? "Create" : "Save")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
