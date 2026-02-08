import { ChevronRight, Home } from "lucide-react";
import { Link } from "react-router";

type BreadcrumbItem = {
  id: string | null;
  name: string;
};

type BreadcrumbProps = {
  items: BreadcrumbItem[];
  workspaceId: string;
  onNavigate: (folderId: string | null) => void;
};

export default function Breadcrumb({ items, workspaceId, onNavigate }: BreadcrumbProps) {
  return (
    <nav className="flex items-center gap-2 text-sm mb-4">
      <button
        onClick={() => onNavigate(null)}
        className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
      >
        <Home className="h-4 w-4" />
        <span>Storage</span>
      </button>

      {items.map((item, index) => (
        <div key={item.id || "root"} className="flex items-center gap-2">
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          {index === items.length - 1 ? (
            <span className="font-medium text-foreground">{item.name}</span>
          ) : (
            <button
              onClick={() => onNavigate(item.id)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {item.name}
            </button>
          )}
        </div>
      ))}
    </nav>
  );
}
