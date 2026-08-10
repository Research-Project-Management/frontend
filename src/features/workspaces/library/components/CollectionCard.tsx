'use client';

import { useState } from "react";
import {
  BookOpen,
  MoreHorizontal,
  Pencil,
  Trash2,
  FolderOpen,
} from "lucide-react";
import { useRouter, useParams } from "next/navigation";
import { cn } from "@/shared/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui";
import type { Collection } from "@/features/workspaces/library/types/library.types";

interface Props {
  collection: Collection;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
}

export default function CollectionCard({ collection, onDelete, onRename }: Props) {
  const { workspaceId } = useParams();
  const router = useRouter();
  const [isRenaming, setIsRenaming] = useState(false);
  const [nameInput, setNameInput] = useState(collection.name);

  const handleRenameSubmit = () => {
    const trimmed = nameInput.trim();
    if (trimmed && trimmed !== collection.name) {
      onRename(collection._id, trimmed);
    }
    setIsRenaming(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleRenameSubmit();
    if (e.key === "Escape") {
      setNameInput(collection.name);
      setIsRenaming(false);
    }
  };

  return (
    <div
      className={cn(
        "group relative flex flex-col gap-3 rounded-lg border border-border bg-card p-4",
        "cursor-pointer transition-all duration-200",
        "hover:bg-accent/30 hover:border-border/80",
      )}
      onClick={() =>
        !isRenaming &&
        router.push(`/${workspaceId}/library/${collection._id}`)
      }
    >
      {/* Color accent bar */}
      <div
        className="absolute top-0 left-0 right-0 h-1 rounded-t-lg"
        style={{ backgroundColor: collection.color || "#3370ff" }}
      />

      {/* Icon + Menu */}
      <div className="flex items-start justify-between mt-1">
        <div
          className="flex size-10 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${collection.color || "#3370ff"}18` }}
        >
          <FolderOpen
            className="size-5"
            style={{ color: collection.color || "#3370ff" }}
          />
        </div>

        {/* Context menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex size-7 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-accent"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                setIsRenaming(true);
              }}
            >
              <Pencil className="mr-2 size-3.5" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(collection._id);
              }}
            >
              <Trash2 className="mr-2 size-3.5" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Name */}
      {isRenaming ? (
        <input
          autoFocus
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          onBlur={handleRenameSubmit}
          onKeyDown={handleKeyDown}
          onClick={(e) => e.stopPropagation()}
          className="w-full rounded-md border border-primary/40 bg-background px-2 py-1 text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
        />
      ) : (
        <p className="text-sm font-semibold text-foreground line-clamp-1">
          {collection.name}
        </p>
      )}

      {/* Description */}
      {collection.description && (
        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
          {collection.description}
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <BookOpen className="size-3" />
        <span>
          {collection.paperCount}{" "}
          {collection.paperCount === 1 ? "paper" : "papers"}
        </span>
      </div>
    </div>
  );
}
