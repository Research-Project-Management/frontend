/**
 * ai.util.ts — AI Assistant utilities (Slash commands, prompt routing & Monaco live diff editing)
 */

import type React from 'react';

// ── 1. Slash Commands ─────────────────────────────────────────────────────────

export interface SlashCommand {
  cmd: string;
  label: string;
  description: string;
  hint: string;
  needsSelection?: boolean;
}

export const SLASH_COMMANDS: SlashCommand[] = [
  { cmd: "/fix", label: "Fix errors", description: "Fix LaTeX compile errors", hint: "fix", needsSelection: false },
  { cmd: "/explain", label: "Explain", description: "Explain selected code", hint: "explain", needsSelection: true },
  { cmd: "/refactor", label: "Refactor", description: "Rewrite selection for clarity", hint: "refactor", needsSelection: true },
  { cmd: "/complete", label: "Complete here", description: "Continue writing at cursor", hint: "complete", needsSelection: false },
  { cmd: "/table", label: "Generate table", description: "Create a LaTeX table", hint: "table", needsSelection: false },
  { cmd: "/equation", label: "Equation", description: "Generate a LaTeX equation", hint: "equation", needsSelection: false },
  { cmd: "/cite", label: "Citation", description: "Suggest citation format", hint: "cite", needsSelection: true },
  { cmd: "/section", label: "New section", description: "Generate section structure", hint: "section", needsSelection: false },
  { cmd: "/abstract", label: "Improve abstract", description: "Rewrite abstract academically", hint: "abstract", needsSelection: true },
  { cmd: "/translate", label: "Translate", description: "Translate selection to English", hint: "translate", needsSelection: true },
];

export interface ExtractedCodeBlock {
  language: string;
  code: string;
}

export function extractCodeBlocks(markdown: string): ExtractedCodeBlock[] {
  if (!markdown) return [];
  const blocks: ExtractedCodeBlock[] = [];
  const regex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(markdown)) !== null) {
    blocks.push({
      language: match[1].toLowerCase() || "latex",
      code: match[2].trimEnd(),
    });
  }

  return blocks;
}

export function resolveSlashCommandPrompt(
  command: string,
  userPrompt: string,
  selectedText?: string
): string {
  const cleanCmd = command.trim().toLowerCase();
  const trailing = userPrompt.replace(new RegExp(`^${cleanCmd}\\s*`, "i"), "").trim();

  switch (cleanCmd) {
    case "/fix":
      return `Please inspect the compilation logs and current LaTeX source to find and fix errors.${trailing ? ` Additional note: ${trailing}` : ""}`;
    case "/explain":
      return `Please provide a clear explanation of this LaTeX code snippet:${selectedText ? `\n\`\`\`latex\n${selectedText}\n\`\`\`` : ""}${trailing ? `\nQuestion: ${trailing}` : ""}`;
    case "/refactor":
      return `Please refactor and optimize this LaTeX code for readability, typography, and standard conventions:${selectedText ? `\n\`\`\`latex\n${selectedText}\n\`\`\`` : ""}${trailing ? `\nInstructions: ${trailing}` : ""}`;
    case "/complete":
      return `Continue writing naturally from the cursor position:${selectedText ? `\nContext:\n\`\`\`latex\n${selectedText}\n\`\`\`` : ""}${trailing ? `\nGoal: ${trailing}` : ""}`;
    case "/table":
      return `Generate a clean, publication-ready LaTeX table with booktabs formatting.${trailing ? ` Details: ${trailing}` : ""}`;
    case "/equation":
      return `Generate the LaTeX equations and math environment for the following concept.${trailing ? ` Description: ${trailing}` : ""}`;
    case "/cite":
      return `Suggest appropriate citation formatting and BibTeX key usage.${trailing ? ` Reference info: ${trailing}` : ""}`;
    case "/section":
      return `Structure a complete LaTeX section with clear subsections, introductory paragraph, and labels.${trailing ? ` Topic: ${trailing}` : ""}`;
    default:
      return userPrompt;
  }
}

// ── 2. AI Monaco Edit Types ───────────────────────────────────────────────────

export type {
  AiEditIntent,
  AiEditOperation,
  AiEditResponse,
  AiEditValidationResult,
  AiEditPreviewHandle,
  LatexCommandRange,
  ParsedCodeBlock,
  ParsedAiResponse,
  EditorEditContext,
} from '../types/ai-edit.types';

import type {
  AiEditIntent,
  AiEditOperation,
  AiEditResponse,
  AiEditValidationResult,
  AiEditPreviewHandle,
  LatexCommandRange,
  ParsedAiResponse,
  EditorEditContext,
} from '../types/ai-edit.types';

// ── 3. Edit Validation ────────────────────────────────────────────────────────

export function validateEdits(
  edits: AiEditOperation[],
  totalLines: number,
  fileContent: string,
): AiEditValidationResult {
  const errors: string[] = [];
  const lines = fileContent.split('\n');
  let totalReplacedChars = 0;
  const totalChars = fileContent.length || 1;

  for (let i = 0; i < edits.length; i++) {
    const edit = edits[i];
    const idx = i + 1;

    if (edit.startLineNumber < 1 || edit.startLineNumber > totalLines)
      errors.push(`Edit ${idx}: startLine ${edit.startLineNumber} out of range (1–${totalLines})`);
    if (edit.endLineNumber < 1 || edit.endLineNumber > totalLines)
      errors.push(`Edit ${idx}: endLine ${edit.endLineNumber} out of range (1–${totalLines})`);
    if (edit.startColumn < 1) errors.push(`Edit ${idx}: startColumn must be ≥ 1`);
    if (edit.endColumn < 1) errors.push(`Edit ${idx}: endColumn must be ≥ 1`);
    if (edit.startLineNumber > edit.endLineNumber)
      errors.push(`Edit ${idx}: startLine > endLine`);

    if (edit.type === 'replace' || edit.type === 'delete') {
      const sl = Math.max(0, edit.startLineNumber - 1);
      const el = Math.min(lines.length - 1, edit.endLineNumber - 1);
      for (let l = sl; l <= el; l++) {
        const len = (lines[l] || '').length;
        if (l === sl && l === el) totalReplacedChars += Math.max(0, edit.endColumn - edit.startColumn);
        else if (l === sl) totalReplacedChars += Math.max(0, len - edit.startColumn + 1);
        else if (l === el) totalReplacedChars += edit.endColumn;
        else totalReplacedChars += len;
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    replacementRatio: totalReplacedChars / totalChars,
  };
}

export function isEditSafe(
  result: AiEditValidationResult,
  intent: AiEditIntent,
  threshold = 0.6,
): boolean {
  if (intent === 'append_to_file' || intent === 'no_change') return true;
  if (!result.valid) return false;
  return result.replacementRatio <= threshold;
}

export interface DiffHunk {
  index: number;
  startLine: number;
  endLine: number;
  oldText: string;
  newText: string;
  description?: string;
}

export interface ConflictItem {
  startLine: number;
  endLine: number;
  currentText: string;
  expectedText: string;
}

export interface ConflictResult {
  hasConflict: boolean;
  conflicts: ConflictItem[];
}

export const AiPatchEngine = {
  extractOldText(fileContent: string, edit: AiEditOperation): string {
    const lines = fileContent.split('\n');
    const sl = edit.startLineNumber - 1;
    const el = edit.endLineNumber - 1;
    if (sl < 0 || sl >= lines.length) return '';
    if (sl === el) {
      return (lines[sl] || '').slice(edit.startColumn - 1, edit.endColumn - 1);
    }
    const parts: string[] = [];
    parts.push((lines[sl] || '').slice(edit.startColumn - 1));
    for (let i = sl + 1; i < el && i < lines.length; i++) parts.push(lines[i] || '');
    if (el < lines.length) parts.push((lines[el] || '').slice(0, edit.endColumn - 1));
    return parts.join('\n');
  },

  computeHunks(fileContent: string, edits: AiEditOperation[]): DiffHunk[] {
    return edits.map((edit, index) => ({
      index,
      startLine: edit.startLineNumber,
      endLine: edit.endLineNumber,
      oldText: AiPatchEngine.extractOldText(fileContent, edit),
      newText: edit.text || '',
      description: edit.description,
    }));
  },

  validate(edits: AiEditOperation[], totalLines: number, fileContent: string): AiEditValidationResult {
    return validateEdits(edits, totalLines, fileContent);
  },

  isSafe(result: AiEditValidationResult, intent: AiEditIntent, threshold = 0.6): boolean {
    return isEditSafe(result, intent, threshold);
  },

  detectConflict(
    baseContent: string,
    currentMainContent: string,
    edits: AiEditOperation[],
  ): ConflictResult {
    if (baseContent === currentMainContent || !edits.length) {
      return { hasConflict: false, conflicts: [] };
    }

    const baseLines = baseContent.split('\n');
    const mainLines = currentMainContent.split('\n');
    const conflicts: ConflictItem[] = [];

    for (const edit of edits) {
      const sl = edit.startLineNumber - 1;
      const el = edit.endLineNumber - 1;

      const baseSlice = baseLines.slice(sl, el + 1).join('\n');
      const mainSlice = mainLines.slice(sl, el + 1).join('\n');

      if (baseSlice !== mainSlice) {
        conflicts.push({
          startLine: edit.startLineNumber,
          endLine: edit.endLineNumber,
          currentText: mainSlice,
          expectedText: baseSlice,
        });
      }
    }

    return {
      hasConflict: conflicts.length > 0,
      conflicts,
    };
  },

  applyAtomicToString(
    fileContent: string,
    edits: AiEditOperation[],
  ): { updatedContent: string; affected: { startLine: number; endLine: number } | null } {
    if (!edits.length) return { updatedContent: fileContent, affected: null };
    const sorted = [...edits].sort((a, b) => {
      if (b.startLineNumber !== a.startLineNumber) return b.startLineNumber - a.startLineNumber;
      return b.startColumn - a.startColumn;
    });

    const lines = fileContent.split('\n');
    for (const edit of sorted) {
      const sl = edit.startLineNumber - 1;
      const el = edit.endLineNumber - 1;
      const sc = edit.startColumn - 1;
      const ec = edit.endColumn - 1;

      const before = (lines[sl] || '').slice(0, sc);
      const after = (lines[el] || '').slice(ec);
      const replacementLines = (edit.text || '').split('\n');

      if (replacementLines.length === 1) {
        lines.splice(sl, el - sl + 1, before + replacementLines[0] + after);
      } else {
        const merged: string[] = [
          before + replacementLines[0],
          ...replacementLines.slice(1, -1),
          replacementLines[replacementLines.length - 1] + after,
        ];
        lines.splice(sl, el - sl + 1, ...merged);
      }
    }

    return {
      updatedContent: lines.join('\n'),
      affected: calcAffected(edits),
    };
  },
};

// ── 4. Monaco Operations ──────────────────────────────────────────────────────

function buildMonacoEdits(edits: AiEditOperation[], model: any) {
  const totalLines = model.getLineCount();
  return edits.map((edit) => {
    const sl = Math.max(1, Math.min(edit.startLineNumber, totalLines));
    const el = Math.max(1, Math.min(edit.endLineNumber, totalLines));
    const sc = Math.max(1, edit.startColumn);
    const lineMaxCol = model.getLineMaxColumn(el);
    const ec =
      edit.type === 'insert'
        ? sc
        : Math.min(Math.max(1, edit.endColumn), lineMaxCol + 1);
    return {
      range: { startLineNumber: sl, startColumn: sc, endLineNumber: el, endColumn: ec },
      text: edit.type === 'delete' ? '' : (edit.text ?? ''),
      forceMoveMarkers: true,
    };
  });
}

function calcAffected(edits: AiEditOperation[]): { startLine: number; endLine: number } | null {
  if (!edits.length) return null;
  const starts = edits.map((e) => e.startLineNumber);
  const ends = edits.map((e) => {
    const addedLines = (e.text || '').split('\n').length - 1;
    return e.startLineNumber + addedLines;
  });
  return { startLine: Math.min(...starts), endLine: Math.max(...ends) };
}

export function applyEditsToEditor(
  editor: any,
  edits: AiEditOperation[],
): { startLine: number; endLine: number } | null {
  const model = editor.getModel();
  if (!model) return null;

  const monacoEdits = buildMonacoEdits(edits, model);

  editor.pushUndoStop();
  editor.executeEdits('ai-assistant', monacoEdits);
  editor.pushUndoStop();

  const first = monacoEdits[0];
  if (first) {
    editor.revealLineInCenter(first.range.startLineNumber);
    const insertedLines = (first.text || '').split('\n');
    const newEndLine = first.range.startLineNumber + insertedLines.length - 1;
    const newEndCol =
      insertedLines.length === 1
        ? first.range.startColumn + insertedLines[0].length
        : insertedLines[insertedLines.length - 1].length + 1;
    editor.setPosition({ lineNumber: newEndLine, column: newEndCol });
  }
  editor.focus();

  return calcAffected(edits);
}

const PREVIEW_CLASS = 'ai-edit-preview-line';

export function previewEditsInEditor(
  editor: any,
  edits: AiEditOperation[],
  isAiPreviewingRef: React.MutableRefObject<boolean>,
): AiEditPreviewHandle {
  const model = editor.getModel();
  if (!model) {
    return { snapshot: '', cursorSnapshot: null, clearDecorations: () => {}, affected: null };
  }

  const snapshot = model.getValue();
  const cursorSnapshot = editor.getPosition() ?? null;
  const monacoEdits = buildMonacoEdits(edits, model);

  isAiPreviewingRef.current = true;
  editor.executeEdits('ai-preview', monacoEdits);
  setTimeout(() => { isAiPreviewingRef.current = false; }, 0);

  const affected = calcAffected(edits);
  const decorationRanges: any[] = [];

  if (affected) {
    const lineCount = model.getLineCount();
    for (let ln = affected.startLine; ln <= Math.min(affected.endLine, lineCount); ln++) {
      decorationRanges.push({
        range: { startLineNumber: ln, startColumn: 1, endLineNumber: ln, endColumn: 1 },
        options: { isWholeLine: true, className: PREVIEW_CLASS },
      });
    }
  }

  const collection = editor.createDecorationsCollection(decorationRanges);
  if (affected) editor.revealLineInCenter(affected.startLine);

  return {
    snapshot,
    cursorSnapshot,
    clearDecorations: () => { try { collection.clear(); } catch { /* disposed */ } },
    affected,
  };
}

const HIGHLIGHT_CLASS = 'ai-edit-highlight-line';

export function highlightLines(
  editor: any,
  startLine: number,
  endLine: number,
  durationMs = 1500,
): void {
  const coll = editor.createDecorationsCollection([
    {
      range: { startLineNumber: startLine, startColumn: 1, endLineNumber: endLine, endColumn: 1 },
      options: { isWholeLine: true, className: HIGHLIGHT_CLASS },
    },
  ]);
  setTimeout(() => { try { coll.clear(); } catch { /* disposed */ } }, durationMs);
}

// ── 5. LaTeX Command Helpers ──────────────────────────────────────────────────

export function findLatexCommandRange(
  content: string,
  commandName: string,
): LatexCommandRange | null {
  const lines = content.split('\n');
  const cmdPattern = new RegExp(`\\\\${commandName}\\s*\\{`);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = cmdPattern.exec(line);
    if (!match) continue;

    const cmdStart = match.index;
    const braceOpenPos = cmdStart + match[0].length;

    let depth = 1;
    let endLine = i;
    let endCol = -1;
    let searchDone = false;

    for (let c = braceOpenPos; c < line.length; c++) {
      if (line[c] === '{') depth++;
      else if (line[c] === '}') {
        depth--;
        if (depth === 0) { endCol = c; searchDone = true; break; }
      }
    }

    if (!searchDone) {
      for (let j = i + 1; j < lines.length && !searchDone; j++) {
        const nl = lines[j];
        for (let c = 0; c < nl.length; c++) {
          if (nl[c] === '{') depth++;
          else if (nl[c] === '}') {
            depth--;
            if (depth === 0) { endLine = j; endCol = c; searchDone = true; break; }
          }
        }
      }
    }

    if (!searchDone) continue;

    let innerText: string;
    if (endLine === i) {
      innerText = line.slice(braceOpenPos, endCol);
    } else {
      const parts = [line.slice(braceOpenPos)];
      for (let j = i + 1; j < endLine; j++) parts.push(lines[j]);
      parts.push(lines[endLine].slice(0, endCol));
      innerText = parts.join('\n');
    }

    const fullText =
      endLine === i
        ? line.slice(cmdStart, endCol + 1)
        : [line.slice(cmdStart), ...lines.slice(i + 1, endLine), lines[endLine].slice(0, endCol + 1)].join('\n');

    return {
      fullText,
      innerText,
      lineNumber: i + 1,
      startLineNumber: i + 1,
      startColumn: cmdStart + 1,
      endLineNumber: endLine + 1,
      endColumn: endCol + 2,
    };
  }

  return null;
}

export function replaceLatexCommandValue(
  content: string,
  commandName: string,
  newValue: string,
): AiEditOperation | null {
  const range = findLatexCommandRange(content, commandName);
  if (!range) return null;
  return {
    type: 'replace',
    startLineNumber: range.startLineNumber,
    startColumn: range.startColumn,
    endLineNumber: range.endLineNumber,
    endColumn: range.endColumn,
    text: `\\${commandName}{${newValue}}`,
  };
}

export function getEditorEditContext(editor: any, filename: string): EditorEditContext {
  const model = editor.getModel();
  const fileContent = model?.getValue() ?? '';
  const totalLines = model?.getLineCount() ?? 0;
  const position = editor.getPosition();
  const selection = editor.getSelection();

  const cursorLine = position?.lineNumber ?? 1;
  const cursorColumn = position?.column ?? 1;

  const hasSelection =
    selection &&
    (selection.startLineNumber !== selection.endLineNumber ||
      selection.startColumn !== selection.endColumn);

  const selectedText = hasSelection && model ? model.getValueInRange(selection) : '';

  const padWidth = String(fileContent.split('\n').length).length;
  const fileContentWithLineNumbers = fileContent
    .split('\n')
    .map((line: string, i: number) => `${String(i + 1).padStart(padWidth, ' ')}: ${line}`)
    .join('\n');

  const hasFullDocument =
    /\\documentclass/.test(fileContent) &&
    /\\begin\{document\}/.test(fileContent) &&
    /\\end\{document\}/.test(fileContent);

  return {
    fileContent,
    fileContentWithLineNumbers,
    totalLines,
    filename,
    cursorLine,
    cursorColumn,
    selectedText,
    selectionStartLine: hasSelection ? selection.startLineNumber : null,
    selectionStartColumn: hasSelection ? selection.startColumn : null,
    selectionEndLine: hasSelection ? selection.endLineNumber : null,
    selectionEndColumn: hasSelection ? selection.endColumn : null,
    hasFullDocument,
  };
}

export function tryLocalCommandEdit(
  content: string,
  userPrompt: string,
): { op: AiEditOperation; explanation: string } | null {
  const prompt = userPrompt.trim();

  function extractValue(trigger: string): string {
    const idx = prompt.toLowerCase().indexOf(trigger.toLowerCase());
    if (idx === -1) return '';
    return prompt.slice(idx + trigger.length).trim().replace(/^[""\u201c\u201d']+|[""\u201c\u201d']+$/g, '').trim();
  }

  const valueTriggers = [' to ', ' thành ', ' sang ', ' là ', '→ ', ':  '];

  const checks: Array<{ test: RegExp; cmd: string; label: string }> = [
    { test: /sửa\s+title|change\s+(?:the\s+)?title|update\s+(?:the\s+)?title|set\s+(?:the\s+)?title|đổi\s+title|thay\s+title/i, cmd: 'title', label: '\\title' },
    { test: /sửa\s+author|change\s+(?:the\s+)?author|update\s+(?:the\s+)?author|set\s+(?:the\s+)?author|đổi\s+author/i, cmd: 'author', label: '\\author' },
    { test: /sửa\s+date|change\s+(?:the\s+)?date|set\s+(?:the\s+)?date/i, cmd: 'date', label: '\\date' },
    { test: /sửa\s+abstract|rewrite\s+(?:the\s+)?abstract/i, cmd: 'abstract', label: '\\abstract' },
  ];

  for (const { test, cmd, label } of checks) {
    if (test.test(prompt)) {
      for (const trigger of valueTriggers) {
        const v = extractValue(trigger);
        if (v) {
          const op = replaceLatexCommandValue(content, cmd, v);
          if (op) return { op, explanation: `Changed ${label} to "${v}"` };
        }
      }
    }
  }

  return null;
}

// ── 6. AI Response Parser ─────────────────────────────────────────────────────

function tryParseJson(text: string): any | null {
  try { return JSON.parse(text); } catch { return null; }
}

function isValidAiEditResponse(obj: any): obj is AiEditResponse {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    typeof obj.intent === 'string' &&
    typeof obj.explanation === 'string' &&
    Array.isArray(obj.edits)
  );
}

function extractJsonObject(text: string): string | null {
  const fenceMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (fenceMatch) return fenceMatch[1];
  const bareMatch = text.match(/(?:^|\n)\s*(\{[\s\S]*\})\s*(?:\n|$)/);
  if (bareMatch) return bareMatch[1];
  return null;
}

interface ParsedBlock { lang: string; code: string; start: number; end: number; }

function extractResponseBlocks(text: string): ParsedBlock[] {
  const blocks: ParsedBlock[] = [];
  const lines = text.split('\n');
  let inBlock = false;
  let lang = '';
  let codeLines: string[] = [];
  let blockStart = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!inBlock && line.trim().startsWith('```')) {
      inBlock = true;
      lang = line.trim().slice(3).trim().toLowerCase();
      codeLines = [];
      blockStart = i;
    } else if (inBlock && line.trim() === '```') {
      blocks.push({ lang, code: codeLines.join('\n'), start: blockStart, end: i });
      inBlock = false;
      lang = '';
      codeLines = [];
    } else if (inBlock) {
      codeLines.push(line);
    }
  }
  return blocks;
}

function legacyOpToEditOperation(op: any): AiEditOperation | null {
  if (op.action === 'replace_lines' && op.startLine && op.endLine) {
    return { type: 'replace', startLineNumber: op.startLine, startColumn: 1, endLineNumber: op.endLine, endColumn: 9999, text: op.newContent ?? '' };
  }
  if (op.action === 'insert_after' && op.afterLine) {
    return { type: 'insert', startLineNumber: op.afterLine, startColumn: 9999, endLineNumber: op.afterLine, endColumn: 9999, text: '\n' + (op.newContent ?? '') };
  }
  if (op.action === 'insert_before' && op.beforeLine) {
    return { type: 'insert', startLineNumber: op.beforeLine, startColumn: 1, endLineNumber: op.beforeLine, endColumn: 1, text: (op.newContent ?? '') + '\n' };
  }
  if (op.action === 'delete_lines' && op.startLine && op.endLine) {
    return { type: 'delete', startLineNumber: op.startLine, startColumn: 1, endLineNumber: op.endLine, endColumn: 9999, text: '' };
  }
  return null;
}

function diffBlockToEdits(diffLines: string[], fileContent: string): AiEditOperation[] | null {
  const fileLines = fileContent.split('\n');
  const removedLines = diffLines.filter((l) => l.startsWith('-') && !l.startsWith('---')).map((l) => l.slice(1));
  const addedLines = diffLines.filter((l) => l.startsWith('+') && !l.startsWith('+++')).map((l) => l.slice(1));

  if (removedLines.length === 0 && addedLines.length === 0) return null;

  if (removedLines.length > 0) {
    const target = removedLines[0].trim();
    for (let i = 0; i < fileLines.length; i++) {
      if (fileLines[i].trim() === target) {
        let matches = true;
        for (let j = 1; j < removedLines.length; j++) {
          if (i + j >= fileLines.length || fileLines[i + j].trim() !== removedLines[j].trim()) {
            matches = false;
            break;
          }
        }
        if (matches) {
          return [{
            type: 'replace',
            startLineNumber: i + 1,
            startColumn: 1,
            endLineNumber: i + removedLines.length,
            endColumn: (fileLines[i + removedLines.length - 1] || '').length + 1,
            text: addedLines.join('\n'),
          }];
        }
      }
    }
  }
  return null;
}

function extractExplanationText(rawText: string, blocks: ParsedBlock[]): string {
  const lines = rawText.split('\n');
  const blockLineSet = new Set<number>();
  for (const b of blocks) {
    for (let i = b.start; i <= b.end; i++) blockLineSet.add(i);
  }
  return lines.filter((_, i) => !blockLineSet.has(i)).join('\n').trim();
}

export function parseAiResponse(rawText: string, fileContent = ''): ParsedAiResponse {
  const result: ParsedAiResponse = {
    explanation: '',
    edits: [],
    intent: 'no_change',
    hasEdits: false,
    codeBlocks: [],
    safetyWarning: null,
  };

  if (!rawText?.trim()) return result;

  const blocks = extractResponseBlocks(rawText);

  for (const block of blocks) {
    if (block.lang === 'json' || block.lang === '') {
      const parsed = tryParseJson(block.code);
      if (parsed && isValidAiEditResponse(parsed) && parsed.edits.length > 0) {
        result.intent = parsed.intent as AiEditIntent;
        result.explanation = parsed.explanation;
        result.edits = parsed.edits;
        result.hasEdits = true;
        const totalChars = fileContent.length || 1;
        let replacedChars = 0;
        for (const edit of parsed.edits) {
          if (edit.type !== 'insert') replacedChars += (edit.text || '').length || 200;
        }
        if (replacedChars / totalChars > 0.6) {
          result.safetyWarning = '⚠️ This edit affects a large portion of your file. Review carefully.';
        }
        return result;
      }
    }
  }

  const bareJson = extractJsonObject(rawText);
  if (bareJson) {
    const parsed = tryParseJson(bareJson);
    if (parsed && isValidAiEditResponse(parsed) && parsed.edits.length > 0) {
      result.intent = parsed.intent as AiEditIntent;
      result.explanation = parsed.explanation;
      result.edits = parsed.edits;
      result.hasEdits = true;
      return result;
    }
  }

  const applyEdits: AiEditOperation[] = [];
  for (const block of blocks) {
    if (block.lang === 'apply') {
      const parsed = tryParseJson(block.code);
      if (parsed) {
        const op = legacyOpToEditOperation(parsed);
        if (op) applyEdits.push(op);
      }
    }
  }
  if (applyEdits.length > 0) {
    result.intent = 'replace_range';
    result.edits = applyEdits;
    result.hasEdits = true;
    result.explanation = extractExplanationText(rawText, blocks);
    return result;
  }

  for (const block of blocks) {
    if (block.lang === 'diff') {
      const ops = diffBlockToEdits(block.code.split('\n'), fileContent);
      if (ops) {
        result.intent = 'replace_range';
        result.edits = ops;
        result.hasEdits = true;
        result.explanation = extractExplanationText(rawText, blocks);
        result.codeBlocks.push({ lang: 'diff', code: block.code });
        return result;
      }
      result.codeBlocks.push({ lang: 'diff', code: block.code });
    }
  }

  for (const block of blocks) {
    if (['latex', 'tex', ''].includes(block.lang) && block.lang !== 'diff' && block.lang !== 'apply' && block.lang !== 'json') {
      result.codeBlocks.push({ lang: block.lang || 'latex', code: block.code });
    }
  }

  result.explanation = extractExplanationText(rawText, blocks);
  return result;
}

// ── 7. Aliases ────────────────────────────────────────────────────────────────

export const applyAiEdits = applyEditsToEditor;
export const highlightEditedLines = highlightLines;
export const validateAiEdits = validateEdits;
export const parseAiEditResponse = (rawText: string) => {
  const r = parseAiResponse(rawText);
  return r.hasEdits ? { intent: r.intent, explanation: r.explanation, edits: r.edits } : null;
};
export const previewAiEdits = (editor: any, edits: AiEditOperation[]) => {
  const dummyRef = { current: false };
  return previewEditsInEditor(editor, edits, dummyRef);
};
export const parseDiffToEdits = (diffText: string, fileContent: string): AiEditOperation[] => {
  const ops = diffBlockToEdits(diffText.split('\n'), fileContent);
  return ops ?? [];
};
