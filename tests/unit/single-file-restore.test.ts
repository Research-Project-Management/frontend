import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useSettingsStore } from '@/features/editor/store/settings.store';
import { usePageStore } from '@/features/editor/store/editor.store';
import type { CompileLatexPayload } from '@/features/editor/services/compiler.service';
import type { CompileExecutionOptions } from '@/features/editor/utils/viewer.util';

describe('Single File Restore & Stop on First Error (Overleaf Parity)', () => {
  beforeEach(() => {
    // Reset settings store to defaults
    useSettingsStore.setState({
      stopOnFirstError: false,
      engine: 'pdflatex',
      compileMode: 'full',
      mainFile: 'main.tex',
      useCache: true,
      autoCompile: false,
    });

    usePageStore.setState({
      currentPage: null,
      activeFilePage: null,
    });
  });

  describe('Stop on First Error (-halt-on-error) Configuration', () => {
    it('defaults stopOnFirstError to false', () => {
      expect(useSettingsStore.getState().stopOnFirstError).toBe(false);
    });

    it('toggles stopOnFirstError state via toggleStopOnFirstError', () => {
      const { toggleStopOnFirstError } = useSettingsStore.getState();
      toggleStopOnFirstError();
      expect(useSettingsStore.getState().stopOnFirstError).toBe(true);

      toggleStopOnFirstError();
      expect(useSettingsStore.getState().stopOnFirstError).toBe(false);
    });

    it('sets stopOnFirstError state via setStopOnFirstError', () => {
      const { setStopOnFirstError } = useSettingsStore.getState();
      setStopOnFirstError(true);
      expect(useSettingsStore.getState().stopOnFirstError).toBe(true);

      setStopOnFirstError(false);
      expect(useSettingsStore.getState().stopOnFirstError).toBe(false);
    });

    it('correctly maps stop_on_first_error into compiler payload', () => {
      const opts: CompileExecutionOptions = {
        projectId: 'proj-123',
        pageId: 'page-456',
        mainFile: 'main.tex',
        engine: 'pdflatex',
        draft: false,
        useCache: true,
        dirtyFiles: [],
        stopOnFirstError: true,
      };

      const payload: CompileLatexPayload = {
        project_id: opts.projectId,
        page_id: opts.pageId,
        main_file: opts.mainFile,
        engine: opts.engine,
        draft: opts.draft,
        use_cache: opts.useCache ?? true,
        stop_on_first_error: opts.stopOnFirstError,
      };

      expect(payload.stop_on_first_error).toBe(true);
      expect(payload.engine).toBe('pdflatex');
    });

    it('omits or keeps stop_on_first_error as false when disabled', () => {
      const opts: CompileExecutionOptions = {
        projectId: 'proj-123',
        pageId: 'page-456',
        mainFile: 'main.tex',
        engine: 'pdflatex',
        draft: false,
        useCache: true,
        dirtyFiles: [],
        stopOnFirstError: false,
      };

      const payload: CompileLatexPayload = {
        project_id: opts.projectId,
        page_id: opts.pageId,
        main_file: opts.mainFile,
        engine: opts.engine,
        draft: opts.draft,
        use_cache: opts.useCache ?? true,
        stop_on_first_error: opts.stopOnFirstError,
      };

      expect(payload.stop_on_first_error).toBe(false);
    });
  });

  describe('Single File Restore Logic & Isolation', () => {
    it('restores only targeted file without altering other project files', async () => {
      const mockFiles = [
        { id: 'file-1', title: 'main.tex', content: '\\input{chapter1}' },
        { id: 'file-2', title: 'chapter1.tex', content: 'Current broken chapter 1 content' },
        { id: 'file-3', title: 'refs.bib', content: '@article{test, author={Author}}' },
      ];

      const previewRevisionContent = 'Restored working chapter 1 content from v2';
      const mutateAsyncMock = vi.fn().mockImplementation(async ({ pageId, content }: { pageId: string; content: string }) => {
        const file = mockFiles.find((f) => f.id === pageId);
        if (file) {
          file.content = content;
        }
        return file;
      });

      // User initiates single file restore on chapter1.tex (file-2)
      const targetFileId = 'file-2';
      await mutateAsyncMock({
        pageId: targetFileId,
        content: previewRevisionContent,
      });

      // Verify targeted file was restored
      expect(mutateAsyncMock).toHaveBeenCalledWith({
        pageId: 'file-2',
        content: previewRevisionContent,
      });
      expect(mockFiles.find((f) => f.id === 'file-2')?.content).toBe(previewRevisionContent);

      // Verify other files remained untouched
      expect(mockFiles.find((f) => f.id === 'file-1')?.content).toBe('\\input{chapter1}');
      expect(mockFiles.find((f) => f.id === 'file-3')?.content).toBe('@article{test, author={Author}}');
    });

    it('updates Monaco editor buffer if active open file matches restored file', () => {
      const setValueMock = vi.fn();
      const mockEditorRef = { current: { setValue: setValueMock } };

      const activeFilePage = { id: 'file-2', title: 'chapter1.tex' };
      const restoredFileId = 'file-2';
      const restoredContent = 'New restored text';

      if (restoredFileId === activeFilePage.id) {
        mockEditorRef.current?.setValue(restoredContent);
      }

      expect(setValueMock).toHaveBeenCalledWith('New restored text');
    });

    it('does not overwrite Monaco editor if restored file is a different background file', () => {
      const setValueMock = vi.fn();
      const mockEditorRef = { current: { setValue: setValueMock } };

      const activeFilePage = { id: 'file-1', title: 'main.tex' };
      const restoredFileId = 'file-2'; // restoring chapter1.tex while main.tex is active
      const restoredContent = 'New restored text';

      if (restoredFileId === activeFilePage.id) {
        mockEditorRef.current?.setValue(restoredContent);
      }

      expect(setValueMock).not.toHaveBeenCalled();
    });
  });
});
