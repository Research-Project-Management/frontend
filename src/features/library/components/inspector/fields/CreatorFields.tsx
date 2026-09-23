'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Plus, Minus, Check, ChevronDown, ChevronUp, Building2, User } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import type { Item, CreatorCredit } from '@/features/library/types/library.types';
import { normalizeAuthors, splitAuthorString } from '../../../domain';
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui';

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
  onUpdatePaper?: (data: Partial<Item>) => void;
}

const MAX_COLLAPSED_AUTHORS = 3;

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
      const fieldMode = (rawCreatorItem as any).fieldMode ?? 0;
      const shortName = cleanValue((rawCreatorItem as any).shortName);
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
        const splitNameParts = splitAuthorString(creatorName);
        if (splitNameParts.length > 1) {
          for (const authorPart of splitNameParts) {
            parsedCreators.push({
              creatorType,
              name: authorPart,
              fieldMode: 0,
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
  return creatorEntries.map((creatorEntry, indexPosition) => ({
    orderIndex: indexPosition,
    creatorType: creatorEntry.creatorType || 'author',
    fieldMode: creatorEntry.fieldMode ?? 0,
    fullName: creatorEntry.name.trim(),
    name: creatorEntry.name.trim(),
    firstName: creatorEntry.firstName,
    lastName: creatorEntry.lastName,
    shortName: creatorEntry.shortName?.trim() || undefined,
  }));
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

  const visibleCreators = useMemo(() => {
    if (isAuthorsExpanded || localCreators.length <= MAX_COLLAPSED_AUTHORS) {
      return localCreators;
    }
    return localCreators.slice(0, MAX_COLLAPSED_AUTHORS);
  }, [localCreators, isAuthorsExpanded]);

  useEffect(() => {
    if (focusAuthorIndex !== null && authorInputRefs.current[focusAuthorIndex]) {
      authorInputRefs.current[focusAuthorIndex]?.focus();
      setFocusAuthorIndex(null);
    }
  }, [focusAuthorIndex, localCreators]);

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
    const existingCreators = parseCreators(paper);
    if (areCreatorsEqual(updatedCreators, existingCreators)) {
      return;
    }
    const primaryRole = typeDefinition.primaryCreatorType || getPrimaryCreatorType(currentItemType) || 'author';
    const allCreatorNames = updatedCreators
      .map((creatorItem) => creatorItem.name.trim())
      .filter(Boolean);
    const primaryCreatorNames = updatedCreators
      .filter((creatorItem) => (creatorItem.creatorType || primaryRole) === primaryRole)
      .map((creatorItem) => creatorItem.name.trim())
      .filter(Boolean);
    const finalAuthors = primaryCreatorNames.length ? primaryCreatorNames : allCreatorNames;
    if (onUpdatePaper) {
      onUpdatePaper({
        authors: finalAuthors.length ? finalAuthors : undefined,
        creators: toItemCreators(updatedCreators),
      });
    }
  };

  const handleToggleFieldMode = (targetIndex: number) => {
    const current = localCreators[targetIndex];
    if (!current) return;
    const nextMode = (current.fieldMode ?? 0) === 1 ? 0 : 1;
    const updatedCreators = [...localCreators];
    updatedCreators[targetIndex] = {
      ...current,
      fieldMode: nextMode,
    };
    setLocalCreators(updatedCreators);
    if (onUpdatePaper) {
      onUpdatePaper({
        creators: toItemCreators(updatedCreators),
      });
    }
  };

  const handleAddCreator = (afterIndex?: number) => {
    const primaryRole = typeDefinition.primaryCreatorType || getPrimaryCreatorType(currentItemType) || 'author';
    const insertPosition = typeof afterIndex === 'number' ? afterIndex + 1 : localCreators.length;
    const updatedCreators = [...localCreators];
    updatedCreators.splice(insertPosition, 0, { creatorType: primaryRole, name: '', fieldMode: 0 });
    setLocalCreators(updatedCreators);
    setIsAuthorsExpanded(true);
    setFocusAuthorIndex(insertPosition);
  };

  const handleRemoveCreator = (targetIndex: number) => {
    const updatedCreators = localCreators.filter((_, creatorIndex) => creatorIndex !== targetIndex);
    setLocalCreators(updatedCreators);
    const primaryRole = typeDefinition.primaryCreatorType || getPrimaryCreatorType(currentItemType) || 'author';
    const allCreatorNames = updatedCreators
      .map((creatorItem) => creatorItem.name.trim())
      .filter(Boolean);
    const primaryCreatorNames = updatedCreators
      .filter((creatorItem) => (creatorItem.creatorType || primaryRole) === primaryRole)
      .map((creatorItem) => creatorItem.name.trim())
      .filter(Boolean);
    const finalAuthors = primaryCreatorNames.length ? primaryCreatorNames : allCreatorNames;
    if (onUpdatePaper) {
      onUpdatePaper({
        authors: finalAuthors.length ? finalAuthors : undefined,
        creators: updatedCreators.length ? toItemCreators(updatedCreators) : undefined,
      });
    }
  };

  return (
    <div className="py-0.5 space-y-0.5">
      {localCreators.length === 0 ? (
        canEdit ? (
          <div className="grid grid-cols-[80px_1fr] gap-1.5 items-center py-0.5">
            <span className="text-muted-foreground text-right font-normal select-none pr-1.5 text-12 leading-tight break-words">
              {typeDefinition.creatorTypes[0]?.label || 'Author'}
            </span>
            <input
              type="text"
              aria-label="Author"
              onBlur={(blurEvent) => {
                const trimmedValue = blurEvent.target.value.trim();
                const existingAuthors = normalizeAuthors(paper.authors, paper.creators, paper.contributors);
                if (trimmedValue && (!existingAuthors.length || existingAuthors[0] !== trimmedValue)) {
                  if (onUpdatePaper) {
                    onUpdatePaper({
                      authors: [trimmedValue],
                      creators: [
                        {
                          orderIndex: 0,
                          creatorType: 'author',
                          fieldMode: 0,
                          fullName: trimmedValue,
                          name: trimmedValue,
                        },
                      ],
                    });
                  }
                }
              }}
              onKeyDown={(keyboardEvent) => {
                if (keyboardEvent.key === 'Enter') {
                  const trimmedValue = (keyboardEvent.target as HTMLInputElement).value.trim();
                  const existingAuthors = normalizeAuthors(paper.authors, paper.creators, paper.contributors);
                  if (trimmedValue && (!existingAuthors.length || existingAuthors[0] !== trimmedValue)) {
                    if (onUpdatePaper) {
                      onUpdatePaper({
                        authors: [trimmedValue],
                        creators: [
                          {
                            orderIndex: 0,
                            creatorType: 'author',
                            fieldMode: 0,
                            fullName: trimmedValue,
                            name: trimmedValue,
                          },
                        ],
                      });
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
          {visibleCreators.map((creatorEntry, creatorIndex) => (
            <div key={creatorIndex} className="grid grid-cols-[76px_1fr] gap-1.5 items-center py-0.5 group">
              {/* Left Role Column */}
              <div className="flex items-center justify-end min-w-0">
                {canEdit ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="w-full min-h-7 h-auto flex items-center justify-end pr-1.5 rounded-md text-12 leading-normal font-normal text-muted-foreground hover:bg-muted cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary select-none text-right"
                        aria-label={`Change role for creator ${creatorIndex + 1}`}
                      >
                        <span className="break-words leading-tight">
                          {ALL_CREATOR_TYPES[creatorEntry.creatorType] || creatorEntry.creatorType || 'Author'}
                        </span>
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="min-w-[170px] p-1.5 rounded-md shadow-raised-200 border border-border bg-popover text-popover-foreground space-y-0.5">
                      {creatorTypesList.map((creatorTypeItem) => (
                        <DropdownMenuItem
                          key={creatorTypeItem.creatorType}
                          onClick={() => handleUpdateCreatorType(creatorIndex, creatorTypeItem.creatorType)}
                          className={cn(
                            'flex items-center justify-between h-7 px-2 text-xs font-normal rounded-md cursor-pointer text-foreground hover:bg-muted',
                            creatorEntry.creatorType === creatorTypeItem.creatorType && 'bg-muted text-foreground font-medium',
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
                  <div className="w-full min-h-7 h-auto flex items-center justify-end pr-1.5 text-12 leading-normal font-normal text-muted-foreground select-text text-right">
                    <span className="break-words leading-tight">
                      {ALL_CREATOR_TYPES[creatorEntry.creatorType] || creatorEntry.creatorType || 'Author'}
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
                        authorInputRefs.current[creatorIndex] = inputElement;
                      }}
                      type="text"
                      value={creatorEntry.name}
                      placeholder={creatorEntry.fieldMode === 1 ? 'Institution or organization name' : 'Author name'}
                      aria-label={`Creator ${creatorIndex + 1}`}
                      onChange={(changeEvent) => {
                        const inputValue = changeEvent.target.value;
                        if (inputValue.includes(';') || /\s+and\s+/i.test(inputValue) || inputValue.includes('\n')) {
                          const splitParts = splitAuthorString(inputValue);
                          if (splitParts.length > 1) {
                            const updatedCreators = [...localCreators];
                            const newCreatorEntries = splitParts.map((authorNamePart) => ({
                              creatorType: updatedCreators[creatorIndex]?.creatorType || 'author',
                              fieldMode: updatedCreators[creatorIndex]?.fieldMode ?? 0,
                              name: authorNamePart,
                            }));
                            updatedCreators.splice(creatorIndex, 1, ...newCreatorEntries);
                            setLocalCreators(updatedCreators);
                            return;
                          }
                        }
                        const updatedCreators = [...localCreators];
                        updatedCreators[creatorIndex] = { ...updatedCreators[creatorIndex], name: inputValue };
                        setLocalCreators(updatedCreators);
                      }}
                      onBlur={() => {
                        const originalCreators = parseCreators(paper);
                        if (areCreatorsEqual(localCreators, originalCreators)) {
                          return;
                        }
                        const primaryRole = typeDefinition.primaryCreatorType || getPrimaryCreatorType(currentItemType) || 'author';
                        const allCreatorNames = localCreators
                          .map((creatorItem) => creatorItem.name.trim())
                          .filter(Boolean);
                        const primaryCreatorNames = localCreators
                          .filter((creatorItem) => (creatorItem.creatorType || primaryRole) === primaryRole)
                          .map((creatorItem) => creatorItem.name.trim())
                          .filter(Boolean);
                        const finalAuthors = primaryCreatorNames.length ? primaryCreatorNames : allCreatorNames;
                        if (onUpdatePaper) {
                          onUpdatePaper({
                            authors: finalAuthors.length ? finalAuthors : undefined,
                            creators: toItemCreators(localCreators),
                          });
                        }
                      }}
                      onKeyDown={(keyboardEvent) => {
                        if (keyboardEvent.key === 'Enter') {
                          keyboardEvent.preventDefault();
                          handleAddCreator(creatorIndex);
                        }
                      }}
                      className="flex-1 min-w-0 h-7 bg-transparent px-2 py-1 rounded-md border border-transparent focus:border-primary focus:ring-1 focus:ring-primary focus:bg-background text-foreground text-12 leading-normal outline-none font-normal font-sans"
                    />

                    {/* Optional Short Name / Acronym when in single-field institutional mode */}
                    {creatorEntry.fieldMode === 1 && (
                      <Tooltip delayDuration={700}>
                        <TooltipTrigger asChild>
                          <input
                            type="text"
                            value={creatorEntry.shortName || ''}
                            placeholder="Acronym (e.g. WHO)"
                            aria-label={`Short name or acronym for creator ${creatorIndex + 1}`}
                            onChange={(changeEvent) => {
                              const updatedCreators = [...localCreators];
                              updatedCreators[creatorIndex] = {
                                ...updatedCreators[creatorIndex],
                                shortName: changeEvent.target.value,
                              };
                              setLocalCreators(updatedCreators);
                            }}
                            onBlur={() => {
                              const originalCreators = parseCreators(paper);
                              if (areCreatorsEqual(localCreators, originalCreators)) return;
                              if (onUpdatePaper) {
                                onUpdatePaper({
                                  creators: toItemCreators(localCreators),
                                });
                              }
                            }}
                            className="w-24 sm:w-28 h-7 bg-transparent px-2 py-1 rounded-md border border-border/50 focus:border-primary focus:ring-1 focus:ring-primary focus:bg-background text-foreground text-11 placeholder:text-muted-foreground/60 leading-normal outline-none font-normal font-sans shrink-0"
                          />
                        </TooltipTrigger>
                        <TooltipContent
                          side="bottom"
                          align="start"
                          sideOffset={6}
                          alignOffset={2}
                          className="text-11 font-normal px-2 py-0.5 rounded-md border border-border bg-popover text-foreground shadow-sm"
                        >
                          Short name / acronym for CSL in-text citations (e.g. WHO, UNESCO)
                        </TooltipContent>
                      </Tooltip>
                    )}

                    {/* Action Buttons (Field mode, Add, Remove) - only visible on hover */}
                    <div className="invisible group-hover:visible flex items-center gap-0.5 shrink-0">
                      <Tooltip delayDuration={700}>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => handleToggleFieldMode(creatorIndex)}
                            className="size-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer focus-visible:outline-none"
                            aria-label={
                              creatorEntry.fieldMode === 1
                                ? 'Single field (institution) — Click to switch to personal author'
                                : 'Personal author — Click to switch to single field (institution)'
                            }
                          >
                            {creatorEntry.fieldMode === 1 ? (
                              <Building2 className="size-3.5 text-primary shrink-0" aria-hidden="true" strokeWidth={1.5} />
                            ) : (
                              <User className="size-3.5 text-muted-foreground hover:text-foreground shrink-0" aria-hidden="true" strokeWidth={1.5} />
                            )}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent
                          side="bottom"
                          align="start"
                          sideOffset={6}
                          alignOffset={2}
                          className="text-11 font-normal px-2 py-0.5 rounded-md border border-border bg-popover text-foreground shadow-sm"
                        >
                          {creatorEntry.fieldMode === 1
                            ? 'Institution — Click for personal author'
                            : 'Personal author — Click for institution'}
                        </TooltipContent>
                      </Tooltip>

                      <Tooltip delayDuration={700}>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => handleAddCreator(creatorIndex)}
                            className="size-6 flex items-center justify-center rounded-md text-foreground hover:bg-muted transition-colors cursor-pointer focus-visible:outline-none"
                            aria-label="Add creator below"
                          >
                            <Plus className="size-3.5 text-foreground shrink-0" aria-hidden="true" strokeWidth={1.5} />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent
                          side="bottom"
                          align="start"
                          sideOffset={6}
                          alignOffset={2}
                          className="text-11 font-normal px-2 py-0.5 rounded-md border border-border bg-popover text-foreground shadow-sm"
                        >
                          Add author below
                        </TooltipContent>
                      </Tooltip>

                      {localCreators.length > 1 && (
                        <Tooltip delayDuration={700}>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={() => handleRemoveCreator(creatorIndex)}
                              className="size-6 flex items-center justify-center rounded-md text-foreground hover:bg-muted transition-colors cursor-pointer focus-visible:outline-none"
                              aria-label="Remove creator"
                            >
                              <Minus className="size-3.5 text-foreground shrink-0" aria-hidden="true" strokeWidth={1.5} />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent
                            side="bottom"
                            align="start"
                            sideOffset={6}
                            alignOffset={2}
                            className="text-11 font-normal px-2 py-0.5 rounded-md border border-border bg-popover text-foreground shadow-sm"
                          >
                            Remove author
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
          ))}

          {localCreators.length > MAX_COLLAPSED_AUTHORS && (
            <div className="grid grid-cols-[76px_1fr] gap-1.5 items-center pt-0.5">
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
                      Show {localCreators.length - MAX_COLLAPSED_AUTHORS}{' '}
                      {localCreators.length - MAX_COLLAPSED_AUTHORS === 1 ? 'more author' : 'more authors'}
                    </span>
                  </>
                )}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default CreatorFields;
