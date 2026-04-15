import { useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { Check, ChevronLeft, SquarePen, Tag, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { TaskLabel } from "~/types/task";

const AVAILABLE_LABEL_COLORS = [
  { name: "green_subtle", color: "#baf3db" }, { name: "yellow_subtle", color: "#f8e6a0" }, { name: "orange_subtle", color: "#fedec8" }, { name: "red_subtle", color: "#ffd5d2" }, { name: "purple_subtle", color: "#dfd8fd" },
  { name: "green", color: "#4bce97" }, { name: "yellow", color: "#f5cd47" }, { name: "orange", color: "#fea362" }, { name: "red", color: "#f87168" }, { name: "purple", color: "#9f8fef" },
  { name: "green_bold", color: "#1f845a" }, { name: "yellow_bold", color: "#946f00" }, { name: "orange_bold", color: "#c25100" }, { name: "red_bold", color: "#c9372c" }, { name: "purple_bold", color: "#6e5dc6" },
  { name: "blue_subtle", color: "#cce0ff" }, { name: "sky_subtle", color: "#c6edfb" }, { name: "lime_subtle", color: "#d3f1a7" }, { name: "pink_subtle", color: "#fdd0ec" }, { name: "grey_subtle", color: "#dcdfe4" },
  { name: "blue", color: "#579dff" }, { name: "sky", color: "#60c6d2" }, { name: "lime", color: "#94c748" }, { name: "pink", color: "#e774bb" }, { name: "grey", color: "#8590a2" },
  { name: "blue_bold", color: "#0c66e4" }, { name: "sky_bold", color: "#1d7f8c" }, { name: "lime_bold", color: "#5b7f24" }, { name: "pink_bold", color: "#ae4787" }, { name: "grey_bold", color: "#44546f" },
];

type ActionLabelsSectionProps = {
  actionBtnClass?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  labels: string[];
  setLabels: Dispatch<SetStateAction<string[]>>;
  labelPool: TaskLabel[];
  setLabelPool: Dispatch<SetStateAction<TaskLabel[]>>;
  onDeleteLabel: (labelId: string) => void;
};

export function ActionLabelsSection({
  actionBtnClass,
  open,
  onOpenChange,
  labels,
  setLabels,
  labelPool,
  setLabelPool,
  onDeleteLabel,
}: ActionLabelsSectionProps) {
  const [labelSearch, setLabelSearch] = useState("");
  const [labelsView, setLabelsView] = useState<"list" | "edit">("list");
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [selectedEditColor, setSelectedEditColor] = useState("");
  const contentScrollRef = useRef<HTMLDivElement>(null);
  const resolvedActionBtnClass =
    actionBtnClass ??
    "h-10 rounded-sm border border-[#d9d9d9] bg-white px-4 text-[15px] font-medium text-[#333] shadow-none transition-colors hover:bg-[#f7f7f7]";

  const filteredLabelPool = useMemo(() => {
    return labelPool.filter((label) =>
      label.title.toLowerCase().includes(labelSearch.toLowerCase())
    );
  }, [labelPool, labelSearch]);

  const setLabelSelected = (id: string, selected: boolean) => {
    setLabels((prev) =>
      selected
        ? prev.includes(id)
          ? prev
          : [...prev, id]
        : prev.filter((labelId) => labelId !== id)
    );
  };

  const handleEditLabel = (item: { id: string; color: string; title: string }) => {
    setEditingLabelId(item.id);
    setEditingTitle(item.title);
    setSelectedEditColor(item.color);
    setLabelsView("edit");
  };

  const handleCreateNewLabel = () => {
    const numericIds = labelPool
      .map((label) => Number(label.id.replace(/^L/, "")))
      .filter((value) => Number.isFinite(value));
    const newId = numericIds.length > 0 ? `L${Math.max(...numericIds) + 1}` : `L${Date.now().toString(36)}`;
    setEditingLabelId(newId);
    setEditingTitle("");
    setSelectedEditColor("#4bce97");
    setLabelsView("edit");
  };

  const handleSaveEditLabel = () => {
    if (!editingLabelId) return;
    const trimmedTitle = editingTitle.trim();
    if (!trimmedTitle) return;

    setLabelPool((prev) => {
      const existingIdx = prev.findIndex((l) => l.id === editingLabelId);
      if (existingIdx > -1) {
        const next = [...prev];
        next[existingIdx] = {
          ...next[existingIdx],
          color: selectedEditColor,
          title: trimmedTitle,
        };
        return next;
      }
      return [
        ...prev,
        { id: editingLabelId, color: selectedEditColor, title: trimmedTitle },
      ];
    });

    setLabels((prev) =>
      prev.includes(editingLabelId)
        ? prev
        : Array.from(new Set([...prev, editingLabelId]))
    );

    setLabelsView("list");
  };

  const handleDeleteLabelFromTask = () => {
    if (!editingLabelId) return;
    setLabels((prev) => prev.filter((id) => id !== editingLabelId));
    onDeleteLabel(editingLabelId);
    setEditingLabelId(null);
    setEditingTitle("");
    setSelectedEditColor("");
    setLabelsView("list");
  };

  const renderLabelsContent = () => {
    if (labelsView === "edit" && editingLabelId) {
      return (
        <div className="flex h-full min-h-0 flex-col animate-in fade-in slide-in-from-right-2 duration-200">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 shrink-0">
            <Button variant="ghost" size="icon" className="size-8" onClick={() => setLabelsView("list")}>
              <ChevronLeft className="size-4" />
            </Button>
            <span className="text-sm font-semibold text-center flex-1">Chỉnh sửa nhãn</span>
            <Button variant="ghost" size="icon" className="size-8" onClick={() => onOpenChange(false)}>
              <X className="size-4" />
            </Button>
          </div>

          <div ref={contentScrollRef} className="flex-1 min-h-0 overflow-y-auto p-4 space-y-6">
            <div className="h-10 rounded-sm shadow-none w-full flex items-center px-3" style={{ backgroundColor: selectedEditColor }}>
              {editingTitle ? (
                <span className="text-xs font-bold text-white truncate max-w-full drop-shadow-sm">
                  {editingTitle}
                </span>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label className="text-[13px] font-bold text-muted-foreground uppercase">Tiêu đề</Label>
              <Input
                value={editingTitle}
                onChange={(e) => setEditingTitle(e.target.value)}
                className="h-10 border-[#091e4224] focus-visible:ring-2 ring-black/20 shadow-none border-none bg-accent/20"
              />
            </div>

            <div className="space-y-3">
              <Label className="text-[13px] font-bold text-muted-foreground uppercase">Chọn một màu</Label>
              <div className="grid grid-cols-5 gap-2">
                {AVAILABLE_LABEL_COLORS.map((item) => (
                  <button
                    key={item.name}
                    onClick={() => setSelectedEditColor(item.color)}
                    className="h-8 rounded-sm relative transition-transform hover:scale-105 active:scale-95 flex items-center justify-center"
                    style={{ backgroundColor: item.color }}
                  >
                    {selectedEditColor === item.color ? (
                      <Check className="size-4 text-white drop-shadow-md" />
                    ) : null}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border/50 mt-4">
              <Button onClick={handleSaveEditLabel} className="bg-black hover:bg-black/90 text-white font-semibold h-10 px-6 rounded-sm shadow-sm">
                Lưu
              </Button>
              <Button onClick={handleDeleteLabelFromTask} variant="destructive" className="bg-[#c9372c] hover:bg-[#c9372c]/90 text-white font-semibold h-10 px-6 rounded-sm shadow-sm">
                Xóa
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="flex h-full min-h-0 flex-col animate-in fade-in slide-in-from-left-2 duration-200">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 shrink-0">
          <span className="text-sm font-semibold text-center flex-1">Nhãn</span>
          <Button variant="ghost" size="icon" className="size-8" onClick={() => onOpenChange(false)}>
            <X className="size-4" />
          </Button>
        </div>

        <div ref={contentScrollRef} className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
          <Input
            placeholder="Tìm nhãn..."
            value={labelSearch}
            onChange={(e) => setLabelSearch(e.target.value)}
            className="h-10 border-black focus-visible:ring-2 ring-black/20 transition-all shadow-none"
          />

          <div className="space-y-3">
            <h4 className="text-[13px] font-bold text-muted-foreground">Nhãn</h4>
            <div className="space-y-2">
              {filteredLabelPool.map((item) => (
                <div key={item.id} className="flex items-center gap-3 group">
                  <Checkbox
                    checked={labels.includes(item.id)}
                    onCheckedChange={(checked) => setLabelSelected(item.id, checked === true)}
                    className="size-5 rounded-sm border-zinc-200 data-[state=checked]:bg-black data-[state=checked]:border-black"
                  />

                  <button
                    type="button"
                    onClick={() => setLabelSelected(item.id, !labels.includes(item.id))}
                    className="h-10 flex-1 rounded-sm transition-all hover:opacity-85 active:scale-[0.98] shadow-none flex items-center px-3"
                    style={{ backgroundColor: item.color }}
                  >
                    {item.title ? (
                      <span className="text-xs font-bold text-white truncate max-w-full drop-shadow-sm">
                        {item.title}
                      </span>
                    ) : null}
                  </button>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEditLabel(item)}
                    className="size-8 opacity-60 group-hover:opacity-100 transition-opacity"
                  >
                    <SquarePen className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <Button
            variant="secondary"
            onClick={handleCreateNewLabel}
            className="w-full bg-[#091e420f] hover:bg-[#091e421a] text-[#172b4d] font-semibold h-10 rounded-sm border-none shadow-none transition-all"
          >
            Tạo nhãn mới
          </Button>
        </div>
      </div>
    );
  };

  return (
    <Popover
      open={open}
      onOpenChange={(value) => {
        onOpenChange(value);
        if (!value) setLabelsView("list");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={
            open
              ? "h-10 rounded-sm border-none bg-black px-4 text-[14px] font-semibold text-white shadow-none"
              : resolvedActionBtnClass
          }
        >
          <Tag className="mr-2 h-4 w-4" />Nhãn
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={-180}
        collisionPadding={12}
        onInteractOutside={(e) => {
          const target = e.target;
          if (!(target instanceof HTMLElement)) return;
          if (target.closest("[data-slot='select-content']") || target.closest("[role='option']") || target.closest("[role='listbox']")) {
            e.preventDefault();
          }
        }}
        onFocusOutside={(e) => {
          const target = e.target;
          if (!(target instanceof HTMLElement)) return;
          if (target.closest("[data-slot='select-content']") || target.closest("[role='option']") || target.closest("[role='listbox']")) {
            e.preventDefault();
          }
        }}
        className="z-100 flex max-h-[82vh] w-80 min-h-0 flex-col overflow-hidden rounded-sm border-border/50 p-0 shadow-xl"
        style={{ maxHeight: "min(82vh, 760px)" }}
      >
        {renderLabelsContent()}
      </PopoverContent>
    </Popover>
  );
}
