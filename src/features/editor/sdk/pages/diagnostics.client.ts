/**
 * diagnostics.client.ts
 *
 * Diagnostics, linter, and explanation sub-API.
 */

import { apiGet, apiPost } from '@/shared/lib/api';
import { PAGES_API_BASE } from './base';
import { DEFAULT_COMPILER_ENGINE } from '@/features/editor/domain/types/compiler.types';
import type {
  DiagnosticReportDto,
  ErrorExplanationDto,
} from './types';

export const diagnostics = {
  parseLog: async (logText: string, engine: string = DEFAULT_COMPILER_ENGINE): Promise<DiagnosticReportDto> => {
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
      `${PAGES_API_BASE}/diagnostics/parse-log`,
      { logText: payload, engine },
      { silent: true },
    );
  },

  lint: async (
    source: string,
    filename = 'main.tex',
    options?: {
      projectId?: string;
      docId?: string;
      knownBibKeys?: string[];
      knownLabels?: string[];
    },
  ): Promise<DiagnosticReportDto> => {
    const payload = {
      source,
      content: source,
      filename,
      spaceId: options?.projectId,
      docId: options?.docId,
      knownBibKeys: options?.knownBibKeys,
      knownLabels: options?.knownLabels,
    };
    if (options?.projectId) {
      return await apiPost<DiagnosticReportDto>(
        `${PAGES_API_BASE}/diagnostics/spaces/${options.projectId}/lint-doc`,
        payload,
        { silent: true },
      );
    }
    return await apiPost<DiagnosticReportDto>(
      `${PAGES_API_BASE}/diagnostics/lint`,
      payload,
      { silent: true },
    );
  },

  lintDoc: async (
    projectId: string,
    payload: {
      content: string;
      filename?: string;
      docId?: string;
      knownBibKeys?: string[];
      knownLabels?: string[];
    },
  ): Promise<DiagnosticReportDto> => {
    return await apiPost<DiagnosticReportDto>(
      `${PAGES_API_BASE}/diagnostics/spaces/${projectId}/lint-doc`,
      { ...payload, source: payload.content, spaceId: projectId },
      { silent: true },
    );
  },

  lintProject: async (projectId: string): Promise<DiagnosticReportDto> => {
    return await apiPost<DiagnosticReportDto>(`${PAGES_API_BASE}/diagnostics/spaces/${projectId}/lint`, {});
  },

  getExplanation: async (code: string): Promise<ErrorExplanationDto> => {
    return await apiGet<ErrorExplanationDto>(`${PAGES_API_BASE}/diagnostics/explain/${encodeURIComponent(code)}`);
  },

  getRules: async (): Promise<ErrorExplanationDto[]> => {
    return await apiGet<ErrorExplanationDto[]>(`${PAGES_API_BASE}/diagnostics/rules`);
  },
};
