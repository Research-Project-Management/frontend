const LATEX_DIACRITIC_MAP: ReadonlyArray<
  readonly [RegExp, (match: string, c1: string, c2: string) => string]
> = [
  [
    /\{?\\`(?:\{\\?([a-zA-Z])\}|\\?([a-zA-Z]))\}?/g,
    (_, c1, c2) => `${c1 || c2}\u0300`.normalize("NFC"),
  ],
  [
    /\{?\\'(?:\{\\?([a-zA-Z])\}|\\?([a-zA-Z]))\}?/g,
    (_, c1, c2) => `${c1 || c2}\u0301`.normalize("NFC"),
  ],
  [
    /\{?\\\^(?:\{\\?([a-zA-Z])\}|\\?([a-zA-Z]))\}?/g,
    (_, c1, c2) => `${c1 || c2}\u0302`.normalize("NFC"),
  ],
  [
    /\{?\\~(?:\{\\?([a-zA-Z])\}|\\?([a-zA-Z]))\}?/g,
    (_, c1, c2) => `${c1 || c2}\u0303`.normalize("NFC"),
  ],
  [
    /\{?\\"(?:\{\\?([a-zA-Z])\}|\\?([a-zA-Z]))\}?/g,
    (_, c1, c2) => `${c1 || c2}\u0308`.normalize("NFC"),
  ],
  [
    /\{?\\=(?:\{\\?([a-zA-Z])\}|\\?([a-zA-Z]))\}?/g,
    (_, c1, c2) => `${c1 || c2}\u0304`.normalize("NFC"),
  ],
  [
    /\{?\\\.(?:\{\\?([a-zA-Z])\}|\\?([a-zA-Z]))\}?/g,
    (_, c1, c2) => `${c1 || c2}\u0307`.normalize("NFC"),
  ],
  [
    /\{?\\u(?:\{\\?([a-zA-Z])\}|\s+\\?([a-zA-Z]))\}?/g,
    (_, c1, c2) => `${c1 || c2}\u0306`.normalize("NFC"),
  ],
  [
    /\{?\\v(?:\{\\?([a-zA-Z])\}|\s+\\?([a-zA-Z]))\}?/g,
    (_, c1, c2) => `${c1 || c2}\u030C`.normalize("NFC"),
  ],
  [
    /\{?\\H(?:\{\\?([a-zA-Z])\}|\s+\\?([a-zA-Z]))\}?/g,
    (_, c1, c2) => `${c1 || c2}\u030B`.normalize("NFC"),
  ],
  [
    /\{?\\c(?:\{\\?([a-zA-Z])\}|\s+\\?([a-zA-Z]))\}?/g,
    (_, c1, c2) => `${c1 || c2}\u0327`.normalize("NFC"),
  ],
  [
    /\{?\\k(?:\{\\?([a-zA-Z])\}|\s+\\?([a-zA-Z]))\}?/g,
    (_, c1, c2) => `${c1 || c2}\u0328`.normalize("NFC"),
  ],
  [
    /\{?\\r(?:\{\\?([a-zA-Z])\}|\s+\\?([a-zA-Z]))\}?/g,
    (_, c1, c2) => `${c1 || c2}\u030A`.normalize("NFC"),
  ],
];

/** Strips LaTeX macros, decodes LaTeX diacritics, and unescapes symbols common in BibTeX */
export function stripLatexMarkup(str: string): string {
  if (!str || typeof str !== "string") return "";
  if (!str.includes("\\") && !str.includes("{") && !str.includes("}")) {
    return str.trim();
  }
  // Normalize dotless \i and \j first so accent commands like {\'\i}, \'{\i}, \'\i combine cleanly
  let out = str.replace(/\\i\b\s*/g, "i").replace(/\\j\b\s*/g, "j");
  for (const [pattern, replacer] of LATEX_DIACRITIC_MAP) {
    out = out.replace(pattern, replacer);
  }
  out = out
    .replace(/\{\\aa\}|\\aa\b/g, "å")
    .replace(/\{\\AA\}|\\AA\b/g, "Å")
    .replace(/\{\\ae\}|\\ae\b/g, "æ")
    .replace(/\{\\AE\}|\\AE\b/g, "Æ")
    .replace(/\{\\oe\}|\\oe\b/g, "œ")
    .replace(/\{\\OE\}|\\OE\b/g, "Œ")
    .replace(/\{\\o\}|\\o\b/g, "ø")
    .replace(/\{\\O\}|\\O\b/g, "Ø")
    .replace(/\{\\l\}|\\l\b/g, "ł")
    .replace(/\{\\L\}|\\L\b/g, "Ł")
    .replace(/\{\\dj\}|\\dj\b/g, "đ")
    .replace(/\{\\DJ\}|\\DJ\b/g, "Đ")
    .replace(/\{\\ss\}|\\ss\b/g, "ß")
    .replace(/\\([&%$#_{}])/g, "$1")
    .replace(
      /\\(?:textbf|textit|textsf|texttt|textsc|emph|text|mathrm|mathbf|mathit)\s*\{([^}]+)\}/gi,
      "$1",
    )
    .replace(/\\(?:bf|it|em|rm|sf|tt|large|Large|small|tiny)\b\s*/gi, "")
    .replace(/[{}]/g, "")
    .trim();
  return out;
}

const INVALID_TAG_TOKENS = new Set([
  "null",
  "undefined",
  "n/a",
  "na",
  "n.a.",
  "n.a",
  "none",
  "nil",
  "unknown",
  "false",
  "true",
  "sample",
  "draft",
  "test",
  "etc",
  "etc.",
  "et al",
  "et al.",
  "downloaded",
  "downloaded from",
  "full text",
  "pdf",
  "abstract",
  "keywords",
  "keyword",
  "index terms",
  "key words",
  "open access",
  "all rights reserved",
  "peer-reviewed",
  "original article",
  "research article",
  "review article",
  "multidisciplinary",
  "general",
  "miscellaneous",
  "misc",
]);

/**
 * Cleans and validates a single tag in the frontend UI.
 */
export function cleanSingleFrontendTag(raw: string): string | null {
  if (!raw || typeof raw !== "string") return null;
  let str = raw
    .replace(/[\uFFFD]/g, "")
    .replace(
      /^(?:tags?|keywords?|index terms?|categor(?:y|ies)|subject(?: areas?)?|topics?|terms?|classification|descriptors?|field(?: of study)?)[:—\-\s]+/i,
      "",
    )
    .replace(/^[#"''`[{<•·*—\-\s]+/, "")
    .replace(/["''`\]}>.,;:—\-\s•·*]+$/, "")
    .trim();

  if (str.startsWith("(") && str.endsWith(")")) {
    str = str.slice(1, -1).trim();
  } else if (str.startsWith("(") && !str.includes(")")) {
    str = str.slice(1).trim();
  } else if (str.endsWith(")") && !str.includes("(")) {
    str = str.slice(0, -1).trim();
  }

  str = stripLatexMarkup(str);
  str = str
    .replace(/<[^>]+>/g, "")
    .replace(/[\xA0\r\n\s]+/g, " ")
    .trim()
    .normalize("NFC");

  if (!str || str.length < 2 || str.length > 255) return null;
  const lower = str.toLowerCase();
  if (INVALID_TAG_TOKENS.has(lower)) return null;
  if (/^\d+$/.test(str) || /^\d{1,4}[-–—/]\d{1,4}$/.test(str)) return null;
  if (
    /^(?:doi[:\s/]|https?:\/\/|www\.|10\.\d{4,9}\/|(?:pmid|pmcid|isbn|issn|arxiv)[:\s/]|downloaded\s+(?:from|on|by)\b)/i.test(
      str,
    )
  ) {
    return null;
  }
  if (
    /^(?:(?:p|pp|v)\.\s*|(?:p|pp|v)\s+|(?:page|pages|vol|volume|no|number|issue)\.?\s*)\d+(?:\s*[-–—]\s*\d+)?$/i.test(
      str,
    )
  ) {
    return null;
  }
  return str;
}

/**
 * Normalizes tags from an Item for inspector display.
 */
export function normalizeTags(
  rawItem?:
    | { tags?: unknown; keywords?: unknown; labels?: unknown }
    | unknown[]
    | string
    | null,
): string[] {
  if (!rawItem) return [];

  const candidates: unknown[] = [];
  if (Array.isArray(rawItem)) {
    candidates.push(...rawItem);
  } else if (typeof rawItem === "object") {
    const obj = rawItem as Record<string, unknown>;
    if (Array.isArray(obj.tags)) candidates.push(...obj.tags);
    if (Array.isArray(obj.keywords)) candidates.push(...obj.keywords);
    if (Array.isArray(obj.labels)) candidates.push(...obj.labels);
    if (typeof obj.tags === "string") candidates.push(obj.tags);
    if (typeof obj.keywords === "string") candidates.push(obj.keywords);
    if (typeof obj.labels === "string") candidates.push(obj.labels);
  } else if (typeof rawItem === "string") {
    candidates.push(rawItem);
  }

  const tagList: string[] = [];
  const seenLower = new Set<string>();
  const addTag = (cleaned: string | null) => {
    if (!cleaned) return;
    const lower = cleaned.toLowerCase();
    if (!seenLower.has(lower)) {
      seenLower.add(lower);
      tagList.push(cleaned);
    }
  };

  for (const item of candidates) {
    if (typeof item === "string") {
      const parts =
        item.includes(";") || item.includes(",") || item.includes("•")
          ? item.split(/[,;•]+/)
          : [item];
      for (const part of parts) {
        addTag(cleanSingleFrontendTag(part));
      }
    } else if (item && typeof item === "object") {
      const tagObj = item as Record<string, unknown>;
      const name =
        typeof tagObj.name === "string"
          ? tagObj.name
          : typeof tagObj.tag === "string"
            ? tagObj.tag
            : "";
      if (name) {
        addTag(cleanSingleFrontendTag(name));
      }
    }
  }

  return tagList;
}

export interface NormalizedNote {
  id: string;
  note?: string;
  content: string;
  title?: string;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
  dateModified?: string;
}

/**
 * Cleans HTML tags and entities from a note string while preserving paragraph structure.
 */
export function cleanNoteContent(raw: string): string {
  if (!raw || typeof raw !== "string") return "";
  if (!/<\/?[a-z][\s\S]*>/i.test(raw) && !raw.includes("&")) {
    return raw.trim();
  }
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, (_, c) => `# ${c.trim()}\n\n`)
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, (_, c) => `## ${c.trim()}\n\n`)
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, (_, c) => `### ${c.trim()}\n\n`)
    .replace(
      /<h[4-6][^>]*>([\s\S]*?)<\/h[4-6]>/gi,
      (_, c) => `#### ${c.trim()}\n\n`,
    )
    .replace(
      /<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi,
      (_, c) => `> ${c.trim()}\n\n`,
    )
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, c) => `- ${c.trim()}\n`)
    .replace(/<\/?(ul|ol)[^>]*>/gi, "\n")
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (_, c) => `${c.trim()}\n\n`)
    .replace(/<\/div>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi, "**$2**")
    .replace(/<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi, "*$2*")
    .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, "`$1`")
    .replace(
      /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
      "[$2]($1)",
    )
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&mdash;/gi, "—")
    .replace(/&ndash;/gi, "–")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Normalizes an array of notes from an Item for inspector display.
 */
export function normalizeNotes(rawNotes?: unknown): NormalizedNote[] {
  if (!rawNotes) return [];
  if (!Array.isArray(rawNotes)) {
    if (typeof rawNotes === "string") {
      const cleaned = cleanNoteContent(rawNotes);
      if (cleaned) {
        return [{ id: "note-0", note: cleaned, content: cleaned }];
      }
    }
    return [];
  }

  const results: NormalizedNote[] = [];
  const seenKeys = new Set<string>();
  let index = 0;
  for (const n of rawNotes) {
    if (!n) continue;
    if (typeof n === "string") {
      const cleaned = cleanNoteContent(n);
      const dedupeKey = `text:${cleaned.toLowerCase()}`;
      if (cleaned && !seenKeys.has(dedupeKey)) {
        seenKeys.add(dedupeKey);
        results.push({
          id: `note-${index++}`,
          note: cleaned,
          content: cleaned,
        });
      }
    } else if (typeof n === "object") {
      const obj = n as Record<string, unknown>;
      const rawText =
        typeof obj.contentMd === "string" && obj.contentMd
          ? obj.contentMd
          : typeof obj.content === "string" && obj.content
            ? obj.content
            : typeof obj.note === "string"
              ? obj.note
              : "";
      const cleaned = cleanNoteContent(rawText);
      const realId =
        typeof obj.id === "string" && obj.id.trim().length > 0
          ? obj.id.trim()
          : null;
      const dedupeKey = realId
        ? `id:${realId}`
        : `text:${cleaned.toLowerCase()}`;
      if (cleaned && !seenKeys.has(dedupeKey)) {
        seenKeys.add(dedupeKey);
        results.push({
          id: realId || `note-${index++}`,
          note: cleaned,
          content: cleaned,
          title: typeof obj.title === "string" ? obj.title : undefined,
          tags: Array.isArray(obj.tags)
            ? obj.tags.filter((t): t is string => typeof t === "string")
            : undefined,
          createdAt:
            typeof obj.createdAt === "string" ? obj.createdAt : undefined,
          updatedAt:
            typeof obj.updatedAt === "string" ? obj.updatedAt : undefined,
          dateModified:
            typeof obj.dateModified === "string" ? obj.dateModified : undefined,
        });
      }
    }
  }

  return results;
}

const HTML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
  "&ndash;": "–",
  "&mdash;": "—",
  "&lsquo;": "‘",
  "&rsquo;": "’",
  "&ldquo;": "“",
  "&rdquo;": "”",
};

/**
 * Fallback abstract text cleaner for UI presentation.
 * Strips JATS/XML/HTML tags (e.g. `<jats:title>Abstract</jats:title><jats:p>...`),
 * decodes HTML entities, strips leading "Abstract" headers, and filters placeholder strings.
 */
export function cleanAbstractText(text?: string | null): string {
  if (!text || typeof text !== "string") return "";
  if (!isValidValue(text)) return "";

  let cleaned = text
    // Strip leading <jats:title>Abstract</jats:title> or <title>Abstract</title> blocks
    .replace(
      /<(?:jats:)?title[^>]*>\s*abstract\s*:?\s*<\/(?:jats:)?title>/gi,
      " ",
    )
    // Replace paragraph/block closing tags with spaces so sentences don't concatenate
    .replace(/<\/(?:jats:)?(?:p|sec|div|li|br)\s*>/gi, " ")
    // Strip remaining XML/HTML tags
    .replace(/<[^>]+>/g, "")
    // Decode named HTML entities
    .replace(
      /&(?:amp|lt|gt|quot|#39|apos|nbsp|ndash|mdash|lsquo|rsquo|ldquo|rdquo);/gi,
      (m) => HTML_ENTITIES[m.toLowerCase()] ?? m,
    )
    // Decode numeric HTML entities
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16)),
    )
    // Strip leading "Abstract:" or "Summary:" prefix if left over
    .replace(/^(?:abstract|summary)\s*[:.—\-]\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!isValidValue(cleaned)) return "";
  return cleaned;
}


export function isValidValue(val?: unknown): boolean {
  if (val === undefined || val === null) return false;
  if (typeof val === "number")
    return !isNaN(val) && Number.isFinite(val) && val !== 0;
  if (typeof val === "boolean") return true;
  if (Array.isArray(val)) return val.some((item) => isValidValue(item));
  if (typeof val === "object")
    return Object.keys(val as Record<string, unknown>).length > 0;
  const s = String(val).trim();
  if (!s) return false;
  const lower = s.toLowerCase();
  if (
    lower === "0" ||
    lower === "0000" ||
    lower === "n/a" ||
    lower === "na" ||
    lower === "none" ||
    lower === "nil" ||
    lower === "null" ||
    lower === "undefined" ||
    lower === "{}" ||
    lower === "[]" ||
    lower === "[object object]" ||
    lower === "unknown" ||
    lower.startsWith("unknown ")
  ) {
    return false;
  }
  return true;
}

/**
 * Normalizes a field value into a clean display string, returning empty string for invalid/placeholder values.
 */
export function cleanValue(val?: unknown): string {
  if (!isValidValue(val)) return "";
  if (Array.isArray(val)) {
    return val
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          const obj = item as {
            name?: string;
            firstName?: string;
            lastName?: string;
          };
          return (
            obj.name || [obj.firstName, obj.lastName].filter(Boolean).join(" ")
          );
        }
        return String(item);
      })
      .filter(Boolean)
      .join(", ");
  }
  return String(val).trim();
}

export function cleanFilenameToTitle(filename?: string | null): string {
  if (!filename || typeof filename !== "string") return "Uploaded Document";
  const base = filename
    .replace(/\.[a-zA-Z0-9]+$/, "")
    .replace(/[-_]+/g, " ")
    .trim();
  if (!base) return "Uploaded Document";
  return base
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
