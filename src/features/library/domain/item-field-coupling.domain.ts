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

import type { Item } from "@/features/library/domain/types/library.types";
import {
  getTitleFieldForType,
  normalizeCanonicalItemType,
} from "@/features/library/domain/types/item-types.types";
import { isValidValue } from "./metadata";
import { parseValidYear } from "./item-field-scorers.strategy";

export const TITLE_COUPLED_BY_TYPE: Readonly<Record<string, string>> = {
  case: "caseName",
  statute: "nameOfAct",
  email: "subject",
};

export const PUBLICATION_TITLE_COUPLED_BY_TYPE: Readonly<Record<string, string>> = {
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

export const PLACE_COUPLED_BY_TYPE: Readonly<Record<string, string>> = {
  conferencePaper: "eventPlace",
  presentation: "eventPlace",
  artwork: "eventPlace",
  letter: "eventPlace",
  patent: "country",
};

export const DATE_COUPLED_FIELDS: ReadonlySet<string> = new Set<string>([
  "date",
  "publicationDate",
  "dateDecided",
  "dateEnacted",
  "issueDate",
  "filingDate",
]);

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

  // 1. Title <-> caseName (case), nameOfAct (statute), subject (email)
  const typeTitleField =
    TITLE_COUPLED_BY_TYPE[itemType] || getTitleFieldForType(itemType);
  if (
    fieldKey === "title" ||
    fieldKey === "caseName" ||
    fieldKey === "nameOfAct" ||
    fieldKey === "subject"
  ) {
    setCoupled("title");
    if (fieldKey !== "title") {
      setCoupled(fieldKey);
    }
    if (typeTitleField && typeTitleField !== "title") {
      setCoupledIfSynced(typeTitleField);
    }
  }

  // 2. publicationTitle <-> reporter (case), code (statute), blogTitle (blogPost),
  //    forumTitle (forumPost), dictionaryTitle (dictionaryEntry),
  //    encyclopediaTitle (encyclopediaArticle), programTitle (tvBroadcast, radioBroadcast),
  //    proceedingsTitle (conferencePaper), bookTitle (bookSection), websiteTitle (webpage),
  //    sessionTitle / meetingName (presentation)
  const typePubField = PUBLICATION_TITLE_COUPLED_BY_TYPE[itemType];
  const isPresentationVenueField =
    itemType === "presentation" &&
    (fieldKey === "meetingName" || fieldKey === "sessionTitle");
  const isPubCoupledField =
    fieldKey === "publicationTitle" ||
    fieldKey === "reporter" ||
    fieldKey === "code" ||
    fieldKey === "blogTitle" ||
    fieldKey === "forumTitle" ||
    fieldKey === "dictionaryTitle" ||
    fieldKey === "encyclopediaTitle" ||
    fieldKey === "programTitle" ||
    isPresentationVenueField ||
    (typePubField !== undefined && fieldKey === typePubField);

  if (isPubCoupledField) {
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
  }

  // 3. place <-> eventPlace (conferencePaper, presentation, artwork, letter), country (patent)
  const typePlaceField = PLACE_COUPLED_BY_TYPE[itemType];
  if (
    fieldKey === "place" ||
    fieldKey === "eventPlace" ||
    fieldKey === "country"
  ) {
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
  }

  // 4. date & publicationDate <-> dateDecided (case), dateEnacted (statute),
  //    issueDate (patent), filingDate (patent)
  if (DATE_COUPLED_FIELDS.has(fieldKey)) {
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
      (fieldKey === "date" || fieldKey === "publicationDate" || fieldKey === "issueDate")
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
      if (parsedYear !== undefined && (!isFilingDateOnly || !isValidValue(rec.year))) {
        patch.year = parsedYear;
        nextEf.year = parsedYear;
      }
    }
  }

  // 5. numPages <-> numberOfPages
  if (fieldKey === "numPages" || fieldKey === "numberOfPages") {
    setCoupled("numPages");
    setCoupled("numberOfPages");
  }

  // 6. authority <-> issuingAuthority (and court for case)
  if (fieldKey === "authority" || fieldKey === "issuingAuthority") {
    setCoupled("authority");
    setCoupled("issuingAuthority");
    if (itemType === "case") {
      setCoupled("court");
    }
  } else if (fieldKey === "court" && itemType === "case") {
    setCoupled("court");
    setCoupled("authority");
    setCoupled("issuingAuthority");
  }

  patch.extraFields = nextEf;
  return patch;
}
