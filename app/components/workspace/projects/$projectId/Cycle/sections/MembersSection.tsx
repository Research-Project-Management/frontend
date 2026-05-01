import React, { useState, useMemo } from "react";
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from "~/components/ui/popover";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { UserPlus, Search, Check, X } from "lucide-react";

interface MembersSectionProps {
  projectData: any;
  formMembers: string[];
  setFormMembers: (members: string[]) => void;
  trigger?: React.ReactNode;
  isReadOnly?: boolean;
}

export const MembersSection = ({ projectData, formMembers, setFormMembers, trigger, isReadOnly }: MembersSectionProps) => {
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
          <button className="h-10 rounded-sm border border-[#d9d9d9] bg-white px-4 text-[15px] font-medium text-[#333] hover:bg-[#f7f7f7] flex items-center gap-2 transition-colors outline-none">
            <UserPlus className="size-4 text-[#44546f]" /> Members
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0 rounded-sm border-none shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-150 bg-white z-140">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0 bg-white">
          <span className="text-sm font-semibold text-center flex-1 text-[#172b4d]">Members</span>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-[#6b778c] hover:bg-[#091e420f]"
            onClick={() => setIsOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-gray-400 pointer-events-none" />
            <Input 
              placeholder="Search members" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-9 pl-9 pr-4 text-[14px] border-zinc-200 focus-visible:ring-0 focus-visible:border-black rounded-sm shadow-none"
            />
          </div>

          <div className="mt-4">
            <h4 className="text-[11px] font-bold text-[#44546f] uppercase tracking-wider mb-2.5">
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
                      className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-md transition-all text-left group ${
                        isSelected 
                          ? 'bg-[#091e420f] ring-1 ring-zinc-300 mx-0.5 my-0.5 text-[#172b4d]' 
                          : 'hover:bg-[#091e4208] text-[#172b4d]/80 w-full'
                      } ${isSelected ? 'w-[calc(100%-4px)]' : ''}`}
                    >
                      <Avatar className="size-7">
                        <AvatarImage src={user.avatar} className="object-cover" />
                        <AvatarFallback className="bg-zinc-100 text-zinc-600 text-[10px] font-bold flex items-center justify-center">
                          {user.name?.charAt(0).toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <span className={`text-[13px] flex-1 truncate ${isSelected ? 'font-semibold' : 'font-medium'}`}>
                        {user.name}
                      </span>
                      {isSelected && <Check className="size-3.5 text-[#172b4d] stroke-[3]" />}
                    </button>
                  );
                })
              ) : (
                <p className="text-[13px] text-[#6b778c] py-4 text-center">No members found</p>
              )}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
