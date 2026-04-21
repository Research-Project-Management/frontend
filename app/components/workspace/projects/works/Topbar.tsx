import type { ComponentType, ReactNode } from "react";

type TopbarProps = {
  title: string;
  Icon: ComponentType<any>;
  children?: ReactNode;
};

export default function Topbar({ title, Icon, children }: TopbarProps) {
  return (
    <header className="flex items-center justify-between px-4 h-13 border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-10 shrink-0">
      <div className="flex items-center gap-2.5">
        <Icon className="size-4.5 text-primary" />
        <h1 className="text-sm font-semibold text-primary transition-all duration-200">
          {title}
        </h1>
      </div>
      <div className="flex items-center gap-3">{children}</div>
    </header>
  );
}
