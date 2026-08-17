import React from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

function normalizeMarkdown(text: string): string {
  let result = text
    .replace(/\u200B/g, "")
    .replace(/\\+([*_`[\]()#>+\-.!|%])/g, "$1");

  // Convert inline HTML spans/font styling to bold markdown to prevent raw HTML leak
  result = result.replace(/<span\s+style="[^"]*">([\s\S]*?)<\/span>/gi, "**$1**");
  result = result.replace(/<font\s+color="[^"]*">([\s\S]*?)<\/font>/gi, "**$1**");

  // Convert inline bullet lists into multiline markdown.
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

export function renderMarkdown(text: string): React.ReactNode[] {
  return [
    <ReactMarkdown
      key="markdown"
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={markdownComponents}
    >
      {normalizeMarkdown(text)}
    </ReactMarkdown>,
  ];
}
