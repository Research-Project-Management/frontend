import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  downloadAuxFileUrl,
  downloadAllArtifactsZipUrl,
  compileService,
} from '@/features/editor/services/compiler.service';
import { manuscriptService } from '@/features/editor/services/manuscript.service';
import { parseLatexLog } from '@/features/editor/components/viewer/Logs';
import { createPdfBlobAndUrl } from '@/features/editor/utils/viewer.util';

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

  describe('createPdfBlobAndUrl Helper', () => {
    it('handles direct HTTP and HTTPS URLs', () => {
      const res = createPdfBlobAndUrl('https://example.com/doc.pdf');
      expect(res).not.toBeNull();
      expect(res?.url).toBe('https://example.com/doc.pdf');
      expect(res?.blob).toBeNull();
    });

    it('handles blob URLs directly', () => {
      const res = createPdfBlobAndUrl('blob:http://localhost:2915/abc-123');
      expect(res).not.toBeNull();
      expect(res?.url).toBe('blob:http://localhost:2915/abc-123');
      expect(res?.blob).toBeNull();
    });

    it('decodes valid base64 PDF into blob URL', () => {
      const base64Pdf = 'JVBERi0xLjQKMSAwIG9iago=';
      const res = createPdfBlobAndUrl(base64Pdf);
      expect(res).not.toBeNull();
      expect(res?.url).toMatch(/^blob:/);
      expect(res?.blob).toBeInstanceOf(Blob);
    });

    it('strips data:application/pdf;base64 prefix before decoding', () => {
      const dataUri = 'data:application/pdf;base64,JVBERi0xLjQKMSAwIG9iago=';
      const res = createPdfBlobAndUrl(dataUri);
      expect(res).not.toBeNull();
      expect(res?.url).toMatch(/^blob:/);
      expect(res?.blob).toBeInstanceOf(Blob);
    });

    it('strips newlines and spaces from base64 PDF data', () => {
      const messyBase64 = '  JVBERi0xLjQK\r\nMSAwIG9iago= \n ';
      const res = createPdfBlobAndUrl(messyBase64);
      expect(res).not.toBeNull();
      expect(res?.url).toMatch(/^blob:/);
      expect(res?.blob).toBeInstanceOf(Blob);
    });

    it('decodes raw %PDF- ASCII string directly', () => {
      const rawPdf = '%PDF-1.4\n1 0 obj\n<<>>\nendobj';
      const res = createPdfBlobAndUrl(rawPdf);
      expect(res).not.toBeNull();
      expect(res?.url).toMatch(/^blob:/);
      expect(res?.blob).toBeInstanceOf(Blob);
    });

    it('returns null for empty or invalid inputs', () => {
      expect(createPdfBlobAndUrl('')).toBeNull();
      expect(createPdfBlobAndUrl('   ')).toBeNull();
      expect(createPdfBlobAndUrl(null as any)).toBeNull();
      expect(createPdfBlobAndUrl(undefined as any)).toBeNull();
    });
  });
});
