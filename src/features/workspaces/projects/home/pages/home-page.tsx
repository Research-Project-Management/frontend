'use client';

import { useState, useCallback, useMemo } from "react";
import { format } from "date-fns";
import { useParams, useRouter } from 'next/navigation';

import { useAuth } from '@/features/auth/hooks/use-auth';
import { useWorkspace } from '@/features/workspaces/shell/hooks/use-workspace';
import { Skeleton } from "@/shared/components/ui";
import ChatAi from "../components/chat-ai";

import Recent from "../components/recent";
import Quicklinks from "../components/quicklinks";
import Stickies from "../components/stickies";
import { Section } from "../components/layouts/section";
import { ManageWidgetsModal } from "../components/modals/manage-widgets-modal";
import { Topbar } from "../components/layouts/topbar";
import { Shapes, Home } from "lucide-react";

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

import {
  loadSectionConfig,
  saveSectionConfig,
  defaultSectionConfig,
  getGreeting,
  type SectionConfig,
  type SectionId,
} from '../utils/home-page.util';

// ─── Main dashboard ──────────────────────────────────────────────────────────

export default function HomePage() {
  const { workspaceId } = useParams() as { workspaceId: string };
  const { workspace } = useWorkspace(workspaceId);
  const router = useRouter();

  const { user, isLoading: isUserLoading } = useAuth();
  const [config, setConfig] = useState<SectionConfig[]>(loadSectionConfig);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const handleChatSend = useCallback((text: string, projectId?: string, webSearchSites?: string[]) => {
    const params = new URLSearchParams();
    params.set("q", text);
    if (projectId) params.set("project", projectId);
    // Since we don't handle webSearchSites explicitly in query params on ai page yet, we just pass the query.
    // If we wanted, we could encode them, but for now we follow the old behavior or ignore.
    router.push(`/${workspaceId}/ai/chat?${params.toString()}`);
  }, [router, workspaceId]);

  const resetConfig = useCallback(() => {
    const d = defaultSectionConfig();
    saveSectionConfig(d);
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
  const greeting = useMemo(() => getGreeting(), []);
  const now = useMemo(() => new Date(), []);

  return (
    <div className="h-full flex flex-col overflow-clip">
      <Topbar onManageWidgetsClick={() => setSettingsOpen(true)} />
      
      <ManageWidgetsModal
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        config={config}
        setConfig={setConfig}
        enrichedConfig={enrichedConfig}
        saveConfig={saveSectionConfig}
      />

      <main className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
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
                <h2 className="text-3xl font-serif font-bold tracking-tight text-foreground leading-tight">
                  {greeting.text}{fullName ? `, ${fullName}` : ""}
                </h2>
                <div className="flex items-center gap-2.5 text-sm font-semibold text-muted-foreground mt-1">
                  <span className="text-lg">
                    {greeting.icon}
                  </span>
                  <span>{format(now, "EEEE, MMMM do, h:mm a")}</span>
                </div>
              </>
            )}
          </div>

          {/* AI Chat Block */}
          <Section title="AI Assistant">
            <ChatAi onSend={handleChatSend} />
          </Section>

          {visibleSections.length > 0 ? (
            visibleSections.map(({ id, component: Comp }) => (
              <Comp key={id} />
            ))
          ) : (
            <div className="flex flex-col items-center justify-center p-12 text-center rounded-lg border-2 border-dashed border-border/60 bg-muted/10 mx-6 mb-6">
              <div className="size-14 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-5">
                <Shapes className="size-6" />
              </div>
              <h3 className="text-base font-semibold text-foreground mb-1">
                It's Quiet Without Widgets
              </h3>
              <p className="text-sm text-muted-foreground max-w-[350px]">
                It looks like all your widgets are turned off. Enable them now to enhance your experience.
              </p>
              <button
                onClick={() => setSettingsOpen(true)}
                className="mt-6 px-5 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium transition-colors shadow-none"
              >
                Enable Widgets
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
