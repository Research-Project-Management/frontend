'use client';

import React, { useState, useMemo } from "react";
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from "@/shared/components/ui";
import { Button } from "@/shared/components/ui";
import { Input } from "@/shared/components/ui";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui";
import { UserPlus, Search, Check, X } from "lucide-react";

export interface MembersProps {
  projectData: any;
  formMembers: string[];
  setFormMembers: (members: string[]) => void;
  trigger?: React.ReactNode;
  isReadOnly?: boolean;
}

export const Members = ({ projectData, formMembers, setFormMembers, trigger, isReadOnly }: MembersProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const projectMembers = useMemo(() => {
    return projectData?.members || projectData?.project?.members || [];
  }, [projectData]);

  const filteredProjectMembers = useMemo(() => {
    return projectMembers.filter((m: any) => {
      const name = m.user?.name || 'User';
      return name.toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [projectMembers, searchTerm]);

  const toggleMember = (userId: string) => {
    if (isReadOnly) return;
    if (formMembers.includes(userId)) {
      setFormMembers(formMembers.filter(id => id !== userId));
    } else {
      setFormMembers([...formMembers, userId]);
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        {trigger || (
          <button className="h-10 rounded-sm border border-border bg-background px-4 text-[15px] font-medium text-foreground hover:bg-muted flex items-center gap-2 transition-colors outline-none cursor-pointer">
            <UserPlus className="size-4 text-foreground" /> Members
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent
        align="start"
        onCloseAutoFocus={(e) => e.preventDefault()}
        className="w-72 p-0 rounded-sm border border-border shadow-xl overflow-hidden animate-in fade-in zoom-in duration-150 bg-popover z-140"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 shrink-0 bg-popover">
          <span className="text-sm font-semibold text-center flex-1 text-foreground">Members</span>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-foreground hover:bg-muted cursor-pointer"
            onClick={() => setIsOpen(false)}
            aria-label="Close members popover"
          >
            <X className="h-4 w-4 text-foreground" />
          </Button>
        </div>

        <div className="p-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-foreground pointer-events-none" />
            <Input 
              placeholder="Search members" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-9 pl-9 pr-4 text-[14px] border-border bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-primary rounded-sm shadow-none"
            />
          </div>

          <div className="mt-4">
            <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2.5">
              BOARD MEMBERS
            </h4>
            <div className="space-y-0.5 max-h-[280px] overflow-y-auto custom-scrollbar px-1.5">
              {filteredProjectMembers?.length > 0 ? (
                filteredProjectMembers.map((m: any) => {
                  const user = typeof m.user === 'object' ? m.user : { _id: m.user, name: 'User' };
                  const isSelected = formMembers.includes(user._id);
                  return (
                    <button
                      key={user._id}
                      onClick={() => toggleMember(user._id)}
                      className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-md transition-all text-left group cursor-pointer ${
                        isSelected 
                          ? 'bg-accent ring-1 ring-border mx-0.5 my-0.5 text-foreground' 
                          : 'hover:bg-muted text-foreground/80 w-full'
                      } ${isSelected ? 'w-[calc(100%-4px)]' : ''}`}
                    >
                      <Avatar className="size-7">
                        <AvatarImage src={user.avatar} className="object-cover" />
                        <AvatarFallback className="bg-muted text-foreground text-[10px] font-bold flex items-center justify-center">
                          {user.name?.charAt(0).toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <span className={`text-[13px] flex-1 truncate text-foreground ${isSelected ? 'font-semibold' : 'font-medium'}`}>
                        {user.name}
                      </span>
                      {isSelected && <Check className="size-3.5 text-foreground stroke-[3]" />}
                    </button>
                  );
                })
              ) : (
                <p className="text-[13px] text-muted-foreground py-4 text-center">No members found</p>
              )}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export const MembersSection = Members;

