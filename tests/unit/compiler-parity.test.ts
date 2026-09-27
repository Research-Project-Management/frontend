import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  downloadAuxFileUrl,
  downloadAllArtifactsZipUrl,
  compileService,
} from '@/features/editor/services/compiler.service';
import { manuscriptService } from '@/features/editor/services/manuscript.service';
import { parseLatexLog } from '@/features/editor/components/viewer/Logs';

describe('Phase 2: Compiler & Artifacts Overleaf Parity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Auxiliary & Output Artifacts Download Endpoints', () => {
    it('should generate correct download URL for individual auxiliary file', () => {
      const url = downloadAuxFileUrl('proj-123', 'output.aux');
      expect(url).toContain('/projects/proj-123/artifacts/output.aux');
    });

    it('should properly encode special characters in auxiliary filename', () => {
      const url = downloadAuxFileUrl('proj-123', 'subfolder/chapter 1.aux');
      expect(url).toContain(encodeURIComponent('subfolder/chapter 1.aux'));
    });

    it('should generate correct download URL for all artifacts ZIP package', () => {
      const url = downloadAllArtifactsZipUrl('proj-123');
      expect(url).toContain('/projects/proj-123/artifacts-zip');
    });

    it('should expose both aux URL helpers on the compileService object', () => {
      expect(compileService.downloadAuxFileUrl).toBeDefined();
      expect(compileService.downloadAllArtifactsZipUrl).toBeDefined();
      expect(typeof compileService.downloadAuxFileUrl).toBe('function');
      expect(typeof compileService.downloadAllArtifactsZipUrl).toBe('function');
    });
  });

  describe('Compiler Payload & Configuration Parity', () => {
    it('supports 240,000ms timeout, draft mode, and stop_on_first_error in payload typing', () => {
      const payload: Parameters<typeof manuscriptService.compiler.compile>[0] = {
        main_file: 'main.tex',
        engine: 'pdflatex',
        draft: true,
        use_cache: true,
        stop_on_first_error: true,
        timeout_ms: 240000,
        timeoutMs: 240000,
      };

      expect(payload.timeout_ms).toBe(240000);
      expect(payload.draft).toBe(true);
      expect(payload.stop_on_first_error).toBe(true);
    });
  });

  describe('Log Parser & Error Classification', () => {
    it('classifies LaTeX errors, warnings, and bad boxes accurately', () => {
      const sampleLog = `
This is pdfTeX, Version 3.141592653-2.6-1.40.24 (TeX Live 2022)
entering extended mode
(./main.tex
LaTeX2e <2022-11-01> patch level 1
! Undefined control sequence.
l.42 \\invalidcommand
                     {test}
LaTeX Warning: Citation 'smith2020' on page 1 undefined on input line 55.
Overfull \\hbox (15.2pt too wide) in paragraph at lines 60--65
Underfull \\vbox (badness 10000) has occurred while \\output is active
)
`;
      const parsed = parseLatexLog(sampleLog);
      expect(parsed.errors.length).toBeGreaterThan(0);
      expect(parsed.warnings.length).toBeGreaterThan(0);
      expect(parsed.badBoxes.length).toBeGreaterThan(0);

      const hasUndefined = parsed.errors.some((e) =>
        e.message.includes('Undefined control sequence') || e.detail?.includes('invalidcommand')
      );
      expect(hasUndefined).toBe(true);

      const hasCitationWarning = parsed.warnings.some((w) =>
        w.message.includes('Citation')
      );
      expect(hasCitationWarning).toBe(true);
    });
  });
});
