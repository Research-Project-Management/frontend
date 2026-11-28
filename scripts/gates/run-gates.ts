/**
 * Single-pass AST Quality Gate Runner for frontend/src.
 *
 * Evaluates 4 deterministic gates per file:
 *   1. no-ts-ignore (zero tolerance — baseline = 0)
 *   2. no-unknown   (SHA-256 syntax-fingerprint baseline)
 *   3. empty-catch  (SHA-256 syntax-fingerprint baseline; allows named catch with reason comment)
 *   4. file-size    (p90 = 600 LOC ceiling; file baseline)
 */
import { readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import ts from 'typescript';
import {
  countFindings,
  readBaseline,
  resolveRepoRoot,
  syntaxFingerprint,
  verifyAgainstBaseline,
  walkTsFiles,
  writeBaseline,
  type Finding,
} from './baseline';

const FILE_SIZE_LIMIT_LOC = 600; // Calibrated from measured frontend p90 = 600 LOC

interface GateConfig {
  id: string;
  baselineFile: string | null;
  remediation: string;
  findings: Finding[];
}

function assertsUnknown(type: ts.TypeNode): boolean {
  if (ts.isParenthesizedTypeNode(type)) return assertsUnknown(type.type);
  return (
    type.kind === ts.SyntaxKind.UnknownKeyword ||
    (ts.isUnionTypeNode(type) && type.types.some(assertsUnknown))
  );
}

function hasCatchReasonComment(clause: ts.CatchClause, source: ts.SourceFile): boolean {
  const hasCommentAt = (pos: number): boolean =>
    (ts.getLeadingCommentRanges(source.text, pos)?.length ?? 0) > 0 ||
    (ts.getTrailingCommentRanges(source.text, pos)?.length ?? 0) > 0;

  const visit = (node: ts.Node): boolean =>
    ts.isToken(node) ? hasCommentAt(node.pos) : node.getChildren(source).some(visit);

  return visit(clause) || (ts.getTrailingCommentRanges(source.text, clause.end)?.length ?? 0) > 0;
}

function isEmptyCatchBlock(block: ts.Block): boolean {
  return block.statements.every((stmt) => ts.isEmptyStatement(stmt));
}

function scanFile(relPath: string, text: string, gates: Record<string, GateConfig>): void {
  const loc = text.split('\n').length;
  if (loc > FILE_SIZE_LIMIT_LOC) {
    gates['file-size'].findings.push({
      file: relPath,
      line: loc,
      fingerprint: 'over-600-loc',
      detail: `${loc} LOC (limit: ${FILE_SIZE_LIMIT_LOC})`,
    });
  }

  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/\/\/\s*@ts-(?:ignore|expect-error|nocheck)\b/.test(line)) {
      gates['no-ts-ignore'].findings.push({
        file: relPath,
        line: i + 1,
        fingerprint: `ts-directive:${i + 1}`,
        detail: line.trim(),
      });
    }
  }

  const source = ts.createSourceFile(relPath, text, ts.ScriptTarget.Latest, true);

  const visit = (node: ts.Node): void => {
    if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) {
      if (assertsUnknown(node.type)) {
        const line = source.getLineAndCharacterOfPosition(node.type.getStart(source)).line + 1;
        gates['no-unknown'].findings.push({
          file: relPath,
          line,
          fingerprint: syntaxFingerprint(node, source),
        });
      }
    }

    if (ts.isCatchClause(node) && isEmptyCatchBlock(node.block)) {
      const unnamed = node.variableDeclaration === undefined;
      const unexplained = !hasCatchReasonComment(node, source);
      if (unnamed || unexplained) {
        const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
        const defects = [unnamed ? 'unnamed' : '', unexplained ? 'unexplained' : '']
          .filter(Boolean)
          .join('+');
        gates['empty-catch'].findings.push({
          file: relPath,
          line,
          fingerprint: syntaxFingerprint(node, source, defects),
          detail: defects,
        });
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(source);
}

function main(): void {
  const started = performance.now();
  const repoRoot = resolveRepoRoot();
  const args = process.argv.slice(2);
  const updateBaseline = args.includes('--update-baseline');
  const prune = args.includes('--prune');
  const fileArgs = args.filter((a) => !a.startsWith('--'));

  if ((updateBaseline || prune) && fileArgs.length > 0) {
    console.error('Error: --update-baseline and --prune require a full scan (no file arguments).');
    process.exit(1);
  }

  const targetFiles =
    fileArgs.length > 0
      ? fileArgs
          .map((f) => relative(repoRoot, resolve(repoRoot, f)).replaceAll('\\', '/'))
          .filter(
            (f) =>
              f.startsWith('src/') &&
              (f.endsWith('.ts') || f.endsWith('.tsx')) &&
              !f.endsWith('.d.ts'),
          )
      : walkTsFiles(resolve(repoRoot, 'src'), repoRoot);

  const scopedSet = fileArgs.length > 0 ? new Set(targetFiles) : undefined;
  const baselineDir = resolve(repoRoot, 'scripts/gates/baselines');

  const gates: Record<string, GateConfig> = {
    'no-ts-ignore': {
      id: 'no-ts-ignore',
      baselineFile: null,
      remediation: 'Remove @ts-ignore/@ts-expect-error/@ts-nocheck and fix the underlying TypeScript type.',
      findings: [],
    },
    'no-unknown': {
      id: 'no-unknown',
      baselineFile: resolve(baselineDir, 'no-unknown.json'),
      remediation: 'Avoid new `as unknown` casts. Narrow with a type guard or align component/API types.',
      findings: [],
    },
    'empty-catch': {
      id: 'empty-catch',
      baselineFile: resolve(baselineDir, 'empty-catch.json'),
      remediation: 'Name the error (e.g. `catch (err)`) and add a brief comment explaining why ignoring it is safe.',
      findings: [],
    },
    'file-size': {
      id: 'file-size',
      baselineFile: resolve(baselineDir, 'file-size.json'),
      remediation: `New files must stay <= ${FILE_SIZE_LIMIT_LOC} LOC (measured p90). Split components or extract hooks/helpers.`,
      findings: [],
    },
  };

  for (const relPath of targetFiles) {
    const text = readFileSync(resolve(repoRoot, relPath), 'utf8');
    scanFile(relPath, text, gates);
  }

  if (updateBaseline) {
    for (const gate of Object.values(gates)) {
      if (!gate.baselineFile) continue;
      writeBaseline(gate.baselineFile, countFindings(gate.findings));
      console.log(`[baseline] ${gate.id}: recorded ${gate.findings.length} legacy entries`);
    }
    console.log(`Done in ${Math.round(performance.now() - started)}ms (${targetFiles.length} files).`);
    return;
  }

  let failed = false;
  for (const gate of Object.values(gates)) {
    const baseline = gate.baselineFile ? readBaseline(gate.baselineFile) : {};
    const res = verifyAgainstBaseline(gate.findings, baseline, scopedSet);

    if (res.newViolations.length > 0) {
      failed = true;
      console.error(`\n✖ Gate "${gate.id}" failed (${res.newViolations.length} new violation(s)):`);
      console.error(`  Fix: ${gate.remediation}`);
      for (const v of res.newViolations.slice(0, 20)) {
        const extra = v.detail ? ` [${v.detail}]` : '';
        console.error(`  - ${v.file}:${v.line}${extra} (${v.fingerprint})`);
      }
      if (res.newViolations.length > 20) {
        console.error(`  ... and ${res.newViolations.length - 20} more.`);
      }
    } else {
      if (prune && gate.baselineFile && res.staleEntries > 0) {
        writeBaseline(gate.baselineFile, countFindings(gate.findings));
        console.log(`✔ ${gate.id}: 0 new violations (pruned ${res.staleEntries} retired legacy entries; ${res.totalObserved} remain)`);
      } else {
        const staleHint =
          !scopedSet && res.staleEntries > 0
            ? ` — ${res.staleEntries} legacy entries can be retired via \`pnpm run verify:gates:prune\``
            : '';
        console.log(`✔ ${gate.id}: 0 new violations (${res.totalObserved} legacy tracked)${staleHint}`);
      }
    }
  }

  console.log(`Gates completed in ${Math.round(performance.now() - started)}ms (${targetFiles.length} files).`);
  if (failed) process.exit(1);
}

main();
