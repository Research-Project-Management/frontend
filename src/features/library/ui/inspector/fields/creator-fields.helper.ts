import type { Item, CreatorCredit } from '@/features/library/domain/types/library.types';
import {
  normalizeAuthors,
  splitAuthorString,
  parseCreatorName,
  isInstitutionName,
} from '@/features/library/domain/creators';
import { cleanValue } from '@/features/library/domain/metadata';
import {
  getPrimaryCreatorType,
  type SchemaItemTypeDefinition,
} from '@/features/library/domain/types/item-types.types';

export interface CreatorEntry {
  creatorType: string;
  name: string;
  fieldMode?: number;
  firstName?: string;
  lastName?: string;
  shortName?: string;
}

export interface CreatorFieldsProps {
  item?: Item;
  typeDefinition: SchemaItemTypeDefinition;
  canEdit?: boolean;
  onUpdateItem?: (data: Partial<Item>, options?: { silent?: boolean }) => void;
}

export const MAX_COLLAPSED_AUTHORS = 3;

/** Parse & sanitize creators array into structured list */
export function parseCreators(item: Item): CreatorEntry[] {
  const rawCreators =
    item.creators && item.creators.length > 0
      ? item.creators
      : item.contributors;
  if (Array.isArray(rawCreators) && rawCreators.length > 0) {
    const parsedCreators: CreatorEntry[] = [];
    for (const rawCreatorItem of rawCreators) {
      const creatorType = rawCreatorItem.creatorType || "author";
      const firstName = cleanValue(
        rawCreatorItem.firstName ||
          (rawCreatorItem as Record<string, unknown>).given,
      );
      const lastName = cleanValue(
        rawCreatorItem.lastName ||
          (rawCreatorItem as Record<string, unknown>).family,
      );
      const shortName = cleanValue(rawCreatorItem.shortName || undefined);
      let creatorName = cleanValue(
        rawCreatorItem.name || rawCreatorItem.fullName,
      );
      if (!creatorName && (firstName || lastName)) {
        creatorName = [lastName, firstName].filter(Boolean).join(", ");
      }

      const isSingleFieldInstitution =
        rawCreatorItem.fieldMode === 1 ||
        (rawCreatorItem.fieldMode === undefined &&
          !firstName &&
          Boolean(creatorName || lastName) &&
          isInstitutionName(creatorName || lastName));
      const fieldMode = isSingleFieldInstitution
        ? 1
        : (rawCreatorItem.fieldMode ?? 0);

      if (creatorName) {
        // If creator is marked as institution (fieldMode === 1), do NOT split by 'and', '&', or commas
        const splitNameParts =
          fieldMode === 1 ? [creatorName] : splitAuthorString(creatorName);
        if (splitNameParts.length > 1) {
          for (const authorPart of splitNameParts) {
            const parsed = parseCreatorName(authorPart);
            parsedCreators.push({
              creatorType,
              name: authorPart,
              fieldMode: parsed.isInstitution ? 1 : 0,
              firstName: parsed.isInstitution
                ? undefined
                : parsed.firstName || undefined,
              lastName: parsed.isInstitution
                ? authorPart
                : parsed.lastName || undefined,
            });
          }
        } else {
          parsedCreators.push({
            creatorType,
            name: creatorName,
            fieldMode,
            firstName: fieldMode === 1 ? undefined : firstName || undefined,
            lastName:
              fieldMode === 1 ? lastName || creatorName : lastName || undefined,
            shortName: shortName || undefined,
          });
        }
      } else {
        parsedCreators.push({
          creatorType,
          name: "",
          fieldMode,
          firstName: fieldMode === 1 ? undefined : firstName || undefined,
          lastName: lastName || undefined,
          shortName: shortName || undefined,
        });
      }
    }
    if (parsedCreators.length > 0) return parsedCreators;
  }

  const normalizedAuthorList = normalizeAuthors(
    item.authors,
    item.creators,
    item.contributors,
  );
  if (normalizedAuthorList.length > 0) {
    const defaultRole = getPrimaryCreatorType(item.itemType) || "author";
    return normalizedAuthorList.map((authorName) => ({
      creatorType: defaultRole,
      name: authorName || "",
      fieldMode: 0,
    }));
  }

  return [];
}

/** Compare two creator arrays for semantic equality to prevent redundant mutations */
export function areCreatorsEqual(
  firstCreators: CreatorEntry[],
  secondCreators: CreatorEntry[],
): boolean {
  const normalizedFirstCreators = firstCreators.filter(
    (creatorItem) => creatorItem.name.trim().length > 0,
  );
  const normalizedSecondCreators = secondCreators.filter(
    (creatorItem) => creatorItem.name.trim().length > 0,
  );

  if (normalizedFirstCreators.length !== normalizedSecondCreators.length) {
    return false;
  }

  for (
    let creatorIndex = 0;
    creatorIndex < normalizedFirstCreators.length;
    creatorIndex += 1
  ) {
    const firstCreator = normalizedFirstCreators[creatorIndex];
    const secondCreator = normalizedSecondCreators[creatorIndex];
    if (!firstCreator || !secondCreator) {
      return false;
    }
    const firstCreatorRole = firstCreator.creatorType || "author";
    const secondCreatorRole = secondCreator.creatorType || "author";
    if (firstCreatorRole !== secondCreatorRole) {
      return false;
    }
    if ((firstCreator.fieldMode ?? 0) !== (secondCreator.fieldMode ?? 0)) {
      return false;
    }
    const firstCreatorName = firstCreator.name.trim();
    const secondCreatorName = secondCreator.name.trim();
    if (firstCreatorName !== secondCreatorName) {
      return false;
    }
    const firstShort = (firstCreator.shortName || "").trim();
    const secondShort = (secondCreator.shortName || "").trim();
    if (firstShort !== secondShort) {
      return false;
    }
  }

  return true;
}

/** Convert CreatorEntry items into strongly typed CreatorCredit items for Item */
export function toItemCreators(
  creatorEntries: CreatorEntry[],
): CreatorCredit[] {
  return creatorEntries.map((creatorEntry, indexPosition) => {
    const trimmedName = creatorEntry.name.trim();
    let firstName = creatorEntry.firstName;
    let lastName = creatorEntry.lastName;

    if (creatorEntry.fieldMode === 1) {
      firstName = "";
      lastName = trimmedName;
    } else if (firstName || lastName) {
      // Explicit 2-field mode inputs preserved directly
    } else if (trimmedName) {
      const parsed = parseCreatorName(trimmedName);
      firstName = parsed.firstName;
      lastName = parsed.lastName;
    }

    return {
      orderIndex: indexPosition,
      creatorType: creatorEntry.creatorType || "author",
      fieldMode: creatorEntry.fieldMode ?? 0,
      fullName: trimmedName,
      name: trimmedName,
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      shortName: creatorEntry.shortName?.trim() || undefined,
    };
  });
}

