import React from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { ExternalLink } from "lucide-react";
import "katex/dist/katex.min.css";

function normalizeMarkdown(text: string): string {
  let result = text
    .replace(/\u200B/g, "")
    .replace(/\\+([*_`[\]()#>+\-.!|%])/g, "$1");

  // Unescape literal \n if present (e.g. from SSE streaming or database serialization)
  // Ensures paragraphs, bullet lists, and numbered lists render cleanly instead of printing raw \n
  if (result.includes("\\n")) {
    result = result.replace(/\\r\\n|\\n/g, "\n");
  }

  // Convert inline HTML spans/font styling to bold markdown to prevent raw HTML leak
  result = result.replace(/<span\s+style="[^"]*">([\s\S]*?)<\/span>/gi, "**$1**");
  result = result.replace(/<font\s+color="[^"]*">([\s\S]*?)<\/font>/gi, "**$1**");

  // Convert inline bullet lists like "prefix: * A * B * C" into multiline markdown.
  result = result.replace(
    /^(.*?)(?::\s*)(\*\s+[^\n*]+(?:\*\s+[^\n*]+)+)$/gm,
    (_, prefix, listPart) => {
      const items = listPart
        .split(/\*\s+/)
        .map((s: string) => s.trim())
        .filter(Boolean);
      return prefix + ":\n" + items.map((item: string) => `* ${item}`).join("\n");
    },
  );

  return result;
}

const markdownComponents: Components = {
  p({ children }) {
    return <p className="max-w-[56ch] leading-relaxed text-foreground/90">{children}</p>;
  },
  strong({ children }) {
    return <strong className="font-semibold text-foreground">{children}</strong>;
  },
  em({ children }) {
    return <em className="italic">{children}</em>;
  },
  h1({ children }) {
    return <h2 className="mt-5 mb-2 max-w-[56ch] text-24 font-semibold text-foreground tracking-tight">{children}</h2>;
  },
  h2({ children }) {
    return <h3 className="mt-4 mb-1.5 max-w-[56ch] text-20 font-semibold text-foreground tracking-tight">{children}</h3>;
  },
  h3({ children }) {
    return <h4 className="mt-3.5 mb-1.5 max-w-[56ch] text-sub font-semibold text-foreground">{children}</h4>;
  },
  h4({ children }) {
    return <h5 className="mt-3 mb-1 max-w-[56ch] text-13 font-semibold text-foreground/90">{children}</h5>;
  },
  ul({ children }) {
    return <ul className="my-2 ml-4 max-w-[56ch] list-disc space-y-1.5 marker:text-muted-foreground">{children}</ul>;
  },
  ol({ children }) {
    return <ol className="my-2 ml-4 max-w-[56ch] list-decimal space-y-1.5 marker:text-muted-foreground">{children}</ol>;
  },
  li({ children }) {
    return <li className="pl-1 leading-relaxed text-foreground/90">{children}</li>;
  },
  blockquote({ children }) {
    return (
      <blockquote className="my-2.5 max-w-[56ch] py-0.5 italic text-muted-foreground">
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
      <div className="my-3 w-full overflow-x-auto">
        <table className="w-auto max-w-full border-collapse text-13">{children}</table>
      </div>
    );
  },
  thead({ children }) {
    return <thead className="border-b border-border">{children}</thead>;
  },
  tbody({ children }) {
    return (
      <tbody className="[&>tr:not(:last-child)>td]:border-b [&>tr:not(:last-child)>td]:border-border">
        {children}
      </tbody>
    );
  },
  th({ children }) {
    return (
      <th className="max-w-[42ch] break-words px-3 py-2 text-left text-xs font-semibold text-muted-foreground first:pl-0 last:pr-0">
        {children}
      </th>
    );
  },
  td({ children }) {
    return (
      <td className="max-w-[42ch] break-words px-3 py-2 align-top text-13 leading-relaxed text-foreground/85 first:pl-0 last:pr-0">
        {children}
      </td>
    );
  },
  hr() {
    return <hr className="my-3 border-border" />;
  },
  code({ className, children }) {
    return (
      <code className={`${className ?? ""} rounded-sm bg-muted px-1.5 py-0.5 font-mono text-xs font-medium text-foreground [pre_&]:bg-transparent [pre_&]:p-0 [pre_&]:rounded-none`}>
        {children}
      </code>
    );
  },
  pre({ children }) {
    return (
      <pre className="my-3 overflow-x-auto rounded-md border border-border bg-panel/60 px-3.5 py-2.5 font-mono text-xs leading-relaxed">
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
          className="mx-0.5 inline-flex items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary no-underline transition-colors hover:bg-primary/20"
        >
          {linkMatch[1]}
          <ExternalLink className="size-2.5 opacity-70 shrink-0" />
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
          className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs font-medium text-foreground"
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

export interface RenderMarkdownOptions {
  components?: Partial<Components>;
}

export function renderMarkdown(
  text: string,
  options?: RenderMarkdownOptions,
): React.ReactNode[] {
  const mergedComponents = options?.components
    ? { ...markdownComponents, ...options.components }
    : markdownComponents;

  return [
    <ReactMarkdown
      key="markdown"
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={mergedComponents}
    >
      {normalizeMarkdown(text)}
    </ReactMarkdown>,
  ];
}
