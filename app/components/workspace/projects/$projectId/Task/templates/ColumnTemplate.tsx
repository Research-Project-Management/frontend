import { Plus, MoreHorizontal, Trash2, Pencil } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";

type ColumnTemplateProps = {
  title: string;
  count: number;
  canManage?: boolean;
  onAdd: () => void;
  onDelete?: () => void;
  onUpdate?: () => void;
  color?: string;
};

export default function ColumnTemplate({
  title,
  count,
  canManage = false,
  onAdd,
  onDelete,
  onUpdate,
  color = "#6B7280",
}: ColumnTemplateProps) {
  return (
    <div 
      className="flex w-full items-center justify-between px-3 py-2.5 rounded-t-md relative"
      style={{ 
        backgroundColor: `${color}08`,
        borderBottom: `2px solid ${color}20`
      }}
    >
      <div className="flex items-center gap-2.5 flex-1 min-w-0">
        {/* Color indicator */}
        <div
          className="w-1 h-5 rounded-full shrink-0"
          style={{ backgroundColor: color }}
        />
        
        <h3 
          className="text-sm font-semibold text-foreground truncate cursor-pointer hover:text-primary transition-colors"
          onClick={() => canManage && onUpdate?.()}
        >
          {title}
        </h3>
        
        {/* Count badge */}
        <span
          className="inline-flex h-5 min-w-5 items-center justify-center rounded px-1.5 text-[11px] font-medium shrink-0"
          style={{
            backgroundColor: `${color}18`,
            color: color,
          }}
        >
          {count}
        </span>
      </div>

      <div className="flex items-center gap-1 shrink-0 ml-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          onClick={onAdd}
          aria-label="Add card"
        >
          <Plus className="h-4 w-4" />
        </Button>

        {canManage ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                aria-label="More column actions"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => onUpdate?.()}>
                <Pencil className="mr-2 h-4 w-4" />
                Rename column
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => onDelete?.()}
                className="text-destructive focus:text-destructive focus:bg-destructive/10"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete column
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </div>
  );
}
