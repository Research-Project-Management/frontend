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
    return await apiPost<DiagnosticReportDto>(`${MANUSCRIPTS_API_BASE}/diagnostics/parse-log`, { logText, engine });
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
