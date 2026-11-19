/**
 * src/features/editor/subsystems/project-settings/index.ts
 *
 * Project Settings Subsystem Public Seam (Matt Pocock Deep Module).
 *
 * Responsibilities:
 * - Project Settings Modal & Compiler Configuration Section.
 * - GitHub Two-Way Sync, References Integrations, and Custom Spelling Dictionary Tabs.
 * - Supporting Query/Mutation Hooks (useGithubSync, useSpellingDictionary).
 */

export { ProjectSettingsModal } from './ui/ProjectSettingsModal';
export {
  ProjectCompilerSection,
  type ProjectCompilerSectionProps,
} from './ui/ProjectCompilerSection';
export { ProjectGithubTab } from './ui/ProjectGithubTab';
export { ProjectReferencesTab } from './ui/ProjectReferencesTab';
export {
  ProjectDictionaryTab,
  type ProjectDictionaryTabProps,
} from './ui/ProjectDictionaryTab';
export {
  EDITOR_FONT_FAMILIES,
  EDITOR_FONT_SIZES,
  CodeIconBrackets,
  SettingsSwitch,
  SettingRow,
  type SettingsTab,
} from './ui/settings-common';
export {
  useGithubSync,
  githubSyncKeys,
  type UseGithubSyncOptions,
} from './hooks/useGithubSync';
export {
  useSpellingDictionary,
  spellingKeys,
} from './hooks/useSpelling';
