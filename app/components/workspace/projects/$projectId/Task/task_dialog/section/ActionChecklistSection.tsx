import { useState } from "react";
import { CheckSquare, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type ActionChecklistSectionProps = {
  onAddChecklist: (title: string) => void;
};

export function ActionChecklistSection({
  onAddChecklist,
}: ActionChecklistSectionProps) {
  const [open, setOpen] = useState(false);
  const [checklistTitle, setChecklistTitle] = useState("Việc cần làm");

  const actionBtnClass =
    "h-10 rounded-[8px] border border-[#d9d9d9] bg-white px-4 text-[15px] font-medium text-[#333] shadow-none hover:bg-[#f7f7f7]";

  const handleAddChecklist = () => {
    if (!checklistTitle.trim()) return;
    onAddChecklist(checklistTitle);
    setChecklistTitle("Việc cần làm");
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={
            open
              ? "h-10 rounded-xl border-none bg-[#4c525e] px-4 text-[15px] font-medium text-white shadow-none"
              : actionBtnClass
          }
        >
          <CheckSquare className="mr-2 h-4 w-4" />Việc cần làm
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={-14}
        className="w-80 p-0 rounded-xl shadow-xl border-border/50 overflow-hidden flex flex-col z-100"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 shrink-0">
          <span className="text-sm font-semibold text-center flex-1">
            Thêm danh sách công việc
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-md"
            onClick={() => setOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="p-4 space-y-4">
          <div className="space-y-2">
            <Label className="text-[13px] font-semibold text-foreground">
              Tiêu đề
            </Label>
            <Input
              value={checklistTitle}
              onChange={(e) => setChecklistTitle(e.target.value)}
              autoFocus
              className="h-10 focus-visible:ring-1 focus-visible:ring-primary"
            />
          </div>
          <Button
            className="w-fit px-6 bg-primary hover:bg-primary/90"
            onClick={handleAddChecklist}
          >
            Thêm
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
