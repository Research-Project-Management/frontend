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
  isDefault: boolean;
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
  const [isDefault, setIsDefault] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSectionName(initialData?.sectionName || "");
      setSelectedColor(initialData?.selectedColor || COLORS[0].value);
      setIsDefault(initialData?.isDefault || false);
    }
  }, [isOpen, initialData]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!sectionName.trim()) return;
    
    onSubmit({
      sectionName: sectionName.trim(),
      selectedColor,
      isDefault,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md gap-0 p-0 overflow-hidden border border-gray-100">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="p-6 pb-2">
            <DialogTitle className="text-lg font-semibold text-gray-900">
              {mode === "create" ? "New Column" : "Rename Column"}
            </DialogTitle>
          </DialogHeader>

          <div className="p-6 space-y-5">
            <div className="space-y-2.5">
              <Label
                htmlFor="section-name"
                className="text-xs font-semibold text-muted-foreground uppercase tracking-wider"
              >
                Column Name
              </Label>
              <Input
                id="section-name"
                placeholder="e.g. Code Review"
                value={sectionName}
                onChange={(e) => setSectionName(e.target.value)}
                autoFocus
                className="h-10 text-sm font-medium focus-visible:ring-1 focus-visible:ring-gray-300"
              />
            </div>

            <div className="space-y-3">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Accent Color
              </Label>
              <div className="flex items-center space-x-3.5">
                {COLORS.map((color) => (
                  <button
                    key={color.id}
                    onClick={() => setSelectedColor(color.value)}
                    type="button"
                    className={`
                      w-6.5 h-6.5 rounded-full transition-all duration-200 focus:outline-none
                      ${color.border ? "border border-gray-200" : ""}
                      ${
                        selectedColor.toLowerCase() === color.value.toLowerCase()
                          ? "ring-2 ring-offset-2 ring-gray-900 scale-100"
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

          <DialogFooter className="px-6 py-4 bg-gray-50/50 border-t border-gray-100 flex flex-row items-center justify-end gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
              className="h-9 px-4 text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="h-9 px-6 text-sm font-medium bg-gray-900 text-white hover:bg-gray-800"
              disabled={!sectionName.trim() || isLoading}
            >
              {isLoading ? (mode === "create" ? "Creating..." : "Saving...") : (mode === "create" ? "Create" : "Save Changes")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
