import { formatDistanceToNow } from "date-fns";
import { FileText, CheckSquare, Activity as ActivityIcon } from "lucide-react";
import { useMemo } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { useProjectTasks } from "~/query/task";
import { useActivityFeed } from "~/query/workspace";
import type { Activity } from "~/query/workspace";



type RecentFile = {
  _id?: string;
  id?: string;
  filename?: string;
  name?: string;
  originalName?: string;
  createdAt?: string;
  updatedAt?: string;
  author?: Activity["user"];
};

type ProjectRecentActivityProps = {
  projectId: string;
  workspaceId: string;
  recentFiles: RecentFile[];
  limit?: number;
};

type ActivityEntry = {
  id: string;
  type: Activity["type"] | "file_fallback";
  user: Activity["user"];
  content: string;
  time: string;
  itemId: string;
};

function getInitials(name?: string) {
  const value = name?.trim() || "Someone";
  return value
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .substring(0, 2);
}

function getFileId(file: RecentFile) {
  return file._id || file.id || "";
}

function getFileName(file: RecentFile) {
  return file.filename || file.name || file.originalName || "a file";
}

function isValidDate(value?: string) {
  return Boolean(value && !Number.isNaN(new Date(value).getTime()));
}

function getActivityIcon(type: ActivityEntry["type"]) {
  if (type === "task_update") return CheckSquare;
  if (type === "file_upload" || type === "file_fallback") return FileText;
  return ActivityIcon;
}

export default function ProjectRecentActivity({
  projectId,
  workspaceId,
  recentFiles = [],
  limit = 8,
}: ProjectRecentActivityProps) {
  const { data: taskData, isLoading: isTasksLoading } = useProjectTasks(projectId);
  const { data: workspaceActivities = [], isLoading: isActivityLoading } = useActivityFeed(workspaceId);

  const visibleActivities = useMemo(() => {
    // Defensive check for recentFiles
    const filesArray = Array.isArray(recentFiles) ? recentFiles : [];
    const tasksArray = taskData?.tasks || [];

    const taskIds = new Set(tasksArray.map((task) => task._id).filter(Boolean));
    const fileIds = new Set(filesArray.map(getFileId).filter(Boolean));
    const seen = new Set<string>();

    const feedEntries: ActivityEntry[] = (workspaceActivities as (Activity & { _id?: string; id?: string })[])
      .filter((activity) => {
        if (!activity?.itemId || !isValidDate(activity.time)) return false;
        if (activity.type === "task_update") return taskIds.has(activity.itemId);
        if (activity.type === "file_upload") return fileIds.has(activity.itemId);
        return false;
      })
      .map((activity) => ({
        id: activity._id || activity.id || [
          activity.type,
          activity.itemId,
          activity.time,
          activity.user?._id,
        ].filter(Boolean).join(":"),
        type: activity.type,
        user: activity.user,
        content: activity.content || "performed an action",
        time: activity.time,
        itemId: activity.itemId,
      }));

    const feedFileIds = new Set(
      feedEntries
        .filter((entry) => entry.type === "file_upload")
        .map((entry) => entry.itemId),
    );

    const fileFallbackEntries: ActivityEntry[] = filesArray
      .filter((file) => {
        const itemId = getFileId(file);
        return itemId && !feedFileIds.has(itemId) && isValidDate(file.createdAt || file.updatedAt);
      })
      .map((file) => {
        const itemId = getFileId(file);
        const fileTime = file.createdAt || file.updatedAt || "";
        return {
          id: `file:${itemId}:${fileTime}`,
          type: "file_fallback",
          user: file.author || { _id: "system", name: "Someone", email: "system@internal" },
          content: `uploaded ${getFileName(file)}`,
          time: fileTime,
          itemId,
        };
      });

    return [...feedEntries, ...fileFallbackEntries]
      .sort((a, b) => {
        const timeA = new Date(a.time).getTime();
        const timeB = new Date(b.time).getTime();
        if (timeA !== timeB) return timeB - timeA;
        return a.id.localeCompare(b.id); // Stable sort fallback
      })
      .filter((entry) => {
        const dedupeKey = `${entry.type}:${entry.itemId}:${entry.time}:${entry.content}`;
        if (seen.has(dedupeKey)) return false;
        seen.add(dedupeKey);
        return true;
      })
      .slice(0, limit);
  }, [recentFiles, taskData?.tasks, workspaceActivities, limit]);

  const isLoading = isTasksLoading || isActivityLoading;

  if (isLoading && visibleActivities.length === 0) {
    return <div className="p-8 text-center text-xs text-muted-foreground">Loading...</div>;
  }

  if (visibleActivities.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground text-sm">
        No recent activity in this project.
      </div>
    );
  }

  return (
    <div className="max-h-[450px] overflow-y-auto custom-scrollbar">
      <div className="grid gap-1 relative before:absolute before:left-7.5 before:top-4 before:bottom-4 before:w-px before:bg-border/30">
        {visibleActivities.map((activity) => {
          const Icon = getActivityIcon(activity.type);
          const userName = activity.user?.name || "Someone";

          return (
            <div
              key={activity.id}
              className="flex items-start gap-4 px-3 py-3 rounded-xl hover:bg-secondary/40 transition-all duration-200 group border border-transparent hover:border-border/40"
            >
              <Avatar className="h-9 w-9 border border-border/50 shrink-0 mt-0.5">
                <AvatarImage src={activity.user?.avatar} alt={userName} />
                <AvatarFallback className="text-[10px]">
                  {getInitials(userName)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-4">
                  <p className="text-sm font-medium text-foreground leading-snug">
                    <span className="font-bold mr-1.5">{userName}</span>
                    <span className="text-muted-foreground">{activity.content}</span>
                  </p>
                  <span className="text-[10px] text-muted-foreground/30 font-bold uppercase whitespace-nowrap shrink-0">
                    {formatDistanceToNow(new Date(activity.time), { addSuffix: true })}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-1.5 text-xs text-primary/60 font-medium">
                  <Icon className="size-3.5" />
                  <span className="truncate">
                    {activity.type === "task_update" ? "Task activity" : "Project assets"}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
