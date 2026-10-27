/**
 * Declarative Strategy Scorer Registry & Alias Derivation Helpers for Zotero Schema v42 Fields.
 */

import { ALL_SCHEMA_FIELD_KEYS } from "@/features/library/domain/types/item-fields.constants";
import { BASE_FIELD_MAPPINGS } from "@/features/library/domain/types/item-types.types";
import { EXTRA_KEY_ALIASES } from "./metadata-extra.constants";

const CROSS_FIELD_ALIAS_TARGETS = new Set<string>([
  "publisher",
  "publicationTitle",
  "number",
  "place",
  "authority",
]);

export function getDirectExtraAliases(fieldKey: string): readonly string[] {
  const collapsed = fieldKey.trim().toLowerCase().replace(/[\s_-]+/g, "");
  const rawAliases = EXTRA_KEY_ALIASES[collapsed];
  if (!rawAliases) return [];
  return rawAliases.filter(
    (alias) =>
      alias.toLowerCase().replace(/[\s_-]+/g, "") === collapsed ||
      !CROSS_FIELD_ALIAS_TARGETS.has(alias),
  );
}

/** First-class columns on the backend Prisma `Item` table. */
export const FIRST_CLASS_ITEM_COLUMNS: ReadonlySet<string> = new Set([
  "title", "abstractNote", "publicationTitle", "journalAbbreviation", "volume", "issue",
  "pages", "numberOfPages", "publisher", "place", "edition", "series", "seriesTitle",
  "seriesNumber", "doi", "isbn", "issn", "pmid", "pmcid", "arxivId", "url", "openAccessPdfUrl",
  "year", "publicationDate", "date", "accessDate", "itemType", "language", "license",
  "archive", "archiveLocation", "callNumber", "libraryCatalog", "citationKey", "shortTitle",
  "citationCount", "referenceCount",
]);

/** Universal bidirectional field aliases between Zotero Schema v42 field keys and canonical `Item` columns. */
export const CANONICAL_FIELD_ALIASES: Record<string, readonly string[]> = {
  abstractNote: ["abstractNote", "abstract"],
  abstract: ["abstractNote", "abstract"],
  journalAbbreviation: ["journalAbbreviation", "journalAbbr"],
  journalAbbr: ["journalAbbreviation", "journalAbbr"],
  publicationTitle: ["publicationTitle", "journal"],
  journal: ["publicationTitle", "journal"],
  accessDate: ["accessDate", "accessedAt"],
  accessedAt: ["accessDate", "accessedAt"],
  rights: ["license", "rights"],
  license: ["license", "rights"],
  ISBN: ["isbn", "ISBN"],
  isbn: ["isbn", "ISBN"],
  ISSN: ["issn", "ISSN"],
  issn: ["issn", "ISSN"],
  PMID: ["pmid", "PMID"],
  pmid: ["pmid", "PMID"],
  PMCID: ["pmcid", "PMCID"],
  pmcid: ["pmcid", "PMCID"],
  DOI: ["doi", "DOI"],
  doi: ["doi", "DOI"],
  archiveID: ["archiveID", "archiveId", "arxivId"],
  archiveId: ["archiveID", "archiveId", "arxivId"],
  arxivId: ["archiveID", "archiveId", "arxivId"],
  citationKey: ["citationKey"],
  citeKey: ["citationKey"],
  numPages: ["numberOfPages", "numPages"],
  numberOfPages: ["numberOfPages", "numPages"],
  versionNumber: ["versionNumber"],
  meetingName: ["meetingName", "conferenceName"],
  reporter: ["reporter", "publicationTitle"],
};

const BASE_FIELD_SYNC_EXPANSIONS: Record<string, readonly string[]> = {
  title: ["title"],
  publicationTitle: ["publicationTitle"],
  publisher: ["publisher"],
  authority: ["authority", "publisher"],
  place: ["place"],
  date: ["publicationDate", "date"],
  volume: ["volume"],
  pages: ["pages"],
  number: ["number"],
  type: ["genre", "type"],
  status: ["status"],
};

const WRITE_SYNC_OVERRIDES: Record<string, readonly string[]> = {
  eventplace: ["eventPlace"],
  country: ["country"],
  organization: ["organization", "authority"],
  reportnumber: ["reportNumber", "number"],
  websitetype: ["websiteType"],
};

export function buildDerivedFieldMappings(): {
  syncSetters: Record<string, readonly string[]>;
  fallbackChains: Record<string, ReadonlyArray<readonly ["p" | "ef", string]>>;
} {
  const syncSetters: Record<string, readonly string[]> = {};
  const concreteToBaseField = new Map<string, string>();

  for (const mapping of Object.values(BASE_FIELD_MAPPINGS)) {
    for (const [baseField, concreteField] of Object.entries(mapping)) {
      if (concreteField && !concreteToBaseField.has(concreteField)) {
        concreteToBaseField.set(concreteField, baseField);
      }
    }
  }

  for (const [concreteField, baseField] of concreteToBaseField.entries()) {
    const lower = concreteField.toLowerCase();
    if (WRITE_SYNC_OVERRIDES[lower]) {
      syncSetters[lower] = WRITE_SYNC_OVERRIDES[lower]!;
      continue;
    }
    const expansions = BASE_FIELD_SYNC_EXPANSIONS[baseField] || [baseField];
    syncSetters[lower] = Array.from(new Set([concreteField, ...expansions]));
  }

  for (const [fieldKey, aliases] of Object.entries(CANONICAL_FIELD_ALIASES)) {
    syncSetters[fieldKey.toLowerCase()] = aliases;
  }
  for (const [lowerKey, overrideTargets] of Object.entries(WRITE_SYNC_OVERRIDES)) {
    syncSetters[lowerKey] = overrideTargets;
  }
  syncSetters.authority = ["issuingAuthority", "authority", "publisher"];

  const fallbackChains: Record<string, ReadonlyArray<readonly ["p" | "ef", string]>> = {};

  const addChain = (key: string, entries: ReadonlyArray<readonly ["p" | "ef", string]>) => {
    const seen = new Set<string>();
    const deduped: Array<readonly ["p" | "ef", string]> = [];
    for (const [src, prop] of entries) {
      const id = `${src}:${prop}`;
      if (!seen.has(id)) {
        seen.add(id);
        deduped.push([src, prop]);
      }
    }
    fallbackChains[key.toLowerCase()] = deduped;
  };

  for (const schemaField of ALL_SCHEMA_FIELD_KEYS) {
    addChain(schemaField, [["p", schemaField], ["ef", schemaField]]);
  }

  for (const [concreteField, baseField] of concreteToBaseField.entries()) {
    const expansions = BASE_FIELD_SYNC_EXPANSIONS[baseField] || [baseField];
    addChain(concreteField, [
      ["p", concreteField],
      ["ef", concreteField],
      ...expansions.map((b): readonly ["p" | "ef", string] => ["p", b]),
      ...expansions.map((b): readonly ["p" | "ef", string] => ["ef", b]),
    ]);
  }

  for (const [fieldKey, aliases] of Object.entries(CANONICAL_FIELD_ALIASES)) {
    addChain(fieldKey, [
      ...aliases.map((a): readonly ["p" | "ef", string] => ["p", a]),
      ...aliases.map((a): readonly ["p" | "ef", string] => ["ef", a]),
    ]);
  }

  addChain("booktitle", [["p", "bookTitle"], ["p", "publicationTitle"], ["p", "containerTitle"], ["p", "proceedingsTitle"], ["ef", "bookTitle"]]);
  addChain("proceedingstitle", [["p", "proceedingsTitle"], ["p", "publicationTitle"], ["p", "containerTitle"], ["p", "bookTitle"], ["ef", "proceedingsTitle"]]);
  addChain("sessiontitle", [["p", "sessionTitle"], ["ef", "sessionTitle"]]);
  addChain("publisher", [["p", "publisher"], ["p", "university"], ["p", "institution"], ["ef", "publisher"]]);
  addChain("university", [["p", "university"], ["p", "publisher"], ["p", "institution"], ["ef", "university"]]);
  addChain("institution", [["p", "institution"], ["p", "publisher"], ["p", "university"], ["ef", "institution"]]);
  addChain("authority", [["p", "issuingAuthority"], ["ef", "issuingAuthority"], ["p", "authority"], ["p", "publisher"]]);
  addChain("place", [["p", "place"], ["ef", "place"], ["p", "eventPlace"], ["ef", "eventPlace"], ["ef", "address"], ["ef", "location"], ["p", "repositoryLocation"], ["ef", "repositoryLocation"], ["p", "country"], ["ef", "country"]]);
  addChain("eventplace", [["p", "eventPlace"], ["ef", "eventPlace"], ["p", "place"]]);
  addChain("country", [["p", "country"], ["ef", "country"], ["p", "place"]]);
  addChain("filingdate", [["p", "filingDate"], ["ef", "filingDate"], ["p", "date"]]);
  addChain("prioritydate", [["p", "priorityDate"], ["ef", "priorityDate"]]);

  return { syncSetters, fallbackChains };
}

export function parseValidYear(val: string): number | undefined {
  const yearMatch = val.match(/(?:^|[^\d])(1\d{3}|20\d{2})(?:[^\d]|$)/);
  const parsedYear = yearMatch
    ? parseInt(yearMatch[1]!, 10)
    : parseInt(val, 10);
  return !isNaN(parsedYear) && parsedYear >= 1000 && parsedYear <= 2999
    ? parsedYear
    : undefined;
}

// ---------------------------------------------------------------------------
// Declarative Strategy Scorer Registry for Field Candidate Resolution (FE-P4)
// ---------------------------------------------------------------------------

export type FieldCandidateScorer = (value: string, rawValue?: unknown) => number;

const scoreDatePrecision = (value: string): number => {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.length + 40;
  if (/^\d{4}-\d{2}$/.test(trimmed)) return trimmed.length + 25;
  if (/\b(1\d{3}|20\d{2})\b/.test(trimmed)) return trimmed.length + 10;
  return trimmed.length;
};

const scoreVenueCompleteness = (value: string): number => {
  const trimmed = value.trim();
  const hasFullWords = /\s/.test(trimmed) && !/^[A-Z0-9.\s-]+$/.test(trimmed);
  return trimmed.length + (hasFullWords ? 15 : 0);
};

const scoreAuthorSingleToken = (name: string): number => {
  const trimmed = name.trim();
  if (!trimmed) return 0;
  let score = 20;
  const parts = trimmed.includes(",")
    ? trimmed.split(",").map((p) => p.trim()).reverse().filter(Boolean)
    : trimmed.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const givenTokens = parts.slice(0, -1);
    const hasFullGivenName = givenTokens.some(
      (tok) => tok.replace(/[^A-Za-z\u00C0-\u024F]/g, "").length >= 2 && !/^[A-Z]\.?$/.test(tok),
    );
    score += hasFullGivenName ? 15 : 3;
  }
  score += Math.min(trimmed.length, 25);
  return score;
};

const scoreAuthorsCompleteness: FieldCandidateScorer = (value: string, rawValue?: unknown): number => {
  if (Array.isArray(rawValue)) {
    if (rawValue.length === 0) return -1;
    let total = 0;
    for (const entry of rawValue) {
      if (typeof entry === "string") {
        total += scoreAuthorSingleToken(entry);
      } else if (entry && typeof entry === "object") {
        const rec = entry as Record<string, unknown>;
        const first = String(rec.firstName ?? rec.given ?? "").trim();
        const last = String(rec.lastName ?? rec.family ?? "").trim();
        const full = String(rec.fullName ?? rec.name ?? [first, last].filter(Boolean).join(" ")).trim();
        total += scoreAuthorSingleToken(full);
      }
    }
    return total;
  }
  const tokens = value.split(/[;\n]+|,\s*(?=[A-Z])/).map((s) => s.trim()).filter(Boolean);
  if (tokens.length === 0) return -1;
  return tokens.reduce((acc, tok) => acc + scoreAuthorSingleToken(tok), 0);
};

export const FIELD_CANDIDATE_SCORERS: Readonly<Record<string, FieldCandidateScorer>> = {
  itemType: (value: string) => {
    const t = value.trim();
    if (
      t === "journalArticle" ||
      t === "conferencePaper" ||
      t === "book" ||
      t === "bookSection"
    ) {
      return 100;
    }
    if (t === "preprint" || t === "document") {
      return 20;
    }
    return 50;
  },
  authors: scoreAuthorsCompleteness,
  creators: scoreAuthorsCompleteness,
  doi: (value: string) => {
    const d = value.trim();
    return /10\.48550\/arxiv/i.test(d) ? 10 : d.length + 50;
  },
  date: scoreDatePrecision,
  publicationDate: scoreDatePrecision,
  year: (value: string) => {
    const parsed = parseValidYear(value.trim());
    return parsed !== undefined ? 40 : value.trim().length;
  },
  publicationTitle: scoreVenueCompleteness,
  abstractNote: (value: string) => value.trim().length,
  abstract: (value: string) => value.trim().length,
};
