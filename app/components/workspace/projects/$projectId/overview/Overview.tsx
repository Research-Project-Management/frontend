import { useParams, useNavigate } from "react-router";
import { useMemo, useState } from "react";
import { useProjectOverview } from "~/query/project";
import {
  Users,
  FileText,
  CheckSquare,
  HardDrive,
  CalendarDays,
  ArrowUpRight,
} from "lucide-react";
import { Skeleton } from "~/components/ui/skeleton";
import { Button } from "~/components/ui/button";
import { Progress } from "~/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { getRoleName } from "~/lib/utils";
import { memo } from "react";

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .substring(0, 2);
}

function UserAvatar({
  name,
  avatar,
  className,
  fallbackClassName,
}: {
  name: string;
  avatar?: string;
  className: string;
  fallbackClassName?: string;
}) {
  const [hasImageError, setHasImageError] = useState(false);
  const avatarValue = avatar?.trim() || "";
  const isImageAvatar =
    !hasImageError &&
    (avatarValue.startsWith("http://") ||
      avatarValue.startsWith("https://") ||
      avatarValue.startsWith("/") ||
      avatarValue.startsWith("data:image/"));

  return (
    <Avatar className={className}>
      {isImageAvatar ? (
        <AvatarImage
          src={avatarValue}
          alt={name}
          onError={() => setHasImageError(true)}
        />
      ) : null}
      <AvatarFallback className={fallbackClassName}>
        {avatarValue && !isImageAvatar ? avatarValue : getInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
}

const Section = memo(
  ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="w-full">
      <h2 className="text-primary/50 font-semibold mb-4">{title}</h2>
      <div className="relative">{children}</div>
    </div>
  ),
);

Section.displayName = "Section";

export default function ProjectOverview() {
  const { projectId, workspaceId } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, error } = useProjectOverview(projectId!);

  const formatSize = useMemo(
    () => (bytes: number) => {
      if (bytes === 0) return "0 B";
      const k = 1024;
      const sizes = ["B", "KB", "MB", "GB", "TB"];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
    },
    [],
  );

  if (isLoading) {
    return (
      <div className="flex-1 p-6 space-y-10 overflow-y-auto">
        <div className="flex justify-between items-start">
          <div className="space-y-2">
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-4 w-80" />
          </div>
          <Skeleton className="h-9 w-28 rounded-md" />
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="p-4 rounded-xl bg-secondary/20 space-y-3">
              <div className="flex items-center gap-3">
                <Skeleton className="size-8 rounded-lg" />
                <Skeleton className="h-4 w-20" />
              </div>
              <Skeleton className="h-7 w-12" />
              <Skeleton className="h-1.5 w-full rounded" />
            </div>
          ))}
        </div>
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-7">
          <div className="col-span-4 space-y-4">
            <Skeleton className="h-5 w-24" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-3">
                <Skeleton className="size-10 rounded-lg" />
                <div className="space-y-1 flex-1">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
            ))}
          </div>
          <div className="col-span-3 space-y-4">
            <Skeleton className="h-5 w-28" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-2">
                <Skeleton className="size-9 rounded-full" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }
  if (error || !data)
    return <div className="p-6 text-destructive">Failed to load overview</div>;

  const { project, stats } = data;

  return (
    <div className="flex-1 p-6 space-y-10 overflow-y-auto">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
          <p className="text-muted-foreground mt-1 max-w-2xl">
            {project.description || "No description provided."}
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <div
          onClick={() => navigate(`/${workspaceId}/projects/${projectId}/tasks`)}
          className="p-4 rounded-xl bg-secondary/20 border border-transparent hover:border-primary/20 hover:bg-secondary/40 transition-all duration-200 cursor-pointer group"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary/10 rounded-lg text-primary group-hover:bg-primary group-hover:text-white transition-colors">
              <CheckSquare className="h-4 w-4" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">
              Total Tasks
            </span>
          </div>
          <div className="text-2xl font-bold pl-1">{stats.tasks.total}</div>
          <div className="mt-3 flex items-center gap-2">
            <Progress
              value={
                stats.tasks.total > 0
                  ? (stats.tasks.completed / stats.tasks.total) * 100
                  : 0
              }
              className="h-1.5 flex-1"
            />
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {stats.tasks.completed} done
            </span>
          </div>
        </div>

        <div
          onClick={() => navigate(`/${workspaceId}/projects/${projectId}/settings/team`)}
          className="p-4 rounded-xl bg-secondary/20 border border-transparent hover:border-primary/20 hover:bg-secondary/40 transition-all duration-200 cursor-pointer group"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary/10 rounded-lg text-primary group-hover:bg-primary group-hover:text-white transition-colors">
              <Users className="h-4 w-4" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">
              Team
            </span>
          </div>
          <div className="text-2xl font-bold pl-1">{stats.members}</div>
          <div className="flex -space-x-2 mt-3 overflow-hidden pl-1">
            {project.members.slice(0, 5).map((m, i) => (
              <UserAvatar
                key={i}
                name={m.user.name}
                avatar={m.user.avatar}
                className="inline-block h-6 w-6 border-2 border-background"
                fallbackClassName="text-[10px]"
              />
            ))}
          </div>
        </div>

        <div
          onClick={() => navigate(`/${workspaceId}/projects/${projectId}/storage`)}
          className="p-4 rounded-xl bg-secondary/20 border border-transparent hover:border-primary/20 hover:bg-secondary/40 transition-all duration-200 cursor-pointer group"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary/10 rounded-lg text-primary group-hover:bg-primary group-hover:text-white transition-colors">
              <HardDrive className="h-4 w-4" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">
              Storage
            </span>
          </div>
          <div className="text-2xl font-bold pl-1">{stats.files.count}</div>
          <p className="text-xs text-muted-foreground mt-1 pl-1">
            {formatSize(stats.files.totalSize)} used
          </p>
        </div>

        <div className="p-4 rounded-xl bg-secondary/20 border border-transparent hover:border-primary/10 transition-colors">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <CalendarDays className="h-4 w-4" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">
              Age
            </span>
          </div>
          <div className="text-2xl font-bold pl-1">
            {Math.ceil(
              (Date.now() - new Date(project.createdAt).getTime()) /
                (1000 * 60 * 60 * 24),
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1 pl-1">Days active</p>
        </div>
      </div>

      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-7">
        {/* Recent Files */}
        <div className="col-span-4">
          <Section title="Recent Files">
            {stats.files.recent.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm">
                No files yet.
              </div>
            ) : (
              <div className="grid gap-2">
                {stats.files.recent.map((file) => (
                  <div
                    key={file._id}
                    className="flex items-center gap-4 px-3 py-3 rounded-xl hover:bg-secondary/50 transition-all duration-200 cursor-pointer group border border-transparent hover:border-border/50"
                  >
                    <div className="h-10 w-10 flex items-center justify-center rounded-lg bg-primary/5 text-primary group-hover:bg-primary/10 transition-colors">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="flex-1 grid gap-0.5">
                      <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate">
                        {file.filename}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(file.createdAt).toLocaleDateString()} • by{" "}
                        {file.author?.name}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => window.open(file.url, "_blank")}
                    >
                      <ArrowUpRight className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>

        {/* Team List */}
        <div className="col-span-3">
          <Section title="Team Members">
            <div className="grid gap-2">
              {project.members.map((member) => {
                const roleName = getRoleName(member);

                return (
                  <div
                    key={member.user._id}
                    className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-secondary/50 transition-all duration-200 group"
                  >
                    <UserAvatar
                      name={member.user.name}
                      avatar={member.user.avatar}
                      className="h-9 w-9 border border-border/50"
                    />
                    <div>
                      <p className="text-sm font-medium leading-none group-hover:text-primary transition-colors">
                        {member.user.name}
                      </p>
                      <p className="text-xs text-muted-foreground capitalize mt-1">
                        {roleName}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
