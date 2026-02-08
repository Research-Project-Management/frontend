import { Brain } from "lucide-react";

export default function TopBar() {
  return (
    <div className="flex items-center justify-between px-2 py-1">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 px-3 py-2">
          <Brain className="size-4 text-primary" />
          <span className="text-[11px] font-bold uppercase tracking-tight">
            Wiki Chat
          </span>
        </div>
      </div>
    </div>
  );
}
