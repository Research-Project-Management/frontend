import { Search, Filter, Target } from "lucide-react";
import { Button } from "~/components/ui/button";

interface TopbarProps {
  workspaceName?: string;
  onAddCycle: () => void;
}

export function Topbar({ workspaceName = "xinchao", onAddCycle }: TopbarProps) {
  return (
    <div className="h-12 border-b border-border flex items-center justify-between px-4 shrink-0 bg-background/80 backdrop-blur-sm sticky top-0 z-10">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="hover:text-foreground cursor-pointer transition-colors">
          {workspaceName}
        </span>
        <span>&gt;</span>
        <div className="flex items-center gap-1.5 text-foreground font-medium">
          <Target className="size-4" />
          Cycles
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" className="size-8 p-0 hover:bg-accent/50 transition-colors">
          <Search className="size-4" />
        </Button>
        <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-3 hover:bg-accent/50 transition-colors">
          <Filter className="size-4" />
          <span className="text-xs font-medium">Filters</span>
        </Button>
        <Button 
          onClick={onAddCycle} 
          size="sm" 
          className="h-8 px-3 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md text-xs font-medium shadow-sm transition-all active:scale-95"
        >
          Add cycle
        </Button>
      </div>
    </div>
  );
}
