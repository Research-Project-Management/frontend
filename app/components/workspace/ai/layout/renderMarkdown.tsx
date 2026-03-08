import React from "react";

function processEmphasis(text: string, baseKey: number): React.ReactNode {
  const boldParts = text.split(/\*\*(.+?)\*\*/g);
  if (boldParts.length > 1) {
    return boldParts.map((part, i) =>
      i % 2 === 1 ? (
        <strong key={`b${baseKey}-${i}`} className="font-semibold">
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
    // Markdown link: [label](url)
    const linkMatch = remaining.match(/\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch && linkMatch.index !== undefined) {
      if (linkMatch.index > 0) {
        parts.push(processEmphasis(remaining.slice(0, linkMatch.index), key++));
      }
      const label = linkMatch[1];
      const href = linkMatch[2];
      parts.push(
        <a
          key={`l${key++}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors no-underline mx-0.5"
        >
          {label}
          <svg
            className="size-2.5 opacity-60"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
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
          className="px-1.5 py-0.5 rounded-md bg-secondary text-[12px] font-mono text-primary"
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
      } else {
        inCodeBlock = false;
        elements.push(
          <div
            key={`code-${i}`}
            className="my-3 rounded-xl overflow-hidden border border-border/50"
          >
            {codeLang && (
              <div className="px-3 py-1.5 bg-secondary/80 text-[10px] font-mono text-muted-foreground uppercase tracking-wider border-b border-border/40">
                {codeLang}
              </div>
            )}
            <pre className="px-4 py-3 overflow-x-auto bg-secondary/30 text-xs leading-relaxed">
              <code>{codeLines.join("\n")}</code>
            </pre>
          </div>,
        );
        continue;
      }
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    if (line.startsWith("### ")) {
      elements.push(
        <h4 key={i} className="text-sm font-semibold mt-4 mb-1.5">
          {formatInline(line.slice(4))}
        </h4>,
      );
      continue;
    }
    if (line.startsWith("## ")) {
      elements.push(
        <h3 key={i} className="text-sm font-bold mt-4 mb-1.5">
          {formatInline(line.slice(3))}
        </h3>,
      );
      continue;
    }
    if (line.startsWith("# ")) {
      elements.push(
        <h2 key={i} className="text-base font-bold mt-4 mb-2">
          {formatInline(line.slice(2))}
        </h2>,
      );
      continue;
    }

    if (line.match(/^[-*]\s/)) {
      elements.push(
        <div key={i} className="flex gap-2 ml-1 my-0.5">
          <span className="text-primary/60 mt-0.5 shrink-0">•</span>
          <span className="text-sm leading-relaxed">
            {formatInline(line.slice(2))}
          </span>
        </div>,
      );
      continue;
    }

    const numMatch = line.match(/^(\d+)\.\s/);
    if (numMatch) {
      elements.push(
        <div key={i} className="flex gap-2 ml-1 my-0.5">
          <span className="text-primary/60 mt-0.5 shrink-0 text-xs font-semibold tabular-nums">
            {numMatch[1]}.
          </span>
          <span className="text-sm leading-relaxed">
            {formatInline(line.slice(numMatch[0].length))}
          </span>
        </div>,
      );
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
