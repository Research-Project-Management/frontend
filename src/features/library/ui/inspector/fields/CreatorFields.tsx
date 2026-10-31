"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import {
  type CreatorEntry,
  normalizeAuthors,
  splitAuthorString,
  parseCreatorName,
  parseCreators,
  areCreatorsEqual,
  toItemCreators,
} from "@/features/library/domain/creators";
import type { Item } from "@/features/library/domain/types/library.types";
import {
  type SchemaItemTypeDefinition,
  ALL_CREATOR_TYPES,
  getPrimaryCreatorType,
} from "@/features/library/domain/types/item-types.types";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import { CreatorRowItem, type CreatorRowItemProps } from "./CreatorRowItem";

export interface CreatorFieldsProps {
  item?: Item;
  typeDefinition: SchemaItemTypeDefinition;
  canEdit?: boolean;
  onUpdateItem?: (data: Partial<Item>, options?: { silent?: boolean }) => void;
}

const MAX_COLLAPSED_AUTHORS = 3;

export type { CreatorEntry, CreatorRowItemProps };
export { parseCreators, areCreatorsEqual, toItemCreators, CreatorRowItem };

export function CreatorFields({
  item,
  onUpdateItem,
  typeDefinition,
  canEdit = true,
}: CreatorFieldsProps) {
  const [isAuthorsExpanded, setIsAuthorsExpanded] = useState(false);
  const [focusAuthorIndex, setFocusAuthorIndex] = useState<number | null>(null);
  const [emptyAuthorDraft, setEmptyAuthorDraft] = useState("");
  const emptyInputFocusedItemIdRef = useRef<string | undefined>(undefined);
  const authorInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const currentItemType = item?.itemType || "journalArticle";

  const primaryRole = useMemo(() => {
    return (
      typeDefinition?.primaryCreatorType ||
      getPrimaryCreatorType(currentItemType) ||
      "author"
    ).toLowerCase();
  }, [typeDefinition?.primaryCreatorType, currentItemType]);

  const creatorTypesList = useMemo(() => {
    const list = [...(typeDefinition?.creatorTypes || [])];
    const standardRoles = [
      "author",
      "contributor",
      "editor",
      "reviewedAuthor",
      "translator",
    ];
    for (const role of standardRoles) {
      if (!list.some((ct) => ct.creatorType === role)) {
        list.push({
          creatorType: role,
          label: ALL_CREATOR_TYPES[role] || role,
          primary: false,
        });
      }
    }
    return list;
  }, [typeDefinition]);

  const [localCreators, setLocalCreators] = useState<CreatorEntry[]>(() =>
    item ? parseCreators(item) : [],
  );

  const itemId = item?.id;
  const itemCreators = item?.creators;
  const itemContributors = item?.contributors;
  const itemAuthors = item?.authors;
  const lastSyncedItemIdRef = useRef<string | undefined>(itemId);

  useEffect(() => {
    if (item) {
      const incoming = parseCreators(item);
      const isItemSwitched = lastSyncedItemIdRef.current !== itemId;
      lastSyncedItemIdRef.current = itemId;
      const isAnyInputFocused = authorInputRefs.current.some(
        (el) => el && typeof document !== "undefined" && document.activeElement === el,
      );
      if ((isItemSwitched || !isAnyInputFocused) && !areCreatorsEqual(localCreators, incoming)) {
        setLocalCreators(incoming);
      }
    }
  }, [itemId, itemCreators, itemContributors, itemAuthors]);

  useEffect(() => {
    setIsAuthorsExpanded(false);
    setEmptyAuthorDraft("");
    emptyInputFocusedItemIdRef.current = undefined;
  }, [itemId]);

  useEffect(() => {
    if (
      focusAuthorIndex !== null &&
      authorInputRefs.current[focusAuthorIndex]
    ) {
      authorInputRefs.current[focusAuthorIndex]?.focus();
      setFocusAuthorIndex(null);
    }
  }, [focusAuthorIndex, localCreators]);

  /** Helper to determine if a creator entry belongs to authors (which can collapse) */
  const isAuthorRole = useCallback(
    (role?: string) => {
      const r = (role || "author").trim().toLowerCase();
      return r === primaryRole || r === "author" || r === "bookauthor";
    },
    [primaryRole],
  );

  /**
   * Partition creators:
   * - authorEntries: Authors / primary creator entries that collapse when > MAX_COLLAPSED_AUTHORS
   * - otherEntries: Secondary creators below (Editors, Contributors, Translators, etc.) that are ALWAYS fully visible
   */
  const { authorEntries, otherEntries } = useMemo(() => {
    const authors: { creator: CreatorEntry; originalIndex: number }[] = [];
    const others: { creator: CreatorEntry; originalIndex: number }[] = [];

    localCreators.forEach((creator, originalIndex) => {
      if (isAuthorRole(creator.creatorType)) {
        authors.push({ creator, originalIndex });
      } else {
        others.push({ creator, originalIndex });
      }
    });

    return { authorEntries: authors, otherEntries: others };
  }, [localCreators, isAuthorRole]);

  const visibleAuthorEntries = useMemo(() => {
    if (isAuthorsExpanded || authorEntries.length <= MAX_COLLAPSED_AUTHORS) {
      return authorEntries;
    }
    return authorEntries.slice(0, MAX_COLLAPSED_AUTHORS);
  }, [authorEntries, isAuthorsExpanded]);

  /** Sync updated creators to parent mutation */
  const syncCreatorsToParent = useCallback(
    (updatedCreators: CreatorEntry[]) => {
      if (!item) return;
      const originalCreators = parseCreators(item);
      if (areCreatorsEqual(updatedCreators, originalCreators)) {
        return;
      }
      const nextCreators = updatedCreators.filter((c) => c.name.trim().length > 0);
      const primaryRoleDef =
        typeDefinition.primaryCreatorType ||
        getPrimaryCreatorType(currentItemType) ||
        "author";
      const primaryCreatorNames = nextCreators
        .filter((creatorItem) =>
          isAuthorRole(creatorItem.creatorType || primaryRoleDef),
        )
        .map((creatorItem) => creatorItem.name.trim())
        .filter(Boolean);
      const editorNames = nextCreators
        .filter(
          (creatorItem) =>
            (creatorItem.creatorType || "").toLowerCase() === "editor",
        )
        .map((creatorItem) => creatorItem.name.trim())
        .filter(Boolean);
      const finalAuthors =
        primaryCreatorNames.length > 0
          ? primaryCreatorNames
          : nextCreators
              .filter(
                (creatorItem) =>
                  !creatorItem.creatorType || !creatorItem.creatorType.trim(),
              )
              .map((creatorItem) => creatorItem.name.trim())
              .filter(Boolean);
      const structuredCreators = nextCreators.length
        ? toItemCreators(nextCreators)
        : [];
      const currentExtraFields =
        item.extraFields && typeof item.extraFields === "object"
          ? (item.extraFields as Record<string, unknown>)
          : {};
      if (onUpdateItem) {
        onUpdateItem(
          {
            ...(item.itemType ? { itemType: item.itemType } : {}),
            authors: nextCreators.length ? finalAuthors : [],
            editors: nextCreators.length ? editorNames : [],
            creators: structuredCreators,
            contributors: structuredCreators,
            ...(structuredCreators.length === 0
              ? {
                  extraFields: {
                    ...currentExtraFields,
                    creators: null,
                    contributors: null,
                  },
                }
              : "creators" in currentExtraFields ||
                  "contributors" in currentExtraFields
                ? {
                    extraFields: {
                      ...currentExtraFields,
                      creators: structuredCreators,
                      contributors: structuredCreators,
                    },
                  }
                : {}),
            silent: true,
          },
          { silent: true },
        );
      }
    },
    [item, typeDefinition.primaryCreatorType, currentItemType, isAuthorRole, onUpdateItem],
  );

  const handleUpdateCreatorType = (
    targetIndex: number,
    newCreatorType: string,
  ) => {
    const currentCreator = localCreators[targetIndex];
    if (!currentCreator) return;
    const currentRole = currentCreator.creatorType || "author";
    if (currentRole === newCreatorType) {
      return;
    }
    const updatedCreators = [...localCreators];
    updatedCreators[targetIndex] = {
      ...currentCreator,
      creatorType: newCreatorType,
    };
    setLocalCreators(updatedCreators);
    syncCreatorsToParent(updatedCreators);
  };

  const handleAddCreator = (afterIndex?: number) => {
    toast.dismiss("item-update");
    const primaryRoleDef =
      typeDefinition.primaryCreatorType ||
      getPrimaryCreatorType(currentItemType) ||
      "author";
    const insertPosition =
      typeof afterIndex === "number" ? afterIndex + 1 : localCreators.length;
    const updatedCreators = [...localCreators];
    const previousCreator =
      typeof afterIndex === "number" ? localCreators[afterIndex] : undefined;
    const newRole = previousCreator
      ? previousCreator.creatorType
      : primaryRoleDef;
    updatedCreators.splice(insertPosition, 0, {
      creatorType: newRole,
      name: "",
      fieldMode: 0,
    });
    setLocalCreators(updatedCreators);
    if (isAuthorRole(newRole)) {
      setIsAuthorsExpanded(true);
    }
    setFocusAuthorIndex(insertPosition);
  };

  const handleRemoveCreator = (targetIndex: number) => {
    toast.dismiss("item-update");
    const updatedCreators = localCreators.filter(
      (_, creatorIndex) => creatorIndex !== targetIndex,
    );
    setLocalCreators(updatedCreators);
    syncCreatorsToParent(updatedCreators);
  };

  const handleAssignInputRef = useCallback(
    (index: number, el: HTMLInputElement | null) => {
      authorInputRefs.current[index] = el;
    },
    [],
  );

  const handleUpdateLocalCreators = useCallback(
    (nextCreators: CreatorEntry[], syncImmediately = false) => {
      setLocalCreators(nextCreators);
      if (syncImmediately) {
        syncCreatorsToParent(nextCreators);
      }
    },
    [syncCreatorsToParent],
  );

  const renderCreatorRow = (
    creatorEntry: CreatorEntry,
    originalIndex: number,
  ) => {
    return (
      <CreatorRowItem
        key={originalIndex}
        creatorEntry={creatorEntry}
        originalIndex={originalIndex}
        canEdit={canEdit}
        creatorTypesList={creatorTypesList}
        localCreators={localCreators}
        onAssignInputRef={handleAssignInputRef}
        onUpdateCreatorType={handleUpdateCreatorType}
        onUpdateLocalCreators={handleUpdateLocalCreators}
        onSyncCreators={syncCreatorsToParent}
        onAddCreator={handleAddCreator}
        onRemoveCreator={handleRemoveCreator}
      />
    );
  };

  return (
    <div className="py-0.5 space-y-0.5">
      {localCreators.length === 0 ? (
        canEdit ? (
          <div className="grid grid-cols-[84px_1fr] gap-2 items-center py-0.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-foreground text-right font-normal select-none pr-1 text-12 leading-normal whitespace-nowrap truncate">
                  {typeDefinition.creatorTypes[0]?.label || "Author"}
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" align="start" sideOffset={6}>
                {typeDefinition.creatorTypes[0]?.label || "Author"}
              </TooltipContent>
            </Tooltip>
            <input
              type="text"
              aria-label="Author"
              value={emptyAuthorDraft}
              onFocus={() => {
                emptyInputFocusedItemIdRef.current = itemId;
              }}
              onChange={(e) => setEmptyAuthorDraft(e.target.value)}
              onBlur={() => {
                if (
                  emptyInputFocusedItemIdRef.current &&
                  emptyInputFocusedItemIdRef.current !== itemId
                ) {
                  return;
                }
                const trimmedValue = emptyAuthorDraft.trim();
                const existingAuthors = normalizeAuthors(
                  item?.authors,
                  item?.creators,
                  item?.contributors,
                );
                if (
                  trimmedValue &&
                  (!existingAuthors.length ||
                    existingAuthors[0] !== trimmedValue)
                ) {
                  const primaryRoleDef =
                    typeDefinition.primaryCreatorType ||
                    getPrimaryCreatorType(currentItemType) ||
                    "author";
                  const splitParts = splitAuthorString(trimmedValue);
                  const rawParts =
                    splitParts.length > 0 ? splitParts : [trimmedValue];
                  const newEntries: CreatorEntry[] = rawParts.map((part) => {
                    const parsed = parseCreatorName(part);
                    return {
                      creatorType: primaryRoleDef,
                      fieldMode: parsed.isInstitution ? 1 : 0,
                      name: part,
                      firstName: parsed.isInstitution
                        ? undefined
                        : parsed.firstName || undefined,
                      lastName: parsed.isInstitution
                        ? part
                        : parsed.lastName || undefined,
                    };
                  });
                  setEmptyAuthorDraft("");
                  setLocalCreators(newEntries);
                  syncCreatorsToParent(newEntries);
                }
              }}
              onKeyDown={(keyboardEvent) => {
                if (keyboardEvent.key === "Enter") {
                  (keyboardEvent.target as HTMLInputElement).blur();
                }
              }}
              className="flex-1 h-7 bg-transparent px-2 py-1 rounded-md border border-transparent focus:border-primary focus:ring-1 focus:ring-primary focus:bg-background text-foreground text-12 leading-normal outline-none min-w-0 font-normal font-sans"
            />
          </div>
        ) : null
      ) : (
        <>
          {/* Render visible authors */}
          {visibleAuthorEntries.map(({ creator, originalIndex }) =>
            renderCreatorRow(creator, originalIndex),
          )}

          {/* Authors collapse toggle button - ONLY for authors */}
          {authorEntries.length > MAX_COLLAPSED_AUTHORS && (
            <div className="grid grid-cols-[84px_1fr] gap-2 items-center py-0.5">
              <span />
              <button
                type="button"
                onClick={() => setIsAuthorsExpanded(!isAuthorsExpanded)}
                className="flex items-center gap-1.5 text-11 text-foreground font-medium cursor-pointer py-0.5 px-2 hover:bg-muted focus-visible:outline-none rounded-md w-fit transition-colors select-none relative before:absolute before:-inset-1.5 md:before:hidden"
                aria-expanded={isAuthorsExpanded}
              >
                {isAuthorsExpanded ? (
                  <>
                    <ChevronUp
                      className="size-3.5 shrink-0"
                      aria-hidden="true"
                      strokeWidth={1.5}
                    />
                    <span>Show less</span>
                  </>
                ) : (
                  <>
                    <ChevronDown
                      className="size-3.5 shrink-0"
                      aria-hidden="true"
                      strokeWidth={1.5}
                    />
                    <span>Show more</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Render all other creator types below (Editors, Contributors, Translators, etc.) - ALWAYS visible, NEVER collapsed */}
          {otherEntries.map(({ creator, originalIndex }) =>
            renderCreatorRow(creator, originalIndex),
          )}
        </>
      )}
    </div>
  );
}

export default CreatorFields;
