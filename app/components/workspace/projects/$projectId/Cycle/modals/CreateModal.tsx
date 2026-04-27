import React, { useMemo } from "react";
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
import { LabelsSection, LabelSelect } from "../sections/LabelsSection";
import { DatesSection } from "../sections/DatesSection";

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
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  phases: any[];
  setPhases: (v: any[]) => void;
  projectData: any;
  workspaceTags: any[];
  onSave: () => void;
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
  searchTerm,
  setSearchTerm,
  phases,
  setPhases,
  projectData,
  workspaceTags,
  onSave
}: CreateModalProps) => {

  const currentPhaseConfig = useMemo(() => {
    return phases.find(p => p.id === formPhase) || phases[0];
  }, [phases, formPhase]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-[740px] p-0 overflow-hidden rounded-[20px] border-0 shadow-2xl bg-white">
        <div className="flex items-center justify-between px-9 py-4 border-b border-border/50">
          <span className="text-sm font-semibold text-[#172b4d]">Create Cycle</span>
          <Button variant="ghost" size="icon" className="size-8" onClick={() => onOpenChange(false)}>
            <X className="size-4" />
          </Button>
        </div>

        <div className="px-9 pt-6 pb-4">
          <textarea 
            rows={1} 
            value={formName} 
            onChange={(e) => { 
              setFormName(e.target.value); 
              e.currentTarget.style.height = "auto"; 
              e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`; 
            }}
            placeholder="Enter cycle title..." 
            className="w-full resize-none rounded-lg border-none bg-transparent px-2 py-1 text-[24px] font-bold leading-tight outline-none placeholder:text-[#999] hover:bg-[#091e420f] focus:bg-white focus:ring-2 focus:ring-[#3884ff] text-[#172b4d]" 
            autoFocus 
          />
        </div>

        <div className="px-9 space-y-8">
          <div className="flex flex-wrap items-center gap-2">
            <PhaseSection phases={phases} setPhases={setPhases} formPhase={formPhase} setFormPhase={setFormPhase} />
            
            <MembersSection 
              projectData={projectData} 
              formMembers={formMembers} 
              setFormMembers={setFormMembers} 
              searchTerm={searchTerm} 
              setSearchTerm={setSearchTerm} 
            />

            <LabelsSection 
              workspaceTags={workspaceTags} 
              formLabels={formLabels} 
              setFormLabels={setFormLabels} 
            />

            <DatesSection 
              formStart={formStart} 
              formEnd={formEnd} 
              setFormStart={setFormStart} 
              setFormEnd={setFormEnd} 
            />
          </div>

          <div className="flex flex-wrap items-start gap-x-8 gap-y-10 pt-2">
            <div className="flex flex-col gap-2 shrink-0">
              <span className="text-[14px] font-semibold text-[#5e6c84]">Research Phase</span>
              <PhaseSection phases={phases} setPhases={setPhases} formPhase={formPhase} setFormPhase={setFormPhase} trigger={
                <div className="h-10 px-4 bg-[#f1f2f4] rounded-md flex items-center gap-2.5 text-[#172b4d] font-medium text-[15px] cursor-pointer hover:bg-[#e2e4e9] transition-colors">
                  <span className="text-base">{currentPhaseConfig?.icon}</span>
                  <span>{currentPhaseConfig?.label}</span>
                </div>
              } />
            </div>

            {formMembers.length > 0 && (
              <div className="flex flex-col gap-2 shrink-0">
                <span className="text-[14px] font-semibold text-[#5e6c84]">Members</span>
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-2">
                    {projectData?.project?.members?.filter((m: any) => formMembers.includes(m.user._id)).map((m: any) => (
                      <Popover key={m.user._id}>
                        <PopoverTrigger asChild>
                          <button className="rounded-full ring-2 ring-white shadow-sm transition-transform hover:scale-110 active:scale-95 outline-none">
                            <Avatar className="size-9">
                              <AvatarImage src={m.user.avatar} />
                              <AvatarFallback className="bg-indigo-600 text-white text-xs font-bold">{m.user.name.charAt(0).toUpperCase()}</AvatarFallback>
                            </Avatar>
                          </button>
                        </PopoverTrigger>
                        <PopoverContent align="start" side="top" sideOffset={8} className="z-140 w-48 rounded-xl border-border/50 p-1.5 shadow-xl bg-white">
                          <div className="px-3 py-2 border-b border-gray-50 mb-1">
                              <span className="text-[13px] font-semibold text-[#172b4d] truncate block">{m.user.name}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setFormMembers(prev => prev.filter(id => id !== m.user._id))}
                            className="flex w-full items-center rounded-lg px-3 py-2 text-left text-[14px] text-[#c9372c] transition-colors hover:bg-[#fff1f0] font-medium"
                          >
                            Remove from cycle
                          </button>
                        </PopoverContent>
                      </Popover>
                    ))}
                  </div>
                  <MembersSection 
                    projectData={projectData} 
                    formMembers={formMembers} 
                    setFormMembers={setFormMembers} 
                    searchTerm={searchTerm} 
                    setSearchTerm={setSearchTerm} 
                    trigger={<button className="size-9 rounded-full bg-[#e5e7eb] text-[#172b4d] flex items-center justify-center hover:bg-[#d9dde3] transition-colors"><Plus className="size-4" /></button>}
                  />
                </div>
              </div>
            )}

            {formLabels.length > 0 && (
              <div className="flex flex-col gap-2 min-w-0 max-w-full">
                <span className="text-[14px] font-semibold text-[#5e6c84]">Labels</span>
                <LabelSelect selectedLabelIds={formLabels} onChange={setFormLabels} trigger={
                  <div className="flex flex-wrap items-center gap-2 cursor-pointer outline-none group">
                    {workspaceTags.filter(t => formLabels.includes(t._id)).map((tag) => (
                      <div key={tag._id} 
                        className="inline-flex h-10 max-w-45 items-center rounded-md px-4 text-[15px] font-medium text-white transition-opacity hover:opacity-90 shadow-sm shrink-0"
                        style={{ backgroundColor: tag.color }}>
                        <span className="truncate drop-shadow-sm">{tag.name}</span>
                      </div>
                    ))}
                    <div className="size-9 rounded-full bg-[#e5e7eb] text-[#172b4d] flex items-center justify-center hover:bg-[#d9dde3] transition-colors shrink-0">
                      <Plus className="size-4" />
                    </div>
                  </div>
                } />
              </div>
            )}

            {(formStart || formEnd) && (
              <div className="flex flex-col gap-2 shrink-0">
                <span className="text-[14px] font-semibold text-[#5e6c84]">Dates</span>
                <DatesSection formStart={formStart} formEnd={formEnd} setFormStart={setFormStart} setFormEnd={setFormEnd} trigger={
                  <div className="h-10 px-4 bg-[#f1f2f4] rounded-md flex items-center gap-2.5 text-[#172b4d] font-medium text-[15px] cursor-pointer hover:bg-[#e2e4e9] transition-colors">
                    <CalendarDays className="size-4 text-[#44546f]" />
                    <span>
                      {formStart && formEnd 
                        ? `${format(parseISO(formStart), 'dd MMM yyyy')} - ${format(parseISO(formEnd), 'dd MMM yyyy')}` 
                        : "Set dates"}
                    </span>
                    <button onClick={(e) => { e.stopPropagation(); setFormStart(""); setFormEnd(""); }} className="ml-1 size-5 rounded-full hover:bg-black/5 flex items-center justify-center transition-colors"><X className="size-3 text-[#5e6c84]" /></button>
                  </div>
                } />
              </div>
            )}
          </div>

          <div className="space-y-4 pt-4 border-t border-gray-100">
            <div className="flex items-center gap-3">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-[#44546f]"><line x1="21" y1="6" x2="3" y2="6"></line><line x1="15" y1="12" x2="3" y2="12"></line><line x1="17" y1="18" x2="3" y2="18"></line></svg>
              <h3 className="text-[17px] font-bold text-[#172b4d]">Description</h3>
            </div>
            <textarea 
              value={formDescription} 
              onChange={(e) => setFormDescription(e.target.value)} 
              placeholder="Add a more detailed description..."
              className="min-h-35 w-full resize-none rounded-xl border border-[#d0d7e2] px-4 py-3 text-[15px] text-[#172b4d] outline-none hover:bg-[#091e420f] focus:bg-white focus:ring-2 focus:ring-[#3884ff] focus:border-[#3884ff] transition-all" 
            />
          </div>
        </div>

        <DialogFooter className="px-9 py-6 mt-4 flex items-center justify-end gap-2 border-t border-[#ececec]">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="h-9 px-4 text-[#44546f] hover:bg-[#091e420f] transition-colors">Cancel</Button>
          <Button onClick={onSave} disabled={!formName.trim()} className="h-9 bg-[#0c66e4] px-5 text-white hover:bg-[#0c66e4]/90 shadow-none font-medium transition-all active:scale-95">
            Create cycle
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
