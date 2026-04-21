import { Link, useParams } from "react-router";
import { useProjects } from "~/hooks/useWorkspace";
import { ChevronRight, Folder } from "lucide-react";

export default function QuickProjects() {
  const { workspaceId } = useParams();
  const { projects = [], isLoading } = useProjects();

  if (isLoading) return null;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-primary/50 font-semibold uppercase text-[11px] tracking-wider">Quick Projects</h2>
        <Link to={`/${workspaceId}`} className="text-xs font-medium text-primary hover:underline">
          View all
        </Link>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {projects.slice(0, 4).map((project: any) => {
          // Navigating to project overview
          const projectOverviewPath = `/${workspaceId}/projects/${project._id}/overview`;
          
          return (
            <Link
              key={project._id}
              to={projectOverviewPath}
              className="p-4 rounded-xl bg-secondary/20 border border-transparent hover:border-primary/20 hover:bg-secondary/40 transition-all duration-200 group flex items-center gap-3"
            >
              <div className="size-10 flex items-center justify-center rounded-lg bg-primary/5 text-primary group-hover:bg-primary/10 transition-colors">
                <span className="text-lg">{project.avatar || <Folder className="h-5 w-5 opacity-40" />}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate">
                  {project.name}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {project.modules?.length || 0} modules active
                </p>
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-primary/60 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 shrink-0" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
