import { ChevronRight, type LucideIcon } from "lucide-react";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";


interface TopbarProps {
  project?: {
    name: string;
    avatar: string;
  };
  title: string;
  Icon: LucideIcon;
  actions?: React.ReactNode;
}

function ProjectAvatar({ avatar, name }: { avatar: string; name: string }) {
  if (!avatar) return null;

  const isUrl =
    avatar.startsWith("http") ||
    avatar.startsWith("/") ||
    avatar.startsWith("data:");

  if (isUrl) {
    return (
      <div className="size-6 shrink-0 overflow-hidden rounded-sm">
        <img src={avatar} alt={name} className="h-full w-full object-cover" />
      </div>
    );
  }

  return (
    <span className="text-base leading-none shrink-0" title={name}>
      {avatar}
    </span>
  );
}

export default function Topbar({
  project,
  title,
  Icon,
  actions,
}: TopbarProps) {

  return (
    <header className="flex items-center justify-between px-4 h-13 border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-50 shrink-0 transition-all duration-300">
      <div 
        className="flex items-center gap-4"
        style={{ paddingLeft: "var(--header-offset, 0px)" }}
      >
        {project && (
          <div className="flex items-center gap-2">
            <ProjectAvatar avatar={project.avatar} name={project.name} />
            <span className="text-sm font-semibold text-primary truncate max-w-[120px]">
              {project.name}
            </span>
            <ChevronRight className="size-3.5 text-muted-foreground/50" />
          </div>
        )}
        <div className="flex items-center gap-2.5">
          <Icon className="size-4.5 text-primary" />
          <h1 className="text-sm font-semibold text-primary tracking-tight transition-all duration-300">
            {title}
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {actions}
      </div>
    </header>
  );
}
