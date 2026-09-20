import { StickiesIcon } from "@/shared/components/ui";

interface EmptyStateProps {
  searchQuery?: string;
}

const copy = {
  Icon: StickiesIcon,
  emptySearch: "No stickies match your search",
  empty: "No stickies yet",
  cta: 'Click "Add Sticky" to get started',
};

export default function EmptyState({ searchQuery }: EmptyStateProps = {}) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
      <div className="size-12 rounded-md bg-muted border border-border flex items-center justify-center">
        <copy.Icon className="size-6 text-muted-foreground/50 shrink-0" />
      </div>
      <p className="text-base font-semibold tracking-tight text-foreground">
        {searchQuery ? copy.emptySearch : copy.empty}
      </p>
      {!searchQuery && (
        <p className="text-xs text-muted-foreground">
          {copy.cta}
        </p>
      )}
    </div>
  );
}
