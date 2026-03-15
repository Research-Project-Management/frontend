import { Button } from "~/components/ui/button";

type DangerZoneProps = {
  onDelete: () => void;
};

export default function DangerZone({ onDelete }: DangerZoneProps) {
  return (
    <div className="rounded-lg border border-destructive/30 p-6">
      <div className="flex items-center justify-between gap-6">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-foreground">
            Delete this workspace
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
            This action is irreversible. All data, projects, pages, and member
            access will be permanently removed.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={onDelete}
          className="shrink-0 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
        >
          Delete
        </Button>
      </div>
    </div>
  );
}
