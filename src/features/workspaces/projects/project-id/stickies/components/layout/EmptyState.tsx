import { Layers2 } from "lucide-react";

interface EmptyStateProps {
  searchQuery: string;
}

const copy = {
  Icon: Layers2,
  emptyFiltered: "No stickies match your filters",
  empty: "No stickies yet",
  cta: 'Click "Add Sticky" to get started',
};

export default function EmptyState({ searchQuery }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
      <div className="w-14 h-14 rounded-2xl bg-secondary/60 flex items-center justify-center">
        <copy.Icon className="h-7 w-7 text-muted-foreground/30" />
      </div>
      <p className="text-xl font-semibold tracking-tight text-foreground/90 font-serif">
        {searchQuery ? copy.emptyFiltered : copy.empty}
      </p>
      {!searchQuery && (
        <p className="text-sm text-muted-foreground/60 mt-1">
          {copy.cta}
        </p>
      )}
    </div>
  );
}
