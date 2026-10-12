/**
 * diagnostics.api.ts
 *
 * Diagnostics, linter, autofix, and explanation sub-API.
 */

import { apiGet, apiPost } from '@/shared/lib/api';
import { MANUSCRIPTS_API_BASE } from './base';
import type { DiagnosticReportDto, AutoFixResultDto, ErrorExplanationDto } from './types';

export const diagnostics = {
  parseLog: async (logText: string, engine = 'pdflatex'): Promise<DiagnosticReportDto> => {
    if (!logText || !logText.trim() || logText.includes('signal is aborted') || logText.includes('Compilation superseded')) {
      return {
        id: `report-${Date.now()}`,
        isSuccess: true,
        errorsCount: 0,
        warningsCount: 0,
        badboxesCount: 0,
        infoCount: 0,
        totalCount: 0,
        items: [],
      };
    }
    const MAX_LOG_SIZE = 256 * 1024; // 256KB max to stay well within proxy body limits
    const payload =
      logText.length > MAX_LOG_SIZE
        ? logText.slice(logText.length - MAX_LOG_SIZE)
        : logText;

    return await apiPost<DiagnosticReportDto>(
      `${MANUSCRIPTS_API_BASE}/diagnostics/parse-log`,
      { logText: payload, engine },
      { silent: true }
    );
  },

  lint: async (source: string, filename = 'main.tex'): Promise<DiagnosticReportDto> => {
    return await apiPost<DiagnosticReportDto>(`${MANUSCRIPTS_API_BASE}/diagnostics/lint`, { source, filename });
  },

  lintProject: async (projectId: string): Promise<DiagnosticReportDto> => {
    return await apiPost<DiagnosticReportDto>(`${MANUSCRIPTS_API_BASE}/diagnostics/${projectId}/lint`, {});
  },

  autoFix: async (source: string): Promise<AutoFixResultDto> => {
    return await apiPost<AutoFixResultDto>(`${MANUSCRIPTS_API_BASE}/diagnostics/autofix`, { source });
  },

  getExplanation: async (code: string): Promise<ErrorExplanationDto> => {
    return await apiGet<ErrorExplanationDto>(`${MANUSCRIPTS_API_BASE}/diagnostics/explain/${encodeURIComponent(code)}`);
  },

  getRules: async (): Promise<ErrorExplanationDto[]> => {
    return await apiGet<ErrorExplanationDto[]>(`${MANUSCRIPTS_API_BASE}/diagnostics/rules`);
  },
};
