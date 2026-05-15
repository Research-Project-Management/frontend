import React from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  CircleDot,
  ExternalLink,
  Flag,
  Hash,
  Info,
  ListChecks,
  Table2,
  UserRound,
} from "lucide-react";

function processEmphasis(text: string, baseKey: number): React.ReactNode {
  const boldParts = text.split(/\*\*(.+?)\*\*/g);
  if (boldParts.length > 1) {
    return boldParts.map((part, index) =>
      index % 2 === 1 ? (
        <strong key={`b${baseKey}-${index}`} className="font-semibold">
          {part}
        </strong>
      ) : (
        part
      ),
    );
  }
  return text;
}

export function formatInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    const linkMatch = remaining.match(/\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch && linkMatch.index !== undefined) {
      if (linkMatch.index > 0) {
        parts.push(processEmphasis(remaining.slice(0, linkMatch.index), key++));
      }
      parts.push(
        <a
          key={`l${key++}`}
          href={linkMatch[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="mx-0.5 inline-flex items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary no-underline transition-colors hover:bg-primary/20"
        >
          {linkMatch[1]}
          <ExternalLink className="size-2.5 opacity-70" />
        </a>,
      );
      remaining = remaining.slice(linkMatch.index + linkMatch[0].length);
      continue;
    }

    const codeMatch = remaining.match(/`([^`]+)`/);
    if (codeMatch && codeMatch.index !== undefined) {
      if (codeMatch.index > 0) {
        parts.push(processEmphasis(remaining.slice(0, codeMatch.index), key++));
      }
      parts.push(
        <code
          key={`c${key++}`}
          className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[12px] text-primary"
        >
          {codeMatch[1]}
        </code>,
      );
      remaining = remaining.slice(codeMatch.index + codeMatch[0].length);
      continue;
    }

    parts.push(processEmphasis(remaining, key++));
    break;
  }

  return parts;
}

function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function stripMarkdown(value: string): string {
  return value
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/`(.*?)`/g, "$1")
    .trim();
}

function getCell(row: string[], headers: string[], names: string[]): string {
  const normalized = headers.map(normalizeHeader);
  const index = normalized.findIndex((header) =>
    names.some((name) => name && header.includes(name)),
  );
  return index >= 0 ? row[index] ?? "" : "";
}

function priorityStyle(value: string): string {
  const lower = value.toLowerCase();
  if (lower.includes("urgent")) {
    return "border-red-200 bg-red-50 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400";
  }
  if (lower.includes("high")) {
    return "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-500/20 dark:bg-orange-500/10 dark:text-orange-400";
  }
  if (lower.includes("medium")) {
    return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400";
  }
  if (lower.includes("low")) {
    return "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-400";
  }
  return "border-border bg-muted text-muted-foreground";
}

function isTaskTable(headers: string[]): boolean {
  const normalized = headers.map(normalizeHeader);
  return (
    normalized.some((header) => header.includes("task")) &&
    normalized.some((header) =>
      ["priority", "due", "assignee", "status", "column"].some((name) =>
        header.includes(name),
      ),
    )
  );
}

function TaskTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: string[][];
}) {
  return (
    <div className="my-3 overflow-hidden rounded-lg border border-border bg-background">
      <div className="flex items-center gap-2 border-b border-border bg-sidebar px-3 py-2">
        <CircleDot className="size-3.5 text-primary" />
        <span className="text-xs font-semibold text-foreground">Task list</span>
        <span className="ml-auto rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          {rows.length}
        </span>
      </div>
      <div className="divide-y divide-border">
        {rows.map((row, index) => {
          const number = stripMarkdown(row[0] || String(index + 1));
          const title =
            getCell(row, headers, ["task", "title", "name"]) ||
            row[1] ||
            row[0] ||
            "Untitled task";
          const priority = stripMarkdown(getCell(row, headers, ["priority"]));
          const due = stripMarkdown(getCell(row, headers, ["due", "deadline"]));
          const assignee = stripMarkdown(
            getCell(row, headers, ["assignee", "owner", "member"]),
          );
          const status = stripMarkdown(getCell(row, headers, ["status", "column"]));

          return (
            <div
              key={index}
              className="grid grid-cols-[auto_minmax(0,1fr)] gap-2.5 px-3 py-2.5 transition-colors hover:bg-muted/40"
            >
              <span className="mt-0.5 flex size-6 items-center justify-center rounded-md border border-border bg-muted text-[10px] font-semibold text-muted-foreground">
                {number.replace(/[^0-9]/g, "") || index + 1}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium leading-snug text-foreground">
                  {formatInline(title)}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {priority && (
                    <span
                      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${priorityStyle(priority)}`}
                    >
                      <Flag className="size-2.5" />
                      {priority.replace(/^[^\w]+/, "").trim()}
                    </span>
                  )}
                  {due && due !== "-" && (
                    <span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      <CalendarDays className="size-2.5" />
                      {due}
                    </span>
                  )}
                  {assignee && assignee !== "-" && (
                    <span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      <UserRound className="size-2.5" />
                      {assignee}
                    </span>
                  )}
                  {status && status !== "-" && (
                    <span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      <Hash className="size-2.5" />
                      {status}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GenericTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: string[][];
}) {
  return (
    <div className="my-3 overflow-hidden rounded-lg border border-border bg-background">
      <div className="flex items-center gap-2 border-b border-border bg-sidebar px-3 py-2">
        <Table2 className="size-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold text-foreground">Details</span>
        <span className="ml-auto rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          {rows.length}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-max border-collapse text-sm">
          <thead>
            <tr className="bg-muted/40">
              {headers.map((header, index) => (
                <th
                  key={index}
                  className="border-b border-border px-3 py-2 text-left text-[11px] font-semibold text-muted-foreground"
                >
                  {formatInline(header)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className="transition-colors odd:bg-background even:bg-muted/20 hover:bg-muted/40"
              >
                {row.map((cell, cellIndex) => (
                  <td
                    key={cellIndex}
                    className="border-b border-border px-3 py-2 align-top text-xs leading-relaxed text-foreground/75"
                  >
                    {formatInline(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StructuredList({
  items,
  ordered = false,
}: {
  items: string[];
  ordered?: boolean;
}) {
  return (
    <div className="my-2 overflow-hidden rounded-lg border border-border bg-background">
      <div className="flex items-center gap-2 border-b border-border bg-sidebar px-3 py-2">
        <ListChecks className="size-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold text-foreground">
          {ordered ? "Steps" : "Checklist"}
        </span>
        <span className="ml-auto rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          {items.length}
        </span>
      </div>
      <div className="divide-y divide-border">
        {items.map((item, index) => {
          const checkbox = item.match(/^\[( |x|X)\]\s+(.*)$/);
          const checked = checkbox ? checkbox[1].toLowerCase() === "x" : false;
          const content = checkbox ? checkbox[2] : item;

          return (
            <div
              key={index}
              className="grid grid-cols-[auto_minmax(0,1fr)] gap-2.5 px-3 py-2.5 transition-colors hover:bg-muted/40"
            >
              {ordered ? (
                <span className="flex size-6 items-center justify-center rounded-md border border-border bg-muted text-[10px] font-semibold text-muted-foreground">
                  {index + 1}
                </span>
              ) : checked ? (
                <CheckCircle2 className="mt-0.5 size-4 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <CircleDot className="mt-0.5 size-4 text-primary/70" />
              )}
              <p
                className={`text-sm leading-relaxed ${
                  checked ? "text-muted-foreground line-through" : "text-foreground/85"
                }`}
              >
                {formatInline(content)}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Callout({
  type = "info",
  children,
}: {
  type?: "info" | "warning" | "success";
  children: React.ReactNode;
}) {
  const Icon =
    type === "warning" ? AlertTriangle : type === "success" ? CheckCircle2 : Info;
  const tone =
    type === "warning"
      ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300"
      : type === "success"
        ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300"
        : "border-border bg-muted/40 text-foreground/80";

  return (
    <div className={`my-3 flex gap-2 rounded-lg border px-3 py-2.5 ${tone}`}>
      <Icon className="mt-0.5 size-3.5 shrink-0" />
      <div className="min-w-0 text-sm leading-relaxed">{children}</div>
    </div>
  );
}

export function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeLines: string[] = [];
  let codeLang = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trim().startsWith("```")) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeLang = line.trim().slice(3).trim();
        codeLines = [];
        continue;
      }

      inCodeBlock = false;
      elements.push(
        <div
          key={`code-${i}`}
          className="my-3 overflow-hidden rounded-lg border border-border bg-background"
        >
          {codeLang && (
            <div className="border-b border-border bg-sidebar px-3 py-1.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
              {codeLang}
            </div>
          )}
          <pre className="overflow-x-auto bg-muted/40 px-4 py-3 text-xs leading-relaxed">
            <code>{codeLines.join("\n")}</code>
          </pre>
        </div>,
      );
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    if (line.startsWith("|")) {
      const nextLine = lines[i + 1];
      if (nextLine && /^\|[\s\-:|]+\|/.test(nextLine)) {
        const tableRows: string[][] = [];
        let j = i;
        while (j < lines.length && lines[j].trim().startsWith("|")) {
          tableRows.push(
            lines[j]
              .split("|")
              .slice(1, -1)
              .map((cell) => cell.trim()),
          );
          j++;
        }

        const headers = tableRows[0] ?? [];
        const bodyRows = tableRows.slice(2);
        elements.push(
          isTaskTable(headers) ? (
            <TaskTable key={`task-table-${i}`} headers={headers} rows={bodyRows} />
          ) : (
            <GenericTable key={`table-${i}`} headers={headers} rows={bodyRows} />
          ),
        );
        i = j - 1;
        continue;
      }
    }

    if (line.startsWith("### ")) {
      elements.push(
        <h4 key={i} className="mt-4 mb-1.5 text-sm font-semibold">
          {formatInline(line.slice(4))}
        </h4>,
      );
      continue;
    }
    if (line.startsWith("## ")) {
      elements.push(
        <h3 key={i} className="mt-4 mb-1.5 text-sm font-bold">
          {formatInline(line.slice(3))}
        </h3>,
      );
      continue;
    }
    if (line.startsWith("# ")) {
      elements.push(
        <h2 key={i} className="mt-4 mb-2 text-base font-bold">
          {formatInline(line.slice(2))}
        </h2>,
      );
      continue;
    }

    const summaryMatch = line.match(
      /^\*\*(Summary|Tóm tắt|Tong ket|Tổng kết|Insight|Note|Lưu ý|Luu y):\*\*\s*(.*)$/i,
    );
    if (summaryMatch) {
      const label = summaryMatch[1].toLowerCase();
      const type =
        label.includes("summary") ||
        label.includes("tóm") ||
        label.includes("tong") ||
        label.includes("insight")
          ? "success"
          : "info";
      elements.push(
        <Callout key={`summary-${i}`} type={type}>
          <span className="font-semibold">{summaryMatch[1]}:</span>{" "}
          {formatInline(summaryMatch[2])}
        </Callout>,
      );
      continue;
    }

    if (line.startsWith("> ")) {
      const quoteLines: string[] = [];
      let j = i;
      while (j < lines.length && lines[j].startsWith("> ")) {
        quoteLines.push(lines[j].slice(2));
        j++;
      }
      const content = quoteLines.join(" ");
      const type =
        /warning|cảnh báo|canh bao|overdue|quá hạn|qua han|risk|rủi ro|rui ro/i.test(
          content,
        )
          ? "warning"
          : "info";
      elements.push(
        <Callout key={`quote-${i}`} type={type}>
          {formatInline(content)}
        </Callout>,
      );
      i = j - 1;
      continue;
    }

    if (line.match(/^[-*]\s/)) {
      const items: string[] = [];
      let j = i;
      while (j < lines.length && lines[j].match(/^[-*]\s/)) {
        items.push(lines[j].replace(/^[-*]\s/, ""));
        j++;
      }
      elements.push(<StructuredList key={`list-${i}`} items={items} />);
      i = j - 1;
      continue;
    }

    if (line.match(/^\d+\.\s/)) {
      const items: string[] = [];
      let j = i;
      while (j < lines.length && lines[j].match(/^\d+\.\s/)) {
        items.push(lines[j].replace(/^\d+\.\s/, ""));
        j++;
      }
      elements.push(
        <StructuredList key={`ordered-${i}`} items={items} ordered />,
      );
      i = j - 1;
      continue;
    }

    if (line.match(/^---+$/)) {
      elements.push(<hr key={i} className="my-3 border-border/40" />);
      continue;
    }

    if (line.trim() === "") {
      elements.push(<div key={i} className="h-2" />);
      continue;
    }

    elements.push(
      <p key={i} className="text-sm leading-relaxed">
        {formatInline(line)}
      </p>,
    );
  }

  return elements;
}
