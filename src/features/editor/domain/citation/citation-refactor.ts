/**
 * citation-refactor.ts
 *
 * Pure Domain Engine for Project-Wide Citation Key Refactoring & Renaming.
 * Location: `features/editor/domain/citation/citation-refactor.ts`
 *
 * Responsibilities:
 * - Validates citation keys according to BibTeX / BibLaTeX / Natbib standards.
 * - Safely refactors citation keys across BibTeX entries without corrupting metadata.
 * - Accurately updates all LaTeX citation macros (\cite, \citep, \citet, \autocite, \nocite)
 *   and Pandoc Markdown citations (@key, [@key1; @key2]).
 * - Substring-safe: renaming 'lee20' will NEVER corrupt 'lee2020' or 'lee20a'.
 * - Pure TypeScript with zero UI or DOM dependencies; 100% testable.
 */

export interface ValidateKeyResult {
  isValid: boolean;
  error?: string;
}

export interface RefactorFileResult {
  content: string;
  count: number;
}

export interface ProjectRefactorResult {
  modifiedFiles: Array<{
    id: string;
    path: string;
    oldContent: string;
    newContent: string;
    count: number;
  }>;
  totalCount: number;
}

/**
 * Escapes special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Validates a citation key string
 */
export function validateCitationKey(key: string, oldKey?: string): ValidateKeyResult {
  const trimmed = (key || '').trim();

  if (!trimmed) {
    return { isValid: false, error: 'Khóa trích dẫn không được để trống.' };
  }

  if (trimmed.startsWith('@')) {
    return {
      isValid: false,
      error: 'Khóa trích dẫn không cần chứa ký tự @ ở đầu (hệ thống sẽ tự nhận diện).',
    };
  }

  if (/\s/.test(trimmed)) {
    return { isValid: false, error: 'Khóa trích dẫn không được chứa khoảng trắng.' };
  }

  if (/[\\{},~"%\$\^]/.test(trimmed)) {
    return {
      isValid: false,
      error: 'Khóa trích dẫn không được chứa các ký tự đặc biệt ({ }, \\, ~, ", %, $, ^).',
    };
  }

  if (oldKey && trimmed.toLowerCase() === oldKey.trim().toLowerCase()) {
    return {
      isValid: false,
      error: 'Khóa trích dẫn mới phải khác với khóa trích dẫn hiện tại.',
    };
  }

  // Standard BibTeX citation key regex: alphanumeric + allowed punctuation (_ : - .)
  const validPattern = /^[a-zA-Z0-9_:.#/-]+$/;
  if (!validPattern.test(trimmed)) {
    return {
      isValid: false,
      error: 'Khóa trích dẫn chỉ được chứa chữ cái, số và các ký tự: _ : - . # /',
    };
  }

  return { isValid: true };
}

/**
 * Refactors a citation key inside BibTeX bibliography source text.
 * Replaces `@type{oldKey,` and `key = {oldKey}` while preserving all inner formatting.
 */
export function refactorCitationKeyInBibTeX(
  bibContent: string,
  oldKey: string,
  newKey: string
): RefactorFileResult {
  if (!bibContent || !oldKey || !newKey || oldKey === newKey) {
    return { content: bibContent, count: 0 };
  }

  let count = 0;
  const escapedOld = escapeRegex(oldKey);

  // 1. Match BibTeX entry definition: @type{oldKey, or @type(oldKey,
  const entryDefRegex = new RegExp(
    `(@[a-zA-Z0-9_-]+\\s*[{()]\\s*)(${escapedOld})(\\s*,)`,
    'gi'
  );

  let updated = bibContent.replace(entryDefRegex, (_match, prefix, _key, suffix) => {
    count++;
    return `${prefix}${newKey}${suffix}`;
  });

  // 2. Match optional key = {oldKey} or key = "oldKey" fields inside BibTeX entries
  const keyFieldRegex = new RegExp(
    `(\\bkey\\s*=\\s*[{"]\\s*)(${escapedOld})(\\s*[}"]\\s*,?)`,
    'gi'
  );

  updated = updated.replace(keyFieldRegex, (_match, prefix, _key, suffix) => {
    count++;
    return `${prefix}${newKey}${suffix}`;
  });

  return { content: updated, count };
}

/**
 * Refactors citation keys in LaTeX / Pandoc Markdown source text.
 * Strictly matches command arguments and boundary-delimited Pandoc citations.
 */
export function refactorCitationKeyInLatex(
  text: string,
  oldKey: string,
  newKey: string
): RefactorFileResult {
  if (!text || !oldKey || !newKey || oldKey === newKey) {
    return { content: text, count: 0 };
  }

  let count = 0;
  const targetLower = oldKey.toLowerCase();

  // 1. LaTeX citation commands regex matching \cite, \citep, \citet, \autocite, \nocite, etc.
  const LATEX_CITE_REGEX =
    /(\\(?:auto|paren|text|foot|no)?cite(?:p|t|alt|alp|author|year|date|num)?\*?(?:\[[^\]]*\])*(?:\[[^\]]*\])*\{)([^}]+)(\})/gi;

  let updated = text.replace(LATEX_CITE_REGEX, (_fullMatch, prefix, innerKeys, suffix) => {
    const parts = innerKeys.split(',');
    let modified = false;

    const newParts = parts.map((part: string) => {
      const trimmed = part.trim();
      if (trimmed.toLowerCase() === targetLower) {
        count++;
        modified = true;
        // Preserve surrounding whitespace inside comma segment
        const leadingSpace = part.slice(0, part.indexOf(trimmed));
        const trailingSpace = part.slice(part.indexOf(trimmed) + trimmed.length);
        return `${leadingSpace}${newKey}${trailingSpace}`;
      }
      return part;
    });

    if (modified) {
      return `${prefix}${newParts.join(',')}${suffix}`;
    }
    return _fullMatch;
  });

  // 2. Pandoc bracketed citations: [@key1; @key2, p. 20]
  const PANDOC_BRACKET_REGEX = /\[([^\]]*@[a-zA-Z0-9_:-]+[^\]]*)\]/g;
  updated = updated.replace(PANDOC_BRACKET_REGEX, (fullBracket, inner) => {
    const atRegex = new RegExp(`(@)(${escapeRegex(oldKey)})(?=[\\s,;\\]]|\$)`, 'gi');
    let bracketModified = false;
    const newInner = inner.replace(atRegex, (_m: string, atPrefix: string) => {
      count++;
      bracketModified = true;
      return `${atPrefix}${newKey}`;
    });

    return bracketModified ? `[${newInner}]` : fullBracket;
  });

  // 3. Inline Pandoc citations: @oldKey in prose
  const INLINE_CITE_REGEX = new RegExp(
    `(^|[\\s(])(@)(${escapeRegex(oldKey)})(?=[\\s.,;:?!)\\]]|\$)`,
    'gi'
  );
  updated = updated.replace(INLINE_CITE_REGEX, (_m, before, atPrefix) => {
    count++;
    return `${before}${atPrefix}${newKey}`;
  });

  return { content: updated, count };
}

/**
 * Refactors a citation key across all files in a project
 */
export function refactorCitationKeyAcrossFiles(
  files: Array<{ id: string; path: string; content: string }>,
  oldKey: string,
  newKey: string
): ProjectRefactorResult {
  const modifiedFiles: ProjectRefactorResult['modifiedFiles'] = [];
  let totalCount = 0;

  for (const file of files) {
    const ext = file.path.split('.').pop()?.toLowerCase() || '';
    let res: RefactorFileResult;

    if (ext === 'bib') {
      res = refactorCitationKeyInBibTeX(file.content, oldKey, newKey);
    } else {
      res = refactorCitationKeyInLatex(file.content, oldKey, newKey);
    }

    if (res.count > 0 && res.content !== file.content) {
      totalCount += res.count;
      modifiedFiles.push({
        id: file.id,
        path: file.path,
        oldContent: file.content,
        newContent: res.content,
        count: res.count,
      });
    }
  }

  return { modifiedFiles, totalCount };
}
