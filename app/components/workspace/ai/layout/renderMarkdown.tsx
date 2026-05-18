import React from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { ExternalLink } from "lucide-react";

function normalizeMarkdown(text: string): string {
  let result = text
    .replace(/\u200B/g, "")
    .replace(/\\+([*_`[\]()#>+\-.!|%])/g, "$1");

  // Convert inline bullet lists like "prefix: * A * B * C" into multiline markdown.
  // This handles responses where the AI puts all list items on one line separated by " * ".
  // Pattern: a line that contains " * text * text" (multiple asterisk-prefixed items inline)
  result = result.replace(
    /^(.*?)(?::\s*)(\*\s+[^\n*]+(?:\*\s+[^\n*]+)+)$/gm,
    (_, prefix, listPart) => {
      const items = listPart
        .split(/\*\s+/)
        .map((s: string) => s.trim())
        .filter(Boolean);
      return prefix + ":\n" + items.map((item: string) => `* ${item}`).join("\n");
    }
  );

  return result;
}

const markdownComponents: Components = {
  p({ children }) {
    return <p className="text-sm leading-relaxed text-foreground/85">{children}</p>;
  },
  strong({ children }) {
    return <strong className="font-semibold text-foreground">{children}</strong>;
  },
  em({ children }) {
    return <em className="italic">{children}</em>;
  },
  h1({ children }) {
    return <h2 className="mt-4 mb-2 text-base font-bold text-foreground">{children}</h2>;
  },
  h2({ children }) {
    return <h3 className="mt-4 mb-1.5 text-sm font-bold text-foreground">{children}</h3>;
  },
  h3({ children }) {
    return <h4 className="mt-4 mb-1.5 text-sm font-semibold text-foreground">{children}</h4>;
  },
  h4({ children }) {
    return <h5 className="mt-3 mb-1 text-xs font-semibold text-foreground/90">{children}</h5>;
  },
  ul({ children }) {
    return <ul className="my-1.5 ml-4 list-disc space-y-1 marker:text-primary/60">{children}</ul>;
  },
  ol({ children }) {
    return <ol className="my-1.5 ml-4 list-decimal space-y-1 marker:text-muted-foreground">{children}</ol>;
  },
  li({ children }) {
    return <li className="pl-1 text-sm leading-relaxed text-foreground/85">{children}</li>;
  },
  blockquote({ children }) {
    return (
      <blockquote className="my-2 border-l-2 border-primary/40 bg-muted/30 px-3 py-2 text-foreground/75">
        {children}
      </blockquote>
    );
  },
  a({ href, children }) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-primary underline-offset-3 hover:underline"
      >
        {children}
      </a>
    );
  },
  table({ children }) {
    return (
      <div className="my-3 overflow-x-auto rounded-lg border border-border bg-background">
        <table className="w-full min-w-max border-collapse text-sm">{children}</table>
      </div>
    );
  },
  thead({ children }) {
    return <thead className="bg-muted/40">{children}</thead>;
  },
  th({ children }) {
    return (
      <th className="border-b border-border px-3 py-2 text-left text-[11px] font-semibold text-muted-foreground">
        {children}
      </th>
    );
  },
  td({ children }) {
    return (
      <td className="border-b border-border px-3 py-2 align-top text-xs leading-relaxed text-foreground/75">
        {children}
      </td>
    );
  },
  hr() {
    return <hr className="my-3 border-border/40" />;
  },
  code({ className, children }) {
    return (
      <code className={`${className ?? ""} rounded-md bg-muted px-1.5 py-0.5 font-mono text-[12px] text-primary`}>
        {children}
      </code>
    );
  },
  pre({ children }) {
    return (
      <pre className="my-3 overflow-x-auto rounded-lg border border-border bg-muted/40 px-4 py-3 text-xs leading-relaxed">
        {children}
      </pre>
    );
  },
  input(props) {
    return <input {...props} disabled className="mr-1.5 align-middle" />;
  },
};

function normalizeInlineMarkdown(text: string): string {
  return text
    .replace(/\u200B/g, "")
    .replace(/\\+([*_`[\]()#>+\-.!|%])/g, "$1");
}

function processItalic(text: string, baseKey: number): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const pattern = /(^|[^*])\*(?!\*)([^*]+?)\*(?!\*)|(^|[^_])_([^_]+?)_/g;
  let cursor = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = pattern.exec(text))) {
    const prefix = match[1] ?? match[3] ?? "";
    const content = match[2] ?? match[4] ?? "";
    const markerStart = match.index + prefix.length;

    if (markerStart > cursor) {
      nodes.push(text.slice(cursor, markerStart));
    }

    nodes.push(
      <em key={`i${baseKey}-${key++}`} className="italic">
        {content}
      </em>,
    );

    cursor = markerStart + content.length + 2;
  }

  if (cursor < text.length) {
    nodes.push(text.slice(cursor));
  }

  return nodes;
}

function processEmphasis(text: string, baseKey: number): React.ReactNode {
  const normalized = normalizeInlineMarkdown(text);
  const nodes: React.ReactNode[] = [];
  const pattern = /(\*\*|__)([\s\S]+?)\1/g;
  let cursor = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = pattern.exec(normalized))) {
    if (match.index > cursor) {
      nodes.push(...processItalic(normalized.slice(cursor, match.index), baseKey + key * 100));
    }

    nodes.push(
      <strong key={`b${baseKey}-${key++}`} className="font-semibold text-foreground">
        {processItalic(match[2], baseKey + key * 100)}
      </strong>,
    );

    cursor = match.index + match[0].length;
  }

  if (cursor < normalized.length) {
    nodes.push(...processItalic(normalized.slice(cursor), baseKey + key * 100));
  }

  return nodes.length === 1 ? nodes[0] : nodes;
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

export function renderMarkdown(text: string): React.ReactNode[] {
  return [
    <ReactMarkdown
      key="markdown"
      remarkPlugins={[remarkGfm]}
      components={markdownComponents}
    >
      {normalizeMarkdown(text)}
    </ReactMarkdown>,
  ];
}
