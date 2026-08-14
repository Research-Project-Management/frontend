'use client';

import { useState, useCallback, useMemo } from "react";
import { format } from "date-fns";
import { useParams } from 'next/navigation';

import { useAuth } from '@/features/auth';
import { useWorkspace } from '@/features/workspaces/shell/hooks/use-workspace';
import { Skeleton } from "@/shared/components/ui";

import Recent from "../components/recent";
import Quicklinks from "../components/quicklinks";
import Stickies from "../components/stickies";
import { Section } from "../components/layouts/section";
import { ManageWidgetsModal } from "../components/modals/manage-widgets-modal";
import { Topbar } from "../components/layouts/topbar";

// ─── Section registry ───────────────────────────────────────────────────────

const SECTION_REGISTRY = [
  {
    id: "quicklinks" as const,
    label: "Quicklinks",
    description: "Quick access links",
    component: Quicklinks,
  },
  {
    id: "recent" as const,
    label: "Recent",
    description: "Recently visited items",
    component: Recent,
  },
  {
    id: "stickies" as const,
    label: "Stickies",
    description: "Recent sticky notes",
    component: () => <Stickies />,
  },
];

type SectionId = (typeof SECTION_REGISTRY)[number]["id"];
interface SectionConfig {
  id: SectionId;
  visible: boolean;
}

const STORAGE_KEY = "flux-dashboard-sections-v2";
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

// ─── Main dashboard ──────────────────────────────────────────────────────────

export default function HomePage() {
  const { workspaceId } = useParams() as { workspaceId: string };
  const { workspace } = useWorkspace(workspaceId);

  const { user, isLoading: isUserLoading } = useAuth();
  const [config, setConfig] = useState<SectionConfig[]>(loadConfig);
  const [settingsOpen, setSettingsOpen] = useState(false);

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

  const fullName = user?.name;
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
      <Topbar onManageWidgetsClick={() => setSettingsOpen(true)} />
      
      <ManageWidgetsModal
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        config={config}
        setConfig={setConfig}
        enrichedConfig={enrichedConfig}
        saveConfig={saveConfig}
      />

      <main className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-10 flex flex-col gap-10">
          {/* Greeting Section */}
          <div className="flex flex-col items-center justify-center text-center space-y-1 mt-4 mb-2">
            {isUserLoading ? (
              <div className="flex flex-col items-center gap-2">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-4 w-32" />
              </div>
            ) : (
              <>
                <h2 className="text-3xl font-serif font-semibold tracking-tight text-foreground">
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
