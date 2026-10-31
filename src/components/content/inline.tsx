import Link from "next/link";
import { Fragment } from "react";
import { parseInline, type InlineNode } from "@/lib/content/inline";

const linkClass = "font-medium text-primary underline decoration-primary/30 underline-offset-[3px] transition hover:decoration-primary";

function Nodes({ nodes }: { nodes: InlineNode[] }) {
  return nodes.map((n, i) => {
    switch (n.type) {
      case "text":
        return <Fragment key={i}>{n.value}</Fragment>;
      case "strong":
        return (
          <strong key={i} className="font-semibold text-foreground">
            <Nodes nodes={n.children} />
          </strong>
        );
      case "em":
        return (
          <em key={i}>
            <Nodes nodes={n.children} />
          </em>
        );
      case "link":
        return n.external ? (
          <a key={i} href={n.href} className={linkClass} rel="noopener noreferrer" target="_blank">
            <Nodes nodes={n.children} />
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        ) : n.href.startsWith("/") ? (
          <Link key={i} href={n.href} className={linkClass}>
            <Nodes nodes={n.children} />
          </Link>
        ) : (
          <a key={i} href={n.href} className={linkClass}>
            <Nodes nodes={n.children} />
          </a>
        );
    }
  });
}

/** Render inline markup safely (text nodes only — never HTML). */
export function Inline({ text }: { text: string }) {
  return <Nodes nodes={parseInline(text)} />;
}
