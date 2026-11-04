'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { ChevronDown, ChevronUp, Plus, Minus, Check } from 'lucide-react';
import { toast } from 'sonner';
import { type CreatorEntry, normalizeAuthors, splitAuthorString, parseCreatorName, parseCreators, areCreatorsEqual, toItemCreators, buildCanonicalCreatorsPatch, isInstitutionName } from '@/features/library/domain/creators';
import type { Item } from '@/features/library/domain/types/core.types';
import { type SchemaItemTypeDefinition, ALL_CREATOR_TYPES, getPrimaryCreatorType } from '@/features/library/domain/types/item-types.types';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { cn } from '@/shared/lib/utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';

export interface CreatorFieldsProps {
  item?: Item;
  typeDefinition: SchemaItemTypeDefinition;
  canEdit?: boolean;
  onUpdateItem?: (data: Partial<Item>, options?: { silent?: boolean }) => void;
}

const MAX_COLLAPSED_AUTHORS = 3;

export type { CreatorEntry };
export {
  parseCreators,
  areCreatorsEqual,
  toItemCreators,
  buildCanonicalCreatorsPatch,
};

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
      if (!item || !onUpdateItem) return;
      const originalCreators = parseCreators(item);
      if (areCreatorsEqual(updatedCreators, originalCreators)) {
        return;
      }
      onUpdateItem(
        buildCanonicalCreatorsPatch(
          item,
          updatedCreators,
          typeDefinition.primaryCreatorType,
        ),
        { silent: true },
      );
    },
    [item, typeDefinition.primaryCreatorType, onUpdateItem],
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

export interface CreatorTypeOption {
  creatorType: string;
  label: string;
  primary?: boolean;
}

export interface CreatorRowItemProps {
  creatorEntry: CreatorEntry;
  originalIndex: number;
  canEdit: boolean;
  creatorTypesList: CreatorTypeOption[];
  localCreators: CreatorEntry[];
  onAssignInputRef: (index: number, el: HTMLInputElement | null) => void;
  onUpdateCreatorType: (index: number, newCreatorType: string) => void;
  onUpdateLocalCreators: (nextCreators: CreatorEntry[], syncImmediately?: boolean) => void;
  onSyncCreators: (creators: CreatorEntry[]) => void;
  onAddCreator: (afterIndex: number) => void;
  onRemoveCreator: (index: number) => void;
}

export function CreatorRowItem({
  creatorEntry,
  originalIndex,
  canEdit,
  creatorTypesList,
  localCreators,
  onAssignInputRef,
  onUpdateCreatorType,
  onUpdateLocalCreators,
  onSyncCreators,
  onAddCreator,
  onRemoveCreator,
}: CreatorRowItemProps) {
  const roleLabel =
    ALL_CREATOR_TYPES[creatorEntry.creatorType] ||
    creatorEntry.creatorType ||
    "Author";

  return (
    <div className="grid grid-cols-[84px_1fr] gap-2 items-center py-0.5 group">
      {/* Left Role Column */}
      <div className="flex items-center justify-end min-w-0 pr-1">
        {canEdit ? (
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="w-full min-h-7 h-auto flex items-center justify-end pr-1 rounded-md text-11 leading-normal font-medium text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ring select-none text-right truncate"
                    aria-label={`Change role for ${roleLabel.toLowerCase()} ${originalIndex + 1}`}
                  >
                    <span className="truncate whitespace-nowrap leading-normal">
                      {roleLabel}
                    </span>
                  </button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom" align="start" sideOffset={6}>
                {roleLabel}
              </TooltipContent>
            </Tooltip>
            <DropdownMenuContent
              align="start"
              className="min-w-[170px] p-1.5 rounded-md shadow-raised-200 border border-border bg-popover text-popover-foreground space-y-0.5"
            >
              {creatorTypesList.map((creatorTypeItem) => (
                <DropdownMenuItem
                  key={creatorTypeItem.creatorType}
                  onClick={() =>
                    onUpdateCreatorType(
                      originalIndex,
                      creatorTypeItem.creatorType,
                    )
                  }
                  className={cn(
                    "flex items-center justify-between h-7 px-2 text-xs font-normal rounded-md cursor-pointer text-foreground hover:bg-muted",
                    creatorEntry.creatorType ===
                      creatorTypeItem.creatorType &&
                      "bg-muted text-foreground font-medium",
                  )}
                >
                  <span className="text-foreground">
                    {creatorTypeItem.label}
                  </span>
                  {creatorEntry.creatorType ===
                    creatorTypeItem.creatorType && (
                    <Check
                      className="size-3 text-primary shrink-0"
                      aria-hidden="true"
                    />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <div className="w-full min-h-7 h-auto flex items-center justify-end pr-1 text-11 leading-normal font-medium text-muted-foreground select-text text-right truncate">
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="truncate whitespace-nowrap leading-normal">
                  {roleLabel}
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" align="start" sideOffset={6}>
                {roleLabel}
              </TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>

      {/* Right Input Column */}
      <div className="flex items-center gap-1 min-w-0">
        {canEdit ? (
          <>
            <input
              ref={(inputElement) => {
                onAssignInputRef(originalIndex, inputElement);
              }}
              type="text"
              value={creatorEntry.name}
              placeholder={`${roleLabel} name`}
              aria-label={`${roleLabel} ${originalIndex + 1}`}
              onChange={(changeEvent: React.ChangeEvent<HTMLInputElement>) => {
                const inputValue = changeEvent.target.value;
                const currentEntry = localCreators[originalIndex];
                const isSingleFieldMode =
                  currentEntry?.fieldMode === 1 || isInstitutionName(inputValue);
                if (
                  !isSingleFieldMode &&
                  (inputValue.includes(";") || inputValue.includes("\n"))
                ) {
                  const splitParts = splitAuthorString(inputValue);
                  if (splitParts.length > 1) {
                    const updatedCreators = [...localCreators];
                    const newCreatorEntries: CreatorEntry[] = splitParts.map(
                      (authorNamePart) => {
                        const parsed = parseCreatorName(authorNamePart);
                        return {
                          creatorType: currentEntry?.creatorType || "author",
                          fieldMode: parsed.isInstitution ? 1 : 0,
                          name: authorNamePart,
                          firstName: parsed.isInstitution
                            ? undefined
                            : parsed.firstName || undefined,
                          lastName: parsed.isInstitution
                            ? authorNamePart
                            : parsed.lastName || undefined,
                        };
                      },
                    );
                    updatedCreators.splice(
                      originalIndex,
                      1,
                      ...newCreatorEntries,
                    );
                    onUpdateLocalCreators(updatedCreators, true);
                    return;
                  }
                }
                const updatedCreators = [...localCreators];
                const current = updatedCreators[originalIndex];
                if (current?.fieldMode === 1) {
                  updatedCreators[originalIndex] = {
                    ...current,
                    creatorType: current?.creatorType || "author",
                    fieldMode: 1,
                    name: inputValue,
                    firstName: undefined,
                    lastName: inputValue,
                  };
                  onUpdateLocalCreators(updatedCreators, false);
                  return;
                }
                const trimmedInput = inputValue.trim();
                const combinedForward = [current?.firstName, current?.lastName]
                  .filter(Boolean)
                  .join(" ")
                  .trim();
                const combinedInverted = [current?.lastName, current?.firstName]
                  .filter(Boolean)
                  .join(", ")
                  .trim();
                const matchesExisting =
                  Boolean(current?.firstName || current?.lastName) &&
                  (trimmedInput === combinedForward ||
                    trimmedInput === combinedInverted);
                const parsed = matchesExisting
                  ? undefined
                  : parseCreatorName(inputValue);
                const isInst = Boolean(parsed?.isInstitution);
                updatedCreators[originalIndex] = {
                  ...current,
                  creatorType: current?.creatorType || "author",
                  fieldMode: isInst ? 1 : (current?.fieldMode ?? 0),
                  name: inputValue,
                  firstName: isInst
                    ? undefined
                    : matchesExisting
                      ? current?.firstName
                      : parsed?.firstName || undefined,
                  lastName: isInst
                    ? inputValue
                    : matchesExisting
                      ? current?.lastName
                      : parsed?.lastName || undefined,
                };
                onUpdateLocalCreators(updatedCreators, false);
              }}
              onBlur={() => onSyncCreators(localCreators)}
              onKeyDown={(keyboardEvent) => {
                if (keyboardEvent.key === "Enter") {
                  keyboardEvent.preventDefault();
                  onAddCreator(originalIndex);
                }
              }}
              className="flex-1 min-w-0 h-7 bg-transparent px-2 py-1 rounded-md border border-transparent hover:bg-muted focus:border-primary focus:ring-1 focus:ring-ring focus:bg-background text-foreground text-13 leading-normal outline-none font-normal font-sans placeholder:text-muted-foreground"
            />

            {/* Action Buttons (Add, Remove) */}
            <div className="invisible group-hover:visible max-md:visible flex items-center gap-0.5 shrink-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => onAddCreator(originalIndex)}
                    className="size-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer focus-visible:outline-none relative before:absolute before:-inset-2 md:before:hidden"
                    aria-label={`Add ${roleLabel.toLowerCase()}`}
                  >
                    <Plus
                      className="size-3.5 shrink-0"
                      aria-hidden="true"
                      strokeWidth={1.5}
                    />
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="bottom"
                  align="start"
                  sideOffset={6}
                  alignOffset={2}
                >
                  Add {roleLabel.toLowerCase()}
                </TooltipContent>
              </Tooltip>

              {localCreators.length > 1 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => onRemoveCreator(originalIndex)}
                      className="size-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer focus-visible:outline-none relative before:absolute before:-inset-2 md:before:hidden"
                      aria-label={`Remove ${roleLabel.toLowerCase()}`}
                    >
                      <Minus
                        className="size-3.5 shrink-0"
                        aria-hidden="true"
                        strokeWidth={1.5}
                      />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent
                    side="bottom"
                    align="start"
                    sideOffset={6}
                    alignOffset={2}
                  >
                    Remove {roleLabel.toLowerCase()}
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 min-h-7 h-auto px-2 py-1 text-foreground text-12 leading-snug min-w-0 font-normal font-sans break-words select-text flex items-center gap-1.5">
            <span>{creatorEntry.name}</span>
          </div>
        )}
      </div>
    </div>
  );
}
