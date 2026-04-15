import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, X, Copy, Trash2, UserMinus, UserPlus } from "lucide-react";
import { resolveTaskColumnId, type Column } from "~/types/task";

type TaskHeaderProps = {
  columnId: string;
  setColumnId: (id: string) => void;
  columns: Column[];
  currentUserId?: string | null;
  isCurrentUserAssignee?: boolean;
  onJoin?: () => void;
  onLeave?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  onClose: () => void;
};

export function TaskHeader({
  columnId,
  setColumnId,
  columns,
  currentUserId,
  isCurrentUserAssignee = false,
  onJoin,
  onLeave,
  onDuplicate,
  onDelete,
  onClose,
}: TaskHeaderProps) {
  return (
    <div className="flex items-center justify-between px-7 py-5 border-b border-[#f3f3f3] bg-white sticky top-0 z-20 shrink-0">
      <Select value={columnId} onValueChange={setColumnId}>
        <SelectTrigger className="h-9 w-auto min-w-30 rounded-sm border-0 bg-[#091e420f] px-3 text-[14px] font-semibold text-[#172b4d] shadow-none hover:bg-[#091e421a] focus:ring-0 transition-colors">
          <SelectValue placeholder="Chọn cột" />
        </SelectTrigger>
        <SelectContent className="rounded-sm border-border/50 shadow-xl">
          {columns.map((column) => {
            const value = resolveTaskColumnId(column);
            return (
              <SelectItem key={value} value={value} className="py-2.5">
                {column.title}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>

      <div className="flex items-center gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-10 rounded-sm text-[#44546f] hover:bg-[#091e420f]"
            >
              <MoreHorizontal className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 rounded-sm border-border/50 shadow-xl p-1.5">
            {onDuplicate && (
              <DropdownMenuItem onClick={onDuplicate} className="rounded-sm py-2.5">
                <Copy className="mr-3 h-4 w-4 opacity-70" />
                <span>Duplicate</span>
              </DropdownMenuItem>
            )}
            {currentUserId && onJoin && onLeave ? (
              <DropdownMenuItem
                onClick={isCurrentUserAssignee ? onLeave : onJoin}
                className="rounded-sm py-2.5"
              >
                {isCurrentUserAssignee ? (
                  <UserMinus className="mr-3 h-4 w-4 opacity-70" />
                ) : (
                  <UserPlus className="mr-3 h-4 w-4 opacity-70" />
                )}
                <span>{isCurrentUserAssignee ? "Leave" : "Join"}</span>
              </DropdownMenuItem>
            ) : null}
            {onDelete && (
              <DropdownMenuItem
                onClick={onDelete}
                className="text-destructive focus:text-destructive focus:bg-destructive/5 rounded-sm py-2.5"
              >
                <Trash2 className="mr-3 h-4 w-4 opacity-70" />
                <span>Delete</span>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="ghost"
          size="icon"
          className="size-10 rounded-sm text-[#44546f] hover:bg-[#091e420f]"
          onClick={onClose}
        >
          <X className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
