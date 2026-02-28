import React from "react";

export default function TopBar({
  title,
  Icon,
}: {
  title: string;
  Icon: React.ComponentType<any>;
}) {
  return (
    <header className="flex items-center justify-between ml-4 p-4 border-b">
      <div
        className="flex items-center gap-2"
        style={{ paddingLeft: "var(--header-offset, 0px)" }}
      >
        <h1 className=" font-semibold text-primary transition-all duration-300">
          {title}
        </h1>
      </div>
      <Icon className="size-4 text-gray-400 hover:text-primary cursor-pointer" />
    </header>
  );
}
