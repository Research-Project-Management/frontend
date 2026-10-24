/**
 * warning-filter.ts
 *
 * Domain layer: TeX/LaTeX Compiler Warning & Noise Suppression Filter (Overleaf Parity).
 *
 * Capabilities:
 * - Detects and filters noisy TeX warnings: Overfull/Underfull bad boxes, LaTeX font warnings, package warnings.
 * - Supports custom user patterns (case-insensitive substring or regex).
 * - Guarantees critical compiler errors (severity === 'error') are never suppressed.
 * - Pure functions with zero side-effects and microsecond execution speed.
 */

export interface WarningFilterOptions {
  /** Suppress Overfull \hbox, Underfull \hbox, Overfull \vbox, Underfull \vbox */
  suppressBadBoxes?: boolean;
  /** Suppress LaTeX Font Warning, Font shape undefined, size substitution warnings */
  suppressFontWarnings?: boolean;
  /** Suppress Package <name> Warning and Class <name> Warning */
  suppressPackageWarnings?: boolean;
  /** User-defined substring or regex patterns to suppress */
  customPatterns?: string[];
}

const BAD_BOX_REGEX = /(?:Overfull|Underfull)\s*\\[hv]box/i;
const FONT_WARNING_REGEX = /(?:LaTeX Font Warning|Font shape|font has no|size substitutions with small differences)/i;
const PACKAGE_WARNING_REGEX = /(?:Package\s+\S+\s+Warning|Class\s+\S+\s+Warning|pdfTeX\s+warning)/i;
const MAX_PATTERN_REGEX_CACHE_SIZE = 200;
const patternRegexCache = new Map<string, RegExp | null>();

function setPatternRegexCache(key: string, value: RegExp | null): void {
  if (patternRegexCache.has(key)) {
    patternRegexCache.delete(key);
  } else if (patternRegexCache.size >= MAX_PATTERN_REGEX_CACHE_SIZE) {
    const oldestKey = patternRegexCache.keys().next().value;
    if (oldestKey !== undefined) {
      patternRegexCache.delete(oldestKey);
    }
  }
  patternRegexCache.set(key, value);
}

function getCompiledRegex(trimmed: string): RegExp | null {
  if (!trimmed.startsWith('/') || trimmed.lastIndexOf('/') <= 0) return null;
  const cached = patternRegexCache.get(trimmed);
  if (cached !== undefined) return cached;
  try {
    const lastSlash = trimmed.lastIndexOf('/');
    const patternStr = trimmed.slice(1, lastSlash);
    const flags = trimmed.slice(lastSlash + 1) || 'i';
    const reg = new RegExp(patternStr, flags);
    setPatternRegexCache(trimmed, reg);
    return reg;
  } catch {
    setPatternRegexCache(trimmed, null);
    return null;
  }
}

/**
 * Checks if a given diagnostic or log entry matches the suppression rules.
 * Errors (severity === 'error') are NEVER suppressed.
 */
export function shouldSuppressWarning(
  item: { message: string; severity?: string; context?: string },
  options: WarningFilterOptions = {}
): boolean {
  // Never suppress hard compilation errors
  if (item.severity === 'error') {
    return false;
  }

  const msg = item.message || '';
  const ctx = item.context || '';
  const combined = `${msg} ${ctx}`.trim();

  if (options.suppressBadBoxes && BAD_BOX_REGEX.test(combined)) {
    return true;
  }

  if (options.suppressFontWarnings && FONT_WARNING_REGEX.test(combined)) {
    return true;
  }

  if (options.suppressPackageWarnings && PACKAGE_WARNING_REGEX.test(combined)) {
    return true;
  }

  if (options.customPatterns && options.customPatterns.length > 0) {
    for (const pattern of options.customPatterns) {
      const trimmed = pattern.trim();
      if (!trimmed) continue;

      const reg = getCompiledRegex(trimmed);
      if (reg) {
        if (reg.test(combined)) return true;
      } else {
        if (combined.toLowerCase().includes(trimmed.toLowerCase())) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Filters an array of diagnostics or log entries according to the supplied filter options.
 */
export function filterDiagnostics<T extends { message: string; severity?: string; context?: string }>(
  items: T[],
  options: WarningFilterOptions = {}
): T[] {
  if (
    !options.suppressBadBoxes &&
    !options.suppressFontWarnings &&
    !options.suppressPackageWarnings &&
    (!options.customPatterns || options.customPatterns.length === 0)
  ) {
    return items;
  }

  return items.filter((item) => !shouldSuppressWarning(item, options));
}
