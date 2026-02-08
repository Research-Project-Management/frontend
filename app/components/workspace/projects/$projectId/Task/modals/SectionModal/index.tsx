import { useEffect, useRef, useState } from "react";
import { X, Pipette } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";

export type CreateSection = {
  sectionName: string;
  selectedColor: string;
  isDefault: boolean;
};

interface NewSectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (payload: CreateSection) => void;
  onSubmit?: (payload: CreateSection) => void;
}

const COLORS = [
  { id: "white", value: "#FFFFFF", border: true },
  { id: "blue", value: "#3B82F6" },
  { id: "green", value: "#10B981" },
  { id: "amber", value: "#F59E0B" },
  { id: "red", value: "#EF4444" },
  { id: "purple", value: "#A855F7" },
];

export default function NewSectionModal({
  isOpen,
  onClose,
  onCreate,
}: NewSectionModalProps) {
  const [sectionName, setSectionName] = useState("");
  const [selectedColor, setSelectedColor] = useState(COLORS[0].value);
  const [isDefault, setIsDefault] = useState(false);

  const colorInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setSectionName("");
    setSelectedColor(COLORS[0].value);
    setIsDefault(false);
  }, [isOpen]);

  const canCreate = sectionName.trim().length > 0;
  const handleCreate = () => {
    if (!canCreate) return;
    onCreate({
      sectionName: sectionName.trim(),
      selectedColor,
      isDefault,
    });
    onClose();
  };

  const handlePickCustomColor = () => {
    colorInputRef.current?.click();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/15 backdrop-blur-[0.5px]"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative z-50 w-full max-w-[480px] bg-white rounded-xl shadow-2xl animate-in fade-in zoom-in-95 duration-200 p-0 overflow-hidden border border-gray-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-2">
          <h2 className="text-xl font-semibold text-gray-900">New Section</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-md hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-6">
          {/* Section Name Input */}
          <div className="space-y-3">
            <Label
              htmlFor="section-name"
              className="text-base font-medium text-gray-700"
            >
              Section Name
            </Label>
            <Input
              id="section-name"
              placeholder="e.g. Code Review"
              value={sectionName}
              onChange={(e) => setSectionName(e.target.value)}
              className="h-11 border-gray-200 focus:border-blue-500 focus:ring-blue-500 text-base"
            />
          </div>

          {/* Color Selection */}
          <div className="space-y-3">
            <Label className="text-base font-medium text-gray-700">
              Column Accent Color
            </Label>
            <div className="flex items-center space-x-3">
              {COLORS.map((color) => (
                <button
                  key={color.id}
                  onClick={() => setSelectedColor(color.value)}
                  type="button"
                  className={`
                    w-8 h-8 rounded-full transition-all duration-200 focus:outline-none
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

              <button
                className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:border-gray-300 transition-colors"
                aria-label="Custom color"
                onClick={handlePickCustomColor}
                type="button"
              >
                <Pipette className="w-4 h-4" />
              </button>
              <input
                ref={colorInputRef}
                data-testid="custom-color-input"
                type="color"
                className="hidden"
                value={selectedColor}
                onChange={(e) => setSelectedColor(e.target.value)}
                aria-label="Custom color input"
              />
            </div>
          </div>

          {/* Default Switch */}
          <div className="flex items-center justify-between bg-gray-50/50 p-4 rounded-lg border border-gray-100/50">
            <div className="space-y-0.5">
              <Label className="text-base font-medium text-gray-800">
                Set as Default
              </Label>
              <p className="text-sm text-gray-500">
                New tasks will be automatically added here
              </p>
            </div>
            <Switch checked={isDefault} onCheckedChange={setIsDefault} />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-5 space-x-3 bg-white">
          <Button
            variant="ghost"
            onClick={onClose}
            className="text-gray-600 hover:text-gray-900 font-normal text-base h-10 px-4"
          >
            Cancel
          </Button>
          <Button
            className="bg-gray-900 hover:bg-gray-800 text-white font-medium text-sm h-10 px-6 rounded-md shadow-sm"
            onClick={handleCreate}
            disabled={!canCreate}
          >
            Create Section
          </Button>
        </div>
      </div>
    </div>
  );
}
