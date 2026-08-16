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

export type CompileLatexPayload = {
  project_id: string;
  main_file: string | null;
  engine: string;
  draft: boolean;
  use_cache: boolean;
};

export const compileLatex = async (
  payload: CompileLatexPayload,
): Promise<{ pdf: string; logs: string; synctex?: string }> => {
  return await apiPost<{ pdf: string; logs: string; synctex?: string }>(
    '/api/latex/compile',
    payload,
  );
};
