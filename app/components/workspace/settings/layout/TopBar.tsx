export default function TopBar({
  title,
  description,
}: {
  title: string;
  description?: string;
  Icon?: React.ComponentType<any>;
}) {
  return (
    <header className="flex items-center justify-between p-4 border-b border-border">
      <div
        className="flex flex-col gap-0.5"
        style={{ paddingLeft: "var(--header-offset, 0px)" }}
      >
        <h1 className="font-semibold text-primary">{title}</h1>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
    </header>
  );
}
