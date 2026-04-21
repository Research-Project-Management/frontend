import { Plus, UserCheck, Clock, CheckCircle2 } from "lucide-react";

interface OverviewCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  variant?: "default" | "warning" | "success";
}

function OverviewCard({ title, value, icon, variant = "default" }: OverviewCardProps) {
  const variantStyles = {
    default: "bg-primary/10 text-primary",
    warning: "bg-orange-500/10 text-orange-600",
    success: "bg-green-500/10 text-green-600",
  };

  return (
    <div className="flex-1 p-4 rounded-xl bg-secondary/20 border border-transparent hover:border-primary/20 hover:bg-secondary/40 transition-all duration-200 group">
      <div className="flex items-center gap-3 mb-2">
        <div className={`p-2 rounded-lg transition-colors ${variantStyles[variant]}`}>
          {icon}
        </div>
        <span className="text-sm font-medium text-muted-foreground">
          {title}
        </span>
      </div>
      <div className="text-2xl font-bold pl-1">{value}</div>
    </div>
  );
}

export default function OverviewSection({ 
    assigned = 0,
    upcomingCount = 0,
    completed = 0
}: { 
    assigned?: number;
    upcomingCount?: number;
    completed?: number;
}) {
  return (
    <div className="w-full">
      <h2 className="text-primary/50 font-semibold mb-4 uppercase text-[11px] tracking-wider">Overview</h2>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <OverviewCard 
          title="Task assigned" 
          value={assigned}
          icon={<UserCheck className="h-4 w-4" />}
        />
        <OverviewCard 
          title="Upcoming" 
          value={upcomingCount}
          icon={<Clock className="h-4 w-4" />}
        />
        <OverviewCard 
          title="Completed" 
          value={completed}
          variant="success"
          icon={<CheckCircle2 className="h-4 w-4" />}
        />
      </div>
    </div>
  );
}



