'use client';

/**
 * ProjectCompilerTab.tsx
 *
 * LaTeX compiler engine, TeX Live version, main entrypoint document and caching settings.
 * Location: `features/editor/ui/modals/project-settings/ProjectCompilerTab.tsx`
 */

import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Loader2, Trash2 } from 'lucide-react';
import {
  useSettingsStore,
  type CompilerEngine,
} from '@/features/editor/store';
import { SettingRow, OverleafSwitch } from './settings-common';

export interface ProjectCompilerTabProps {
  texFiles: string[];
  mainFile: string;
  onMainFileChange: (val: string) => void;
  onClearCache: () => void;
  isClearingCache: boolean;
}

export function ProjectCompilerTab({
  texFiles,
  mainFile,
  onMainFileChange,
  onClearCache,
  isClearingCache,
}: ProjectCompilerTabProps) {
  const engine = useSettingsStore((s) => s.engine);
  const setEngine = useSettingsStore((s) => s.setEngine);
  const texLiveVersion = useSettingsStore((s) => s.texLiveVersion || '2024');
  const setTexLiveVersion = useSettingsStore((s) => s.setTexLiveVersion);
  const autoCompile = useSettingsStore((s) => s.autoCompile);
  const setAutoCompile = useSettingsStore((s) => s.setAutoCompile);
  const compileMode = useSettingsStore((s) => s.compileMode);
  const setCompileMode = useSettingsStore((s) => s.setCompileMode);
  const stopOnFirstError = useSettingsStore((s) => s.stopOnFirstError);
  const setStopOnFirstError = useSettingsStore((s) => s.setStopOnFirstError);
  const useCache = useSettingsStore((s) => s.useCache);
  const setUseCache = useSettingsStore((s) => s.setUseCache);

  return (
    <div className="space-y-1">
      <SettingRow
        title="Compiler"
        description="Select which LaTeX engine compiles your project"
      >
        <Select
          value={engine}
          onValueChange={(val) => setEngine(val as CompilerEngine)}
        >
          <SelectTrigger
            aria-label="Compiler engine"
            className="w-36 h-8 text-xs font-medium cursor-pointer border-border bg-background"
          >
            <SelectValue placeholder="Engine" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pdflatex" className="cursor-pointer text-xs">
              pdfLaTeX
            </SelectItem>
            <SelectItem value="xelatex" className="cursor-pointer text-xs">
              XeLaTeX
            </SelectItem>
            <SelectItem value="lualatex" className="cursor-pointer text-xs">
              LuaLaTeX
            </SelectItem>
          </SelectContent>
        </Select>
      </SettingRow>

      <SettingRow
        title="TeX Live version"
        description="The version of TeX Live used to compile your project"
      >
        <Select
          value={texLiveVersion}
          onValueChange={setTexLiveVersion}
        >
          <SelectTrigger
            aria-label="TeX Live version"
            className="w-36 h-8 text-xs font-medium cursor-pointer border-border bg-background"
          >
            <SelectValue placeholder="Version" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="2024" className="cursor-pointer text-xs">
              2024
            </SelectItem>
            <SelectItem value="2023" className="cursor-pointer text-xs">
              2023
            </SelectItem>
            <SelectItem value="2022" className="cursor-pointer text-xs">
              2022
            </SelectItem>
            <SelectItem value="2021" className="cursor-pointer text-xs">
              2021
            </SelectItem>
          </SelectContent>
        </Select>
      </SettingRow>

      <SettingRow
        title="Main document"
        description="The entrypoint LaTeX document to compile"
      >
        <Select value={mainFile} onValueChange={onMainFileChange}>
          <SelectTrigger
            aria-label="Main document"
            className="w-44 h-8 text-xs font-medium cursor-pointer border-border bg-background"
          >
            <SelectValue placeholder="Main file" />
          </SelectTrigger>
          <SelectContent>
            {texFiles.map((file) => (
              <SelectItem key={file} value={file} className="cursor-pointer text-xs">
                {file}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingRow>

      <SettingRow
        title="Auto-compile"
        description="Automatically recompile when files change"
      >
        <OverleafSwitch
          checked={autoCompile}
          onCheckedChange={setAutoCompile}
          aria-label="Auto-compile"
        />
      </SettingRow>

      <SettingRow
        title="Fast [draft] compile"
        description="Draft mode compiles faster by skipping heavy figures and fonts"
      >
        <OverleafSwitch
          checked={compileMode === 'draft'}
          onCheckedChange={(v) => setCompileMode(v ? 'draft' : 'full')}
          aria-label="Fast [draft] compile"
        />
      </SettingRow>

      <SettingRow
        title="Stop on first error"
        description="Stop compilation immediately when the first LaTeX error occurs"
      >
        <OverleafSwitch
          checked={stopOnFirstError}
          onCheckedChange={setStopOnFirstError}
          aria-label="Stop on first error"
        />
      </SettingRow>

      <SettingRow
        title="Cache auxiliary files"
        description="Reuse previous build artifacts to accelerate re-compilation"
      >
        <OverleafSwitch
          checked={useCache}
          onCheckedChange={setUseCache}
          aria-label="Cache auxiliary files"
        />
      </SettingRow>

      <SettingRow
        title="Clear cached files"
        description="Delete auxiliary files (.aux, .bbl, .log) to resolve build errors and compile from scratch"
      >
        <button
          type="button"
          onClick={onClearCache}
          disabled={isClearingCache}
          className="h-8 px-3 rounded-md border border-border bg-background hover:bg-muted text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary disabled:opacity-50"
        >
          {isClearingCache ? (
            <Loader2 className="size-3.5 text-muted-foreground animate-spin motion-reduce:animate-none" />
          ) : (
            <Trash2 className="size-3.5 text-muted-foreground" />
          )}
          <span>{isClearingCache ? 'Clearing...' : 'Clear cached files'}</span>
        </button>
      </SettingRow>
    </div>
  );
}
