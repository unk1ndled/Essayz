import DOMPurify from "dompurify";
import { marked } from "marked";
import { useMemo } from "react";

marked.use({
  gfm: true,
  breaks: false,
});

export function Markdown({ source }: { source: string }) {
  const html = useMemo(() => {
    const rendered = marked.parse(source) as string;
    return DOMPurify.sanitize(rendered, { USE_PROFILES: { html: true } });
  }, [source]);

  return <article className="prose" dangerouslySetInnerHTML={{ __html: html }} />;
}
