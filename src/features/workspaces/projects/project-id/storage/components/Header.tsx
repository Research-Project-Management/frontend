import React from "react";
import { HardDrive } from "lucide-react";

export default function Header() {
  return (
    <header className="flex items-center px-6 py-4 border-b border-border/50">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
          <HardDrive className="size-5 text-primary" />
        </div>
        <h1 className="text-xl font-semibold">Storage</h1>
      </div>
    </header>
  );
}
