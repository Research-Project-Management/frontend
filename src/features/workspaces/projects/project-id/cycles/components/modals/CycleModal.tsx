// @ts-nocheck
'use client';

import React, { useMemo, useRef } from "react";
import { LabelsDisplay } from "../icons/LabelsDisplay";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui";
import {
  Dialog,
  DialogContent,
  DialogFooter
} from "@/shared/components/ui";
import { Button } from "@/shared/components/ui";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui";
import { CalendarDays, Plus, X, Lock, ArrowRight, PlayCircle, CheckCircle2 } from "lucide-react";
import { format, parseISO } from "date-fns";

// Internal Sections
import { PhaseSection } from "../dialog/Phase";
import { LabelsSection } from "../dialog/Labels";
import { DatesSection } from "../dialog/Dates";
import { PhaseIconRenderer } from "../icons/PhaseIcon";
import { useParams } from "next/navigation";
import { useLabelsQuery } from '../../hooks/use-labels';
import { cn } from "@/shared/lib/utils";

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
  const { workspaceId, projectId } = useParams() as { workspaceId: string, projectId: string };
  const { data } = useLabels(workspaceId!, "cycle", projectId);
  const labelsTriggerRef = useRef<HTMLButtonElement>(null);
  const phaseTriggerRef = useRef<HTMLButtonElement>(null);

  const currentPhaseConfig = useMemo(() => {
    return phases.find(p => p.id === formPhase) || phases[0];
  }, [phases, formPhase]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        onCloseAutoFocus={(e) => e.preventDefault()}
        className="sm:max-w-[720px] flex flex-col p-0 overflow-hidden rounded-sm border-0 shadow-2xl bg-popover max-h-[90vh]"
      >


        <div className="flex items-center justify-between pl-5 pr-5 py-4 border-b border-border">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-foreground">
                {mode === 'create' ? 'Create Cycle' : (isReadOnly ? 'Cycle Details' : 'Edit Cycle')}
              </span>
              {isReadOnly && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-muted rounded-sm text-[10px] font-bold text-foreground border border-border uppercase tracking-tight">
                  <Lock className="size-2.5 text-foreground" /> Read Only
                </div>
              )}
            </div>
          </div>
          <Button variant="ghost" size="icon" className="size-8 text-foreground hover:bg-muted cursor-pointer" onClick={() => onOpenChange(false)} aria-label="Close dialog">
            <X className="size-5 text-foreground" />
          </Button>
        </div>

        <div className={`px-9 pt-3 pb-1 ${isReadOnly ? 'opacity-90' : ''}`}>
          <div className={`w-full rounded-sm border border-transparent px-3 py-1.5 transition-all ${isReadOnly ? 'cursor-default' : 'hover:bg-muted focus-within:bg-background focus-within:border-border'}`}>
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
              className="w-full resize-none bg-transparent p-0 text-[24px] font-semibold leading-tight text-foreground outline-none placeholder:text-muted-foreground block"
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
              <span className="text-[12px] font-bold text-muted-foreground uppercase tracking-wider">Research Phase</span>
              <button
                type="button"
                disabled={isReadOnly}
                onClick={() => phaseTriggerRef.current?.click()}
                className={`h-9 px-3 bg-muted border border-border rounded-sm flex items-center gap-2 text-foreground font-medium text-[14px] ${isReadOnly ? 'cursor-default' : 'cursor-pointer hover:bg-muted/80'} transition-colors`}
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
                <span className="text-[12px] font-bold text-muted-foreground uppercase tracking-wider">Labels</span>
                <LabelsDisplay
                  labels={data.filter(t => formLabels.includes(t._id))}
                  onOpen={() => labelsTriggerRef.current?.click()}
                  disabled={isReadOnly}
                  showAddButton={!isReadOnly}
                />
              </div>
            )}

            {/* Dates */}
            {(formStart || formEnd) && (
              <div className="flex shrink-0 flex-col gap-1.5">
                <span className="text-[12px] font-bold text-muted-foreground uppercase tracking-wider">Dates</span>
                <DatesSection formStart={formStart} formEnd={formEnd} setFormStart={setFormStart} setFormEnd={setFormEnd} trigger={
                  <div className={`inline-flex h-9 w-fit items-center gap-2 rounded-sm bg-muted px-3 text-[13px] font-medium text-foreground ${isReadOnly ? 'cursor-default' : 'cursor-pointer hover:bg-muted/80'} transition-colors whitespace-nowrap`}>
                    <CalendarDays className="size-3.5 shrink-0 text-foreground" />
                    <div className="flex items-center gap-2">
                      {formStart && formEnd ? (
                        <>
                          <span>{format(parseISO(formStart), 'dd MMM yyyy')}</span>
                          <ArrowRight className="size-3 text-muted-foreground" />
                          <span>{format(parseISO(formEnd), 'dd MMM yyyy')}</span>
                        </>
                      ) : (
                        <>
                          <span className="text-muted-foreground">Start date</span>
                          <ArrowRight className="size-3 text-muted-foreground" />
                          <span className="text-muted-foreground">End date</span>
                        </>
                      )}
                    </div>
                    {!isReadOnly && (
                      <button onClick={(e) => { e.stopPropagation(); setFormStart(""); setFormEnd(""); }} className="ml-0.5 size-4 rounded-full hover:bg-foreground/10 flex items-center justify-center transition-colors cursor-pointer" aria-label="Clear dates">
                        <X className="size-2.5 text-foreground" />
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
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-foreground"><line x1="21" y1="6" x2="3" y2="6"></line><line x1="15" y1="12" x2="3" y2="12"></line><line x1="17" y1="18" x2="3" y2="18"></line></svg>
              <h3 className="text-[16px] font-bold text-foreground">Description</h3>
            </div>
            <textarea
              value={formDescription}
              readOnly={isReadOnly}
              onChange={(e) => {
                if (isReadOnly) return;
                setFormDescription(e.target.value);
              }}
              placeholder={isReadOnly ? "No description provided." : "Add a more detailed description..."}
              className={`min-h-[120px] w-full resize-none rounded-sm border border-border px-4 py-3 text-[15px] text-foreground outline-none ${isReadOnly ? 'bg-transparent cursor-default' : 'hover:bg-muted/30 focus:bg-background focus:border-border'} transition-all`}
            />
          </div>
        </div>

        <DialogFooter className="px-9 py-4 flex items-center justify-end gap-2 border-t border-border bg-popover shrink-0">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSaving} className="h-9 px-4 text-foreground hover:bg-muted transition-colors cursor-pointer">
            {isReadOnly ? 'Close' : 'Cancel'}
          </Button>
          {!isReadOnly && (
            <Button onClick={onSave} disabled={!formName.trim() || isSaving} className="h-9 bg-primary px-6 text-primary-foreground hover:bg-primary/90 shadow-none font-medium transition-all active:scale-95 cursor-pointer">
              {isSaving ? (mode === 'create' ? "Creating..." : "Saving...") : (mode === 'create' ? "Create" : "Save")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
