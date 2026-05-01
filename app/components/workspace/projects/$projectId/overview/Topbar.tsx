import { useState, useRef, useEffect } from "react";
import { ChevronRight, type LucideIcon, Search, Check, FolderKanban } from "lucide-react";
import { useNavigate, useParams, useLocation } from "react-router";
import { useProjects } from "~/hooks/useWorkspace";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";


interface TopbarProps {
  project?: {
    name: string;
    avatar?: string;
  };
  title: string;
  Icon: LucideIcon;
  centerContent?: React.ReactNode;
  actions?: React.ReactNode;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
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

/** Detect if a string is an emoji/non-URL avatar */
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
  actions,
  searchQuery,
  onSearchChange,
}: TopbarProps) {
  const { workspaceId, projectId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { projects = [] } = useProjects();

  const [popoverOpen, setPopoverOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  // Derive current module from URL (e.g., /tasks, /overview, /cycles, etc.)
  const currentModule = (() => {
    const segments = location.pathname.split("/");
    // URL pattern: /{workspaceId}/projects/{projectId}/{module}
    const projectIndex = segments.findIndex((s) => s === "projects");
    if (projectIndex !== -1 && segments.length > projectIndex + 2) {
      return segments[projectIndex + 2] ?? "overview";
    }
    return "overview";
  })();

  // Filtered projects list
  const filteredProjects = projects.filter((p: any) =>
    p.name.toLowerCase().includes(searchValue.toLowerCase())
  );

  // Close popover on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setPopoverOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleTogglePopover = () => {
    setPopoverOpen((prev) => !prev);
    setSearchValue("");
  };

  const handleProjectClick = (proj: any) => {
    setPopoverOpen(false);
    if (proj._id === projectId) return;
    navigate(`/${workspaceId}/projects/${proj._id}/${currentModule || "overview"}`);
  };

  return (
      <header className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-stretch px-4 h-13 border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-50 shrink-0 transition-all duration-300 gap-3">
        <div
          className="flex h-full items-center gap-2 min-w-0"
          style={{ paddingLeft: "var(--header-offset, 0px)" }}
        >
          {project && (
            <div ref={triggerRef} className="flex items-center gap-0.5">
              <div className="flex items-center gap-1">
                <div className="relative">
                    <div
                      className="flex items-center gap-2 min-w-0 px-2 py-1 select-none pointer-events-none"
                    >
                      <ProjectAvatar avatar={project.avatar} name={project.name} />
                      <span className="text-[13px] font-medium text-muted-foreground truncate max-w-[150px]">
                        {project.name}
                      </span>
                    </div>

                  {/* Popover dropdown */}
                  {popoverOpen && (
                    <div
                      ref={popoverRef}
                      className="absolute left-0 top-full mt-1.5 w-60 rounded-sm border border-border bg-popover shadow-none z-[100] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150"
                    >
                      {/* Search box */}
                      <div className="p-2 border-b border-border/40 bg-muted/20">
                        <div className={cn(
                          "relative flex items-center h-8 rounded-sm border border-border/50 bg-background overflow-hidden transition-all"
                        )}>
                          <Search className="absolute left-2.5 size-3.5 text-muted-foreground/60 pointer-events-none z-10" />
                          <Input
                            autoFocus
                            value={searchValue}
                            onChange={(e) => setSearchValue(e.target.value)}
                            placeholder="Search projects..."
                            className="h-full text-[13px] py-0 leading-none border-none bg-transparent focus-visible:ring-0 shadow-none w-full transition-all pl-8 placeholder:text-muted-foreground/40"
                          />
                        </div>
                      </div>

                      {/* Project list */}
                      <div className="max-h-60 overflow-y-auto py-1">
                        {filteredProjects.length === 0 ? (
                          <p className="text-xs text-muted-foreground px-3 py-4 text-center">
                            No projects found
                          </p>
                        ) : (
                          filteredProjects.map((proj: any) => {
                            const isActive = proj._id === projectId;
                            return (
                              <button
                                key={proj._id}
                                onClick={() => handleProjectClick(proj)}
                                className={cn(
                                  "w-full flex items-center gap-2.5 px-3 py-2 text-[13px] transition-all text-left",
                                  isActive
                                    ? "bg-accent/80 text-foreground font-medium"
                                    : "text-foreground/70 hover:bg-accent/40 hover:text-foreground"
                                )}
                              >
                                <span className="shrink-0 text-base leading-none w-5 flex items-center justify-center">
                                  {isEmojiAvatar(proj.avatar) ? (
                                    proj.avatar
                                  ) : proj.avatar ? (
                                    <img
                                      src={proj.avatar}
                                      alt={proj.name}
                                      className="size-4 rounded-sm object-cover"
                                    />
                                  ) : (
                                    <FolderKanban className="size-4 text-muted-foreground" />
                                  )}
                                </span>
                                <span className="flex-1 truncate font-medium">
                                  {proj.name}
                                </span>
                                {isActive && (
                                  <Check className="size-3.5 text-primary shrink-0" />
                                )}
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <button 
                  onClick={handleTogglePopover}
                  className={cn(
                    "flex items-center justify-center size-6 rounded-sm transition-all duration-200 outline-none",
                    popoverOpen ? "bg-secondary/80 text-primary" : "hover:bg-secondary/80 text-muted-foreground/50 hover:text-primary"
                  )}
                  title="Change project"
                >
                  <ChevronRight
                    className={cn(
                      "size-3.5 transition-all duration-300",
                      popoverOpen ? "rotate-90 stroke-[2.5px]" : "rotate-0"
                    )}
                  />
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 ml-1">
            <Icon className="size-4 text-foreground/80" />
            <h1 className="text-[13px] font-semibold text-foreground tracking-tight">
              {title}
            </h1>
          </div>
        </div>

        <div className="flex h-full items-stretch justify-center min-w-0">
          {centerContent}
        </div>

        <div className="flex h-full items-center justify-end gap-3 min-w-0">
          {actions}
        </div>
      </header>
  );
}
