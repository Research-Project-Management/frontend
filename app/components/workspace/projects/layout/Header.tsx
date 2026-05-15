import React from "react";

export default function Header({
  title,
  Icon,
}: {
  title: string;
  Icon: React.ComponentType<any>;
}) {
  return (
    <header className="flex items-center justify-between border-b border-border bg-background/80 p-4 backdrop-blur-md">
      <div className="flex items-center gap-2" style={{ paddingLeft: "var(--header-offset, 0px)" }}>
        <h1 className="font-semibold text-foreground transition-all duration-300">{title}</h1>
      </div>
      <Icon className="size-4 cursor-pointer text-muted-foreground hover:text-primary" />
    </header>
  );
}
