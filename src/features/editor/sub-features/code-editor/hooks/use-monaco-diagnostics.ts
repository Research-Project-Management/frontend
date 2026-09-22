'use client';

import { useEffect } from 'react';
import type * as monacoType from 'monaco-editor';
import { useCompileStore } from '../../../store';
import type { Page, PageFile } from '../../../types';

export interface UseMonacoDiagnosticsOptions {
  editorRef: React.MutableRefObject<monacoType.editor.IStandaloneCodeEditor | null>;
  monacoRef: React.MutableRefObject<typeof monacoType | null>;
  editorMounted: boolean;
  page: Page | PageFile;
}

export function useMonacoDiagnostics({
  editorRef,
  monacoRef,
  editorMounted,
  page,
}: UseMonacoDiagnosticsOptions) {
  const compileErrors = useCompileStore((s) => s.compileErrors);
  const compileStatus = useCompileStore((s) => s.compileStatus);

  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco || !editorMounted) return;

    const model = editor.getModel();
    if (!model) return;

    const currentFileName = (page?.title || 'main.tex').trim().toLowerCase();
    const hasProjectId = 'projectId' in page && Boolean((page as any).projectId);
    const isMainDoc =
      currentFileName === 'main.tex' ||
      currentFileName.endsWith('/main.tex') ||
      !hasProjectId;

    const markers: monacoType.editor.IMarkerData[] = [];

    if (compileErrors && compileErrors.length > 0) {
      for (const err of compileErrors) {
        if (err.file) {
          const errClean = err.file.replace(/^\.\//, '').trim().toLowerCase();
          const matches =
            errClean === currentFileName ||
            currentFileName.endsWith(`/${errClean}`) ||
            errClean.endsWith(`/${currentFileName}`) ||
            (isMainDoc &&
              (errClean === 'main.tex' || errClean.endsWith('/main.tex')));
          if (!matches) continue;
        } else if (!isMainDoc) {
          continue;
        }

        const maxLine = model.getLineCount();
        const line =
          err.line && err.line > 0 ? Math.min(err.line, maxLine) : 1;
        const maxCol = model.getLineMaxColumn(line);

        let severity = monaco.MarkerSeverity.Error;
        if (err.severity === 'warning') severity = monaco.MarkerSeverity.Warning;
        else if (err.severity === 'info') severity = monaco.MarkerSeverity.Info;

        const suggestionText = err.suggestion
          ? `\n\n💡 Gợi ý sửa lỗi: ${err.suggestion}`
          : '';

        markers.push({
          startLineNumber: line,
          startColumn: 1,
          endLineNumber: line,
          endColumn: maxCol,
          message: `${err.message}${suggestionText}`,
          severity,
          source: 'LaTeX Compiler',
          code: err.code,
        });
      }
    }

    monaco.editor.setModelMarkers(model, 'latex-compiler', markers);

    return () => {
      if (model && !model.isDisposed()) {
        monaco.editor.setModelMarkers(model, 'latex-compiler', []);
      }
    };
  }, [
    compileErrors,
    compileStatus,
    editorMounted,
    editorRef,
    monacoRef,
    page?.id,
    page?.title,
  ]);
}
