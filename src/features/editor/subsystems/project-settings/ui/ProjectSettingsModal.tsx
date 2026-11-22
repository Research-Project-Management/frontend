'use client';

/**
 * ProjectSettingsModal.tsx / OverleafMenuDrawer
 *
 * Authentic 1:1 Overleaf Menu Drawer (UI Shell Layer).
 * Location: `features/editor/subsystems/project-settings/ui/ProjectSettingsModal.tsx`
 */

import React from 'react';
import {
  X,
  Archive,
  FileArchive,
  FileDown,
  Copy,
  Calculator,
  Loader2,
  ArrowLeft,
  BookOpen,
  SpellCheck,
  ChevronRight,
  Sliders,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from '@/shared/components/ui/sheet';
import { Button } from '@/shared/components/ui/button';
import { GitHubIcon } from '@/shared/components/icons/IntegrationIcons';
import { EDITOR_FONT_FAMILIES, EDITOR_FONT_SIZES } from './settings-common';
import { ProjectGithubTab } from './ProjectGithubTab';
import { ProjectReferencesTab } from './ProjectReferencesTab';
import { ProjectDictionaryTab } from './ProjectDictionaryTab';
import { ProjectCompilerSection } from './ProjectCompilerSection';
import { ProjectGitSmartHttpCard } from './ProjectGitSmartHttpCard';
import { useProjectMenuActions } from './hooks/useProjectMenuActions';

export { EDITOR_FONT_FAMILIES, EDITOR_FONT_SIZES };

export function ProjectSettingsModal() {
  const m = useProjectMenuActions();

  return (
    <Sheet open={m.settingsPanelOpen} onOpenChange={m.setSettingsPanelOpen}>
      <SheetContent
        side="left"
        showCloseButton={false}
        className="w-full sm:w-[420px] max-w-[420px] p-0 flex flex-col bg-sidebar border-r border-border text-foreground select-none overflow-hidden z-50 shadow-overlay"
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-sidebar shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            {m.currentView !== 'menu' && (
              <button
                type="button"
                onClick={() => {
                  m.setCurrentView('menu');
                  m.setSettingsActiveTab('editor');
                }}
                aria-label="Back to Menu"
                className="size-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer relative after:absolute after:-inset-1.5 after:content-['']"
              >
                <ArrowLeft className="size-4 shrink-0" />
              </button>
            )}
            <div className="min-w-0">
              <SheetTitle className="text-base font-semibold tracking-tight text-foreground leading-tight flex items-center gap-1.5">
                {m.currentView === 'menu' && 'Menu'}
                {m.currentView === 'github' && 'GitHub Sync'}
                {m.currentView === 'references' && 'Reference Integrations'}
                {m.currentView === 'dictionary' && 'Personal Dictionary'}
              </SheetTitle>
              <SheetDescription className="text-xs text-muted-foreground truncate max-w-[260px]">
                {m.currentView === 'menu' ? m.projectTitle : 'Configure settings & integrations'}
              </SheetDescription>
            </div>
          </div>

          <button
            type="button"
            onClick={() => m.setSettingsPanelOpen(false)}
            aria-label="Close menu"
            className="size-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-border relative after:absolute after:-inset-1.5 after:content-['']"
          >
            <X className="size-4 shrink-0" />
          </button>
        </div>

        {m.currentView === 'github' && (
          <div className="flex-1 min-h-0 overflow-y-auto p-5">
            <ProjectGithubTab projectId={m.effectiveProjectId} projectTitle={m.projectTitle} />
          </div>
        )}

        {m.currentView === 'references' && (
          <div className="flex-1 min-h-0 overflow-y-auto p-5">
            <ProjectReferencesTab projectId={m.effectiveProjectId} bibFiles={m.bibFiles} />
          </div>
        )}

        {m.currentView === 'dictionary' && <ProjectDictionaryTab projectId={m.effectiveProjectId} />}

        {m.currentView === 'menu' && (
          <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-6 text-foreground">
            <section aria-labelledby="menu-download-heading">
              <h3
                id="menu-download-heading"
                className="text-[11px] font-semibold text-muted-foreground px-1 mb-2.5"
              >
                Download
              </h3>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={m.handleDownloadZip}
                  disabled={m.isExporting}
                  aria-label="Download Source (.zip)"
                  className="flex flex-col items-center justify-center p-2.5 rounded-md border border-border bg-card/50 hover:bg-muted/70 hover:border-foreground/30 transition-colors cursor-pointer group text-center"
                >
                  <div className="size-7 rounded-md bg-muted text-foreground flex items-center justify-center mb-1">
                    {m.isExporting ? <Loader2 className="size-3.5 animate-spin" /> : <Archive className="size-3.5" />}
                  </div>
                  <span className="text-xs font-medium text-foreground">Source</span>
                  <span className="text-[10px] text-muted-foreground mt-0.5">.zip archive</span>
                </button>

                <button
                  type="button"
                  onClick={m.handleDownloadArxiv}
                  disabled={m.isExporting}
                  aria-label="Download arXiv submission (.zip)"
                  className="flex flex-col items-center justify-center p-2.5 rounded-md border border-border bg-card/50 hover:bg-muted/70 hover:border-foreground/30 transition-colors cursor-pointer group text-center"
                >
                  <div className="size-7 rounded-md bg-muted text-foreground flex items-center justify-center mb-1">
                    {m.isExporting ? <Loader2 className="size-3.5 animate-spin" /> : <FileArchive className="size-3.5" />}
                  </div>
                  <span className="text-xs font-medium text-foreground">arXiv</span>
                  <span className="text-[10px] text-muted-foreground mt-0.5">Submission .zip</span>
                </button>

                <button
                  type="button"
                  onClick={m.handleDownloadPdf}
                  aria-label="Download PDF"
                  className="flex flex-col items-center justify-center p-2.5 rounded-md border border-border bg-card/50 hover:bg-muted/70 hover:border-foreground/30 transition-colors cursor-pointer group text-center"
                >
                  <div className="size-7 rounded-md bg-muted text-foreground flex items-center justify-center mb-1">
                    <FileDown className="size-3.5" />
                  </div>
                  <span className="text-xs font-medium text-foreground">PDF</span>
                  <span className="text-[10px] text-muted-foreground mt-0.5">Compiled output</span>
                </button>
              </div>
            </section>

            <section aria-labelledby="menu-sync-heading" className="space-y-2">
              <h3
                id="menu-sync-heading"
                className="text-[11px] font-semibold text-muted-foreground px-1 mb-2.5"
              >
                Sync
              </h3>

              <div className="flex items-center justify-between p-2.5 rounded-md border border-border bg-card/40 hover:bg-card transition-colors">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="size-7 rounded-md bg-foreground/5 flex items-center justify-center shrink-0">
                    <GitHubIcon className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-medium text-foreground truncate">
                        {m.effectiveGithubLink?.repoFullName || 'GitHub'}
                      </p>
                      {m.effectiveGithubLink?.branch && (
                        <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.2 rounded">
                          {m.effectiveGithubLink.branch}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {m.effectiveGithubLink
                        ? m.effectiveGithubLink.lastSyncedAt
                          ? `Last synced: ${new Date(m.effectiveGithubLink.lastSyncedAt).toLocaleString()}`
                          : 'Linked & ready to sync'
                        : 'Sync repository & commits'}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => m.setCurrentView('github')}
                  className="h-7 text-xs px-2.5 cursor-pointer shrink-0"
                >
                  {m.effectiveGithubLink ? 'Manage' : 'Configure'}
                </Button>
              </div>

              <ProjectGitSmartHttpCard
                projectId={m.effectiveProjectId}
                open={m.settingsPanelOpen}
              />
            </section>

            <section aria-labelledby="menu-wordcount-heading" className="space-y-2">
              <h3
                id="menu-wordcount-heading"
                className="text-[11px] font-semibold text-muted-foreground px-1 mb-2.5"
              >
                Page Functions
              </h3>

              <button
                type="button"
                onClick={m.handleMakeCopy}
                disabled={m.isCopyingPage}
                aria-label="Copy Page"
                className="w-full flex items-center justify-between p-2.5 rounded-md border border-border bg-card/40 hover:bg-card hover:border-foreground/30 transition-colors text-left cursor-pointer group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="size-7 rounded-md bg-muted text-foreground flex items-center justify-center shrink-0">
                    {m.isCopyingPage ? <Loader2 className="size-4 animate-spin" /> : <Copy className="size-4" />}
                  </div>
                  <div>
                    <p className="text-xs font-medium text-foreground">Copy Page</p>
                    <p className="text-[11px] text-muted-foreground">Duplicate this manuscript page and its files</p>
                  </div>
                </div>
                <span className="text-xs text-primary font-medium group-hover:underline">
                  {m.isCopyingPage ? 'Copying...' : 'Duplicate â†’'}
                </span>
              </button>

              <button
                type="button"
                onClick={m.handleSaveAsTemplate}
                disabled={m.isSavingTemplate}
                aria-label="Save as Template"
                className="w-full flex items-center justify-between p-2.5 rounded-md border border-border bg-card/40 hover:bg-card hover:border-foreground/30 transition-colors text-left cursor-pointer group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="size-7 rounded-md bg-muted text-foreground flex items-center justify-center shrink-0">
                    {m.isSavingTemplate ? <Loader2 className="size-4 animate-spin" /> : <BookOpen className="size-4" />}
                  </div>
                  <div>
                    <p className="text-xs font-medium text-foreground">Save as Template</p>
                    <p className="text-[11px] text-muted-foreground">Publish to reusable custom templates</p>
                  </div>
                </div>
                <span className="text-xs text-primary font-medium group-hover:underline">
                  {m.isSavingTemplate ? 'Saving...' : 'Save â†’'}
                </span>
              </button>

              <button
                type="button"
                onClick={m.handleOpenWordCount}
                aria-label="Run Word Count"
                className="w-full flex items-center justify-between p-2.5 rounded-md border border-border bg-card/40 hover:bg-card hover:border-foreground/30 transition-colors text-left cursor-pointer group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="size-7 rounded-md bg-muted text-foreground flex items-center justify-center shrink-0">
                    <Calculator className="size-4" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-foreground">Word Count</p>
                    <p className="text-[11px] text-muted-foreground">Count words & headers with TeXcount</p>
                  </div>
                </div>
                <span className="text-xs text-primary font-medium group-hover:underline">
                  Analyze â†’
                </span>
              </button>
            </section>

            <ProjectCompilerSection
              texFiles={m.texFiles}
              bibFiles={m.bibFiles}
              onMainFileChange={m.handleMainFileChange}
              onClearCache={m.handleClearCache}
              isClearingCache={m.isClearingCache}
            />

            <section aria-labelledby="menu-tools-heading" className="space-y-2 pt-2 border-t border-border">
              <h3
                id="menu-tools-heading"
                className="text-[11px] font-semibold text-muted-foreground px-1 mb-2.5"
              >
                Integrations & Tools
              </h3>

              <button
                type="button"
                onClick={() => m.setCurrentView('references')}
                className="w-full flex items-center justify-between p-2.5 rounded-md border border-border bg-card/40 hover:bg-card transition-colors text-left cursor-pointer group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="size-7 rounded-md bg-muted text-foreground flex items-center justify-center shrink-0">
                    <BookOpen className="size-4" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-foreground">References</p>
                    <p className="text-[11px] text-muted-foreground">Zotero & Mendeley bibliography sync</p>
                  </div>
                </div>
                <ChevronRight className="size-4 text-muted-foreground" />
              </button>

              <button
                type="button"
                onClick={() => m.setCurrentView('dictionary')}
                className="w-full flex items-center justify-between p-2.5 rounded-md border border-border bg-card/40 hover:bg-card transition-colors text-left cursor-pointer group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="size-7 rounded-md bg-muted text-foreground flex items-center justify-center shrink-0">
                    <SpellCheck className="size-4" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-foreground">Personal Dictionary</p>
                    <p className="text-[11px] text-muted-foreground">Manage learned spellcheck words</p>
                  </div>
                </div>
                <ChevronRight className="size-4 text-muted-foreground" />
              </button>

              <button
                type="button"
                onClick={m.handleOpenShortcuts}
                className="w-full flex items-center justify-between p-2.5 rounded-md border border-border bg-card/40 hover:bg-card transition-colors text-left cursor-pointer group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="size-7 rounded-md bg-muted text-foreground flex items-center justify-center shrink-0">
                    <Sliders className="size-4" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-foreground">Keyboard Shortcuts</p>
                    <p className="text-[11px] text-muted-foreground">Hotkey cheat sheet & keybindings</p>
                  </div>
                </div>
                <ChevronRight className="size-4 text-muted-foreground" />
              </button>
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export default ProjectSettingsModal;
