import { formatDistanceToNow } from "date-fns";
import { useParams, Link } from "react-router";
import { useActivityFeed } from "~/query/workspace";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";

export default function RecentActivity({ 
  taskProjectMap = {},
  limit = 5
}: { 
  taskProjectMap?: Record<string, { id: string; name: string }>;
  limit?: number;
}) {
  const { workspaceId } = useParams();
  const { data: activities = [], isLoading } = useActivityFeed(workspaceId || "");

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-muted-foreground font-semibold uppercase text-[11px] tracking-wider">Recent Activity</h2>
      </div>
      <div className="grid gap-2">
        {isLoading ? (
          <div className="p-8 text-center text-xs text-muted-foreground">Loading...</div>
        ) : activities.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground text-sm">No activity yet.</div>
        ) : (
          (limit > 0 ? activities.slice(0, limit) : activities).map((activity: any, idx: number) => {
            const projectInfo = activity.project || taskProjectMap[activity.itemId];
            
            return (
              <Link 
                key={activity._id || activity.id || idx} 
                to={
                  activity.type === "page_update" && (activity.project || projectInfo)
                    ? `/${workspaceId}/projects/${(activity.project?._id || projectInfo?.id)}/pages/${activity.itemId}`
                    : (activity.project || projectInfo)
                    ? `/${workspaceId}/projects/${(activity.project?._id || projectInfo?.id)}/overview`
                    : `/${workspaceId}`
                }
                className="flex items-start gap-3 px-3 py-3 rounded-xl hover:bg-secondary/50 transition-all duration-200 group border border-transparent hover:border-border/50 cursor-pointer"
              >
                <Avatar className="h-9 w-9 border border-border/50 shrink-0 mt-0.5">
                  <AvatarImage src={activity.user?.avatar} alt={activity.user?.name} />
                  <AvatarFallback className="text-[10px]">
                    {activity.user?.name?.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-4">
                    <p className="text-sm font-medium text-foreground leading-snug">
                       <span className="font-bold mr-1.5">{activity.user?.name}</span>
                       <span className="text-muted-foreground">{activity.content}</span>
                    </p>
                    <span className="text-[10px] text-muted-foreground/30 font-bold uppercase whitespace-nowrap shrink-0">
                      {formatDistanceToNow(new Date(activity.time), { addSuffix: true })}
                    </span>
                  </div>
                  
                  {projectInfo && (
                    <div className="mt-1 flex items-center gap-1.5">
                      <div className="h-1 w-1 rounded-full bg-primary/30" />
                      <span className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest leading-none">
                        {projectInfo.name}
                      </span>
                    </div>
                  )}
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
