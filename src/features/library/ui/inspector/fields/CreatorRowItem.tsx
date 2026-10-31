"use client";

import type React from "react";
import { Plus, Minus, Check } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import {
  type CreatorEntry,
  splitAuthorString,
  parseCreatorName,
  isInstitutionName,
} from "@/features/library/domain/creators";
import { ALL_CREATOR_TYPES } from "@/features/library/domain/types/item-types.types";
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
export default CreatorRowItem;
