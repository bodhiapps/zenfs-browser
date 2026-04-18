/**
 * FileMentionPopup — autocomplete dropdown shown above the chat input when the
 * user types `@` followed by a fragment.
 *
 * Anchored to the input's bottom-left via a simple absolute-positioned div. We
 * use a plain container (not Radix Popover) because the caret position and
 * the input's focus must remain on the Input element — moving focus to a
 * Popover trigger breaks the typing flow. Keyboard navigation is forwarded to
 * this component by the parent (ChatInput) via props.
 *
 * Testids:
 *   - div-file-mention-popup[data-test-state="visible|filtering|empty"]
 *   - btn-mention-option-<sanitized-path> (one per row)
 */

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { sanitizeMentionPath } from "./mention-utils";

type FileMentionPopupState = "visible" | "filtering" | "empty";

interface FileMentionPopupProps {
  open: boolean;
  query: string;
  options: string[];
  activeIndex: number;
  onHover: (index: number) => void;
  onPick: (path: string) => void;
}

export default function FileMentionPopup({
  open,
  query,
  options,
  activeIndex,
  onHover,
  onPick,
}: FileMentionPopupProps) {
  const activeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  if (!open) return null;

  const state: FileMentionPopupState =
    options.length === 0
      ? "empty"
      : query.length > 0
        ? "filtering"
        : "visible";

  return (
    <div
      data-testid="div-file-mention-popup"
      data-test-state={state}
      className={cn(
        "absolute bottom-full left-0 mb-1 w-[320px] max-h-64 overflow-y-auto",
        "rounded-md border bg-popover text-popover-foreground shadow-md",
        "z-50",
      )}
    >
      {options.length === 0 ? (
        <div
          data-testid="div-mention-empty"
          className="px-2 py-1.5 text-xs text-muted-foreground"
        >
          No matching files
        </div>
      ) : (
        <div className="py-1">
          {options.map((path, idx) => {
            const isActive = idx === activeIndex;
            return (
              <button
                key={path}
                ref={isActive ? activeRef : null}
                type="button"
                role="option"
                aria-selected={isActive}
                data-testid={`btn-mention-option-${sanitizeMentionPath(path)}`}
                data-active={isActive ? "true" : undefined}
                onMouseEnter={() => onHover(idx)}
                // Use onMouseDown to beat the input's blur handler. onClick
                // would first blur the input and dismiss the popup before the
                // pick registers.
                onMouseDown={(e) => {
                  e.preventDefault();
                  onPick(path);
                }}
                className={cn(
                  "flex w-full items-center gap-2 px-2 py-1 text-left text-xs",
                  isActive ? "bg-accent" : "hover:bg-muted",
                )}
                title={path}
              >
                <span className="truncate">{path}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
