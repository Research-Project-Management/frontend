import type { Item } from './types/library.types';
import { normalizeCanonicalItemType } from './types/item-types.types';
import { normalizeAuthors } from './creators';
import {
  isValidValue,
  stripLatexMarkup,
} from './metadata-sanitizers';
import {
  getItemDisplayTitle,
  getItemDisplayDate,
} from './metadata-extra';
import {
  ALL_SCHEMA_PROMOTE_KEYS,
  CONTAINER_TITLE_CANDIDATE_KEYS,
  SUBTYPE_CANDIDATE_KEYS,
  PLACE_CANDIDATE_KEYS,
  PUBLISHER_CANDIDATE_KEYS,
  DATE_CANDIDATE_KEYS,
  CANONICAL_SCALAR_PROJECTIONS,
  EMPTY_BACKEND_ITEM_DEFAULTS,
  pickFirstValidField,
  hydrateIdentifiersFromRelationalArray,
  mergeRawItemPartials,
  hasExplicitUserStateInPayload,
  getAssignedCollectionIds,
  type ProvisionalUploadItemInput,
  createProvisionalUploadItem,
} from './metadata-mapper.helpers';

export {
  ALL_SCHEMA_PROMOTE_KEYS,
  CONTAINER_TITLE_CANDIDATE_KEYS,
  SUBTYPE_CANDIDATE_KEYS,
  PLACE_CANDIDATE_KEYS,
  PUBLISHER_CANDIDATE_KEYS,
  DATE_CANDIDATE_KEYS,
  CANONICAL_SCALAR_PROJECTIONS,
  EMPTY_BACKEND_ITEM_DEFAULTS,
  pickFirstValidField,
  hydrateIdentifiersFromRelationalArray,
  mergeRawItemPartials,
  hasExplicitUserStateInPayload,
  getAssignedCollectionIds,
  type ProvisionalUploadItemInput,
  createProvisionalUploadItem,
};

const CONTAINER_VENUE_FIELD_BY_TYPE: Readonly<Record<string, string>> = {
  conferencePaper: 'proceedingsTitle',
  bookSection: 'bookTitle',
  webpage: 'websiteTitle',
  blogPost: 'blogTitle',
  forumPost: 'forumTitle',
  dictionaryEntry: 'dictionaryTitle',
  encyclopediaArticle: 'encyclopediaTitle',
  presentation: 'sessionTitle',
  case: 'reporter',
  statute: 'code',
  tvBroadcast: 'programTitle',
  radioBroadcast: 'programTitle',
  podcast: 'seriesTitle',
  audioRecording: 'seriesTitle',
};

/**
 * Bidirectionally projects `publicationTitle` and type-specific container/venue titles
 * (including `programTitle` for `tvBroadcast`/`radioBroadcast` and `seriesTitle` for `podcast`/`audioRecording`)
 * whenever the target field is not already populated or explicitly tombstoned (`null` / `""`).
 */
export function projectContainerAndVenueTitles(
  mapped: Record<string, unknown>,
  rec: Record<string, unknown>,
  ef: Record<string, unknown>,
): void {
  if (!isValidValue(mapped.publicationTitle)) {
    const isPubTitleTombstoned =
      ('publicationTitle' in rec &&
        (rec.publicationTitle === '' || rec.publicationTitle === null)) ||
      ef.publicationTitle === null;
    if (!isPubTitleTombstoned) {
      const containerTitle = pickFirstValidField(
        rec,
        ef,
        CONTAINER_TITLE_CANDIDATE_KEYS,
      );
      if (isValidValue(containerTitle)) {
        mapped.publicationTitle = stripLatexMarkup(
          String(containerTitle).trim(),
        );
      }
    }
  }

  const rawItemType =
    typeof mapped.itemType === 'string'
      ? mapped.itemType.trim()
      : typeof rec.itemType === 'string'
        ? rec.itemType.trim()
        : '';
  const canonicalType = rawItemType
    ? normalizeCanonicalItemType(rawItemType)
    : '';
  const targetVenueField =
    CONTAINER_VENUE_FIELD_BY_TYPE[canonicalType] ||
    CONTAINER_VENUE_FIELD_BY_TYPE[rawItemType];
  if (!targetVenueField) return;

  const targetVenueFields =
    canonicalType === 'presentation' || rawItemType === 'presentation'
      ? ['sessionTitle', 'meetingName']
      : [targetVenueField];

  for (const venueField of targetVenueFields) {
    const isTargetTombstoned =
      (venueField in rec &&
        (rec[venueField] === '' || rec[venueField] === null)) ||
      ef[venueField] === null;
    if (isTargetTombstoned) continue;

    if (!isValidValue(mapped[venueField])) {
      const pubTitle = pickFirstValidField(rec, ef, [
        venueField,
        ...(canonicalType === 'presentation' || rawItemType === 'presentation'
          ? ['sessionTitle', 'meetingName']
          : []),
        'publicationTitle',
        'containerTitle',
        'journal',
      ]);
      const effectiveVal = isValidValue(pubTitle)
        ? pubTitle
        : mapped.publicationTitle;
      if (isValidValue(effectiveVal)) {
        const cleanVal = stripLatexMarkup(String(effectiveVal).trim());
        mapped[venueField] = cleanVal;
        ef[venueField] = cleanVal;
        const currentEfObj =
          mapped.extraFields && typeof mapped.extraFields === 'object'
            ? (mapped.extraFields as Record<string, unknown>)
            : {};
        mapped.extraFields = {
          ...currentEfObj,
          [venueField]: cleanVal,
        };
      }
    }
  }
}

/**
 * Step 2 of `mapBackendItem`: Projects Zotero Schema v42 base fields and legacy backend aliases
 * onto canonical top-level `Item` properties.
 */
function projectCanonicalBaseFields(
  mapped: Record<string, unknown>,
  rec: Record<string, unknown>,
  ef: Record<string, unknown>,
): void {
  mapped.title =
    getItemDisplayTitle(mapped) ||
    (typeof rec.title === 'string' ? rec.title : '');

  const hasExplicitEmptyCreators =
    (Array.isArray(rec.creators) &&
      rec.creators.length === 0 &&
      (!Array.isArray(rec.authors) || rec.authors.length === 0) &&
      (!Array.isArray(rec.contributors) ||
        rec.contributors.length === 0 ||
        ef.creators === null)) ||
    ef.creators === null;

  const normalizedAuthors = hasExplicitEmptyCreators
    ? []
    : normalizeAuthors(
        rec.authors as unknown[],
        (Array.isArray(rec.creators) && rec.creators.length > 0
          ? rec.creators
          : ef.creators) as Array<{
          firstName?: string;
          lastName?: string;
          name?: string;
          fullName?: string;
          creatorType?: string;
        }>,
        (Array.isArray(rec.creators) &&
        rec.creators.length === 0 &&
        Array.isArray(rec.authors) &&
        rec.authors.length === 0
          ? undefined
          : rec.contributors) as Array<{
          firstName?: string;
          lastName?: string;
          name?: string;
          fullName?: string;
          creatorType?: string;
        }>,
      );
  if (hasExplicitEmptyCreators) {
    mapped.authors = [];
    mapped.creators = [];
    mapped.contributors = [];
  } else if (
    normalizedAuthors.length > 0 &&
    (!Array.isArray(rec.authors) || rec.authors.length === 0)
  ) {
    mapped.authors = normalizedAuthors;
  }

  const rawCreators = hasExplicitEmptyCreators
    ? []
    : ((Array.isArray(rec.creators) && rec.creators.length > 0
        ? rec.creators
        : ef.creators || rec.contributors) as unknown);
  if (Array.isArray(rawCreators)) {
    mapped.creators = rawCreators.map((c, idx) => {
      if (!c || typeof c !== 'object') return c;
      const cr = c as Record<string, unknown>;
      const nested =
        cr.contributor && typeof cr.contributor === 'object'
          ? (cr.contributor as Record<string, unknown>)
          : undefined;
      const firstName =
        typeof cr.firstName === 'string'
          ? cr.firstName
          : typeof nested?.firstName === 'string'
            ? nested.firstName
            : typeof cr.given === 'string'
              ? cr.given
              : typeof nested?.given === 'string'
                ? nested.given
                : undefined;
      const lastName =
        typeof cr.lastName === 'string'
          ? cr.lastName
          : typeof nested?.lastName === 'string'
            ? nested.lastName
            : typeof cr.family === 'string'
              ? cr.family
              : typeof nested?.family === 'string'
                ? nested.family
                : undefined;
      const fullName =
        typeof cr.fullName === 'string' && cr.fullName.trim()
          ? cr.fullName.trim()
          : typeof nested?.fullName === 'string' && nested.fullName.trim()
            ? nested.fullName.trim()
            : typeof cr.name === 'string' && cr.name.trim()
              ? cr.name.trim()
              : typeof nested?.name === 'string' && nested.name.trim()
                ? nested.name.trim()
                : [firstName, lastName].filter(Boolean).join(' ').trim();
      return {
        ...cr,
        ...(firstName !== undefined ? { firstName } : {}),
        ...(lastName !== undefined ? { lastName } : {}),
        orderIndex: typeof cr.orderIndex === 'number' ? cr.orderIndex : idx,
        creatorType:
          typeof cr.creatorType === 'string' && cr.creatorType.trim()
            ? cr.creatorType.trim()
            : typeof cr.role === 'string' && cr.role.trim()
              ? cr.role.trim().toLowerCase()
              : 'author',
        fullName,
      };
    });
  }

  for (const [targetKey, sourceKeys] of CANONICAL_SCALAR_PROJECTIONS) {
    if (!isValidValue(mapped[targetKey])) {
      const val = pickFirstValidField(rec, ef, sourceKeys);
      if (isValidValue(val)) {
        mapped[targetKey] = String(val).trim();
      }
    }
  }

  const resolvedItemTypeLower =
    typeof mapped.itemType === 'string'
      ? mapped.itemType.trim().toLowerCase()
      : '';
  const canonicalItemTypeLower = resolvedItemTypeLower
    ? normalizeCanonicalItemType(resolvedItemTypeLower).toLowerCase()
    : '';
  const subtypeCandidates = [
    ef.type,
    rec.type,
    ...SUBTYPE_CANDIDATE_KEYS.filter((k) => k !== 'type').flatMap((k) => [
      rec[k],
      ef[k],
    ]),
  ];
  let resolvedSubtype: string | undefined;
  for (const cand of subtypeCandidates) {
    if (typeof cand === 'string' && isValidValue(cand)) {
      const trimmed = cand.trim();
      const lower = trimmed.toLowerCase();
      if (
        lower &&
        lower !== resolvedItemTypeLower &&
        lower !== canonicalItemTypeLower
      ) {
        resolvedSubtype = trimmed;
        break;
      }
    }
  }
  if (resolvedSubtype) {
    mapped.type = resolvedSubtype;
    if (mapped.extraFields && typeof mapped.extraFields === 'object') {
      (mapped.extraFields as Record<string, unknown>).type = resolvedSubtype;
    }
  } else if (
    typeof mapped.type === 'string' &&
    (mapped.type.trim().toLowerCase() === resolvedItemTypeLower ||
      mapped.type.trim().toLowerCase() === canonicalItemTypeLower)
  ) {
    delete mapped.type;
  }

  if (!isValidValue(mapped.numberOfPages)) {
    const numPagesVal = pickFirstValidField(rec, ef, [
      'numberOfPages',
      'numPages',
    ]);
    if (isValidValue(numPagesVal)) {
      mapped.numberOfPages = numPagesVal;
    }
  }

  if (!Array.isArray(mapped.notes) || mapped.notes.length === 0) {
    if (Array.isArray(rec.notesList) && rec.notesList.length > 0) {
      mapped.notes = rec.notesList;
    }
  }
  if (!Array.isArray(mapped.attachments) || mapped.attachments.length === 0) {
    if (Array.isArray(rec.files) && rec.files.length > 0) {
      mapped.attachments = rec.files;
    }
  }

  const rawTagCandidates = [
    ...(Array.isArray(rec.tags) ? rec.tags : []),
    ...(Array.isArray(rec.itemTags) ? rec.itemTags : []),
    ...(Array.isArray(ef.tags) ? (ef.tags as unknown[]) : []),
  ];
  if (rawTagCandidates.length > 0) {
    const seenTags = new Set<string>();
    const cleanTags: string[] = [];
    for (const entry of rawTagCandidates) {
      let tagName = '';
      if (typeof entry === 'string') {
        tagName = entry.trim();
      } else if (entry && typeof entry === 'object') {
        const obj = entry as {
          name?: unknown;
          tag?: unknown;
        };
        if (typeof obj.name === 'string') {
          tagName = obj.name.trim();
        } else if (typeof obj.tag === 'string') {
          tagName = obj.tag.trim();
        } else if (
          obj.tag &&
          typeof obj.tag === 'object' &&
          typeof (obj.tag as { name?: unknown }).name === 'string'
        ) {
          tagName = ((obj.tag as { name: string }).name || '').trim();
        }
      }
      if (tagName) {
        const lower = tagName.toLowerCase();
        if (!seenTags.has(lower)) {
          seenTags.add(lower);
          cleanTags.push(tagName);
        }
      }
    }
    mapped.tags = cleanTags;
    if (!Array.isArray(mapped.keywords) || mapped.keywords.length === 0) {
      mapped.keywords = cleanTags;
    }
  }
  if (
    !Array.isArray(mapped.collectionIds) ||
    mapped.collectionIds.length === 0
  ) {
    const derivedCollectionIds = new Set<string>();
    if (typeof rec.collectionId === 'string' && rec.collectionId.trim()) {
      derivedCollectionIds.add(rec.collectionId.trim());
    }
    const rawCols = Array.isArray(mapped.collections)
      ? mapped.collections
      : Array.isArray(rec.collections)
        ? rec.collections
        : [];
    for (const c of rawCols) {
      if (c && typeof c === 'object') {
        const obj = c as { id?: unknown; collectionId?: unknown };
        const cid = obj.collectionId ?? obj.id;
        if (typeof cid === 'string' && cid.trim()) {
          derivedCollectionIds.add(cid.trim());
        }
      }
    }
    if (Array.isArray(rec.collectionItems)) {
      for (const ci of rec.collectionItems) {
        if (ci && typeof ci === 'object') {
          const obj = ci as {
            collectionId?: unknown;
            collection?: { id?: unknown };
          };
          const cid = obj.collectionId ?? obj.collection?.id;
          if (typeof cid === 'string' && cid.trim()) {
            derivedCollectionIds.add(cid.trim());
          }
        }
      }
    }
    if (derivedCollectionIds.size > 0) {
      mapped.collectionIds = Array.from(derivedCollectionIds);
    }
  }
  const retractionDetails =
    rec.retractionDetails &&
    typeof rec.retractionDetails === 'object' &&
    !Array.isArray(rec.retractionDetails)
      ? (rec.retractionDetails as Record<string, unknown>)
      : ef.retractionDetails &&
          typeof ef.retractionDetails === 'object' &&
          !Array.isArray(ef.retractionDetails)
        ? (ef.retractionDetails as Record<string, unknown>)
        : undefined;
  const resolvedNoticeUrl =
    (retractionDetails?.noticeUrl as string | undefined) ||
    (rec.noticeUrl as string | undefined) ||
    (ef.noticeUrl as string | undefined);
  if (typeof resolvedNoticeUrl === 'string' && resolvedNoticeUrl.trim()) {
    mapped.noticeUrl = resolvedNoticeUrl.trim();
  }
  if (mapped.notesCount === undefined && typeof rec.noteCount === 'number') {
    mapped.notesCount = rec.noteCount;
  }
  const resolvedIsMyPublication = Boolean(
    rec.isMyPublication === true ||
      rec.isInMyPublications === true ||
      rec.inPublications === true ||
      ef.isMyPublication === true ||
      ef.isInMyPublications === true ||
      ef.inPublications === true ||
      mapped.isMyPublication === true ||
      mapped.isInMyPublications === true ||
      mapped.inPublications === true,
  );
  mapped.isMyPublication = resolvedIsMyPublication;
  mapped.isInMyPublications = resolvedIsMyPublication;

  projectContainerAndVenueTitles(mapped, rec, ef);

  if (!isValidValue(rec.publisher)) {
    const rawPublisher = pickFirstValidField(rec, ef, PUBLISHER_CANDIDATE_KEYS);
    if (isValidValue(rawPublisher)) {
      mapped.publisher = stripLatexMarkup(String(rawPublisher).trim());
    }
  }

  if (!isValidValue(rec.year)) {
    const displayDate = getItemDisplayDate(mapped);
    const resolvedYear =
      typeof displayDate === 'number'
        ? displayDate
        : typeof rec.year === 'number' && rec.year > 0
          ? rec.year
          : undefined;
    if (resolvedYear !== undefined) {
      mapped.year = resolvedYear;
    }
  }

  if (!isValidValue(rec.publicationDate) || !isValidValue(rec.date)) {
    const rawDateStr = pickFirstValidField(rec, ef, DATE_CANDIDATE_KEYS);
    if (isValidValue(rawDateStr)) {
      const cleanDate = String(rawDateStr).trim();
      if (!isValidValue(rec.publicationDate)) mapped.publicationDate = cleanDate;
      if (!isValidValue(rec.date)) mapped.date = cleanDate;
    }
  }

  if (!isValidValue(rec.place) && !isValidValue(ef.place)) {
    const fallbackPlace = pickFirstValidField(rec, ef, PLACE_CANDIDATE_KEYS);
    if (isValidValue(fallbackPlace)) {
      mapped.place = String(fallbackPlace).trim();
    }
  }
}

/**
 * Declaratively normalizes a raw backend item or Zotero Schema v42 record into a canonical UI `Item`,
 * composing `mergeRawItemPartials` and `projectCanonicalBaseFields`.
 */
export function mapBackendItem(
  raw?: Partial<Item> | Record<string, unknown> | null,
): Item {
  if (!raw || typeof raw !== 'object') {
    return { ...EMPTY_BACKEND_ITEM_DEFAULTS };
  }

  const rec = { ...(raw as Record<string, unknown>) };
  const hasExplicitUserState = hasExplicitUserStateInPayload(rec);
  const rawStates = Array.isArray(rec.states)
    ? rec.states
    : Array.isArray(rec.userStates)
      ? rec.userStates
      : undefined;
  const firstState =
    rawStates && rawStates.length > 0 && rawStates[0] && typeof rawStates[0] === 'object'
      ? (rawStates[0] as Record<string, unknown>)
      : undefined;

  const { mapped, ef } = mergeRawItemPartials(rec);
  hydrateIdentifiersFromRelationalArray(rec, ef);
  if (Object.keys(ef).length > 0) {
    mapped.extraFields = {
      ...(mapped.extraFields && typeof mapped.extraFields === 'object'
        ? (mapped.extraFields as Record<string, unknown>)
        : {}),
      ...ef,
    };
  }
  const rawReadingState =
    rec.readingState && typeof rec.readingState === 'object'
      ? (rec.readingState as Record<string, unknown>)
      : rec.state && typeof rec.state === 'object'
        ? (rec.state as Record<string, unknown>)
        : undefined;
  const stateSource = firstState ?? rawReadingState;
  if (stateSource) {
    if (mapped.isStarred === undefined && typeof stateSource.isStarred === 'boolean') {
      mapped.isStarred = stateSource.isStarred;
    }
    if (mapped.readStatus === undefined && typeof stateSource.readStatus === 'string') {
      mapped.readStatus = stateSource.readStatus;
      mapped.isRead = stateSource.readStatus === 'completed';
    }
    if (mapped.rating === undefined && typeof stateSource.rating === 'number') {
      mapped.rating = stateSource.rating;
    }
    if (mapped.lastReadAt === undefined && stateSource.lastReadAt !== undefined) {
      mapped.lastReadAt = stateSource.lastReadAt;
    }
  }
  const resolvedCurrentPage =
    typeof rec.currentPage === 'number'
      ? rec.currentPage
      : typeof stateSource?.currentPage === 'number'
        ? stateSource.currentPage
        : typeof rec.lastReadPage === 'number'
          ? rec.lastReadPage
          : typeof stateSource?.lastReadPage === 'number'
            ? stateSource.lastReadPage
            : undefined;
  if (resolvedCurrentPage !== undefined) {
    if (mapped.currentPage === undefined) mapped.currentPage = resolvedCurrentPage;
    if (mapped.lastReadPage === undefined) mapped.lastReadPage = resolvedCurrentPage;
  }
  const resolvedScrollPosition =
    rec.scrollPosition !== undefined
      ? rec.scrollPosition
      : stateSource?.scrollPosition;
  if (resolvedScrollPosition !== undefined && mapped.scrollPosition === undefined) {
    mapped.scrollPosition = resolvedScrollPosition;
  }
  const resolvedLastOpenedAt =
    typeof rec.lastOpenedAt === 'string' || rec.lastOpenedAt === null
      ? rec.lastOpenedAt
      : typeof stateSource?.lastOpenedAt === 'string' || stateSource?.lastOpenedAt === null
        ? stateSource.lastOpenedAt
        : undefined;
  if (resolvedLastOpenedAt !== undefined && mapped.lastOpenedAt === undefined) {
    mapped.lastOpenedAt = resolvedLastOpenedAt;
  }
  projectCanonicalBaseFields(mapped, rec, ef);

  const normalizedCollections = Array.isArray(mapped.collections)
    ? (mapped.collections as Array<{ id?: string; collectionId?: string }>)
    : [];
  const normalizedCollectionIds =
    Array.isArray(mapped.collectionIds) && mapped.collectionIds.length > 0
      ? (mapped.collectionIds as string[])
      : normalizedCollections
          .map((c) => c?.collectionId || c?.id)
          .filter((id): id is string => Boolean(id));

  const retractionDetails =
    (mapped.retractionDetails as Record<string, unknown> | undefined) ??
    (rec.retractionDetails as Record<string, unknown> | undefined);
  const noticeUrl =
    (retractionDetails?.noticeUrl as string | undefined) ||
    (rec.noticeUrl as string | undefined) ||
    (mapped.noticeUrl as string | undefined);

  const result: Item = {
    ...EMPTY_BACKEND_ITEM_DEFAULTS,
    ...(mapped as Partial<Item>),
    collectionIds: normalizedCollectionIds,
    ...(noticeUrl ? { noticeUrl } : {}),
    createdAt:
      typeof mapped.createdAt === 'string' && mapped.createdAt.trim()
        ? mapped.createdAt
        : EMPTY_BACKEND_ITEM_DEFAULTS.createdAt,
    updatedAt:
      typeof mapped.updatedAt === 'string' && mapped.updatedAt.trim()
        ? mapped.updatedAt
        : EMPTY_BACKEND_ITEM_DEFAULTS.updatedAt,
  };

  setMappedItemMeta(result, {
    isFullBackendItem: true,
    hasExplicitUserState,
  });

  return result;
}

export interface MappedItemMeta {
  isFullBackendItem?: boolean;
  hasExplicitUserState?: boolean;
}

const MAPPED_ITEM_META = new WeakMap<object, MappedItemMeta>();

export function setMappedItemMeta<T extends object>(
  target: T | null | undefined,
  meta: MappedItemMeta,
): T {
  if (!target || typeof target !== 'object') return target as unknown as T;
  const current = MAPPED_ITEM_META.get(target) || {};
  const next: MappedItemMeta = {
    ...current,
    ...(meta.isFullBackendItem !== undefined
      ? { isFullBackendItem: meta.isFullBackendItem }
      : {}),
    ...(meta.hasExplicitUserState !== undefined
      ? { hasExplicitUserState: meta.hasExplicitUserState }
      : {}),
  };
  MAPPED_ITEM_META.set(target, next);

  if (meta.isFullBackendItem !== undefined) {
    Object.defineProperty(target, '_isFullBackendItem', {
      value: Boolean(meta.isFullBackendItem),
      enumerable: false,
      configurable: true,
      writable: true,
    });
  }
  if (meta.hasExplicitUserState !== undefined) {
    Object.defineProperty(target, '_hasExplicitUserState', {
      value: Boolean(meta.hasExplicitUserState),
      enumerable: false,
      configurable: true,
      writable: true,
    });
  }
  return target;
}

export function getMappedItemMeta(
  source: unknown,
): MappedItemMeta | undefined {
  if (!source || typeof source !== 'object') return undefined;
  const fromMap = MAPPED_ITEM_META.get(source);
  const srcRec = source as Record<string, unknown>;
  const hasFullProp = '_isFullBackendItem' in srcRec;
  const hasExplicitProp = '_hasExplicitUserState' in srcRec;
  if (!fromMap && !hasFullProp && !hasExplicitProp) return undefined;
  return {
    isFullBackendItem: hasFullProp
      ? Boolean(srcRec._isFullBackendItem)
      : fromMap?.isFullBackendItem,
    hasExplicitUserState: hasExplicitProp
      ? Boolean(srcRec._hasExplicitUserState)
      : fromMap?.hasExplicitUserState,
  };
}

/**
 * Copies `_isFullBackendItem` and `_hasExplicitUserState` metadata flags
 * from a mapped backend item onto a cloned/spread target object via WeakMap + property descriptors.
 */
export function preserveMappedItemFlags<T extends object>(
  source: unknown,
  target: T,
): T {
  if (!source || typeof source !== 'object' || !target || typeof target !== 'object') {
    return target;
  }
  const meta = getMappedItemMeta(source);
  if (meta) {
    setMappedItemMeta(target, meta);
  }
  return target;
}
