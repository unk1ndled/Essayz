import { useDeferredValue, useLayoutEffect, useMemo, type RefObject } from "react";
import { highlightMarkdown } from "./markdownHighlight";

type MarkdownEditorProps = {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (value: string) => void;
};

export function MarkdownEditor({ textareaRef, value, onChange }: MarkdownEditorProps) {
  const highlightedValue = useDeferredValue(value);
  const tokens = useMemo(() => highlightMarkdown(highlightedValue), [highlightedValue]);

  useLayoutEffect(() => {
    const field = textareaRef.current;
    if (!field) return;

    // Let the document scroll instead of putting a narrow native scrollbar inside
    // the writing surface. Reset first so the field can also shrink after edits.
    field.style.height = "0px";
    field.style.height = `${Math.max(field.scrollHeight, Math.round(window.innerHeight * 0.55))}px`;
  }, [textareaRef, value]);

  return (
    <div className="markdown-editor">
      <pre className="markdown-highlight" aria-hidden="true">
        {tokens.map((token, index) => (
          <span className={`markdown-${token.kind}`} key={`${index}-${token.kind}`}>{token.value}</span>
        ))}
        {highlightedValue.endsWith("\n") ? "\n" : null}
      </pre>
      <textarea
        ref={textareaRef}
        className="markdown-input"
        aria-label="Essay in Markdown"
        placeholder="Begin wherever you are…"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
