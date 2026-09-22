import { describe, it, expect } from 'vitest';
import {
  parseLatexLog,
  parseCompileErrors,
} from '../../src/features/editor/domain/log-parser/latex-log-parser';

describe('Domain: LaTeX Log Parser', () => {
  const sampleLog = `This is pdfTeX, Version 3.141592653-2.6-1.40.24 (TeX Live 2022)
entering extended mode
(./main.tex
LaTeX2e <2021-11-15> patch level 1
(/usr/local/texlive/2022/texmf-dist/tex/latex/base/article.cls)

! Undefined control sequence.
l.42 \\invalidcommand
                     {test}
The control sequence at the end of the top line
of your error message was never \\def'ed.

LaTeX Warning: Reference \`sec:missing' on page 1 undefined on input line 55.

Overfull \\hbox (15.234pt too wide) in paragraph at lines 60--65
 []\\OT1/cmr/m/n/10 Long line that exceeds the margin bounds[]

! LaTeX Error: Environment customenv undefined.
l.75 \\begin{customenv}
                     
Your command was ignored.
)
No pages of output.
Transcript written on main.log.`;

  it('correctly classifies errors, warnings, and bad boxes', () => {
    const parsed = parseLatexLog(sampleLog);
    expect(parsed.errors).toHaveLength(2);
    expect(parsed.errors[0].message).toContain('Undefined control sequence');
    expect(parsed.errors[0].line).toBe(42);
    expect(parsed.errors[1].message).toContain('Environment customenv undefined');
    expect(parsed.errors[1].line).toBe(75);

    expect(parsed.warnings).toHaveLength(1);
    expect(parsed.warnings[0].message).toContain("Reference `sec:missing' on page 1 undefined");
    expect(parsed.warnings[0].line).toBe(55);

    expect(parsed.badBoxes).toHaveLength(1);
    expect(parsed.badBoxes[0].message).toContain('Overfull \\hbox');
    expect(parsed.badBoxes[0].line).toBe(60);
  });

  it('parses compiler output into structured errors with context and line numbers', () => {
    const errors = parseCompileErrors(sampleLog);
    expect(errors.length).toBeGreaterThanOrEqual(2);

    const undefCmd = errors.find((e) => e.message.includes('Undefined control sequence'));
    expect(undefCmd).toBeDefined();
    expect(undefCmd?.line).toBe(42);
    expect(undefCmd?.severity).toBe('error');

    const undefEnv = errors.find((e) => e.message.includes('Environment customenv undefined'));
    expect(undefEnv).toBeDefined();
    expect(undefEnv?.line).toBe(75);
    expect(undefEnv?.severity).toBe('error');
  });

  it('handles empty or clean logs without throwing', () => {
    const cleanLog = parseLatexLog('Output written on main.pdf (1 page, 12345 bytes).');
    expect(cleanLog.errors).toHaveLength(0);
    expect(cleanLog.warnings).toHaveLength(0);
    expect(cleanLog.badBoxes).toHaveLength(0);
  });
});
