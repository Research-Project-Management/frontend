import { useId } from "react";
import { motion, LayoutGroup } from "framer-motion";
import { Library } from "lucide-react";
import { Link, useLocation, useParams } from "react-router";
import { cn } from "~/lib/utils";

export default function LibrarySideBar() {
  const { workspaceId } = useParams();
  const location = useLocation();
  const id = useId();

  const basePath = `/${workspaceId}/library`;

  const items = [
    { label: "All Collections", icon: Library, to: basePath },
  ];

  return (
    <aside className="h-full w-60 overflow-x-hidden border-r border-border bg-card p-2 py-4">
      {/* Header */}
      <div className="mb-4 px-2 font-semibold text-lg text-foreground">
        Library
      </div>

      {/* Navigation */}
      <LayoutGroup id={`library-nav-${id}`}>
        <nav className="flex flex-col gap-1">
          {items.map((item) => {
            const isActive = location.pathname === item.to;
            return (
              <Link
                to={item.to}
                key={item.label}
                className="group/item relative flex h-10 items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors hover:bg-accent/70"
              >
                {isActive && (
                  <motion.div
                    layoutId={`library-nav-active-${id}`}
                    className="absolute inset-0 rounded-md bg-accent"
                    initial={false}
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  />
                )}
                <item.icon
                  className={cn(
                    "relative z-10 size-4 shrink-0",
                    isActive ? "text-primary" : "text-muted-foreground",
                  )}
                />
                <span
                  className={cn(
                    "relative z-10 min-w-0 truncate",
                    isActive
                      ? "font-semibold text-foreground"
                      : "font-medium text-muted-foreground group-hover/item:text-foreground",
                  )}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>
      </LayoutGroup>
    </aside>
  );
}
