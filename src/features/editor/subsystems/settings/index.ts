/**
 * subsystems/settings/index.ts
 *
 * Settings Subsystem Public Seam & Entry Point (Matt Pocock Deep Module).
 *
 * Responsibilities:
 * - Editor & Compiler Settings Modal (`SettingsModal`, `CompilerEditorSection`, `useSettingsModal`).
 * - Page-scoped GitHub Repository Sync (`GithubTab`, `useGithubSync` — Personal & Project Spaces).
 * - Git Smart-HTTP Clone & Personal Access Token Management (`GitCloneCard`, `useGitClone`).
 */

export { SettingsModal } from './ui/SettingsModal';
export {
  CompilerEditorSection,
  type CompilerEditorSectionProps,
} from './ui/CompilerEditorSection';
export { GithubTab } from './ui/GithubTab';
export { GitCloneCard, type GitCloneCardProps } from './ui/GitCloneCard';
export { useSettingsModal, type SettingsView } from './hooks/useSettingsModal';
export { useGithubSync, type UseGithubSyncOptions } from './hooks/useGithubSync';
export { useGitClone, type UseGitCloneParams } from './hooks/useGitClone';
