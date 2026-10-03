'use client';

import { useState, useMemo, useEffect } from "react";
import dynamic from "next/dynamic";
import { format } from "date-fns";

import { useAuth } from '@/features/auth/hooks/use-auth';
import { Skeleton } from "@/shared/components/ui/skeleton";
import { fixMojibake } from "@/shared/lib/utils";
import { ChatAi, Recent, Quicklinks } from "../components";
import { Section } from "../components/layouts/section";
import { Topbar } from "../components/layouts/topbar";
import { Shapes } from "lucide-react";

const Stickies = dynamic(() => import("../components/Stickies"), {
  ssr: false,
  loading: () => <div className="h-32 w-full rounded-lg bg-muted/30 animate-pulse" />,
});

const ManageWidgetsModal = dynamic(
  () =>
    import("../components/modals/manage-widgets-modal").then(
      (m) => m.ManageWidgetsModal
    ),
  { ssr: false }
);

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
    component: Stickies,
  },
];

import {
  loadSectionConfig,
  saveSectionConfig,
  defaultSectionConfig,
  getGreeting,
  type SectionConfig,
} from '../utils/home-page.util';

// ─── Main dashboard ──────────────────────────────────────────────────────────

export default function HomePage() {
  const { user, isLoading: isUserLoading } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [config, setConfig] = useState<SectionConfig[]>(defaultSectionConfig);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    setConfig(loadSectionConfig());
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

  const fullName = fixMojibake(user?.name);
  const greeting = useMemo(() => getGreeting(), []);
  const now = useMemo(() => new Date(), []);

  return (
    <div className="h-full flex flex-col overflow-clip">
      <Topbar onManageWidgetsClick={() => setSettingsOpen(true)} />
      
      {settingsOpen && (
        <ManageWidgetsModal
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          config={config}
          setConfig={setConfig}
          enrichedConfig={enrichedConfig}
          saveConfig={saveSectionConfig}
        />
      )}

      <main className="flex-1 overflow-y-auto no-scrollbar">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-10 flex flex-col gap-10">
          {/* Greeting Section */}
          <div className="flex flex-col items-center justify-center text-center space-y-2 mt-6 mb-8">
            {isUserLoading ? (
              <div className="flex flex-col items-center gap-3">
                <Skeleton className="h-10 w-64 rounded-full" />
                <Skeleton className="h-5 w-40 rounded-full" />
              </div>
            ) : (
              <>
                <h1 className="text-24 md:text-26 font-semibold tracking-tight text-foreground leading-tight">
                  {greeting.text}{fullName ? `, ${fullName}` : ""}
                </h1>
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mt-1.5" suppressHydrationWarning>
                  <span className="text-base">
                    {greeting.icon}
                  </span>
                  <span className="font-mono text-11 text-muted-foreground" suppressHydrationWarning>
                    {mounted ? format(now, "EEEE, MMMM do, h:mm a") : ""}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* AI Chat Block */}
          <Section title="AI Assistant">
            <ChatAi />
          </Section>

          {visibleSections.length > 0 ? (
            visibleSections.map(({ id, component: Comp }) => (
              <Comp key={id} />
            ))
          ) : mounted ? (
            <div className="flex flex-col items-center justify-center py-12 px-6 text-center mx-auto max-w-md">
              <div className="size-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-4">
                <Shapes className="size-5 shrink-0" />
              </div>
              <h3 className="text-base font-semibold text-foreground mb-1">
                It's Quiet Without Widgets
              </h3>
              <p className="text-13 text-foreground/75 max-w-[350px]">
                It looks like all your widgets are turned off. Enable them now to enhance your experience.
              </p>
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                className="mt-5 px-4 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary-hover text-13 font-medium transition-colors cursor-pointer shadow-none"
              >
                Enable Widgets
              </button>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
