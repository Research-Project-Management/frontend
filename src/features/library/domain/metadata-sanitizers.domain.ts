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
  "untitled",
  "etc",
  "etc.",
  "et al",
  "et al.",
  "downloaded",
  "downloaded from",
  "full text",
  "pdf",
  "keywords",
  "keyword",
  "index terms",
  "key words",
  "open access",
  "all rights reserved",
  "copyright",
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

export interface StructuredItemTag {
  id?: string;
  tagId?: string;
  name: string;
  type: "manual" | "automatic";
  color?: string;
  shortcut?: number | null;
}

/**
 * Normalizes tags from an Item for inspector display.
 * When `itemTags` or `tags` is explicitly an array on an Item object, treats it as
 * authoritative (avoiding resurrecting deleted tags from legacy `keywords` / `labels`).
 */
export function normalizeTags(
  rawItem?:
    | {
        itemTags?: unknown;
        tags?: unknown;
        keywords?: unknown;
        labels?: unknown;
      }
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
    const hasAuthoritativeTags =
      Array.isArray(obj.itemTags) || Array.isArray(obj.tags);
    if (hasAuthoritativeTags) {
      if (Array.isArray(obj.itemTags)) candidates.push(...obj.itemTags);
      if (Array.isArray(obj.tags)) candidates.push(...obj.tags);
    } else {
      if (typeof obj.tags === "string") candidates.push(obj.tags);
      if (Array.isArray(obj.keywords)) candidates.push(...obj.keywords);
      if (Array.isArray(obj.labels)) candidates.push(...obj.labels);
      if (typeof obj.keywords === "string") candidates.push(obj.keywords);
      if (typeof obj.labels === "string") candidates.push(obj.labels);
    }
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
      const innerTag =
        tagObj.tag && typeof tagObj.tag === "object"
          ? (tagObj.tag as Record<string, unknown>)
          : null;
      const name =
        typeof tagObj.name === "string"
          ? tagObj.name
          : typeof tagObj.tag === "string"
            ? tagObj.tag
            : innerTag && typeof innerTag.name === "string"
              ? innerTag.name
              : "";
      if (name) {
        addTag(cleanSingleFrontendTag(name));
      }
    }
  }

  return tagList;
}

/**
 * Extracts structured tags (`name`, `type: 'manual' | 'automatic'`, `color`, `shortcut`, `tagId`)
 * for an Item, merging with scope catalog tags when available.
 */
export function extractStructuredItemTags(
  rawItem?:
    | {
        itemTags?: unknown;
        tags?: unknown;
        keywords?: unknown;
        labels?: unknown;
      }
    | null,
  catalogTags?: Array<{
    id?: string;
    name?: string;
    type?: string | number;
    color?: string | null;
    shortcut?: number | null;
  }>,
): StructuredItemTag[] {
  if (!rawItem) return [];

  const catalogByLower = new Map<
    string,
    {
      id?: string;
      name: string;
      type?: "manual" | "automatic";
      color?: string;
      shortcut?: number | null;
    }
  >();
  if (Array.isArray(catalogTags)) {
    for (const ct of catalogTags) {
      if (!ct || typeof ct.name !== "string") continue;
      const cleaned = cleanSingleFrontendTag(ct.name);
      if (!cleaned) continue;
      const isAuto =
        ct.type === "automatic" || ct.type === 1 || ct.type === "1";
      catalogByLower.set(cleaned.toLowerCase(), {
        id: typeof ct.id === "string" ? ct.id : undefined,
        name: cleaned,
        type: isAuto ? "automatic" : "manual",
        color:
          typeof ct.color === "string" && ct.color.trim()
            ? ct.color.trim()
            : undefined,
        shortcut: typeof ct.shortcut === "number" ? ct.shortcut : undefined,
      });
    }
  }

  const itemTagByLower = new Map<string, StructuredItemTag>();
  const rawItemTags = Array.isArray(rawItem.itemTags) ? rawItem.itemTags : [];
  for (const entry of rawItemTags) {
    if (!entry || typeof entry !== "object") continue;
    const obj = entry as Record<string, unknown>;
    const innerTag =
      obj.tag && typeof obj.tag === "object"
        ? (obj.tag as Record<string, unknown>)
        : null;
    const rawName =
      typeof obj.name === "string"
        ? obj.name
        : typeof obj.tag === "string"
          ? obj.tag
          : innerTag && typeof innerTag.name === "string"
            ? innerTag.name
            : "";
    const cleaned = cleanSingleFrontendTag(rawName);
    if (!cleaned) continue;
    const lower = cleaned.toLowerCase();
    if (itemTagByLower.has(lower)) continue;

    const rawType = obj.type ?? innerTag?.type;
    const isAuto =
      rawType === "automatic" || rawType === 1 || rawType === "1";
    const rawColor = obj.color ?? innerTag?.color;
    const rawShortcut = obj.shortcut ?? innerTag?.shortcut;
    const tagId =
      typeof obj.tagId === "string"
        ? obj.tagId
        : innerTag && typeof innerTag.id === "string"
          ? innerTag.id
          : undefined;
    const id = typeof obj.id === "string" ? obj.id : undefined;

    itemTagByLower.set(lower, {
      ...(id ? { id } : {}),
      ...(tagId ? { tagId } : {}),
      name: cleaned,
      type: isAuto ? "automatic" : "manual",
      ...(typeof rawColor === "string" && rawColor.trim()
        ? { color: rawColor.trim() }
        : {}),
      ...(typeof rawShortcut === "number" ? { shortcut: rawShortcut } : {}),
    });
  }

  const names = normalizeTags(rawItem);
  return names.map((name) => {
    const lower = name.toLowerCase();
    const fromItemTag = itemTagByLower.get(lower);
    const fromCatalog = catalogByLower.get(lower);
    return {
      id: fromItemTag?.id,
      tagId: fromItemTag?.tagId ?? fromCatalog?.id,
      name,
      type: fromItemTag?.type ?? fromCatalog?.type ?? "manual",
      color: fromItemTag?.color ?? fromCatalog?.color,
      shortcut: fromItemTag?.shortcut ?? fromCatalog?.shortcut ?? null,
    };
  });
}

/**
 * Builds a canonical multi-field update patch for an Item's tags,
 * keeping `tags`, `keywords`, and structured `itemTags` synchronized.
 */
export function buildCanonicalTagsPatch(
  updatedTags: string[],
  structuredTags: StructuredItemTag[],
  overrideTypes?: Map<string, "manual" | "automatic">,
): Partial<{
  tags: string[];
  keywords: string[];
  itemTags: Array<Record<string, unknown>>;
  silent: boolean;
}> {
  const currentTypeByLower = new Map(
    structuredTags.map((t) => [t.name.toLowerCase(), t] as const),
  );
  const nextItemTags = updatedTags.map((name) => {
    const lower = name.toLowerCase();
    const prev = currentTypeByLower.get(lower);
    const resolvedType =
      overrideTypes?.get(lower) ?? prev?.type ?? ("manual" as const);
    return {
      ...(prev?.id ? { id: prev.id } : {}),
      ...(prev?.tagId ? { tagId: prev.tagId } : {}),
      name,
      type: resolvedType,
      ...(prev?.color ? { color: prev.color } : {}),
      ...(prev?.shortcut !== undefined ? { shortcut: prev.shortcut } : {}),
      tag: {
        ...(prev?.tagId ? { id: prev.tagId } : {}),
        name,
        type: resolvedType,
        ...(prev?.color ? { color: prev.color } : {}),
        ...(prev?.shortcut !== undefined ? { shortcut: prev.shortcut } : {}),
      },
    };
  });

  return {
    tags: updatedTags,
    keywords: updatedTags,
    itemTags: nextItemTags,
    silent: true,
  };
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
function cleanNoteContent(raw: string): string {
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
    return !isNaN(val) && Number.isFinite(val);
  if (typeof val === "boolean") return true;
  if (Array.isArray(val)) return val.some((item) => isValidValue(item));
  if (typeof val === "object")
    return Object.keys(val as Record<string, unknown>).length > 0;
  const s = String(val).trim();
  if (!s) return false;
  const lower = s.toLowerCase();
  if (
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
    lower === "unknown"
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

const ASCII_ONLY_RE = /^[\x00-\x7F]*$/;
const SPECIAL_LATIN_FOLD_RE = /[ĐđŁłØøßÆæŒœ]/g;
const COMBINING_DIACRITIC_RE = /[\u0300-\u036f]/g;
const SPECIAL_LATIN_MAP: Readonly<Record<string, string>> = {
  Đ: 'd', đ: 'd', Ł: 'l', ł: 'l', Ø: 'o', ø: 'o', ß: 'ss', Æ: 'ae', æ: 'ae', Œ: 'oe', œ: 'oe',
};
const BROKEN_HYPHEN_RE = /(\b[A-Za-z0-9]+)-\s*\r?\n\s*([A-Za-z0-9]+\b)/g;
const MULTI_WHITESPACE_RE = /\s+/g;

export function foldDiacritics(input?: string | null): string {
  if (!input) return '';
  if (ASCII_ONLY_RE.test(input)) return input.toLowerCase();
  return input
    .replace(SPECIAL_LATIN_FOLD_RE, (m) => SPECIAL_LATIN_MAP[m] ?? m)
    .normalize('NFD')
    .replace(COMBINING_DIACRITIC_RE, '')
    .toLowerCase();
}

export function cleanText(text?: string | null): string {
  if (!text) return '';
  return text.replace(BROKEN_HYPHEN_RE, '$1-$2').replace(MULTI_WHITESPACE_RE, ' ').trim();
}
