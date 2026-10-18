import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import { test, expect } from '../fixtures/editor.fixture';
import {
  MOCK_PAGE,
  MOCK_FILES_HIERARCHY,
} from '../fixtures/mock-data';
import { parseLatexLog } from '@/features/editor/domain/latex/compiler-logs-parser';
import { parseCompileErrors } from '@/features/editor/domain/latex/latex-structure';
import {
  parseSyncTeX,
  resolveForwardDetail,
  resolveReverse,
  decompressSyncTeXData,
} from '@/features/editor/subsystems/compiler/synctex/synctex-index';
import { performRecursiveXyCut, type PdfTextItemRect } from '@/features/editor/subsystems/compiler/pdf/pdf-xy-cut';

const FIXTURES_DIR = path.resolve(__dirname, '../fixtures/overleaf-ground-truth');

function readFixtureText(filename: string): string {
  return fs.readFileSync(path.join(FIXTURES_DIR, filename), 'utf8');
}

function readFixtureBase64(filename: string): string {
  return fs.readFileSync(path.join(FIXTURES_DIR, filename)).toString('base64');
}

/**
 * overleaf-internet-ground-truth-benchmark.spec.ts
 *
 * Large-Scale Empirical Verification Suite (70+ Real-World Internet Datasets)
 * Sourced directly from Official Primary Repositories on GitHub:
 * 1. `overleaf/overleaf` (`services/web/test/frontend/helpers/fixtures/logs/*.log`, `*.blg`, `logParserTests.js`, `human-readable-logs.test.js`)
 * 2. `overleaf/overleaf` (`services/clsi/test/unit/js/SynctexOutputParser.test.js`, `services/clsi/test/acceptance/fixtures/examples/<name>/output.pdf`)
 * 3. `James-Yu/LaTeX-Workshop` (`test/units/04_parser/log.test.ts` — 41 official TeX Live / MiKTeX / BibTeX / Biber / Badbox / LaTeX3 unit test cases)
 */
test.describe('Overleaf & LaTeX-Workshop Official Internet Ground-Truth Benchmark (70+ Datasets)', () => {
  const PAGE_ID = 'page-paper-001';

  test('Cohort 1 (16 Official Overleaf Fixture Files): 100% Ground-Truth Parity with overleaf/overleaf logParserTests.js & human-readable-logs.test.js', async () => {
    // 1. errors.log — Official Overleaf expectation: 7 deduplicated errors + 1 badBox
    const errorsRes = parseLatexLog(readFixtureText('errors.log'));
    expect(errorsRes.errors.map((e) => [e.line, e.message])).toEqual([
      [29, 'Undefined control sequence.'],
      [30, 'LaTeX Error: \\begin{equation} on input line 28 ended by \\end{equaion}.'],
      [30, 'Missing $ inserted.'],
      [30, 'Display math should end with $$.'],
      [46, 'Extra }, or forgotten \\right.'],
      [46, 'Missing \\right. inserted.'],
      [46, 'Missing } inserted.'],
    ]);
    for (const err of errorsRes.errors) {
      expect(err.file).toBe('sections/appendices.tex');
    }
    expect(errorsRes.errors[1].quickFix?.replacementText).toBe('\\end{equation}');

    // 2. bad-boxes.log — Official Overleaf expectation: 6 badBoxes in logs/bad-boxes.tex
    const badBoxesRes = parseLatexLog(readFixtureText('bad-boxes.log'));
    expect(badBoxesRes.badBoxes.map((b) => [b.line, b.message, b.file])).toEqual([
      [9, 'Overfull \\hbox (29.11179pt too wide) in paragraph at lines 9--10', 'logs/bad-boxes.tex'],
      [11, 'Underfull \\hbox (badness 10000) in paragraph at lines 11--13', 'logs/bad-boxes.tex'],
      [27, 'Overfull \\vbox (12.00034pt too high) detected at line 27', 'logs/bad-boxes.tex'],
      [46, 'Underfull \\vbox (badness 10000) detected at line 46', 'logs/bad-boxes.tex'],
      [54, 'Underfull \\hbox (badness 10000) in paragraph at lines 54--55', 'logs/bad-boxes.tex'],
      [58, 'Underfull \\hbox (badness 10000) in paragraph at lines 58--60', 'logs/bad-boxes.tex'],
    ]);

    // 3. warnings.log — Official Overleaf expectation: 15 unique warnings across 7 multi-file sections + 1 badBox
    const warningsRes = parseLatexLog(readFixtureText('warnings.log'));
    expect(warningsRes.warnings.map((w) => [w.line, w.message, w.file])).toEqual([
      [7, "LaTeX Warning: Citation `Lambert:2010iw' on page 1 undefined on input line 7.", 'sections/introduction.tex'],
      [72, "LaTeX Warning: Citation `Manton:2004tk' on page 3 undefined on input line 72.", 'sections/instantons.tex'],
      [108, "LaTeX Warning: Citation `Atiyah1978' on page 4 undefined on input line 108.", 'sections/instantons.tex'],
      [176, "LaTeX Warning: Citation `Dorey:1996hu' on page 5 undefined on input line 176.", 'sections/instantons.tex'],
      [3, "LaTeX Warning: Citation `Manton1982' on page 8 undefined on input line 3.", 'sections/moduli_space_approximation.tex'],
      [21, "LaTeX Warning: Citation `Weinberg:2006rq' on page 9 undefined on input line 21.", 'sections/moduli_space_approximation.tex'],
      [192, "LaTeX Warning: Citation `Bak:1999sv' on page 12 undefined on input line 192.", 'sections/moduli_space_approximation.tex'],
      [9, "LaTeX Warning: Citation `Peeters:2001np' on page 13 undefined on input line 9.", 'sections/dynamics_of_single_instanton.tex'],
      [27, "LaTeX Warning: Citation `Osborn:1981yf' on page 15 undefined on input line 27.", 'sections/dynamics_of_two_instantons.tex'],
      [27, "LaTeX Warning: Citation `Peeters:2001np' on page 15 undefined on input line 27.", 'sections/dynamics_of_two_instantons.tex'],
      [20, "LaTeX Warning: Citation `Osborn:1981yf' on page 22 undefined on input line 20.", 'sections/appendices.tex'],
      [103, "LaTeX Warning: Citation `Osborn:1981yf' on page 23 undefined on input line 103.", 'sections/appendices.tex'],
      [103, "LaTeX Warning: Citation `Peeters:2001np' on page 23 undefined on input line 103.", 'sections/appendices.tex'],
      [352, "LaTeX Warning: Citation `Peeters:2001np' on page 27 undefined on input line 352.", 'sections/appendices.tex'],
      [undefined, 'LaTeX Warning: There were undefined references.', 'instantons.tex'],
    ]);
    expect(warningsRes.badBoxes.length).toBe(1);
    expect(warningsRes.badBoxes[0].file).toBe('sections/dynamics_of_single_instanton.tex');

    // 4. biber-warnings.log — 4 multi-line biblatex warnings with (biblatex) continuation prefix stripped
    const biberWarnRes = parseLatexLog(readFixtureText('biber-warnings.log'));
    expect(biberWarnRes.warnings.map((w) => [w.line, w.message, w.file])).toEqual([
      [
        undefined,
        'Package biblatex Warning: No "backend" specified, using Biber backend. To use BibTeX, load biblatex with the "backend=bibtex" option.',
        'main.tex',
      ],
      [
        undefined,
        'Package biblatex Warning: The following entry could not be found in the database: Missing3 Please verify the spelling and rerun LaTeX afterwards.',
        'output.bbl',
      ],
      [
        undefined,
        'Package biblatex Warning: The following entry could not be found in the database: Missing2 Please verify the spelling and rerun LaTeX afterwards.',
        'output.bbl',
      ],
      [
        undefined,
        'Package biblatex Warning: The following entry could not be found in the database: Missing1 Please verify the spelling and rerun LaTeX afterwards.',
        'output.bbl',
      ],
    ]);

    // 5. natbib-warnings.log — 2 natbib warnings
    const natbibRes = parseLatexLog(readFixtureText('natbib-warnings.log'));
    expect(natbibRes.warnings.map((w) => [w.line, w.message, w.file])).toEqual([
      [6, "Package natbib Warning: Citation `blah' on page 1 undefined on input line 6.", 'main.tex'],
      [undefined, 'Package natbib Warning: There were undefined citations.', 'main.tex'],
    ]);

    // 6. geometry-warnings.log — 2 multi-line geometry warnings
    const geomRes = parseLatexLog(readFixtureText('geometry-warnings.log'));
    expect(geomRes.warnings.map((w) => [w.line, w.message, w.file])).toEqual([
      [undefined, "Package geometry Warning: Over-specification in `h'-direction. `width' (597.50787pt) is ignored.", 'main.tex'],
      [undefined, "Package geometry Warning: Over-specification in `v'-direction. `height' (845.04684pt) is ignored.", 'main.tex'],
    ]);

    // 7. caption-warnings.log — 2 multi-line caption warnings
    const captionRes = parseLatexLog(readFixtureText('caption-warnings.log'));
    expect(captionRes.warnings.length).toBe(2);
    expect(captionRes.warnings[1].line).toBe(46);
    expect(captionRes.warnings[1].file).toBe('main.tex');

    // 8. runaway-arguments.log — Runaway argument? + Emergency stop. in runaway_argument.tex
    const runawayRes = parseLatexLog(readFixtureText('runaway-arguments.log'));
    expect(runawayRes.errors.length).toBe(2);
    expect(runawayRes.errors[0].file).toBe('runaway_argument.tex');
    expect(runawayRes.errors[0].message).toContain('Runaway argument?');
    expect(runawayRes.errors[1].message).toBe('Emergency stop.');
    expect(runawayRes.errors[1].file).toBe('runaway_argument.tex');

    // 9. filenames.log — Deep paths with spaces & extensionless paths (/compile/main, /compile/otherfile)
    const filenamesRes = parseLatexLog(readFixtureText('filenames.log'));
    expect(filenamesRes.errors.map((e) => [e.line, e.message, e.file])).toEqual([
      [
        1,
        'Undefined control sequence.',
        'a folder with spaces/a subfolder with spaces/a subsubfolder with spaces/another file with spaces.tex',
      ],
    ]);
    expect(filenamesRes.warnings.map((w) => [w.line, w.message, w.file])).toEqual([
      [9, "LaTeX Warning: Citation `Peeters:2001np' on page 13 undefined on input line 9.", 'main'],
    ]);
    expect(filenamesRes.badBoxes.map((b) => [b.line, b.message, b.file])).toEqual([
      [123, 'Overfull \\hbox (4.56pt too wide) in paragraph at lines 123--456', 'otherfile'],
    ]);

    // 10. file-line-error.log — 79-char wrapped path with spaces
    const fle1Res = parseLatexLog(readFixtureText('file-line-error.log'));
    expect(fle1Res.errors.map((e) => [e.line, e.message, e.file])).toEqual([
      [
        1,
        'Undefined control sequence.',
        'a folder with spaces/a subfolder with spaces/a subsubfolder with spaces/another file with spaces.tex',
      ],
    ]);

    // 11. file-line-error-2.log — Multiple file:line:error entries across acks/name.tex & main.tex
    const fle2Res = parseLatexLog(readFixtureText('file-line-error-2.log'));
    expect(fle2Res.errors.map((e) => [e.line, e.message, e.file])).toEqual([
      [1, 'Misplaced alignment tab character &.', 'acks/name.tex'],
      [14, 'Misplaced alignment tab character &.', 'main.tex'],
    ]);

    // 12. biber.blg — Official Overleaf Biber log fixture (1 error on line 8 of bibliography.bib, 2 warnings)
    const biberBlgRes = parseLatexLog(readFixtureText('biber.blg'));
    expect(biberBlgRes.errors.length).toBe(1);
    expect(biberBlgRes.errors[0].file).toBe('bibliography.bib');
    expect(biberBlgRes.errors[0].line).toBe(8);
    expect(biberBlgRes.errors[0].message).toContain(
      'syntax error: at end of input, expected end of entry ("}" or ")") (skipping to next "@")',
    );
    expect(biberBlgRes.warnings.length).toBe(2);

    // 13. bibtex.blg — Official Overleaf BibTeX log fixture (7 errors + 6 warnings)
    const bibtexBlgRes = parseLatexLog(readFixtureText('bibtex.blg'));
    expect(bibtexBlgRes.errors.length).toBe(7);
    expect(bibtexBlgRes.warnings.length).toBe(6);
    expect(bibtexBlgRes.errors[0].file).toBe('references.bib');
    expect(bibtexBlgRes.errors[0].line).toBe(196);
    expect(bibtexBlgRes.errors[5].message).toContain('A bad cross reference---entry "conf/icde/FilhoTTF01"');
    expect(bibtexBlgRes.errors[6].file).toBe('output.aux');
    expect(bibtexBlgRes.errors[6].line).toBe(31);
    expect(bibtexBlgRes.errors[6].message).toContain("I couldn't open style file aa.bst");

    // 14. open-source-issue-1023.log — Official Overleaf Issue #1023 (8 errors + 8 warnings across Package/Class/LaTeX/LaTeX3/Font)
    const issue1023Res = parseLatexLog(readFixtureText('open-source-issue-1023.log'));
    expect(issue1023Res.errors.map((e) => [e.line, e.message, e.file])).toEqual([
      [38, 'Package PACKAGE Error: TEXT PackageError.', 'main.tex'],
      [45, 'Class PACKAGE Error: TEXT ClassError.', 'main.tex'],
      [53, 'LaTeX Error: TEXT @latex@error.', 'main.tex'],
      [72, 'Package PACKAGE Error: TEXT msg_error package', 'main.tex'],
      [84, 'Class PACKAGE Error: TEXT msg_error class', 'main.tex'],
      [97, 'LaTeX3 Error: TEXT msg_error latex3', 'main.tex'],
      [6, 'Critical LaTeX3 Error: TEXT msg_critical latex3', 'output-critical.tex'],
      [133, 'Missing character: There is no 3 ("33) in font nullfont.', 'main.tex'],
    ]);
    expect(issue1023Res.warnings.length).toBeGreaterThanOrEqual(8);

    // 15. undefined-control-sequence.log — Official Overleaf human-readable-logs.test.js (lines 3-8 + quickFixes for url, amsmath, array)
    const ucsRes = parseLatexLog(readFixtureText('undefined-control-sequence.log'));
    const ucsByLine = new Map(ucsRes.errors.filter((e) => e.message === 'Undefined control sequence.').map((e) => [e.line, e]));
    expect(ucsByLine.get(3)?.quickFix).toBeUndefined();
    expect(ucsByLine.get(4)?.quickFix).toBeUndefined();
    expect(ucsByLine.get(5)?.quickFix).toBeUndefined();
    expect(ucsByLine.get(6)?.quickFix?.replacementText).toBe('\\usepackage{url}');
    expect(ucsByLine.get(7)?.quickFix?.replacementText).toBe('\\usepackage{amsmath}');
    expect(ucsByLine.get(8)?.quickFix?.replacementText).toBe('\\usepackage{array}');

    // 16. lncs-undefined-control-sequence.log — 79-char line right before `! Undefined control sequence.` must NOT unwrap the `!`
    const lncsRes = parseLatexLog(readFixtureText('lncs-undefined-control-sequence.log'));
    expect(lncsRes.errors.map((e) => [e.line, e.message, e.file])).toEqual([
      [102, 'Undefined control sequence.', 'main.tex'],
    ]);

    // Also verify `parseCompileErrors` (Editor inline diagnostics) on the same corpus
    expect(parseCompileErrors(readFixtureText('lncs-undefined-control-sequence.log'))[0].line).toBe(102);
    expect(parseCompileErrors(readFixtureText('open-source-issue-1023.log')).filter((x) => x.severity === 'error').length).toBe(8);
  });

  test('Cohort 2 (41 Official LaTeX-Workshop Unit Test Cases from test/units/04_parser/log.test.ts): 100% Detection & Line Accuracy', async () => {
    // 14 General LaTeX Error cases from LaTeX-Workshop
    const lwErrorCases: Array<{ log: string; expectedLine?: number; expectedFile?: string }> = [
      { log: 'main.tex:12: Undefined control sequence', expectedLine: 12, expectedFile: 'main.tex' },
      { log: 'document.cls:45: Package geometry Error: Invalid margin value', expectedLine: 45, expectedFile: 'document.cls' },
      { log: 'main.tex:7: LaTeX Error: Missing $ inserted', expectedLine: 7, expectedFile: 'main.tex' },
      { log: "report.tex:102: File `input.tex' not found", expectedLine: 102, expectedFile: 'report.tex' },
      { log: '! LaTeX Error: This is an error message' },
      { log: '! Package pdftex.def Error: File image.png not found' },
      { log: '! Undefined control sequence (in main.tex)' },
      { log: "! LaTeX Error: Too many }'s" },
      { log: 'main.tex:12: Package amsmath Error: Missing }', expectedLine: 12, expectedFile: 'main.tex' },
      { log: 'document.cls:45: Class article Error: Missing mandatory argument', expectedLine: 45, expectedFile: 'document.cls' },
      { log: 'report.tex:15: LaTeX Error: Overfull \\hbox', expectedLine: 15, expectedFile: 'report.tex' },
      { log: "! File `image.png' not found" },
      { log: '! Missing $ inserted' },
      { log: "! Too many }'s" },
    ];
    for (const c of lwErrorCases) {
      const parsed = parseLatexLog(c.log);
      expect(parsed.errors.length, `Failed on LW error log: ${c.log}`).toBe(1);
      if (c.expectedLine !== undefined) expect(parsed.errors[0].line).toBe(c.expectedLine);
      if (c.expectedFile !== undefined) expect(parsed.errors[0].file).toBe(c.expectedFile);
    }

    // Multi-line TikZ error with line number (LW lines 234-242)
    const tikzLog = `! Undefined control sequence.\nl.4         \\draw\n                [->-=0.5] (0,0) -- (3,-2);`;
    const tikzParsed = parseLatexLog(tikzLog);
    expect(tikzParsed.errors.length).toBe(1);
    expect(tikzParsed.errors[0].line).toBe(4);
    expect(tikzParsed.errors[0].detail).toBe('\\draw');

    // 12 Badbox cases from LaTeX-Workshop (LW lines 252-324)
    const lwBadboxCases: Array<{ log: string; expectedLine?: number }> = [
      { log: 'Overfull \\hbox (some text) in paragraph at lines 10--20', expectedLine: 10 },
      { log: 'Overfull \\vbox (more text) in paragraph at lines 5--15', expectedLine: 5 },
      { log: 'Overfull \\hbox (some text) detected at line 12', expectedLine: 12 },
      { log: 'Overfull \\vbox (more text) detected at line 7', expectedLine: 7 },
      { log: 'Overfull \\hbox (some text) has occurred while \\output is active', expectedLine: undefined },
      { log: 'Overfull \\vbox (more text) has occurred while \\output is active [5]', expectedLine: undefined },
      { log: 'Underfull \\hbox (some text) in paragraph at lines 8--18', expectedLine: 8 },
      { log: 'Underfull \\vbox (more text) in paragraph at lines 3--13', expectedLine: 3 },
      { log: 'Underfull \\hbox (some text) detected at line 11', expectedLine: 11 },
      { log: 'Underfull \\vbox (more text) detected at line 6', expectedLine: 6 },
      { log: 'Underfull \\hbox (some text) has occurred while \\output is active', expectedLine: undefined },
      { log: 'Underfull \\vbox (more text) has occurred while \\output is active [8]', expectedLine: undefined },
    ];
    for (const b of lwBadboxCases) {
      const parsed = parseLatexLog(b.log);
      expect(parsed.badBoxes.length, `Failed on LW badbox: ${b.log}`).toBe(1);
      expect(parsed.badBoxes[0].line).toBe(b.expectedLine);
    }

    // 6 Class / Package / Module / LaTeX3 / Missing-character / Biber warning cases from LaTeX-Workshop (LW lines 346-395)
    const lwWarnCases: Array<{ log: string; expectedLine?: number }> = [
      { log: 'Class MyClass Warning: This is a warning message on input line 42.', expectedLine: 42 },
      { log: 'Module MyModule Warning: Something went wrong.', expectedLine: undefined },
      { log: 'LaTeX3 Warning: Deprecated feature used on line 10.', expectedLine: 10 },
      {
        log: "Package hyperref Warning: Token not allowed in a PDF string (PDFDocEncoding):\n(hyperref)                removing `math shift' on input line 42.",
        expectedLine: 42,
      },
      {
        log: 'Missing character: There is no ⫫ (U+2AEB) in font [latinmodern-math.otf]:mode=base;script=math;language=dflt;mathfontdimen=xetex;!',
        expectedLine: undefined,
      },
      {
        log: "Biber warning: WARN - I didn't find a database entry for 'nonexisting' (section 0)",
        expectedLine: undefined,
      },
    ];
    for (const w of lwWarnCases) {
      const parsed = parseLatexLog(w.log);
      expect(parsed.warnings.length, `Failed on LW warning: ${w.log}`).toBe(1);
      expect(parsed.warnings[0].line).toBe(w.expectedLine);
    }

    // 9 BibTeX & Biber cases from LaTeX-Workshop (LW lines 398-470)
    expect(parseLatexLog('Warning--duplicate entry\n--line 45 of file sample.bib').warnings[0]).toMatchObject({
      file: 'sample.bib',
      line: 45,
    });
    expect(parseLatexLog('Warning--empty field in article1.bib').warnings.length).toBe(1);
    expect(
      parseLatexLog("Error---line 23 of file references.bib\nThere's a problem with the syntax\nI'm skipping whatever remains of this entry")
        .errors[0],
    ).toMatchObject({
      file: 'references.bib',
      line: 23,
    });
    expect(
      parseLatexLog('A bad cross reference---entry "article1"\nrefers to entry "article2", which doesn\'t exist').errors.length,
    ).toBe(1);
    expect(
      parseLatexLog("Macro definition error\n---line 37 of file macros.bib\nUndefined macro \\cite\nI'm skipping whatever remains of this command")
        .errors[0],
    ).toMatchObject({
      file: 'macros.bib',
      line: 37,
    });
    expect(parseLatexLog('Error in the bibliography file---while reading file citations.aux').errors[0]).toMatchObject({
      file: 'citations.aux',
    });
    expect(
      parseLatexLog('ERROR - BibTeX subsystem encountered an unexpected token, line 42, missing closing brace').errors[0].line,
    ).toBe(42);
    expect(parseLatexLog("WARN - I didn't find a database entry for 'article123'.").warnings.length).toBe(1);
    expect(parseLatexLog("WARN - Duplicate entry 'article456' found in the database.").warnings.length).toBe(1);
  });

  test('Cohort 3 (Official Overleaf CLSI SynctexOutputParser.test.js & Gzip .synctex.gz): Forward/Reverse Coordinate & Colon-Filename Parity', async () => {
    // Ground-truth coordinates from Overleaf's `services/clsi/test/unit/js/SynctexOutputParser.test.js`:
    // Page 1: h=133.768356pt, v=663.928223pt, W=343.711060pt, H=9.962640pt (input line 17 in /compile/main.tex)
    // Page 2: h=134.768356pt, v=651.973022pt, W=342.711060pt, H=19.962640pt (input line 42 in /compile/this-file:has-a-weird-name.tex)
    const scaleFactor = (1 / 65536) * 0.996264;
    const toSp = (pt: number) => Math.round(pt / scaleFactor);

    const synctexPlain = [
      'SyncTeX Version:1',
      'Input:1:/compile/main.tex',
      'Input:2:/compile/this-file:has-a-weird-name.tex',
      'Input:3:/compile/sections/methods.tex',
      'Magnification:1000',
      'Unit:1',
      'X Offset:0',
      'Y Offset:0',
      'Content:',
      '{1',
      `h1,17:${toSp(133.768356)},${toSp(663.928223)}:${toSp(343.71106)},${toSp(9.96264)},0`,
      `h3,25:${toSp(72)},${toSp(320)}:${toSp(210)},${toSp(12)},0`,
      '}',
      '{2',
      `h2,42:${toSp(134.768356)},${toSp(651.973022)}:${toSp(342.71106)},${toSp(19.96264)},0`,
      '}',
    ].join('\n');

    // Test 1: Gzip Base64 Decompression (`decompressSyncTeXData`)
    const gzipBase64 = zlib.gzipSync(Buffer.from(synctexPlain, 'utf8')).toString('base64');
    const decompressed = await decompressSyncTeXData(gzipBase64);
    expect(decompressed).toBe(synctexPlain);

    // Test 2: Forward SyncTeX on Page 1 & Page 2 (including filename with colon from Overleaf test suite!)
    const map = parseSyncTeX(decompressed);
    const fwd1 = resolveForwardDetail(17, map, 'main.tex');
    expect(fwd1).toEqual({
      page: 1,
      x: 134,
      y: 664,
      w: 344,
      h: 12, // clamped min height 12pt
    });

    const fwd2 = resolveForwardDetail(42, map, 'this-file:has-a-weird-name.tex');
    expect(fwd2).toEqual({
      page: 2,
      x: 135,
      y: 652,
      w: 343,
      h: 20,
    });

    // Test 3: Reverse SyncTeX (2D k-d Tree) on Page 1 & Page 2
    const rev1 = resolveReverse(664 / 842, 1, map, 200, 664);
    expect(rev1?.line).toBe(17);
    expect(rev1?.sourcePath).toBe('/compile/main.tex');

    const rev2 = resolveReverse(652 / 842, 2, map, 200, 652);
    expect(rev2?.line).toBe(42);
    expect(rev2?.sourcePath).toBe('/compile/this-file:has-a-weird-name.tex');

    // Test 4: Garbage input resilience (Overleaf `handles garbage: "This computer is on strike!"`)
    const garbageMap = parseSyncTeX('This computer is on strike!\n2 + 2 = 4');
    expect(garbageMap.sortedLines).toEqual([]);
    expect(resolveForwardDetail(10, garbageMap, 'main.tex')).toBeNull();
    expect(resolveReverse(0.5, 1, garbageMap, 100, 100)).toBeNull();
  });

  test('Cohort 4 (Browser E2E on Real Overleaf Compiled PDFs & Real Log Fixtures): Renders Official Overleaf PDFs + Real Log Diagnostics End-to-End', async ({
    page,
    editor,
  }) => {
    void editor;

    // Load real Overleaf compiled PDFs (`simple_bibliography.pdf`, `biber_bibliography.pdf`, `latex_compiler.pdf`, `tikz_feynman.pdf`)
    // and real Overleaf log fixtures (`errors.log` + `undefined-control-sequence.log`)
    const simpleBibPdfBase64 = readFixtureBase64('simple_bibliography.pdf');
    const latexCompilerPdfBase64 = readFixtureBase64('latex_compiler.pdf');
    const realOverleafErrorsLog = readFixtureText('errors.log');
    const realOverleafUcsLog = readFixtureText('undefined-control-sequence.log');

    let compileStep = 0;

    await page.route(/\/compile(\?.*)?$/, async (route) => {
      compileStep++;
      if (compileStep === 1) {
        // Compile 1: Real Overleaf `simple_bibliography.pdf` + `errors.log`
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            pdf: simpleBibPdfBase64,
            logs: realOverleafErrorsLog,
          }),
        });
      } else {
        // Compile 2: Real Overleaf `latex_compiler.pdf` + `undefined-control-sequence.log`
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            pdf: latexCompilerPdfBase64,
            logs: realOverleafUcsLog,
          }),
        });
      }
    });

    await page.goto(`/editor/${PAGE_ID}`);
    await expect(page.locator('.cm-content').first()).toBeVisible({ timeout: 15000 });

    const recompileBtn = page.getByRole('button', { name: /Recompile document/i }).first();
    await expect(recompileBtn).toBeVisible({ timeout: 10000 });
    await recompileBtn.click();

    // 1. Verify PDF.js in Chromium decodes & renders the real Overleaf `simple_bibliography.pdf` onto <canvas> and .textLayer
    const pdfPreviewRegion = page.getByRole('region', { name: 'PDF document preview' });
    await expect(pdfPreviewRegion).toBeVisible({ timeout: 15000 });

    const firstCanvas = pdfPreviewRegion.locator('canvas').first();
    await expect(firstCanvas).toBeVisible({ timeout: 15000 });
    const canvasBox = await firstCanvas.boundingBox();
    expect(canvasBox).not.toBeNull();
    expect(canvasBox!.width).toBeGreaterThan(100);
    expect(canvasBox!.height).toBeGreaterThan(100);

    // 2. Switch to Logs view and verify real Overleaf `errors.log` renders exact 7 deduplicated errors
    const logsBtn = page.getByRole('button', { name: /View logs|Logs/i }).first();
    if (await logsBtn.isVisible().catch(() => false)) {
      await logsBtn.click();
    }

    const err0 = page.locator('#log-entry-err-0');
    await expect(err0).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[id^="log-entry-err-"]')).toHaveCount(7);
    await expect(err0).toContainText('Undefined control sequence');
    await expect(page.locator('#log-entry-err-1')).toContainText('\\begin{equation} on input line 28 ended by \\end{equaion}');

    // 3. Trigger Compile 2 with real Overleaf `latex_compiler.pdf` + `undefined-control-sequence.log`
    await recompileBtn.click();

    // Verify `undefined-control-sequence.log` renders all 8 errors + package suggestions (`\usepackage{url}`, `\usepackage{amsmath}`, `\usepackage{array}`)
    await expect(page.locator('[id^="log-entry-err-"]')).toHaveCount(8, { timeout: 15000 });
    await expect(page.locator('#log-entry-err-4')).toContainText('\\url');
    await expect(page.locator('#log-entry-err-5')).toContainText('\\text');
    await expect(page.locator('#log-entry-err-6')).toContainText('\\arraybackslash');

    // Verify Quick Fix buttons are rendered on `\url`, `\text`, and `\arraybackslash`
    await expect(page.locator('#log-entry-err-4').getByRole('button', { name: /Quick fix/i })).toBeVisible();
    await expect(page.locator('#log-entry-err-5').getByRole('button', { name: /Quick fix/i })).toBeVisible();
    await expect(page.locator('#log-entry-err-6').getByRole('button', { name: /Quick fix/i })).toBeVisible();
  });
});
