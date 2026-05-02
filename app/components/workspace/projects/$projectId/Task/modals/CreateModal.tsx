import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Check } from "lucide-react";

export type SectionData = {
  sectionName: string;
  selectedColor: string;
};

interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: SectionData) => void;
  mode?: "create" | "edit";
  initialData?: Partial<SectionData>;
  isLoading?: boolean;
}

const COLORS = [
  { id: "white", value: "#FFFFFF", border: true },
  { id: "slate", value: "#64748b" },
  { id: "blue", value: "#3B82F6" },
  { id: "green", value: "#10B981" },
  { id: "amber", value: "#F59E0B" },
  { id: "red", value: "#EF4444" },
  { id: "purple", value: "#A855F7" },
];

export default function CreateModal({
  isOpen,
  onClose,
  onSubmit,
  mode = "create",
  initialData,
  isLoading = false,
}: CreateModalProps) {
  const [sectionName, setSectionName] = useState("");
  const [selectedColor, setSelectedColor] = useState(COLORS[0].value);
  // Removed isDefault

  useEffect(() => {
    if (isOpen) {
      setSectionName(initialData?.sectionName || "");
      setSelectedColor(initialData?.selectedColor || COLORS[0].value);
    }
  }, [isOpen, initialData]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!sectionName.trim()) return;
    onSubmit({
      sectionName: sectionName.trim(),
      selectedColor,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md gap-0 p-0 overflow-hidden border-0 shadow-2xl rounded-sm">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="p-6 pb-2">
            <DialogTitle className="text-[18px] font-bold text-[#172b4d]">
              {mode === "create" ? "New Column" : "Edit Column"}
            </DialogTitle>
          </DialogHeader>

          <div className="p-6 space-y-6">
            <div className="space-y-2">
              <Label
                htmlFor="section-name"
                className="text-[13px] font-semibold text-zinc-500"
              >
                Column Name
              </Label>
              <Input
                id="section-name"
                placeholder="Enter your Title..."
                value={sectionName}
                onChange={(e) => setSectionName(e.target.value)}
                autoFocus
                className="h-10 text-[14px] font-medium text-zinc-900 rounded-sm border-zinc-200 bg-zinc-50/50 shadow-none focus-visible:ring-0 focus-visible:border-black focus-visible:bg-white transition-all"
              />
            </div>

            <div className="space-y-2.5">
              <Label className="text-[13px] font-semibold text-zinc-500">
                Accent Color
              </Label>
              <div className="flex items-center gap-3">
                {COLORS.map((color) => {
                  const isSelected = selectedColor.toLowerCase() === color.value.toLowerCase();
                  return (
                    <button
                      key={color.id}
                      onClick={() => setSelectedColor(color.value)}
                      type="button"
                      className={`
                        relative w-7 h-7 rounded-full transition-all duration-200 focus:outline-none cursor-pointer flex items-center justify-center
                        ${color.border ? "border border-zinc-200" : "border border-transparent"}
                        ${isSelected ? "ring-2 ring-offset-2 ring-black scale-100" : "hover:scale-110 opacity-80 hover:opacity-100"}
                      `}
                      style={{ backgroundColor: color.value }}
                      aria-label={`Select ${color.id} color`}
                    >
                      {isSelected && (
                        <Check className={`size-3.5 ${color.id === 'white' ? 'text-black' : 'text-white'}`} strokeWidth={3} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="px-6 py-4 bg-zinc-50/50 flex flex-row items-center justify-end gap-3 border-t border-zinc-100">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={isLoading}
              className="h-9 px-4 text-[13px] font-semibold text-zinc-500 hover:bg-zinc-200/50 shadow-none rounded-sm"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="h-9 px-6 text-[13px] font-bold bg-black text-white hover:bg-black/90 shadow-none rounded-sm transition-all duration-200 active:scale-[0.98]"
              disabled={!sectionName.trim() || isLoading}
            >
              {isLoading ? (mode === "create" ? "Creating..." : "Saving...") : (mode === "create" ? "Create Column" : "Save Changes")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
