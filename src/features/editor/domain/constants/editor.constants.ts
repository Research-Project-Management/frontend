/**
 * editor.constants.ts
 *
 * Canonical Centralized Registry for Editor Constants, Persistence Keys,
 * Channel Names, File Extensions, Timing Thresholds, Platform Detection,
 * and Shallow URL Synchronization.
 */

export const EDITOR_STORAGE_KEYS = {
  SETTINGS: 'flux-editor-settings',
  WORKBENCH_LAYOUT: 'flux_editor_workbench_layout',
  OFFLINE_DRAFTS_DB: 'flux_offline_drafts_v1',
  OFFLINE_MUTATIONS_QUEUE: 'flux_offline_mutations_v1',
  DRAFT_PREFIX: 'flux_draft:',
  EXPANDED_FOLDERS_PREFIX: 'flux:expanded-folders:',
} as const;

export const SYNCTEX_BROADCAST_CHANNEL = 'flux-synctex-bus';

export const DEFAULT_MAIN_FILE = 'main.tex';
export const DEFAULT_BIB_FILE = 'references.bib';

export const EDITOR_DOCS_URLS = {
  DOCUMENTATION_HOME:
    process.env.NEXT_PUBLIC_LATEX_DOCS_URL || 'https://latexref.xyz/dev/latex2e.html',
  LATEX_INTRO_GUIDE:
    process.env.NEXT_PUBLIC_LATEX_GUIDE_URL || 'https://en.wikibooks.org/wiki/LaTeX',
} as const;

export const EDITOR_TIMING = {
  DEFAULT_AUTOSAVE_DELAY_MS: 800,
  DEFAULT_AUTOCOMPILE_DELAY_MS: 1500,
  DEFAULT_BARRIER_TIMEOUT_MS: 1500,
  RETRY_BASE_DELAY_MS: 300,
} as const;

export const EDITOR_LIMITS = {
  MAX_FSM_CONTEXTS: 200,
  MAX_MEMORY_DRAFTS: 50,
  MAX_PROJECT_FILES_CACHE: 50,
  MAX_FOLD_SCAN_LINES: 2500,
  MAX_WORD_VALIDITY_CACHE_SIZE: 5000,
  MAX_WORD_SUGGESTIONS_CACHE_SIZE: 1000,
} as const;

export const IMAGE_EXTENSIONS = new Set([
  'png',
  'jpg',
  'jpeg',
  'pdf',
  'svg',
  'eps',
  'webp',
  'gif',
]);

export const RASTER_AND_VECTOR_IMAGE_EXTENSIONS = new Set([
  'png',
  'jpg',
  'jpeg',
  'gif',
  'svg',
  'webp',
  'eps',
]);

export const CODE_EXTENSIONS = new Set([
  'tex',
  'ltx',
  'dtx',
  'py',
  'r',
  'm',
  'c',
  'cpp',
  'java',
  'js',
  'ts',
  'json',
  'csv',
]);

export const ARXIV_ALLOWED_EXTENSIONS = new Set([
  'tex',
  'ltx',
  'sty',
  'cls',
  'bst',
  'def',
  'fd',
  'cfg',
  'bbx',
  'cbx',
  'bib',
  'bbl',
  'png',
  'jpg',
  'jpeg',
  'pdf',
  'eps',
  'ps',
  'svg',
  'csv',
  'dat',
  'txt',
]);

/**
 * Checks whether a tab or file entry corresponds to the project's main LaTeX document.
 */
export function isMainTexTabOrFile(
  tab: { id?: string | null; title?: string | null } | null | undefined,
  projectId?: string | null,
  configuredMainFile: string = DEFAULT_MAIN_FILE,
): boolean {
  if (!tab) return false;
  const lowerTitle = tab.title?.toLowerCase() ?? '';
  const targetMain = (configuredMainFile || DEFAULT_MAIN_FILE).toLowerCase();
  return (
    (Boolean(projectId) && (tab.id === projectId || tab.id === `${projectId}-main`)) ||
    lowerTitle === DEFAULT_MAIN_FILE ||
    lowerTitle === targetMain
  );
}

/**
 * Canonical cross-browser macOS/iOS platform detection.
 */
export function isMacPlatform(): boolean {
  if (typeof navigator === 'undefined') return false;
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  if (typeof nav.userAgentData?.platform === 'string' && /mac/i.test(nav.userAgentData.platform)) {
    return true;
  }
  if (typeof navigator.platform === 'string' && /Mac|iPod|iPhone|iPad/.test(navigator.platform)) {
    return true;
  }
  return /Mac|iPod|iPhone|iPad/.test(navigator.userAgent || '');
}

/**
 * Returns true if the primary command modifier (Cmd on macOS, Ctrl elsewhere) is pressed.
 */
export function isPrimaryModKey(e: { metaKey: boolean; ctrlKey: boolean }): boolean {
  return isMacPlatform() ? e.metaKey : e.ctrlKey;
}

/**
 * Centralized shallow URL query parameter updater (0ms latency, no Next.js router navigation).
 */
export function syncShallowUrlParams(params: Record<string, string | null | undefined>): void {
  if (typeof window === 'undefined') return;
  try {
    const url = new URL(window.location.href);
    for (const [key, value] of Object.entries(params)) {
      if (!value) {
        url.searchParams.delete(key);
      } else {
        url.searchParams.set(key, value);
      }
    }
    window.history.replaceState(window.history.state, '', url.pathname + url.search);
  } catch (err) {
    console.debug('[EditorConstants] Shallow URL replaceState skipped:', err);
  }
}

/**
 * Synchronizes or clears the `?file=` query parameter in the browser URL bar.
 */
export function syncShallowFileUrlParam(fileId?: string | null): void {
  syncShallowUrlParams({ file: fileId || null });
}
