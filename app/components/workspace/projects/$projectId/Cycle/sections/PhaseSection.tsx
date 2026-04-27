import React, { useState } from "react";
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from "~/components/ui/popover";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { 
  ClipboardList, 
  Plus, 
  Check, 
  Trash2, 
  X, 
  ChevronLeft,
  Search,
  Book,
  Settings,
  Database,
  BarChart3,
  FileText,
  RefreshCw,
  GraduationCap,
  FlaskConical,
  Microscope,
  Atom,
  Dna,
  Brain,
  LineChart,
  ClipboardCheck,
  Presentation,
  Stethoscope,
  Globe,
  Calculator,
  Zap,
  Target,
  Users,
  MessageSquare,
  Binary,
  Lightbulb
} from "lucide-react";

const SCIENTIFIC_ICONS = [
  { id: "search", icon: <Search className="size-4" />, label: "Search", color: "#4bce97" },
  { id: "book", icon: <Book className="size-4" />, label: "Literature", color: "#9f8fef" },
  { id: "settings", icon: <Settings className="size-4" />, label: "Methodology", color: "#579dff" },
  { id: "database", icon: <Database className="size-4" />, label: "Data", color: "#f5cd47" },
  { id: "barchart", icon: <BarChart3 className="size-4" />, label: "Analysis", color: "#fea362" },
  { id: "filetext", icon: <FileText className="size-4" />, label: "Writing", color: "#f87168" },
  { id: "refresh", icon: <RefreshCw className="size-4" />, label: "Revision", color: "#60c6d2" },
  { id: "cap", icon: <GraduationCap className="size-4" />, label: "Defense", color: "#44546f" },
  { id: "flask", icon: <FlaskConical className="size-4" />, label: "Experiment", color: "#1f845a" },
  { id: "microscope", icon: <Microscope className="size-4" />, label: "Analysis", color: "#c25100" },
  { id: "atom", icon: <Atom className="size-4" />, label: "Science", color: "#6e5dc6" },
  { id: "dna", icon: <Dna className="size-4" />, label: "Biology", color: "#ae4787" },
  { id: "brain", icon: <Brain className="size-4" />, label: "Psychology", color: "#946f00" },
  { id: "linechart", icon: <LineChart className="size-4" />, label: "Results", color: "#0c66e4" },
  { id: "clipboard", icon: <ClipboardCheck className="size-4" />, label: "Validation", color: "#1d7f8c" },
  { id: "presentation", icon: <Presentation className="size-4" />, label: "Seminar", color: "#5b7f24" },
  { id: "stethoscope", icon: <Stethoscope className="size-4" />, label: "Medical", color: "#c9372c" },
  { id: "globe", icon: <Globe className="size-4" />, label: "Social", color: "#8590a2" },
  { id: "calculator", icon: <Calculator className="size-4" />, label: "Math", color: "#172b4d" },
  { id: "zap", icon: <Zap className="size-4" />, label: "Physics", color: "#fea362" },
  { id: "target", icon: <Target className="size-4" />, label: "Objective", color: "#f87168" },
  { id: "users", icon: <Users className="size-4" />, label: "Group", color: "#4bce97" },
  { id: "message", icon: <MessageSquare className="size-4" />, label: "Discussion", color: "#579dff" },
  { id: "binary", icon: <Binary className="size-4" />, label: "Computing", color: "#9f8fef" },
  { id: "bulb", icon: <Lightbulb className="size-4" />, label: "Idea", color: "#f5cd47" },
];

interface Phase {
  id: string;
  icon: string | React.ReactNode;
  label: string;
  color: string;
}

interface PhaseSectionProps {
  phases: Phase[];
  setPhases: (phases: Phase[]) => void;
  formPhase: string;
  setFormPhase: (id: string) => void;
  trigger?: React.ReactNode;
}

export const PhaseSection = ({ phases, setPhases, formPhase, setFormPhase, trigger }: PhaseSectionProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<"list" | "edit">("list");
  const [editingPhaseId, setEditingPhaseId] = useState<string | null>(null);
  const [tempLabel, setTempLabel] = useState("");
  const [tempIconId, setTempIconId] = useState("search");

  const handleOpenEdit = (phase: Phase) => {
    setEditingPhaseId(phase.id);
    setTempLabel(phase.label);
    const iconObj = SCIENTIFIC_ICONS.find(i => i.id === (phase.id.split("_")[0]));
    setTempIconId(iconObj?.id || "search");
    setView("edit");
  };

  const handleOpenCreate = () => {
    setEditingPhaseId(null);
    setTempLabel("");
    setTempIconId("search");
    setView("edit");
  };

  const handleSave = () => {
    if (!tempLabel.trim()) return;
    
    const iconObj = SCIENTIFIC_ICONS.find(i => i.id === tempIconId);
    if (editingPhaseId) {
      setPhases(phases.map(p => p.id === editingPhaseId ? { ...p, label: tempLabel, icon: iconObj?.icon || p.icon, color: iconObj?.color || p.color } : p));
    } else {
      const newPhase = {
        id: `${tempIconId}_${Date.now()}`,
        icon: iconObj?.icon || <Search className="size-4" />,
        label: tempLabel,
        color: iconObj?.color || "#4bce97"
      };
      setPhases([...phases, newPhase]);
    }
    setView("list");
  };

  const handleDelete = (id: string) => {
    if (phases.length <= 1) return;
    const newPhases = phases.filter(p => p.id !== id);
    setPhases(newPhases);
    if (formPhase === id) setFormPhase(newPhases[0].id);
    setView("list");
  };

  const renderContent = () => {
    if (view === "edit") {
      return (
        <div className="flex h-full min-h-0 flex-col animate-in fade-in slide-in-from-right-2 duration-200 bg-white">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 shrink-0 relative">
            <Button variant="ghost" size="icon" className="size-8" onClick={() => setView("list")}>
              <ChevronLeft className="size-4" />
            </Button>
            <span className="text-sm font-semibold text-center flex-1">
              {editingPhaseId ? "Edit phase" : "Create phase"}
            </span>
            <Button variant="ghost" size="icon" className="size-8" onClick={() => setIsOpen(false)}>
              <X className="size-4" />
            </Button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-6 custom-scrollbar">
            <div className="space-y-2">
              <Label className="text-[12px] font-bold text-[#5e6c84] uppercase tracking-wide">TITLE</Label>
              <Input 
                value={tempLabel} 
                onChange={(e) => setTempLabel(e.target.value)} 
                className="h-11 border-[#091e4224] focus-visible:ring-2 ring-primary/20 bg-accent/5 shadow-none" 
                placeholder="Phase name..."
                autoFocus
              />
            </div>

            <div className="space-y-3">
              <Label className="text-[12px] font-bold text-[#5e6c84] uppercase tracking-wide">SELECT AN ICON</Label>
              <div className="grid grid-cols-5 gap-3">
                {SCIENTIFIC_ICONS.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setTempIconId(item.id)}
                    className={`size-12 rounded-xl flex items-center justify-center transition-all ${tempIconId === item.id ? 'ring-2 ring-offset-2 ring-[#0c66e4] scale-110 shadow-lg' : 'hover:scale-105 active:scale-95'}`}
                    style={{ backgroundColor: item.color + '15', color: item.color }}
                  >
                    {item.icon}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-border/50">
              <Button onClick={handleSave} className="bg-[#0c66e4] hover:bg-[#0c66e4]/90 text-white font-semibold h-10 px-8 rounded-md shadow-sm transition-all active:scale-95">
                Save
              </Button>
              {editingPhaseId && phases.length > 1 && (
                <Button onClick={() => handleDelete(editingPhaseId)} variant="ghost" className="text-[#c9372c] hover:bg-[#c9372c]/10 font-semibold h-10 px-4 rounded-md">
                  Delete
                </Button>
              )}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="flex h-full min-h-0 flex-col animate-in fade-in slide-in-from-left-2 duration-200 bg-white">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 shrink-0 bg-white relative">
          <div className="size-8" />
          <span className="text-sm font-semibold text-[#172b4d] flex-1 text-center">Phases</span>
          <Button variant="ghost" size="icon" className="size-8" onClick={() => setIsOpen(false)}>
            <X className="size-4" />
          </Button>
        </div>
        
        <div className="p-1.5 max-h-[400px] overflow-y-auto custom-scrollbar">
          <div className="space-y-0.5">
            {phases.map((p) => (
              <div key={p.id} className="group relative flex items-center">
                <button 
                  onClick={() => { setFormPhase(p.id); setIsOpen(false); }} 
                  className={`flex-1 flex items-center gap-3 px-3 py-2.5 cursor-pointer rounded-lg text-[14px] transition-all ${formPhase === p.id ? 'bg-blue-50 text-[#0c66e4]' : 'text-[#172b4d] hover:bg-[#091e420f]'}`}
                >
                  <div className="size-8 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: p.color + '20', color: p.color }}>
                    {p.icon}
                  </div>
                  <span className={`font-medium flex-1 text-left truncate ${formPhase === p.id ? 'font-semibold' : ''}`}>{p.label}</span>
                  <div className="group-hover:hidden transition-all">
                    {formPhase === p.id && <Check className="size-4 text-[#0c66e4]" />}
                  </div>
                </button>
                
                <div className="absolute right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity pr-2">
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleOpenEdit(p); }}
                    className="p-1.5 hover:bg-black/5 rounded-md text-[#44546f] hover:text-[#172b4d] transition-colors"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                  </button>
                  {phases.length > 1 && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }}
                      className="p-1.5 hover:bg-red-50 rounded-md text-[#44546f] hover:text-[#c9372c] transition-colors"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="p-2 border-t border-border/50 bg-gray-50/30">
          <Button 
            variant="ghost"
            onClick={handleOpenCreate}
            className="w-full bg-[#091e420f] hover:bg-[#091e421a] text-[#172b4d] font-semibold h-10 rounded-md border-none shadow-none transition-all flex items-center justify-center gap-2"
          >
            <Plus className="size-4" /> Create new phase
          </Button>
        </div>
      </div>
    );
  };

  return (
    <Popover open={isOpen} onOpenChange={(val) => { setIsOpen(val); if(!val) setView("list"); }}>
      <PopoverTrigger asChild>
        {trigger || (
          <button className="h-10 rounded-[8px] border border-[#d9d9d9] bg-white px-4 text-[15px] font-medium text-[#333] hover:bg-[#f7f7f7] flex items-center gap-2 transition-colors outline-none">
            <ClipboardList className="size-4 text-[#44546f]" /> Phase
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[320px] p-0 rounded-xl border-border/50 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-150 z-140">
        {renderContent()}
      </PopoverContent>
    </Popover>
  );
};
