"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Plus, Minus, Check, ChevronDown, ChevronUp, ArrowUp, ArrowDown, Building2, User } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/shared/lib/utils";
import type {
  Item,
  CreatorCredit,
} from "@/features/library/domain/types/library.types";
import {
  normalizeAuthors,
  splitAuthorString,
  parseCreatorName,
  isInstitutionName,
} from "@/features/library/domain/creators";
import { cleanValue } from "@/features/library/domain/metadata";
import {
  ALL_CREATOR_TYPES,
  getPrimaryCreatorType,
  type SchemaItemTypeDefinition,
} from "@/features/library/domain/types/item-types.types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";

import {
  type CreatorEntry,
  type CreatorFieldsProps,
  MAX_COLLAPSED_AUTHORS,
  parseCreators,
  areCreatorsEqual,
  toItemCreators,
} from './creator-fields.helper';

export type { CreatorEntry, CreatorFieldsProps };
export { parseCreators, areCreatorsEqual, toItemCreators };

export function CreatorFields({
  item,
  onUpdateItem,
  typeDefinition,
  canEdit = true,
}: CreatorFieldsProps) {

  const [isAuthorsExpanded, setIsAuthorsExpanded] = useState(false);
  const [focusAuthorIndex, setFocusAuthorIndex] = useState<number | null>(null);
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

  useEffect(() => {
    if (item) {
      setLocalCreators(parseCreators(item));
    }
  }, [item, itemId, itemCreators, itemContributors, itemAuthors]);

  useEffect(() => {
    setIsAuthorsExpanded(false);
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
      const primaryRoleDef =
        typeDefinition.primaryCreatorType ||
        getPrimaryCreatorType(currentItemType) ||
        "author";
      const allCreatorNames = updatedCreators
        .map((creatorItem) => creatorItem.name.trim())
        .filter(Boolean);
      const primaryCreatorNames = updatedCreators
        .filter(
          (creatorItem) =>
            (creatorItem.creatorType || primaryRoleDef) === primaryRoleDef,
        )
        .map((creatorItem) => creatorItem.name.trim())
        .filter(Boolean);
      const finalAuthors = primaryCreatorNames.length
        ? primaryCreatorNames
        : allCreatorNames;
      if (onUpdateItem) {
        onUpdateItem(
          {
            ...(item.itemType ? { itemType: item.itemType } : {}),
            authors: finalAuthors.length ? finalAuthors : undefined,
            creators: updatedCreators.length
              ? toItemCreators(updatedCreators)
              : undefined,
            silent: true,
          },
          { silent: true },
        );
      }
    },
    [item, typeDefinition.primaryCreatorType, currentItemType, onUpdateItem],
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

  const handleToggleFieldMode = (targetIndex: number) => {
    toast.dismiss("item-update");
    const current = localCreators[targetIndex];
    if (!current) return;
    const nextMode = current.fieldMode === 1 ? 0 : 1;
    const updatedCreators = [...localCreators];
    updatedCreators[targetIndex] = {
      ...current,
      fieldMode: nextMode,
    };
    setLocalCreators(updatedCreators);
    syncCreatorsToParent(updatedCreators);
  };

  const handleMoveCreator = (targetIndex: number, direction: -1 | 1) => {
    toast.dismiss("item-update");
    const swapIndex = targetIndex + direction;
    if (swapIndex < 0 || swapIndex >= localCreators.length) return;
    const updatedCreators = [...localCreators];
    const temp = updatedCreators[targetIndex];
    updatedCreators[targetIndex] = updatedCreators[swapIndex];
    updatedCreators[swapIndex] = temp;
    setLocalCreators(updatedCreators);
    syncCreatorsToParent(updatedCreators);
  };

  const renderCreatorRow = (
    creatorEntry: CreatorEntry,
    originalIndex: number,
  ) => {
    const roleLabel =
      ALL_CREATOR_TYPES[creatorEntry.creatorType] ||
      creatorEntry.creatorType ||
      "Author";
    const isSingleField = creatorEntry.fieldMode === 1;

    return (
      <div
        key={originalIndex}
        className="grid grid-cols-[84px_1fr] gap-2 items-center py-0.5 group"
      >
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
                      handleUpdateCreatorType(
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
                  authorInputRefs.current[originalIndex] = inputElement;
                }}
                type="text"
                value={creatorEntry.name}
                placeholder={
                  isSingleField
                    ? "Institution or organization name"
                    : `${roleLabel} name`
                }
                aria-label={`${roleLabel} ${originalIndex + 1}`}
                onChange={(changeEvent) => {
                  const inputValue = changeEvent.target.value;
                  // Only split multi-authors if NOT in institutional single-field mode
                  if (
                    !isSingleField &&
                    (inputValue.includes(";") ||
                      /\s+and\s+/i.test(inputValue) ||
                      inputValue.includes("\n"))
                  ) {
                    const splitParts = splitAuthorString(inputValue);
                    if (splitParts.length > 1) {
                      const updatedCreators = [...localCreators];
                      const currentEntry = updatedCreators[originalIndex];
                      const newCreatorEntries = splitParts.map(
                        (authorNamePart) => {
                          const parsed = parseCreatorName(authorNamePart);
                          return {
                            creatorType: currentEntry?.creatorType || "author",
                            fieldMode: 0,
                            name: authorNamePart,
                            firstName: parsed.firstName || undefined,
                            lastName: parsed.lastName || undefined,
                          };
                        },
                      );
                      updatedCreators.splice(
                        originalIndex,
                        1,
                        ...newCreatorEntries,
                      );
                      setLocalCreators(updatedCreators);
                      return;
                    }
                  }
                  const updatedCreators = [...localCreators];
                  updatedCreators[originalIndex] = {
                    ...updatedCreators[originalIndex],
                    name: inputValue,
                  };
                  setLocalCreators(updatedCreators);
                }}
                onBlur={() => syncCreatorsToParent(localCreators)}
                onKeyDown={(keyboardEvent) => {
                  if (keyboardEvent.key === "Enter") {
                    keyboardEvent.preventDefault();
                    handleAddCreator(originalIndex);
                  }
                }}
                className="flex-1 min-w-0 h-7 bg-transparent px-2 py-1 rounded-md border border-transparent hover:bg-muted focus:border-primary focus:ring-1 focus:ring-ring focus:bg-background text-foreground text-13 leading-normal outline-none font-normal font-sans placeholder:text-muted-foreground"
              />

              {/* Optional Short Name / Acronym when in single-field institutional mode */}
              {isSingleField && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <input
                      type="text"
                      value={creatorEntry.shortName || ""}
                      placeholder="Acronym"
                      aria-label={`Short name or acronym for ${roleLabel.toLowerCase()} ${originalIndex + 1}`}
                      onChange={(changeEvent) => {
                        const updatedCreators = [...localCreators];
                        updatedCreators[originalIndex] = {
                          ...updatedCreators[originalIndex],
                          shortName: changeEvent.target.value,
                        };
                        setLocalCreators(updatedCreators);
                      }}
                      onBlur={() => syncCreatorsToParent(localCreators)}
                      className="w-24 sm:w-28 h-7 bg-transparent px-2 py-1 rounded-md border border-border hover:border-border-hover focus:border-primary focus:ring-1 focus:ring-ring focus:bg-background text-foreground text-12 placeholder:text-muted-foreground leading-normal outline-none font-normal font-sans shrink-0"
                    />
                  </TooltipTrigger>
                  <TooltipContent
                    side="bottom"
                    align="start"
                    sideOffset={6}
                    alignOffset={2}
                  >
                    Short name
                  </TooltipContent>
                </Tooltip>
              )}

              {/* Action Buttons (Mode Toggle, Move Up/Down, Add, Remove) */}
              <div className="invisible group-hover:visible max-md:visible flex items-center gap-0.5 shrink-0">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => handleToggleFieldMode(originalIndex)}
                      className="size-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer focus-visible:outline-none"
                      aria-label={
                        isSingleField
                          ? "Switch to two fields (Last, First)"
                          : "Switch to single field (Institution)"
                      }
                    >
                      {isSingleField ? (
                        <Building2 className="size-3.5 shrink-0" strokeWidth={1.5} />
                      ) : (
                        <User className="size-3.5 shrink-0" strokeWidth={1.5} />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" align="start" sideOffset={6}>
                    {isSingleField
                      ? "Switch to two fields (Last, First)"
                      : "Switch to single field (Institution)"}
                  </TooltipContent>
                </Tooltip>

                {localCreators.length > 1 && (
                  <>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          disabled={originalIndex === 0}
                          onClick={() => handleMoveCreator(originalIndex, -1)}
                          className="size-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 transition-colors cursor-pointer focus-visible:outline-none"
                          aria-label="Move creator up"
                        >
                          <ArrowUp className="size-3 shrink-0" strokeWidth={1.5} />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" align="start" sideOffset={6}>
                        Move up
                      </TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          disabled={originalIndex === localCreators.length - 1}
                          onClick={() => handleMoveCreator(originalIndex, 1)}
                          className="size-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 transition-colors cursor-pointer focus-visible:outline-none"
                          aria-label="Move creator down"
                        >
                          <ArrowDown className="size-3 shrink-0" strokeWidth={1.5} />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" align="start" sideOffset={6}>
                        Move down
                      </TooltipContent>
                    </Tooltip>
                  </>
                )}

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => handleAddCreator(originalIndex)}
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
                        onClick={() => handleRemoveCreator(originalIndex)}
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
              {creatorEntry.shortName && (
                <span className="text-11 text-foreground font-mono">
                  ({creatorEntry.shortName})
                </span>
              )}
            </div>
          )}
        </div>
      </div>
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
              onBlur={(blurEvent) => {
                const trimmedValue = blurEvent.target.value.trim();
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
                  if (onUpdateItem) {
                    const primaryRoleDef =
                      typeDefinition.primaryCreatorType ||
                      getPrimaryCreatorType(currentItemType) ||
                      "author";
                    onUpdateItem(
                      {
                        authors: [trimmedValue],
                        creators: [
                          {
                            orderIndex: 0,
                            creatorType: primaryRoleDef,
                            fieldMode: 0,
                            fullName: trimmedValue,
                            name: trimmedValue,
                          },
                        ],
                        silent: true,
                      },
                      { silent: true },
                    );
                  }
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
