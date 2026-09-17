/**
 * compiler.service.ts
 *
 * Frontend service mirroring Backend `modules/document/compiler/` & LaTeX compilation:
 *  - Compile LaTeX (`/api/latex/compile`)
 *  - Preview Compilation (`/api/latex/compile` with preview flags)
 *  - Word Count (`/api/latex/word-count`)
 *  - Incremental sync (`/api/pages/:rootId/sync-incremental`)
 */

import { apiPost, apiPut } from '@/shared/lib/api';

export const flushPageContent = async (fileId: string, content: string): Promise<void> => {
  await apiPut(`/api/pages/${fileId}`, { content });
};

export const syncIncremental = async (
  rootPageId: string,
  dirtyFileIds: string[],
  forceAll?: boolean,
): Promise<{ synced: string[] }> => {
  return await apiPost<{ synced: string[] }>(`/api/pages/${rootPageId}/sync-incremental`, {
    dirtyFileIds,
    forceAll,
  });
};

export interface CompilerDiagnostic {
  file: string;
  line: number | null;
  message: string;
  context: string;
  severity: 'error' | 'warning' | 'info';
  code?: string;
  suggestion?: string;
}

export type CompileLatexPayload = {
  project_id?: string;
  projectId?: string;
  page_id?: string;
  pageId?: string;
  main_file: string | null;
  engine: string;
  texLiveVersion?: string;
  draft: boolean;
  use_cache: boolean;
  source?: string;
  files?: Record<string, string>;
};

export interface CompileLatexResponse {
  success?: boolean;
  pdf: string;
  logs: string;
  synctex?: string;
  error?: string;
  diagnostics?: CompilerDiagnostic[];
}

export const compileLatex = async (
  payload: CompileLatexPayload,
): Promise<CompileLatexResponse> => {
  return await apiPost<CompileLatexResponse>('/api/latex/compile', payload);
};

export interface WordCountResponse {
  success: boolean;
  stats?: {
    wordsInText: number;
    wordsInHeaders: number;
    wordsInCaptions: number;
    headers: number;
    floats: number;
    mathInlines: number;
    mathDisplayed: number;
  };
  error?: string;
}

export async function fetchWordCount(source: string): Promise<WordCountResponse> {
  return await apiPost<WordCountResponse>('/api/latex/word-count', { source });
}

export interface PreviewCompileResult {
  success: boolean;
  pdf?: string;
  pdfUrl?: string;
  log: string;
  error?: string;
}

export async function compilePreview(
  opts: {
    baseContent?: string;
    suggestion?: string;
    sessionId?: string;
    code?: string;
    engine?: 'pdflatex' | 'xelatex' | 'lualatex';
  },
): Promise<PreviewCompileResult> {
  const source = opts.code || opts.suggestion || opts.baseContent || '';
  const engine = opts.engine || 'pdflatex';

  try {
    const res = await apiPost<{ pdf?: string; logs?: string; synctex?: string; error?: string }>(
      '/api/latex/compile',
      {
        project_id: opts.sessionId || 'preview',
        main_file: 'preview.tex',
        engine,
        source,
        draft: true,
        use_cache: false,
      },
    );

    return {
      success: Boolean(res.pdf),
      pdf: res.pdf,
      pdfUrl: res.pdf,
      log: res.logs || '',
      error: res.error,
    };
  } catch (err: any) {
    return {
      success: false,
      pdf: '',
      pdfUrl: '',
      log: err?.message || String(err),
      error: err?.message || 'Preview compile failed',
    };
  }
}

export const compileService = {
  flushPageContent,
  syncIncremental,
  compileLatex,
  compilePreview,
  fetchWordCount,
};

export const DocumentCompileService = compileService;
