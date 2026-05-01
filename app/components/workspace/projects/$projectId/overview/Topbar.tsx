import { useState } from "react";
import { ChevronRight, ChevronDown, type LucideIcon, Search, Check, FolderKanban } from "lucide-react";
import { useNavigate, useParams, useLocation } from "react-router";
import { useProjects } from "~/hooks/useWorkspace";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";


interface TopbarProps {
  project?: {
    name: string;
    avatar?: string;
  };
  title: string;
  Icon: LucideIcon;
  centerContent?: React.ReactNode;
  titleExtra?: React.ReactNode;
  actions?: React.ReactNode;
  onTitleClick?: () => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  count?: number;
}

function ProjectAvatar({ avatar, name }: { avatar?: string; name: string }) {
  if (!avatar) {
    return (
      <div className="size-5 flex items-center justify-center rounded-sm bg-amber-100/50">
        <FolderKanban className="size-3.5 text-amber-600" />
      </div>
    );
  }

  const isUrl =
    avatar.startsWith("http") ||
    avatar.startsWith("/") ||
    avatar.startsWith("data:");

  if (isUrl) {
    return (
      <div className="size-5 shrink-0 overflow-hidden rounded-sm border border-border/50">
        <img src={avatar} alt={name} className="h-full w-full object-cover" />
      </div>
    );
  }

  return (
    <span className="text-sm leading-none shrink-0" title={name}>
      {avatar}
    </span>
  );
}

function isEmojiAvatar(avatar: string) {
  return (
    avatar &&
    !avatar.startsWith("http") &&
    !avatar.startsWith("/") &&
    !avatar.startsWith("data:")
  );
}

export default function Topbar({
  project,
  title,
  Icon,
  centerContent,
  titleExtra,
  actions,
  onTitleClick,
  count,
}: TopbarProps) {
  const { workspaceId, projectId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { projects = [] } = useProjects();
  const [searchValue, setSearchValue] = useState("");

  const currentModule = (() => {
    const segments = location.pathname.split("/");
    const projectIndex = segments.findIndex((s) => s === "projects");
    if (projectIndex !== -1 && segments.length > projectIndex + 2) {
      return segments[projectIndex + 2] ?? "overview";
    }
    return "overview";
  })();

  const filteredProjects = projects.filter((p: any) =>
    p.name.toLowerCase().includes(searchValue.toLowerCase())
  );

  const handleProjectClick = (proj: any) => {
    if (proj._id === projectId) return;
    navigate(`/${workspaceId}/projects/${proj._id}/${currentModule || "overview"}`);
  };

  return (
    <header className="flex items-center px-4 h-13 border-b border-border bg-background sticky top-0 z-50 shrink-0 gap-0">
      {/* Left: Breadcrumbs */}
      <div className="flex items-center min-w-0">
        {project && (
          <div className="flex items-center">
            {/* Project Switcher Box */}
            <DropdownMenu onOpenChange={() => setSearchValue("")}>
              <DropdownMenuTrigger asChild>
                <div className="flex items-center gap-2.5 px-2 py-1 rounded-sm hover:bg-zinc-100/80 data-[state=open]:bg-zinc-100 cursor-pointer transition-all group">
                  <ProjectAvatar avatar={project.avatar} name={project.name} />
                  <span className="text-[13px] font-medium text-muted-foreground group-hover:text-black group-data-[state=open]:text-black truncate max-w-[150px]">
                    {project.name}
                  </span>
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-60 p-0 rounded-sm border border-border bg-popover shadow-xl z-[100] overflow-hidden">
                <div className="p-2 border-b border-border/40 bg-muted/20">
                  <div className="relative flex items-center h-8 rounded-sm border border-border/50 bg-background overflow-hidden">
                    <Search className="absolute left-2.5 size-3.5 text-muted-foreground/60" />
                    <Input
                      autoFocus
                      value={searchValue}
                      onChange={(e) => setSearchValue(e.target.value)}
                      placeholder="Search projects..."
                      className="h-full text-[13px] py-0 border-none bg-transparent focus-visible:ring-0 shadow-none pl-8"
                    />
                  </div>
                </div>
                <div className="max-h-60 overflow-y-auto py-1">
                  {filteredProjects.map((proj: any) => {
                    const isActive = proj._id === projectId;
                    return (
                      <DropdownMenuItem
                        key={proj._id}
                        onClick={() => handleProjectClick(proj)}
                        className={cn(
                          "flex items-center gap-2.5 px-3 py-2 text-[13px] cursor-pointer outline-none transition-colors",
                          isActive ? "bg-zinc-100/80 text-foreground font-medium" : "text-muted-foreground hover:bg-zinc-50 hover:text-foreground"
                        )}
                      >
                        <span className="shrink-0 w-4 flex items-center justify-center">
                          {isEmojiAvatar(proj.avatar) ? proj.avatar : <FolderKanban className={cn("size-3.5", isActive ? "text-foreground" : "text-muted-foreground/40")} />}
                        </span>
                        <span className="truncate flex-1">{proj.name}</span>
                        {isActive && <Check className="size-3.5 text-foreground/40" />}
                      </DropdownMenuItem>
                    );
                  })}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Separator */}
            <ChevronRight className="size-3.5 text-muted-foreground/20" />
          </div>
        )}

        {/* Module Title */}
        <div 
          onClick={onTitleClick}
          className={cn(
            "flex items-center gap-2.5 px-1.5 py-1 rounded-sm transition-all ml-0.5",
            onTitleClick ? "hover:bg-zinc-100 cursor-pointer" : ""
          )}
        >
          <Icon className="size-3.5 text-foreground/80" />
          <h1 className="text-[13px] font-semibold text-foreground tracking-tight whitespace-nowrap">
            {title}
          </h1>
          {count !== undefined && !titleExtra && (
            <div className="ml-1.5 px-1.5 py-0.5 rounded-sm bg-zinc-100 text-muted-foreground text-[11px] font-medium leading-none min-w-[18px] flex items-center justify-center border border-zinc-200/50">
              {count}
            </div>
          )}
        </div>

        {/* Cycle / Detail Info */}
        {titleExtra}
      </div>

      {/* Center: Extra content */}
      <div className="flex-1 flex items-center justify-center min-w-0">
        {centerContent}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center justify-end gap-3 min-w-0">
        {actions}
      </div>
    </header>
  );
}
