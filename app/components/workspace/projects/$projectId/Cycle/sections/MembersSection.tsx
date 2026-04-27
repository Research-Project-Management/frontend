import React from "react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "~/components/ui/dropdown-menu";
import { Input } from "~/components/ui/input";
import { UserPlus, Search, Check } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";

interface Member {
  user: {
    _id: string;
    name: string;
    avatar?: string;
  };
}

interface MembersSectionProps {
  projectData: any;
  formMembers: string[];
  setFormMembers: React.Dispatch<React.SetStateAction<string[]>>;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  trigger?: React.ReactNode;
}

export const MembersSection = ({ projectData, formMembers, setFormMembers, searchTerm, setSearchTerm, trigger }: MembersSectionProps) => {
  const filteredProjectMembers = projectData?.project?.members?.filter((m: Member) =>
    m.user.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleMember = (userId: string) => {
    setFormMembers(prev => prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {trigger || (
          <button className="h-10 rounded-[8px] border border-[#d9d9d9] bg-white px-4 text-[15px] font-medium text-[#333] hover:bg-[#f7f7f7] flex items-center gap-2 transition-colors">
            <UserPlus className="size-4 text-[#44546f]" /> Members
          </button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[280px] p-0 rounded-xl border-border/50 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-150">
        <div className="p-3 border-b border-border/50 bg-white sticky top-0 z-10">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-[#44546f]" />
            <Input 
              placeholder="Search members..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9 border-none bg-gray-50 focus:bg-white transition-colors"
            />
          </div>
        </div>
        <div className="p-1.5 max-h-[320px] overflow-y-auto custom-scrollbar">
          {filteredProjectMembers?.length > 0 ? (
            <div className="space-y-0.5">
              {filteredProjectMembers.map((m: Member) => (
                <DropdownMenuItem 
                  key={m.user._id} 
                  onClick={(e) => { e.preventDefault(); toggleMember(m.user._id); }}
                  className={`flex items-center gap-3 px-3 py-2 cursor-pointer rounded-lg transition-colors ${formMembers.includes(m.user._id) ? 'bg-blue-50' : 'hover:bg-[#091e420f]'}`}
                >
                  <Avatar className="size-7">
                    <AvatarImage src={m.user.avatar} />
                    <AvatarFallback className="bg-indigo-600 text-white text-[10px] font-bold">{m.user.name.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span className={`text-sm flex-1 truncate ${formMembers.includes(m.user._id) ? 'font-semibold text-[#0c66e4]' : 'text-[#172b4d]'}`}>{m.user.name}</span>
                  {formMembers.includes(m.user._id) && <Check className="size-4 text-[#0c66e4]" />}
                </DropdownMenuItem>
              ))}
            </div>
          ) : (
            <div className="px-4 py-8 text-center">
              <span className="text-sm text-gray-400">No members found</span>
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
