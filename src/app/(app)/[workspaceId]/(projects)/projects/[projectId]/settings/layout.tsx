'use client';

import { useParams, usePathname } from 'next/navigation';

import Link from "next/link";
import { useProjects } from '@/features/workspaces';
import { Settings } from "lucide-react";
import { Topbar } from "@/features/projects";
import { motion, LayoutGroup, AnimatePresence } from "framer-motion";

export default function ProjectSettingLayout({ children }: { children?: React.ReactNode }) {
  const { workspaceId, projectId } = useParams();
  const pathname = usePathname();
  const { projects } = useProjects();
  const currentProject = projects?.find((p: { _id: string | undefined; url?: string }) => p._id === projectId || (p as any).url === projectId);
  const basePath = `/${workspaceId}/projects/${projectId}/settings`;

  const tabs = [
    { label: "General", to: basePath },
    { label: "Team", to: `${basePath}/team` },
    { label: "Modules", to: `${basePath}/modules` },
  ];

  const activeTab = tabs.find((tab) => {
    if (tab.to === basePath) return pathname === basePath;
    return pathname.startsWith(tab.to);
  }) || tabs[0];

  return (
    <div className="flex-1 min-w-0 flex flex-col h-full bg-background overflow-hidden relative">
      <Topbar
        project={currentProject ? { name: currentProject.name, avatar: currentProject.avatar } : undefined}
        title="Settings"
        Icon={Settings}
        centerContent={
          <LayoutGroup id="project-settings-tabs">
            <nav className="flex h-13 max-w-full items-stretch overflow-visible justify-center">
              {tabs.map((tab) => {
                const isActive = activeTab.to === tab.to;

                return (
                  <Link
                    key={tab.to}
                    href={tab.to}
                    className={`relative flex h-full min-w-[110px] items-center justify-center px-4 text-center text-sm font-medium whitespace-nowrap transition-colors ${
                      isActive
                        ? "text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <span className="relative z-10">{tab.label}</span>
                    {isActive ? (
                      <motion.div
                        layoutId="activeTabUnderline"
                        className="absolute -bottom-[1px] inset-x-0 h-[3px] bg-foreground z-20 rounded-t-sm"
                        transition={{ type: "spring", stiffness: 500, damping: 35 }}
                      />
                    ) : null}
                  </Link>
                );
              })}
            </nav>
          </LayoutGroup>
        }
      />

      <div className="flex-1 min-h-0 overflow-y-auto w-full relative">
        <div className="h-full bg-background">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={pathname}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="h-full w-full"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

