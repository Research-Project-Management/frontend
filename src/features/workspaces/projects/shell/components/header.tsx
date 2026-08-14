import React from "react";

export default function Header({
  title,
  Icon,
  children,
}: {
  title: string;
  Icon: React.ComponentType<any>;
  children?: React.ReactNode;
}) {
  return (
    <header className="flex items-center justify-between bg-transparent p-4">
      <div className="flex items-center gap-2" style={{ paddingLeft: "var(--header-offset, 0px)" }}>
        <h1 className="font-semibold text-foreground transition-all duration-300">{title}</h1>
      </div>
      <div className="flex items-center gap-4">
        {children}
        <Icon className="size-4 cursor-pointer text-muted-foreground hover:text-foreground transition-colors" />
      </div>
    </header>
  );
}
