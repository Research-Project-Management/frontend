import { useCallback } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Switch,
} from "@/shared/components/ui";

import type { SectionConfig, SectionId } from "../../schemas/home.schema";

function SortableRow({
  config,
  onToggle,
}: {
  config: SectionConfig & { label: string; description: string };
  onToggle: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: config.id,
  });
  
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      className={cn(
        "flex items-center gap-4 py-2.5 px-2 rounded-sm transition-colors duration-200 hover:bg-muted/40 group",
        isDragging && "bg-muted/60 shadow-sm"
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab text-muted-foreground/20 hover:text-muted-foreground shrink-0 transition-colors"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground/90 group-hover:text-foreground transition-colors">{config.label}</p>
      </div>
      <Switch
        checked={config.visible}
        onCheckedChange={onToggle}
        className="shrink-0"
      />
    </div>
  );
}

export function ManageWidgetsModal({
  open,
  onOpenChange,
  config,
  setConfig,
  enrichedConfig,
  saveConfig,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: SectionConfig[];
  setConfig: React.Dispatch<React.SetStateAction<SectionConfig[]>>;
  enrichedConfig: (SectionConfig & { label: string; description: string })[];
  saveConfig: (config: SectionConfig[]) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      setConfig((prev) => {
        const oldIdx = prev.findIndex((c) => c.id === active.id);
        const newIdx = prev.findIndex((c) => c.id === over.id);
        const next = arrayMove(prev, oldIdx, newIdx);
        saveConfig(next);
        return next;
      });
    },
    [setConfig, saveConfig],
  );

  const toggleVisible = useCallback(
    (id: SectionId) => {
      setConfig((prev) => {
        const next = prev.map((c) =>
          c.id === id ? { ...c, visible: !c.visible } : c,
        );
        saveConfig(next);
        return next;
      });
    },
    [setConfig, saveConfig],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onCloseAutoFocus={(e) => e.preventDefault()}
        className="sm:max-w-[400px] bg-popover border border-border shadow-2xl rounded-lg p-6"
        showCloseButton={false}
      >
        <DialogHeader className="mb-4">
          <DialogTitle className="text-xl font-bold text-foreground">
            Manage widgets
          </DialogTitle>
        </DialogHeader>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={config.map((c) => c.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="flex flex-col">
              {enrichedConfig.map((c) => (
                <SortableRow
                  key={c.id}
                  config={c}
                  onToggle={() => toggleVisible(c.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </DialogContent>
    </Dialog>
  );
}
