import { useState, useCallback, useMemo } from "react";
import { cn } from "~/lib/utils";
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
import { Shapes, GripVertical, RotateCcw, Home } from "lucide-react";
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
import useAuth from "~/hooks/useAuth";
import { Skeleton } from "~/components/ui/skeleton";

// ─── Section registry ───────────────────────────────────────────────────────

const SECTION_REGISTRY = [
  {
    id: "chat-ai" as const,
    label: "Ask Flux AI",
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
        opacity: isDragging ? 0.5 : 1,
      }}
      className={cn(
        "flex items-center gap-4 py-2.5 px-2 rounded-sm transition-all duration-200 hover:bg-muted/40 group",
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
        <p className="text-[14px] font-medium text-foreground/90 group-hover:text-foreground transition-colors">{config.label}</p>
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
  const { user: fetchedUser, isLoading: isUserLoading } = useAuth();
  const fullName = fetchedUser?.name;
  const now = new Date();
  const hour = now.getHours();

  const greeting = useMemo(() => {
    if (hour >= 5 && hour < 11) return { text: "Good morning", icon: "☀️" };
    if (hour >= 11 && hour < 13) return { text: "Good noon", icon: "☀️" };
    if (hour >= 13 && hour < 18) return { text: "Good afternoon", icon: "☀️" };
    if (hour >= 18 && hour < 22) return { text: "Good evening", icon: "🌙" };
    return { text: "Good night", icon: "🌙" };
  }, [hour]);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* ── Header ── */}
      <header className="flex items-center justify-between px-4 h-13 border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-10 shrink-0">
        <div className="flex items-center gap-2.5">
          <Home className="size-4.5 text-primary" />
          <h1 className="text-sm font-semibold text-foreground transition-all duration-200">
            Home
          </h1>
        </div>

        <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-2 rounded-sm border-border/50 bg-background px-3 text-[13px] font-medium text-foreground/70 transition-all hover:bg-secondary/40 hover:text-foreground"
            >
              <Shapes className="size-4 text-foreground/60" />
              <span>Manage widgets</span>
            </Button>
          </DialogTrigger>

          <DialogContent className="sm:max-w-[400px] border-none p-7" showCloseButton={false}>
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
        <div className="max-w-5xl mx-auto px-6 py-10 flex flex-col gap-10">
          {/* Greeting Section */}
          <div className="flex flex-col items-center justify-center text-center space-y-1 mt-4 mb-2">
            {isUserLoading ? (
              <div className="flex flex-col items-center gap-2">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-4 w-32" />
              </div>
            ) : (
              <>
                <h2 className="text-2xl font-bold tracking-tight text-foreground">
                  {greeting.text}{fullName ? `, ${fullName}` : ""}
                </h2>
                <div className="flex items-center gap-2 text-sm text-muted-foreground/80 font-medium">
                  <span className="text-lg">
                    {greeting.icon}
                  </span>
                  <span>{format(now, "EEEE, MMM d HH:mm")}</span>
                </div>
              </>
            )}
          </div>

          {visibleSections.map(({ id, component: Comp }) => (
            <Comp key={id} />
          ))}
        </div>
      </main>
    </div>
  );
}
