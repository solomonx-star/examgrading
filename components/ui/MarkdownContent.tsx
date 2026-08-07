"use client";

import React from "react";

function parseInline(text: string, keyOffset: number): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/);
  if (parts.length === 1) return text;
  return parts.map((part, i) => {
    const k = keyOffset * 1000 + i;
    if (part.startsWith("**") && part.endsWith("**"))
      return <strong key={k}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*"))
      return <em key={k}>{part.slice(1, -1)}</em>;
    if (part.startsWith("`") && part.endsWith("`"))
      return (
        <code key={k} className="rounded bg-black/5 px-1 font-mono text-xs">
          {part.slice(1, -1)}
        </code>
      );
    return part;
  });
}

export function MarkdownContent({ content }: { content: string }) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("### ")) {
      elements.push(
        <h3 key={key} className="mt-2 text-sm font-medium text-foreground">
          {parseInline(line.slice(4), key)}
        </h3>,
      );
    } else if (line.startsWith("## ")) {
      elements.push(
        <h2 key={key} className="mt-3 text-sm font-semibold text-foreground">
          {parseInline(line.slice(3), key)}
        </h2>,
      );
    } else if (line.startsWith("# ")) {
      elements.push(
        <h1 key={key} className="mt-4 text-base font-semibold text-foreground">
          {parseInline(line.slice(2), key)}
        </h1>,
      );
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      const items: React.ReactNode[] = [];
      while (
        i < lines.length &&
        (lines[i].startsWith("- ") || lines[i].startsWith("* "))
      ) {
        items.push(<li key={i}>{parseInline(lines[i].slice(2), i)}</li>);
        i++;
      }
      elements.push(
        <ul key={key} className="my-1 list-disc pl-5">
          {items}
        </ul>,
      );
      key++;
      continue;
    } else if (/^\d+\. /.test(line)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        const text = lines[i].replace(/^\d+\. /, "");
        items.push(<li key={i}>{parseInline(text, i)}</li>);
        i++;
      }
      elements.push(
        <ol key={key} className="my-1 list-decimal pl-5">
          {items}
        </ol>,
      );
      key++;
      continue;
    } else if (line.trim() !== "") {
      elements.push(
        <p key={key} className="my-1">
          {parseInline(line, key)}
        </p>,
      );
    }

    key++;
    i++;
  }

  return <div className="space-y-0.5 text-sm text-foreground">{elements}</div>;
}
