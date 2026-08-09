import React from "react";
import HomeSection from "../HomeSection";
import { Plus } from "lucide-react";

export default function ShortCut() {
  return (
    <HomeSection title="Shortcut">
      <div>
        <button className="size-14 flex items-center justify-center bg-secondary rounded-sm">
          <Plus className="size-6 text-primary/80" />
        </button>
      </div>
    </HomeSection>
  );
}
