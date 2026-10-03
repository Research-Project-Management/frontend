'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Plus, Minus, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/shared/lib/utils';
import type { Item, CreatorCredit } from '@/features/library/types/library.types';
import { normalizeAuthors, splitAuthorString, parseCreatorName } from '../../../domain';
import {
  ALL_CREATOR_TYPES,
  getPrimaryCreatorType,
  SchemaItemTypeDefinition,
} from '../../../types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';

export interface CreatorEntry {
  creatorType: string;
  name: string;
  fieldMode?: number;
  firstName?: string;
  lastName?: string;
  shortName?: string;
}

export interface CreatorFieldsProps {
  paper: Item;
  typeDefinition: SchemaItemTypeDefinition;
  canEdit?: boolean;
  onUpdatePaper?: (data: Partial<Item>, options?: { silent?: boolean }) => void;
}

const MAX_COLLAPSED_AUTHORS = 3;

const SECONDARY_CREATOR_ROLES = new Set([
  'editor',
  'contributor',
  'translator',
  'serieseditor',
  'reviewedauthor',
  'castmember',
  'guest',
  'commenter',
  'cosponsor',
  'sponsor',
  'producer',
  'executiveproducer',
  'scriptwriter',
  'wordsby',
  'interviewer',
  'interviewee',
  'recipient',
  'counsel',
  'attorneyagent',
]);

/** Filter out empty, null, undefined, or junk placeholder string values */
function cleanValue(val?: any): string {
  if (val === null || val === undefined) return '';
  const str = String(val).trim();
  const lower = str.toLowerCase();
  if (
    !str ||
    lower === 'null' ||
    lower === 'undefined' ||
    lower === 'n/a' ||
    lower === 'na' ||
    lower === 'none' ||
    lower === 'nil' ||
    lower === '{}' ||
    lower === '[]' ||
    lower === '[object object]' ||
    lower === '0000' ||
    lower === 'unknown'
  ) {
    return '';
  }
  return str;
}

/** Parse & sanitize creators array into structured list */
export function parseCreators(paper: Item): CreatorEntry[] {
  const rawCreators = paper.creators && paper.creators.length > 0
    ? paper.creators
    : paper.contributors;
  if (Array.isArray(rawCreators) && rawCreators.length > 0) {
    const parsedCreators: CreatorEntry[] = [];
    for (const rawCreatorItem of rawCreators) {
      const creatorType = rawCreatorItem.creatorType || 'author';
      const fieldMode = rawCreatorItem.fieldMode ?? 0;
      const shortName = cleanValue(rawCreatorItem.shortName || undefined);
      let creatorName = cleanValue(rawCreatorItem.name || rawCreatorItem.fullName);
      const firstName = cleanValue(
        rawCreatorItem.firstName || (rawCreatorItem as Record<string, unknown>).given,
      );
      const lastName = cleanValue(
        rawCreatorItem.lastName || (rawCreatorItem as Record<string, unknown>).family,
      );
      if (!creatorName && (firstName || lastName)) {
        creatorName = [lastName, firstName].filter(Boolean).join(', ');
      }

      if (creatorName) {
        // If creator is marked as institution (fieldMode === 1), do NOT split by 'and' or commas
        const splitNameParts = fieldMode === 1 ? [creatorName] : splitAuthorString(creatorName);
        if (splitNameParts.length > 1) {
          for (const authorPart of splitNameParts) {
            const parsed = parseCreatorName(authorPart);
            parsedCreators.push({
              creatorType,
              name: authorPart,
              fieldMode: 0,
              firstName: parsed.firstName || undefined,
              lastName: parsed.lastName || undefined,
            });
          }
        } else {
          parsedCreators.push({
            creatorType,
            name: creatorName,
            fieldMode,
            firstName: firstName || undefined,
            lastName: lastName || undefined,
            shortName: shortName || undefined,
          });
        }
      } else {
        parsedCreators.push({
          creatorType,
          name: '',
          fieldMode,
          firstName: firstName || undefined,
          lastName: lastName || undefined,
          shortName: shortName || undefined,
        });
      }
    }
    if (parsedCreators.length > 0) return parsedCreators;
  }

  const normalizedAuthorList = normalizeAuthors(
    paper.authors,
    paper.creators,
    paper.contributors,
  );
  if (normalizedAuthorList.length > 0) {
    const defaultRole = getPrimaryCreatorType(paper.itemType) || 'author';
    return normalizedAuthorList.map((authorName) => ({
      creatorType: defaultRole,
      name: authorName || '',
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

  for (let creatorIndex = 0; creatorIndex < normalizedFirstCreators.length; creatorIndex += 1) {
    const firstCreator = normalizedFirstCreators[creatorIndex];
    const secondCreator = normalizedSecondCreators[creatorIndex];
    if (!firstCreator || !secondCreator) {
      return false;
    }
    const firstCreatorRole = firstCreator.creatorType || 'author';
    const secondCreatorRole = secondCreator.creatorType || 'author';
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
    const firstShort = (firstCreator.shortName || '').trim();
    const secondShort = (secondCreator.shortName || '').trim();
    if (firstShort !== secondShort) {
      return false;
    }
  }

  return true;
}

/** Convert CreatorEntry items into strongly typed CreatorCredit items for Item */
export function toItemCreators(creatorEntries: CreatorEntry[]): CreatorCredit[] {
  return creatorEntries.map((creatorEntry, indexPosition) => {
    const trimmedName = creatorEntry.name.trim();
    let firstName = creatorEntry.firstName;
    let lastName = creatorEntry.lastName;

    if (creatorEntry.fieldMode === 1) {
      firstName = '';
      lastName = trimmedName;
    } else if (trimmedName) {
      const parsed = parseCreatorName(trimmedName);
      firstName = parsed.firstName;
      lastName = parsed.lastName;
    }

    return {
      orderIndex: indexPosition,
      creatorType: creatorEntry.creatorType || 'author',
      fieldMode: creatorEntry.fieldMode ?? 0,
      fullName: trimmedName,
      name: trimmedName,
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      shortName: creatorEntry.shortName?.trim() || undefined,
    };
  });
}

export function CreatorFields({
  paper,
  typeDefinition,
  canEdit = true,
  onUpdatePaper,
}: CreatorFieldsProps) {
  const [isAuthorsExpanded, setIsAuthorsExpanded] = useState(false);
  const [focusAuthorIndex, setFocusAuthorIndex] = useState<number | null>(null);
  const authorInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const currentItemType = paper.itemType || 'journalArticle';

  const primaryRole = useMemo(() => {
    return (typeDefinition?.primaryCreatorType || getPrimaryCreatorType(currentItemType) || 'author').toLowerCase();
  }, [typeDefinition?.primaryCreatorType, currentItemType]);

  const creatorTypesList = useMemo(() => {
    const list = [...(typeDefinition?.creatorTypes || [])];
    const standardRoles = ['author', 'contributor', 'editor', 'reviewedAuthor', 'translator'];
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

  const [localCreators, setLocalCreators] = useState<CreatorEntry[]>(() => parseCreators(paper));

  const paperId = paper.id;
  const paperCreators = paper.creators;
  const paperContributors = paper.contributors;
  const paperAuthors = paper.authors;

  useEffect(() => {
    setLocalCreators(parseCreators(paper));
  }, [paper, paperId, paperCreators, paperContributors, paperAuthors]);

  useEffect(() => {
    setIsAuthorsExpanded(false);
  }, [paperId]);

  useEffect(() => {
    if (focusAuthorIndex !== null && authorInputRefs.current[focusAuthorIndex]) {
      authorInputRefs.current[focusAuthorIndex]?.focus();
      setFocusAuthorIndex(null);
    }
  }, [focusAuthorIndex, localCreators]);

  /** Helper to determine if a creator entry belongs to authors (which can collapse) */
  const isAuthorRole = useCallback(
    (role?: string) => {
      const r = (role || 'author').trim().toLowerCase();
      if (r === 'author' || r === 'bookauthor') return true;
      if (SECONDARY_CREATOR_ROLES.has(r)) return false;
      return r === primaryRole;
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
      const originalCreators = parseCreators(paper);
      if (areCreatorsEqual(updatedCreators, originalCreators)) {
        return;
      }
      const primaryRoleDef =
        typeDefinition.primaryCreatorType || getPrimaryCreatorType(currentItemType) || 'author';
      const allCreatorNames = updatedCreators
        .map((creatorItem) => creatorItem.name.trim())
        .filter(Boolean);
      const primaryCreatorNames = updatedCreators
        .filter((creatorItem) => (creatorItem.creatorType || primaryRoleDef) === primaryRoleDef)
        .map((creatorItem) => creatorItem.name.trim())
        .filter(Boolean);
      const finalAuthors = primaryCreatorNames.length ? primaryCreatorNames : allCreatorNames;
      if (onUpdatePaper) {
        onUpdatePaper(
          {
            authors: finalAuthors.length ? finalAuthors : undefined,
            creators: updatedCreators.length ? toItemCreators(updatedCreators) : undefined,
            silent: true,
          },
          { silent: true },
        );
      }
    },
    [paper, typeDefinition.primaryCreatorType, currentItemType, onUpdatePaper],
  );

  const handleUpdateCreatorType = (targetIndex: number, newCreatorType: string) => {
    const currentCreator = localCreators[targetIndex];
    if (!currentCreator) return;
    const currentRole = currentCreator.creatorType || 'author';
    if (currentRole === newCreatorType) {
      return;
    }
    const updatedCreators = [...localCreators];
    updatedCreators[targetIndex] = { ...currentCreator, creatorType: newCreatorType };
    setLocalCreators(updatedCreators);
    syncCreatorsToParent(updatedCreators);
  };

  const handleAddCreator = (afterIndex?: number) => {
    toast.dismiss('item-update');
    const primaryRoleDef =
      typeDefinition.primaryCreatorType || getPrimaryCreatorType(currentItemType) || 'author';
    const insertPosition = typeof afterIndex === 'number' ? afterIndex + 1 : localCreators.length;
    const updatedCreators = [...localCreators];
    const previousCreator = typeof afterIndex === 'number' ? localCreators[afterIndex] : undefined;
    const newRole = previousCreator ? previousCreator.creatorType : primaryRoleDef;
    updatedCreators.splice(insertPosition, 0, { creatorType: newRole, name: '', fieldMode: 0 });
    setLocalCreators(updatedCreators);
    if (isAuthorRole(newRole)) {
      setIsAuthorsExpanded(true);
    }
    setFocusAuthorIndex(insertPosition);
  };

  const handleRemoveCreator = (targetIndex: number) => {
    toast.dismiss('item-update');
    const updatedCreators = localCreators.filter((_, creatorIndex) => creatorIndex !== targetIndex);
    setLocalCreators(updatedCreators);
    syncCreatorsToParent(updatedCreators);
  };

  const renderCreatorRow = (creatorEntry: CreatorEntry, originalIndex: number) => {
    const roleLabel =
      ALL_CREATOR_TYPES[creatorEntry.creatorType] || creatorEntry.creatorType || 'Author';

    return (
      <div
        key={originalIndex}
        className="grid grid-cols-[84px_1fr] gap-2 items-center py-0.5 group"
      >
        {/* Left Role Column */}
        <div className="flex items-center justify-end min-w-0 pr-1">
          {canEdit ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="w-full min-h-7 h-auto flex items-center justify-end pr-1 rounded-md text-12 leading-normal font-normal text-muted-foreground hover:bg-muted cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary select-none text-right truncate"
                  aria-label={`Change role for ${roleLabel.toLowerCase()} ${originalIndex + 1}`}
                >
                  <span
                    className="truncate whitespace-nowrap leading-normal"
                    title={roleLabel}
                  >
                    {roleLabel}
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="min-w-[170px] p-1.5 rounded-md shadow-raised-200 border border-border bg-popover text-popover-foreground space-y-0.5"
              >
                {creatorTypesList.map((creatorTypeItem) => (
                  <DropdownMenuItem
                    key={creatorTypeItem.creatorType}
                    onClick={() =>
                      handleUpdateCreatorType(originalIndex, creatorTypeItem.creatorType)
                    }
                    className={cn(
                      'flex items-center justify-between h-7 px-2 text-xs font-normal rounded-md cursor-pointer text-foreground hover:bg-muted',
                      creatorEntry.creatorType === creatorTypeItem.creatorType &&
                        'bg-muted text-foreground font-medium',
                    )}
                  >
                    <span className="text-foreground">{creatorTypeItem.label}</span>
                    {creatorEntry.creatorType === creatorTypeItem.creatorType && (
                      <Check className="size-3 text-foreground shrink-0" aria-hidden="true" />
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="w-full min-h-7 h-auto flex items-center justify-end pr-1 text-12 leading-normal font-normal text-muted-foreground select-text text-right truncate">
              <span
                className="truncate whitespace-nowrap leading-normal"
                title={roleLabel}
              >
                {roleLabel}
              </span>
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
                  creatorEntry.fieldMode === 1
                    ? 'Institution or organization name'
                    : `${roleLabel} name`
                }
                aria-label={`${roleLabel} ${originalIndex + 1}`}
                onChange={(changeEvent) => {
                  const inputValue = changeEvent.target.value;
                  // Only split multi-authors if NOT in institutional single-field mode
                  if (
                    creatorEntry.fieldMode !== 1 &&
                    (inputValue.includes(';') ||
                      /\s+and\s+/i.test(inputValue) ||
                      inputValue.includes('\n'))
                  ) {
                    const splitParts = splitAuthorString(inputValue);
                    if (splitParts.length > 1) {
                      const updatedCreators = [...localCreators];
                      const currentEntry = updatedCreators[originalIndex];
                      const newCreatorEntries = splitParts.map((authorNamePart) => {
                        const parsed = parseCreatorName(authorNamePart);
                        return {
                          creatorType: currentEntry?.creatorType || 'author',
                          fieldMode: 0,
                          name: authorNamePart,
                          firstName: parsed.firstName || undefined,
                          lastName: parsed.lastName || undefined,
                        };
                      });
                      updatedCreators.splice(originalIndex, 1, ...newCreatorEntries);
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
                  if (keyboardEvent.key === 'Enter') {
                    keyboardEvent.preventDefault();
                    handleAddCreator(originalIndex);
                  }
                }}
                className="flex-1 min-w-0 h-7 bg-transparent px-2 py-1 rounded-md border border-transparent focus:border-primary focus:ring-1 focus:ring-primary focus:bg-background text-foreground text-12 leading-normal outline-none font-normal font-sans"
              />

              {/* Optional Short Name / Acronym when in single-field institutional mode */}
              {creatorEntry.fieldMode === 1 && (
                <Tooltip delayDuration={300}>
                  <TooltipTrigger asChild>
                    <input
                      type="text"
                      value={creatorEntry.shortName || ''}
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
                      className="w-24 sm:w-28 h-7 bg-transparent px-2 py-1 rounded-md border border-border/50 focus:border-primary focus:ring-1 focus:ring-primary focus:bg-background text-foreground text-11 placeholder:text-muted-foreground/60 leading-normal outline-none font-normal font-sans shrink-0"
                    />
                  </TooltipTrigger>
                  <TooltipContent
                    side="bottom"
                    align="start"
                    sideOffset={6}
                    alignOffset={2}
                    className="text-11 font-normal px-2 py-0.5 rounded-md border border-border bg-popover text-foreground shadow-md"
                  >
                    Short name
                  </TooltipContent>
                </Tooltip>
              )}


              {/* Action Buttons (Add, Remove) - only visible on hover */}
              <div className="invisible group-hover:visible flex items-center gap-0.5 shrink-0">
                <Tooltip delayDuration={300}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => handleAddCreator(originalIndex)}
                      className="size-6 flex items-center justify-center rounded-md text-foreground hover:bg-muted transition-colors cursor-pointer focus-visible:outline-none"
                      aria-label={`Add ${roleLabel.toLowerCase()}`}
                    >
                      <Plus className="size-3.5 text-foreground shrink-0" aria-hidden="true" strokeWidth={1.5} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent
                    side="bottom"
                    align="start"
                    sideOffset={6}
                    alignOffset={2}
                    className="text-11 font-normal px-2 py-0.5 rounded-md border border-border bg-popover text-foreground shadow-md"
                  >
                    Add {roleLabel.toLowerCase()}
                  </TooltipContent>
                </Tooltip>

                {localCreators.length > 1 && (
                  <Tooltip delayDuration={300}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => handleRemoveCreator(originalIndex)}
                        className="size-6 flex items-center justify-center rounded-md text-foreground hover:bg-muted transition-colors cursor-pointer focus-visible:outline-none"
                        aria-label={`Remove ${roleLabel.toLowerCase()}`}
                      >
                        <Minus className="size-3.5 text-foreground shrink-0" aria-hidden="true" strokeWidth={1.5} />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent
                      side="bottom"
                      align="start"
                      sideOffset={6}
                      alignOffset={2}
                      className="text-11 font-normal px-2 py-0.5 rounded-md border border-border bg-popover text-foreground shadow-md"
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
                <span className="text-11 text-muted-foreground font-mono">
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
            <span
              className="text-muted-foreground text-right font-normal select-none pr-1 text-12 leading-normal whitespace-nowrap truncate"
              title={typeDefinition.creatorTypes[0]?.label || 'Author'}
            >
              {typeDefinition.creatorTypes[0]?.label || 'Author'}
            </span>
            <input
              type="text"
              aria-label="Author"
              onBlur={(blurEvent) => {
                const trimmedValue = blurEvent.target.value.trim();
                const existingAuthors = normalizeAuthors(
                  paper.authors,
                  paper.creators,
                  paper.contributors,
                );
                if (
                  trimmedValue &&
                  (!existingAuthors.length || existingAuthors[0] !== trimmedValue)
                ) {
                  if (onUpdatePaper) {
                    const primaryRoleDef =
                      typeDefinition.primaryCreatorType ||
                      getPrimaryCreatorType(currentItemType) ||
                      'author';
                    onUpdatePaper(
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
                if (keyboardEvent.key === 'Enter') {
                  const trimmedValue = (keyboardEvent.target as HTMLInputElement).value.trim();
                  const existingAuthors = normalizeAuthors(
                    paper.authors,
                    paper.creators,
                    paper.contributors,
                  );
                  if (
                    trimmedValue &&
                    (!existingAuthors.length || existingAuthors[0] !== trimmedValue)
                  ) {
                    if (onUpdatePaper) {
                      const primaryRoleDef =
                        typeDefinition.primaryCreatorType ||
                        getPrimaryCreatorType(currentItemType) ||
                        'author';
                      onUpdatePaper(
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
                className="flex items-center gap-1.5 text-11 text-muted-foreground hover:text-foreground font-medium cursor-pointer py-0.5 px-2 hover:bg-muted focus-visible:outline-none rounded-md w-fit transition-colors select-none"
                aria-expanded={isAuthorsExpanded}
              >
                {isAuthorsExpanded ? (
                  <>
                    <ChevronUp className="size-3.5 shrink-0" aria-hidden="true" strokeWidth={1.5} />
                    <span>Show fewer authors</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="size-3.5 shrink-0" aria-hidden="true" strokeWidth={1.5} />
                    <span>
                      Show {authorEntries.length - MAX_COLLAPSED_AUTHORS}{' '}
                      {authorEntries.length - MAX_COLLAPSED_AUTHORS === 1
                        ? 'more author'
                        : 'more authors'}
                    </span>
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
