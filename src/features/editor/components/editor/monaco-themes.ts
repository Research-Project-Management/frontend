/**
 * monaco-themes.ts
 *
 * Theme definitions preserved for workspace settings compatibility.
 * All live syntax highlighting and theming is now handled natively
 * by CodeMirror 6 (see codemirror/theme.ts).
 */

export interface MonacoThemeDefinition {
  id: string;
  name: string;
  type: 'light' | 'dark';
}

export const MONACO_THEMES: MonacoThemeDefinition[] = [
  { id: 'auto', name: 'Auto (Follow Workspace)', type: 'light' },
  { id: 'latex-light', name: 'Overleaf Light', type: 'light' },
  { id: 'latex-dark', name: 'Overleaf Dark', type: 'dark' },
  { id: 'dracula', name: 'Dracula', type: 'dark' },
  { id: 'monokai', name: 'Monokai', type: 'dark' },
  { id: 'solarized-light', name: 'Solarized Light', type: 'light' },
  { id: 'solarized-dark', name: 'Solarized Dark', type: 'dark' },
  { id: 'github-light', name: 'GitHub Light', type: 'light' },
  { id: 'github-dark', name: 'GitHub Dark', type: 'dark' },
  { id: 'cobalt', name: 'Cobalt', type: 'dark' },
  { id: 'eclipse', name: 'Eclipse', type: 'light' },
];

export function initializeMonacoThemes(): void {
  // No-op: CM6 handles styling natively via Compartments
}
