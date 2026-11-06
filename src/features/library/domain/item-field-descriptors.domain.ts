import type { Item } from '@/features/library/domain/types/core.types';
import { normalizeCanonicalItemType, getTitleFieldForType } from '@/features/library/domain/types/item-types.types';
import { cleanDoi, extractArxivId } from './identifiers.domain';
import { isValidValue, cleanValue } from './metadata.mapper';
import { parseValidYear } from './metadata-extra.constants';

/**
 * Declarative Inspector Field Descriptors (`get`, `patch`, `formatDisplay`)
 * for Zotero Schema v42 Fields.
 */


export type FieldLookupSource = {
  p: Record<string, unknown>;
  ef: Record<string, unknown>;
  displayDoi: string;
  fieldKey: string;
};

export interface InspectorFieldDescriptor {
  get?: (ctx: FieldLookupSource) => string;
  patch?: (
    val: string,
    item: Item | Partial<Item>,
    currentExtraFields: Record<string, unknown>,
  ) => Partial<Item> & Record<string, unknown>;
  formatDisplay?: (rawVal: string) => string;
}

const formatCountDisplay = (rawVal: string): string => {
  if (!rawVal || isNaN(Number(rawVal))) return rawVal;
  return Number(rawVal) > 0
    ? new Intl.NumberFormat("en-US").format(Number(rawVal))
    : "";
};

const buildCountPatch =
  (propKey: "citationCount" | "referenceCount") =>
  (
    val: string,
    _item: Item | Partial<Item>,
    currentExtraFields: Record<string, unknown>,
  ): Partial<Item> & Record<string, unknown> => {
    const parsedCount = parseInt(val.replace(/,/g, ""), 10);
    const validCount = isNaN(parsedCount) ? null : parsedCount;
    return {
      [propKey]: validCount,
      extraFields: { ...currentExtraFields, [propKey]: validCount },
    };
  };

const stripIsoDateSuffix = (rawDate: unknown): string => {
  if (!rawDate || !isValidValue(rawDate)) return "";
  const str = String(rawDate).trim();
  const isoMatch = str.match(/^(\d{4}-\d{2}-\d{2})T/);
  return isoMatch ? isoMatch[1]! : cleanValue(str);
};

const getDateValue = ({ p, ef }: FieldLookupSource): string => {
  const rawDate =
    p.publicationDate ||
    p.date ||
    ef.date ||
    ef.publicationDate ||
    (p.year && Number(p.year) > 0 ? String(p.year) : "");
  return stripIsoDateSuffix(rawDate);
};

const buildMappedDateGetter =
  (
    dateKey: "issueDate" | "dateDecided" | "dateEnacted" | "filingDate",
    fallbackToPubDate = true,
  ) =>
  ({ p, ef }: FieldLookupSource): string => {
    const raw =
      p[dateKey] ||
      ef[dateKey] ||
      (fallbackToPubDate
        ? p.publicationDate ||
          p.date ||
          ef.date ||
          ef.publicationDate ||
          (p.year && Number(p.year) > 0 ? String(p.year) : "")
        : p.date || ef.date);
    return stripIsoDateSuffix(raw);
  };

const buildDatePatch = (
  val: string,
  _item: Item | Partial<Item>,
  currentExtraFields: Record<string, unknown>,
): Partial<Item> & Record<string, unknown> => {
  const finalYear = parseValidYear(val);
  return {
    year: finalYear !== undefined ? finalYear : null,
    publicationDate: val || "",
    date: val || "",
    extraFields: { ...currentExtraFields, date: val || null, publicationDate: val || null },
  };
};

const getPublicationTitleValue = ({ p, ef }: FieldLookupSource): string =>
  cleanValue(
    p.publicationTitle || p.containerTitle || p.journal || p.proceedingsTitle || p.bookTitle || ef.publicationTitle || ef.containerTitle,
  );

const getAccessDateValue = ({ p, ef }: FieldLookupSource): string => {
  const raw = p.accessDate || p.accessedAt || ef.accessDate || ef.accessedAt;
  if (!raw || !isValidValue(raw)) return "";
  const str = String(raw).trim();
  const isoDateMatch = str.match(/^(\d{4}-\d{2}-\d{2})(?:T.*)?$/);
  return isoDateMatch ? isoDateMatch[1]! : cleanValue(str);
};

const getArchiveIdValue = ({ p, ef }: FieldLookupSource): string => {
  const raw = cleanValue(
    p.archiveId ||
      p.archiveID ||
      p.arxivId ||
      ef.archiveId ||
      ef.archiveID ||
      ef.arxivId ||
      extractArxivId(p.url as string) ||
      extractArxivId(p.callNumber as string),
  );
  if (!raw) return "";
  const clean = raw
    .replace(/^arxiv:\s*/i, "")
    .replace(/\s*\[.*?\]\s*$/, "")
    .trim();
  const isPreprint = normalizeCanonicalItemType(p.itemType as string) === "preprint";
  return isPreprint && clean ? `arXiv:${clean}` : clean;
};

const buildArchiveIdPatch = (
  val: string,
  _item: Item | Partial<Item>,
  currentExtraFields: Record<string, unknown>,
): Partial<Item> & Record<string, unknown> => {
  const cleanVal = val.replace(/\s*\[.*?\]\s*$/, "").trim();
  const rawArxiv = cleanVal.replace(/^arxiv:\s*/i, "");
  return {
    arxivId: rawArxiv || "",
    archiveID: cleanVal || "",
    extraFields: {
      ...currentExtraFields,
      arxivId: rawArxiv || null,
      archiveID: cleanVal || null,
    },
  };
};

const getCitationKeyValue = ({ p, ef }: FieldLookupSource): string => {
  const rawEf =
    p.extraFields && typeof p.extraFields === "object"
      ? (p.extraFields as Record<string, unknown>)
      : {};
  const isCleared =
    p.citationKey === "" &&
    (rawEf.citationKey === null || rawEf.citekey === null || rawEf.citeKey === null);
  if (isCleared) return "";
  const meta =
    p.metadata && typeof p.metadata === "object" && !Array.isArray(p.metadata)
      ? (p.metadata as Record<string, unknown>)
      : undefined;
  return cleanValue(
    p.citationKey ||
      ef.citationKey ||
      ef.citekey ||
      ef.citeKey ||
      meta?.citationKey ||
      meta?.citekey,
  );
};

const buildNumPagesPatch = (
  val: string,
  _item: Item | Partial<Item>,
  currentExtraFields: Record<string, unknown>,
): Partial<Item> & Record<string, unknown> => {
  const parsed = parseInt(val, 10);
  const validNum = isNaN(parsed) ? val || null : parsed;
  return {
    numberOfPages: validNum,
    extraFields: {
      ...currentExtraFields,
      numPages: validNum,
      numberOfPages: validNum,
    },
  };
};

const buildMappedDatePatch =
  (
    dateKey: "issueDate" | "dateDecided" | "dateEnacted" | "filingDate",
    syncPubDate = true,
  ) =>
  (
    val: string,
    item: Item | Partial<Item>,
    currentExtraFields: Record<string, unknown>,
  ): Partial<Item> & Record<string, unknown> => {
    const finalYear = parseValidYear(val);
    const trimmed = val.trim();
    const shouldClearYearOnFilingDate =
      !syncPubDate &&
      trimmed === "" &&
      !isValidValue((item as Record<string, unknown>)?.issueDate) &&
      !isValidValue(item?.publicationDate);
    return {
      [dateKey]: val || "",
      ...(syncPubDate
        ? {
            publicationDate: val || "",
            date: val || "",
            year: finalYear !== undefined ? finalYear : null,
          }
        : finalYear !== undefined
          ? { year: finalYear }
          : shouldClearYearOnFilingDate
            ? { year: null }
            : {}),
      extraFields: {
        ...currentExtraFields,
        [dateKey]: val || null,
        ...(syncPubDate
          ? { date: val || null, publicationDate: val || null }
          : {}),
      },
    };
  };

export const INSPECTOR_FIELD_DESCRIPTORS: Record<
  string,
  InspectorFieldDescriptor
> = {
  year: {
    get: ({ p, ef }) => {
      const y = p.year ?? ef.year;
      if (y !== undefined && y !== null && Number(y) > 0) return String(y);
      const rawDate = p.publicationDate || p.date || ef.date || ef.publicationDate;
      const parsed = rawDate ? parseValidYear(String(rawDate)) : undefined;
      return parsed !== undefined ? String(parsed) : "";
    },
    patch: (val, item, currentExtraFields) => {
      const trimmed = val.trim();
      const parsedYear = trimmed ? parseValidYear(trimmed) : undefined;
      const validYear = parsedYear !== undefined ? parsedYear : null;
      const existingDate = String(
        item?.publicationDate || item?.date || currentExtraFields.date || "",
      ).trim();
      const existingDateYear = existingDate ? parseValidYear(existingDate) : undefined;
      const nextDateStr =
        validYear === null
          ? ""
          : existingDate && existingDateYear === validYear
            ? existingDate
            : existingDate && /^\d{4}(-\d{2}(-\d{2})?)$/.test(existingDate)
              ? existingDate.replace(/^\d{4}/, String(validYear))
              : String(validYear);
      return {
        year: validYear,
        date: nextDateStr,
        publicationDate: nextDateStr,
        extraFields: {
          ...currentExtraFields,
          year: validYear,
          date: nextDateStr || null,
          publicationDate: nextDateStr || null,
        },
      };
    },
  },
  abstractnote: {
    patch: (val, _item, currentExtraFields) => {
      const cleaned = val.trim();
      return {
        abstractNote: cleaned || "",
        abstract: cleaned || null,
        extraFields: { ...currentExtraFields, abstractNote: cleaned || null, abstract: cleaned || null },
      };
    },
  },
  abstract: {
    patch: (val, _item, currentExtraFields) => {
      const cleaned = val.trim();
      return {
        abstractNote: cleaned || "",
        abstract: cleaned || null,
        extraFields: { ...currentExtraFields, abstractNote: cleaned || null, abstract: cleaned || null },
      };
    },
  },
  pages: {
    get: ({ p, ef }) => {
      const raw = ((p.pages || ef.pages || "") as string).trim();
      return raw
        ? raw.replace(/\s*(?:--+|[\u2010-\u2015\u2212])\s*/g, "-").replace(/\s*-\s*/g, "-")
        : "";
    },
    patch: (val, _item, currentExtraFields) => {
      const cleaned = typeof val === "string"
        ? val.trim().replace(/\s*(?:--+|[\u2010-\u2015\u2212])\s*/g, "-").replace(/\s*-\s*/g, "-")
        : val;
      return {
        pages: cleaned || "",
        extraFields: { ...currentExtraFields, pages: cleaned || null },
      };
    },
  },
  date: { get: getDateValue, patch: buildDatePatch },
  publicationdate: { get: getDateValue, patch: buildDatePatch },
  publicationtitle: { get: getPublicationTitleValue },
  journal: { get: getPublicationTitleValue },
  accessdate: { get: getAccessDateValue },
  accessedat: { get: getAccessDateValue },
  doi: {
    get: ({ p, ef, displayDoi }) =>
      cleanValue(displayDoi || p.doi || p.DOI || ef.doi),
    patch: (val, _item, currentExtraFields) => {
      const cleaned = cleanDoi(val);
      return {
        doi: cleaned || "",
        extraFields: {
          ...currentExtraFields,
          doi: cleaned || null,
          DOI: null,
        },
      };
    },
  },
  archiveid: { get: getArchiveIdValue, patch: buildArchiveIdPatch },
  arxivid: { get: getArchiveIdValue, patch: buildArchiveIdPatch },
  arxiv: { get: getArchiveIdValue, patch: buildArchiveIdPatch },
  citationkey: { get: getCitationKeyValue },
  citekey: { get: getCitationKeyValue },
  repository: {
    get: ({ p, ef }) =>
      cleanValue(
        p.repository ||
          ef.repository ||
          (normalizeCanonicalItemType(p.itemType as string) === "preprint"
            ? p.publisher || p.publicationTitle
            : ""),
      ),
    patch: (val, item, currentExtraFields) => ({
      repository: val || "",
      ...(item?.itemType === "preprint" ? {} : { publisher: val || "" }),
      extraFields: { ...currentExtraFields, repository: val || null },
    }),
  },
  websitetitle: {
    get: ({ p, ef, fieldKey }) =>
      cleanValue(
        p[fieldKey] || ef[fieldKey] || p.publicationTitle || p.containerTitle,
      ),
  },
  blogtitle: {
    get: ({ p, ef, fieldKey }) =>
      cleanValue(
        p[fieldKey] || ef[fieldKey] || p.publicationTitle || p.containerTitle,
      ),
  },
  citationcount: {
    get: ({ p, ef }) => {
      const count = p.citationCount ?? ef.citationCount;
      return count != null && Number(count) > 0 ? String(count) : "";
    },
    patch: buildCountPatch("citationCount"),
    formatDisplay: formatCountDisplay,
  },
  referencecount: {
    get: ({ p, ef }) => {
      const count = p.referenceCount ?? ef.referenceCount;
      return count != null && Number(count) > 0 ? String(count) : "";
    },
    patch: buildCountPatch("referenceCount"),
    formatDisplay: formatCountDisplay,
  },
  numpages: { patch: buildNumPagesPatch },
  numberofpages: { patch: buildNumPagesPatch },
  issuedate: {
    get: buildMappedDateGetter("issueDate", true),
    patch: buildMappedDatePatch("issueDate", true),
  },
  datedecided: {
    get: buildMappedDateGetter("dateDecided", true),
    patch: buildMappedDatePatch("dateDecided", true),
  },
  dateenacted: {
    get: buildMappedDateGetter("dateEnacted", true),
    patch: buildMappedDatePatch("dateEnacted", true),
  },
  filingdate: {
    get: buildMappedDateGetter("filingDate", false),
    patch: buildMappedDatePatch("filingDate", false),
  },
};

/**
 * Canonical Coupled-Field Synchronization Engine for Zotero Schema v42 Inspector Edits.
 *
 * Centralizes bidirectional synchronization between Zotero type-specific fields
 * (e.g., `caseName`, `nameOfAct`, `subject`, `reporter`, `code`, `blogTitle`,
 * `forumTitle`, `dictionaryTitle`, `encyclopediaTitle`, `programTitle`,
 * `proceedingsTitle`, `bookTitle`, `websiteTitle`, `sessionTitle`, `meetingName`,
 * `eventPlace`, `country`, `dateDecided`, `dateEnacted`, `issueDate`, `filingDate`,
 * `numPages`, `issuingAuthority`, `court`, `docketNumber`, `publicLawNumber`,
 * `patentNumber`, `reportNumber`, `reporterVolume`, `codeNumber`) and canonical
 * base `Item` columns (`title`, `publicationTitle`, `place`, `date`, `publicationDate`,
 * `year`, `numberOfPages`, `authority`, `issue`, `number`, `volume`).
 */


const TITLE_COUPLED_BY_TYPE: Readonly<Record<string, string>> = {
  case: "caseName",
  statute: "nameOfAct",
  email: "subject",
};

const PUBLICATION_TITLE_COUPLED_BY_TYPE: Readonly<Record<string, string>> = {
  case: "reporter",
  statute: "code",
  blogPost: "blogTitle",
  forumPost: "forumTitle",
  dictionaryEntry: "dictionaryTitle",
  encyclopediaArticle: "encyclopediaTitle",
  tvBroadcast: "programTitle",
  radioBroadcast: "programTitle",
  conferencePaper: "proceedingsTitle",
  bookSection: "bookTitle",
  webpage: "websiteTitle",
  presentation: "sessionTitle",
};

const PLACE_COUPLED_BY_TYPE: Readonly<Record<string, string>> = {
  conferencePaper: "eventPlace",
  presentation: "eventPlace",
  artwork: "eventPlace",
  letter: "eventPlace",
  patent: "country",
};

const DATE_COUPLED_FIELDS: ReadonlySet<string> = new Set<string>([
  "date",
  "publicationDate",
  "dateDecided",
  "dateEnacted",
  "issueDate",
  "filingDate",
]);

interface FieldCouplingContext {
  rec: Record<string, unknown>;
  currentEf: Record<string, unknown>;
  nextEf: Record<string, unknown>;
  patch: Partial<Item> & Record<string, unknown>;
  itemType: string;
  fieldKey: string;
  cleanVal: string;
  isClearing: boolean;
  setCoupled: (targetKey: string) => void;
  setCoupledIfSynced: (targetKey: string) => void;
}

interface FieldCouplingRule {
  id: string;
  matches(ctx: FieldCouplingContext): boolean;
  apply(ctx: FieldCouplingContext): void;
}

const TITLE_COUPLING_KEYS: ReadonlySet<string> = new Set([
  "title",
  "caseName",
  "nameOfAct",
  "subject",
]);

const PUB_TITLE_COUPLING_KEYS: ReadonlySet<string> = new Set([
  "publicationTitle",
  "reporter",
  "code",
  "blogTitle",
  "forumTitle",
  "dictionaryTitle",
  "encyclopediaTitle",
  "programTitle",
]);

const PLACE_COUPLING_KEYS: ReadonlySet<string> = new Set([
  "place",
  "eventPlace",
  "country",
]);

const FIELD_COUPLING_RULES: readonly FieldCouplingRule[] = [
  {
    id: "title-coupling",
    matches: ({ fieldKey }) => TITLE_COUPLING_KEYS.has(fieldKey),
    apply: ({ itemType, fieldKey, setCoupled, setCoupledIfSynced }) => {
      const typeTitleField =
        TITLE_COUPLED_BY_TYPE[itemType] || getTitleFieldForType(itemType);
      setCoupled("title");
      if (fieldKey !== "title") {
        setCoupled(fieldKey);
      }
      if (typeTitleField && typeTitleField !== "title") {
        setCoupledIfSynced(typeTitleField);
      }
    },
  },
  {
    id: "publication-title-coupling",
    matches: ({ itemType, fieldKey }) => {
      const typePubField = PUBLICATION_TITLE_COUPLED_BY_TYPE[itemType];
      const isPresentationVenueField =
        itemType === "presentation" &&
        (fieldKey === "meetingName" || fieldKey === "sessionTitle");
      return (
        PUB_TITLE_COUPLING_KEYS.has(fieldKey) ||
        isPresentationVenueField ||
        (typePubField !== undefined && fieldKey === typePubField)
      );
    },
    apply: ({ itemType, fieldKey, setCoupled, setCoupledIfSynced }) => {
      const typePubField = PUBLICATION_TITLE_COUPLED_BY_TYPE[itemType];
      setCoupled("publicationTitle");
      if (fieldKey !== "publicationTitle") {
        setCoupled(fieldKey);
      }
      if (typePubField && typePubField !== fieldKey) {
        setCoupledIfSynced(typePubField);
      }
      if (itemType === "presentation") {
        if (fieldKey !== "meetingName") setCoupledIfSynced("meetingName");
        if (fieldKey !== "sessionTitle") setCoupledIfSynced("sessionTitle");
      }
    },
  },
  {
    id: "place-coupling",
    matches: ({ fieldKey }) => PLACE_COUPLING_KEYS.has(fieldKey),
    apply: ({ itemType, fieldKey, setCoupled, setCoupledIfSynced }) => {
      const typePlaceField = PLACE_COUPLED_BY_TYPE[itemType];
      if (fieldKey === "place") {
        setCoupled("place");
        if (typePlaceField) {
          setCoupledIfSynced(typePlaceField);
        }
      } else {
        setCoupled(fieldKey);
        setCoupledIfSynced("place");
        if (typePlaceField && typePlaceField !== fieldKey) {
          setCoupledIfSynced(typePlaceField);
        }
      }
    },
  },
  {
    id: "date-coupling",
    matches: ({ fieldKey }) => DATE_COUPLED_FIELDS.has(fieldKey),
    apply: ({
      rec,
      currentEf,
      nextEf,
      patch,
      itemType,
      fieldKey,
      cleanVal,
      isClearing,
      setCoupled,
    }) => {
      const isFilingDateOnly =
        fieldKey === "filingDate" &&
        (isValidValue(rec.issueDate) || isValidValue(currentEf.issueDate));

      if (!isFilingDateOnly) {
        setCoupled("date");
        setCoupled("publicationDate");
      }
      if (fieldKey !== "date" && fieldKey !== "publicationDate") {
        setCoupled(fieldKey);
      }
      if (itemType === "case") setCoupled("dateDecided");
      if (itemType === "statute") setCoupled("dateEnacted");
      if (
        itemType === "patent" &&
        (fieldKey === "date" ||
          fieldKey === "publicationDate" ||
          fieldKey === "issueDate")
      ) {
        setCoupled("issueDate");
      }

      if (isClearing) {
        if (!isFilingDateOnly) {
          patch.year = null;
          nextEf.year = null;
        }
      } else {
        const parsedYear = parseValidYear(cleanVal);
        if (
          parsedYear !== undefined &&
          (!isFilingDateOnly || !isValidValue(rec.year))
        ) {
          patch.year = parsedYear;
          nextEf.year = parsedYear;
        }
      }
    },
  },
  {
    id: "num-pages-coupling",
    matches: ({ fieldKey }) =>
      fieldKey === "numPages" || fieldKey === "numberOfPages",
    apply: ({ setCoupled }) => {
      setCoupled("numPages");
      setCoupled("numberOfPages");
    },
  },
  {
    id: "authority-coupling",
    matches: ({ itemType, fieldKey }) =>
      fieldKey === "authority" ||
      fieldKey === "issuingAuthority" ||
      (fieldKey === "court" && itemType === "case"),
    apply: ({ itemType, fieldKey, setCoupled }) => {
      if (fieldKey === "authority" || fieldKey === "issuingAuthority") {
        setCoupled("authority");
        setCoupled("issuingAuthority");
        if (itemType === "case") {
          setCoupled("court");
        }
      } else {
        setCoupled("court");
        setCoupled("authority");
        setCoupled("issuingAuthority");
      }
    },
  },
];

/**
 * Applies canonical coupled-field synchronization rules onto an Inspector patch object
 * (mutating both top-level `patch` and `patch.extraFields`).
 */
export function applyCoupledFieldSynchronization(
  item: Partial<Item> | Record<string, unknown>,
  fieldKey: string,
  rawVal: string,
  patch: Partial<Item> & Record<string, unknown>,
): Partial<Item> & Record<string, unknown> {
  const rec = (item || {}) as Record<string, unknown>;
  const rawItemType =
    typeof rec.itemType === "string" && rec.itemType.trim()
      ? rec.itemType.trim()
      : "journalArticle";
  const itemType = normalizeCanonicalItemType(rawItemType);
  const cleanVal = rawVal.trim();
  const isClearing = cleanVal === "";

  const currentEf =
    rec.extraFields && typeof rec.extraFields === "object" && !Array.isArray(rec.extraFields)
      ? (rec.extraFields as Record<string, unknown>)
      : {};
  const nextEf: Record<string, unknown> = {
    ...currentEf,
    ...(patch.extraFields && typeof patch.extraFields === "object" && !Array.isArray(patch.extraFields)
      ? (patch.extraFields as Record<string, unknown>)
      : {}),
  };

  const setCoupled = (targetKey: string) => {
    patch[targetKey] = isClearing ? "" : cleanVal;
    nextEf[targetKey] = isClearing ? null : cleanVal;
  };

  const hasIndependentValue = (targetKey: string, sourceKey: string): boolean => {
    if (targetKey === sourceKey) return false;
    const rawTarget = rec[targetKey] ?? currentEf[targetKey];
    if (!isValidValue(rawTarget)) return false;
    const rawSource = rec[sourceKey] ?? currentEf[sourceKey];
    if (!isValidValue(rawSource)) return false;
    return String(rawTarget).trim() !== String(rawSource).trim();
  };

  const setCoupledIfSynced = (targetKey: string) => {
    if (isClearing || !hasIndependentValue(targetKey, fieldKey)) {
      setCoupled(targetKey);
    }
  };

  const ctx: FieldCouplingContext = {
    rec,
    currentEf,
    nextEf,
    patch,
    itemType,
    fieldKey,
    cleanVal,
    isClearing,
    setCoupled,
    setCoupledIfSynced,
  };

  for (const rule of FIELD_COUPLING_RULES) {
    if (rule.matches(ctx)) {
      rule.apply(ctx);
    }
  }

  patch.extraFields = nextEf;
  return patch;
}
