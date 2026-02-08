import { Plus, MoreHorizontal } from "lucide-react";
import { Button } from "~/components/ui/button";

export type Column = {
  id: string;
  title: string;
  isDefault: boolean;
  accentColor?: string;
};

export const DEFAULT_COLUMNS = [
  { id: "backlog", title: "Backlog", isDefault: true, accentColor: "#6B7280" },
  { id: "todo", title: "To do", isDefault: true, accentColor: "#3B82F6" },
  { id: "doing", title: "Doing", isDefault: true, accentColor: "#F59E0B" },
  { id: "done", title: "Done", isDefault: true, accentColor: "#10B981" },
] satisfies Column[];

type ColumnTemplateProps = {
  title: string;
  count: number;
  onAdd: () => void;
  color?: string;
};

export default function ColumnTemplate({
  title,
  count,
  onAdd,
  color = "#6B7280",
}: ColumnTemplateProps) {
  return (
    <div 
      className="flex w-full items-center justify-between px-3 py-2.5 rounded-t-md"
      style={{ 
        backgroundColor: `${color}08`,
        borderBottom: `2px solid ${color}20`
      }}
    >
      <div className="flex items-center gap-2.5">
        {/* Color indicator */}
        <div
          className="w-1 h-5 rounded-full"
          style={{ backgroundColor: color }}
        />
        
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        
        {/* Count badge */}
        <span
          className="inline-flex h-5 min-w-5 items-center justify-center rounded px-1.5 text-[11px] font-medium"
          style={{
            backgroundColor: `${color}18`,
            color: color,
          }}
        >
          {count}
        </span>
      </div>

      <div className="flex items-center gap-1">
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

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          aria-label="More column actions"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
