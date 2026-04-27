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
import { Switch } from "~/components/ui/switch";

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

          <div className="p-6 space-y-5">
            <div className="space-y-2.5">
              <Label
                htmlFor="section-name"
                className="text-[12px] font-bold text-[#44546f] uppercase tracking-wider"
              >
                Column Name
              </Label>
              <Input
                id="section-name"
                placeholder="e.g. Code Review"
                value={sectionName}
                onChange={(e) => setSectionName(e.target.value)}
                autoFocus
                className="h-9 text-[14px] font-medium text-[#172b4d] rounded-sm border-zinc-200 shadow-none focus-visible:ring-0 focus-visible:border-black"
              />
            </div>

            <div className="space-y-3">
              <Label className="text-[12px] font-bold text-[#44546f] uppercase tracking-wider">
                Accent Color
              </Label>
              <div className="flex items-center space-x-3.5">
                {COLORS.map((color) => (
                  <button
                    key={color.id}
                    onClick={() => setSelectedColor(color.value)}
                    type="button"
                    className={`
                      w-6.5 h-6.5 rounded-full transition-all duration-200 focus:outline-none cursor-pointer
                      ${color.border ? "border border-[#d9d9d9]" : "border border-transparent"}
                      ${
                        selectedColor.toLowerCase() === color.value.toLowerCase()
                          ? "ring-2 ring-offset-2 ring-black scale-100"
                          : "hover:scale-110"
                      }
                    `}
                    style={{ backgroundColor: color.value }}
                    aria-label={`Select ${color.id} color`}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="border-[#ececec] px-6 py-4 bg-white flex flex-row items-center justify-end gap-2 sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={isLoading}
              className="h-9 px-4 text-[14px] font-medium text-[#44546f] hover:bg-[#091e420f] shadow-none rounded-sm"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="h-9 px-6 text-[14px] font-medium bg-black text-white hover:bg-black/90 shadow-none rounded-sm transition-all duration-200 active:scale-[0.98]"
              disabled={!sectionName.trim() || isLoading}
            >
              {isLoading ? (mode === "create" ? "Creating..." : "Saving...") : (mode === "create" ? "Create" : "Save")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
