'use client';

import { useMemo, useState } from "react";
import { UserPlus, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui";
import { Button } from "@/shared/components/ui";
import { Input } from "@/shared/components/ui";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/components/ui";

export type ActionMemberProps = {
  actionBtnClass?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assigneeId: string | null;
  setAssigneeId: (id: string | null) => void;
  members: any[];
};

export function ActionMember({
  actionBtnClass,
  open,
  onOpenChange,
  assigneeId,
  setAssigneeId,
  members,
}: ActionMemberProps) {
  const [search, setSearch] = useState("");

  const resolvedActionBtnClass =
    actionBtnClass ??
    "h-10 rounded-sm border border-border bg-background px-4 text-[15px] font-medium text-foreground shadow-none hover:bg-muted cursor-pointer";

  const filteredMembers = useMemo(
    () =>
      members.filter((m: any) =>
        m.user.name.toLowerCase().includes(search.toLowerCase())
      ),
    [members, search]
  );

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={
            open
              ? "h-10 rounded-sm border border-border bg-muted px-4 text-[15px] font-medium text-foreground shadow-none"
              : resolvedActionBtnClass
          }
        >
          <UserPlus className="mr-2 h-4 w-4 text-foreground" />
          <span>Members</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={-14}
        onCloseAutoFocus={(e) => e.preventDefault()}
        className="w-72 rounded-sm p-0 shadow-xl border-border/50 flex flex-col z-100"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 shrink-0">
          <span className="text-sm font-semibold text-center flex-1 text-foreground">Members</span>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-foreground hover:bg-muted cursor-pointer"
            onClick={() => onOpenChange(false)}
            aria-label="Close members popover"
          >
            <X className="h-4 w-4 text-foreground" />
          </Button>
        </div>
        <div className="p-3">
          <div className="relative">
            <Input
              placeholder="Search members"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 pr-8"
            />
          </div>
          <div className="mt-4">
            <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Board members
            </h4>
            <div className="space-y-1">
              {filteredMembers.map((m: any) => (
                <button
                  key={m.user._id}
                  onClick={() => {
                    setAssigneeId(m.user._id);
                    onOpenChange(false);
                  }}
                  className={`size-full flex items-center gap-3 px-2 py-1.5 rounded-sm transition-colors hover:bg-accent/50 text-left ${assigneeId === m.user._id ? "bg-accent/50 ring-1 ring-zinc-300" : ""}`}
                >
                  <Avatar className="size-8">
                    <AvatarImage src={m.user.avatar} />
                    <AvatarFallback className="text-xs">
                      {m.user.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium">{m.user.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export const ActionMemberSection = ActionMember;
