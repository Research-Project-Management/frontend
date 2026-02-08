import React from "react";

export default function HomeSection({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="w-full">
      <div className="w-full flex justify-between">
        <h1 className="text-primary/50 font-semibold mb-2">{title}</h1>
      </div>
      <div className="relative">{children}</div>
    </div>
  );
}
