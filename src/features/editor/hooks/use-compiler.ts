'use client';

/**
 * use-compiler.ts
 *
 * Frontend hooks mirroring Backend `modules/document/compiler/`:
 *  - useCompileLatex
 *  - useCompilePreview
 *  - useWordCount
 */

import { useMutation, useQuery } from '@tanstack/react-query';
import {
  compileLatex,
  compilePreview,
  fetchWordCount,
  type CompileLatexPayload,
  type CompileLatexResponse,
  type PreviewCompileResult,
  type WordCountResponse,
} from '../services/compiler.service';

export function useCompileLatex() {
  return useMutation<CompileLatexResponse, Error, CompileLatexPayload>({
    mutationFn: compileLatex,
  });
}

export function useCompilePreview() {
  return useMutation<
    PreviewCompileResult,
    Error,
    {
      baseContent?: string;
      suggestion?: string;
      sessionId?: string;
      code?: string;
      engine?: 'pdflatex' | 'xelatex' | 'lualatex';
    }
  >({
    mutationFn: compilePreview,
  });
}

export function useWordCount(source: string) {
  return useQuery<WordCountResponse, Error>({
    queryKey: ['document-word-count', source],
    queryFn: () => fetchWordCount(source),
    enabled: !!source,
    staleTime: 5000,
  });
}
