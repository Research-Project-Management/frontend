import { useState, useCallback, useMemo } from "react";
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
import { Settings2, GripVertical, RotateCcw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Switch } from "~/components/ui/switch";
import ChatAi from "./Sections/ChatAi";
import Recent from "./Sections/Recent";
import ShortCut from "./Sections/ShortCut";
import Activity from "./Sections/Activity";
import Stickies from "./Sections/Stickies";
import { useUserStore } from "~/stores/user";
import { format } from "date-fns";

// ─── Section registry ───────────────────────────────────────────────────────

const SECTION_REGISTRY = [
  {
    id: "chat-ai" as const,
    label: "Ask AI",
    description: "AI assistant prompt",
    component: ChatAi,
  },
  {
    id: "shortcut" as const,
    label: "Shortcuts",
    description: "Quick access links",
    component: ShortCut,
  },
  {
    id: "stickies" as const,
    label: "Stickies",
    description: "Recent sticky notes",
    component: Stickies,
  },
  {
    id: "recent" as const,
    label: "Recent",
    description: "Recently visited items",
    component: Recent,
  },
  {
    id: "activity" as const,
    label: "Activity",
    description: "Team activity feed",
    component: Activity,
  },
];

type SectionId = (typeof SECTION_REGISTRY)[number]["id"];
interface SectionConfig {
  id: SectionId;
  visible: boolean;
}

const STORAGE_KEY = "flux-dashboard-sections";
const defaultConfig = (): SectionConfig[] =>
  SECTION_REGISTRY.map((s) => ({ id: s.id, visible: true }));

function loadConfig(): SectionConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultConfig();
    const parsed: SectionConfig[] = JSON.parse(raw);
    const ids = parsed.map((c) => c.id);
    const merged = [...parsed];
    for (const def of SECTION_REGISTRY) {
      if (!ids.includes(def.id)) merged.push({ id: def.id, visible: true });
    }
    return merged.filter((c) =>
      SECTION_REGISTRY.some((d) => d.id === c.id),
    ) as SectionConfig[];
  } catch {
    return defaultConfig();
  }
}

function saveConfig(config: SectionConfig[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

// ─── Sortable settings row ───────────────────────────────────────────────────

function SortableItem({
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
        opacity: isDragging ? 0 : 1,
      }}
      className="flex items-center gap-3 px-3 py-2.5 bg-secondary/40 hover:bg-secondary/70
                 rounded-lg border border-border/40 transition-colors"
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab text-muted-foreground/50 hover:text-muted-foreground shrink-0"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-tight">{config.label}</p>
        <p className="text-xs text-muted-foreground truncate">
          {config.description}
        </p>
      </div>
      <Switch
        checked={config.visible}
        onCheckedChange={onToggle}
        className="shrink-0"
      />
    </div>
  );
}

// ─── Main dashboard ──────────────────────────────────────────────────────────

export default function HomeDashboard() {
  const user = useUserStore((s) => s.user);
  const [config, setConfig] = useState<SectionConfig[]>(loadConfig);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setConfig((prev) => {
      const oldIdx = prev.findIndex((c) => c.id === active.id);
      const newIdx = prev.findIndex((c) => c.id === over.id);
      const next = arrayMove(prev, oldIdx, newIdx);
      saveConfig(next);
      return next;
    });
  }, []);

  const toggleVisible = useCallback((id: SectionId) => {
    setConfig((prev) => {
      const next = prev.map((c) =>
        c.id === id ? { ...c, visible: !c.visible } : c,
      );
      saveConfig(next);
      return next;
    });
  }, []);

  const resetConfig = useCallback(() => {
    const d = defaultConfig();
    saveConfig(d);
    setConfig(d);
  }, []);

  const visibleSections = useMemo(
    () =>
      config
        .filter((c) => c.visible)
        .map((c) => SECTION_REGISTRY.find((d) => d.id === c.id)!)
        .filter(Boolean),
    [config],
  );

  const enrichedConfig = useMemo(
    () =>
      config.map((c) => ({
        ...c,
        ...SECTION_REGISTRY.find((d) => d.id === c.id)!,
      })),
    [config],
  );

  const firstName = user?.name?.split(" ")[0];

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* ── Header ── */}
      <header className="flex items-center justify-between px-6 py-3 border-b shrink-0">
        <div>
          <p className="text-sm font-semibold leading-tight">Home</p>
          <p className="text-xs text-muted-foreground">
            {format(new Date(), "EEEE, MMMM d")}
          </p>
        </div>

        <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
            >
              <Settings2 className="h-4 w-4" />
            </Button>
          </DialogTrigger>

          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <div className="flex items-center justify-between pr-6">
                <DialogTitle className="text-base">
                  Dashboard Layout
                </DialogTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetConfig}
                  className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  <RotateCcw className="h-3 w-3" />
                  Reset
                </Button>
              </div>
              <p className="text-xs text-muted-foreground pt-0.5">
                Drag to reorder • toggle to show/hide sections
              </p>
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
                <div className="flex flex-col gap-1.5 mt-1">
                  {enrichedConfig.map((c) => (
                    <SortableItem
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
      </header>

      {/* ── Content ── */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-6 flex flex-col gap-10">
          {visibleSections.map(({ id, component: Comp }) => (
            <Comp key={id} />
          ))}
        </div>
      </main>
    </div>
  );
}
