'use client';

/**
 * SettingsModal.tsx
 *
 * Centered modal for compiler, editor, and project integration settings.
 */

import React from 'react';
import { X, BookOpen, SpellCheck, Cpu, Code2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/shared/components/ui/dialog';
import { GitHubIcon } from '@/shared/components/icons/IntegrationIcons';
import { EDITOR_FONT_FAMILIES, EDITOR_FONT_SIZES } from './settings-common';
import { GithubTab } from './GithubTab';
import { ReferencesTab } from './ReferencesTab';
import { DictionaryTab } from './DictionaryTab';
import { CompilerEditorSection } from './CompilerEditorSection';
import { GitCloneCard } from './GitCloneCard';
import { useSettingsModal, type SettingsView } from './hooks/useSettingsModal';

export { EDITOR_FONT_FAMILIES, EDITOR_FONT_SIZES };

interface NavItem {
  id: SettingsView;
  label: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'compiler', label: 'Compiler', icon: <Cpu className="size-3.5 shrink-0" /> },
  { id: 'editor', label: 'Editor', icon: <Code2 className="size-3.5 shrink-0" /> },
  { id: 'github', label: 'GitHub', icon: <GitHubIcon className="size-3.5 shrink-0" /> },
  { id: 'references', label: 'References', icon: <BookOpen className="size-3.5 shrink-0" /> },
  { id: 'dictionary', label: 'Dictionary', icon: <SpellCheck className="size-3.5 shrink-0" /> },
];

export function SettingsModal() {
  const s = useSettingsModal();

  return (
    <Dialog open={s.open} onOpenChange={s.setOpen}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-[740px] h-[560px] max-h-[85vh] !flex flex-col p-0 gap-0 overflow-hidden rounded-xl border border-border bg-background text-foreground shadow-raised-200 font-sans select-none"
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border shrink-0">
          <div className="min-w-0">
            <DialogTitle className="text-[15px] font-semibold tracking-tight text-foreground leading-tight">
              Settings
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground truncate mt-0.5">
              {s.projectTitle}
            </DialogDescription>
          </div>

          <button
            type="button"
            onClick={() => s.setOpen(false)}
            aria-label="Close settings"
            className="size-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-border"
          >
            <X className="size-4 shrink-0" />
          </button>
        </div>

        <div className="flex-1 min-h-0 flex overflow-hidden">
          <nav
            aria-label="Settings sections"
            className="w-[176px] shrink-0 border-r border-border bg-muted/20 p-2 flex flex-col gap-0.5"
          >
            {NAV_ITEMS.map((item) => {
              const isActive = s.activeView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => s.selectView(item.id)}
                  className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-xs transition-colors cursor-pointer text-left ${
                    isActive
                      ? 'bg-muted text-foreground font-medium'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                >
                  {item.icon}
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>

          {s.activeView === 'dictionary' ? (
            <DictionaryTab projectId={s.projectId} />
          ) : (
            <div className="flex-1 min-h-0 overflow-y-scroll p-5">
              {s.activeView === 'compiler' && (
                <CompilerEditorSection
                  section="compiler"
                  texFiles={s.texFiles}
                  bibFiles={s.bibFiles}
                  onMainFileChange={s.handleMainFileChange}
                  onClearCache={s.handleClearCache}
                  isClearingCache={s.isClearingCache}
                />
              )}

              {s.activeView === 'editor' && (
                <CompilerEditorSection
                  section="editor"
                  texFiles={s.texFiles}
                  bibFiles={s.bibFiles}
                  onMainFileChange={s.handleMainFileChange}
                  onClearCache={s.handleClearCache}
                  isClearingCache={s.isClearingCache}
                />
              )}

              {s.activeView === 'github' && (
                <div className="space-y-4">
                  <GithubTab projectId={s.projectId} projectTitle={s.projectTitle} />
                  <GitCloneCard projectId={s.projectId} open={s.open} />
                </div>
              )}

              {s.activeView === 'references' && (
                <ReferencesTab projectId={s.projectId} bibFiles={s.bibFiles} />
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default SettingsModal;
