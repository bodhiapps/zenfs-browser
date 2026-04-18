import { type FC, useEffect, useRef } from "react";
import { Crepe } from "@milkdown/crepe";
import { Milkdown, MilkdownProvider, useEditor } from "@milkdown/react";
import type { SaveState } from "@/hooks/useFileTree";

import "@milkdown/crepe/theme/common/style.css";
import "@milkdown/crepe/theme/frame.css";
import "./MarkdownEditor.css";

interface MarkdownEditorProps {
  initialContent: string;
  onSave: (content: string) => Promise<void>;
  saveState: SaveState;
}

function saveLabel(state: SaveState): string {
  if (state === "saving") return "Saving…";
  if (state === "saved") return "Saved";
  if (state === "error") return "Save failed";
  return "";
}

const CrepeEditor: FC<MarkdownEditorProps> = ({
  initialContent,
  onSave,
  saveState,
}) => {
  const crepeRef = useRef<Crepe | null>(null);
  const dirtyRef = useRef(false);
  const onSaveRef = useRef(onSave);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  const flushSave = () => {
    if (!dirtyRef.current) return;
    const crepe = crepeRef.current;
    if (!crepe) return;
    let markdown: string;
    try {
      markdown = crepe.getMarkdown();
    } catch {
      return;
    }
    dirtyRef.current = false;
    void onSaveRef.current(markdown);
  };

  useEditor((root) => {
    const crepe = new Crepe({ root, defaultValue: initialContent });
    crepe.on((listener) => {
      listener.markdownUpdated((_ctx, md, prev) => {
        if (md !== prev) dirtyRef.current = true;
      });
      listener.blur(() => {
        flushSave();
      });
    });
    crepeRef.current = crepe;
    return crepe;
  }, []);

  useEffect(() => {
    const id = setInterval(() => flushSave(), 5000);
    return () => {
      clearInterval(id);
      flushSave();
    };
  }, []);

  return (
    <div
      className="relative flex min-w-0 flex-1 flex-col overflow-hidden"
      data-testid="div-markdown-editor"
      data-test-state={saveState}
    >
      <div className="flex-1 overflow-auto">
        <Milkdown />
      </div>
      {saveState !== "idle" && (
        <div className="pointer-events-none absolute right-3 top-2 rounded bg-background/80 px-2 py-0.5 text-xs text-muted-foreground shadow-sm">
          <span data-testid="span-save-state">{saveLabel(saveState)}</span>
        </div>
      )}
    </div>
  );
};

export const MarkdownEditor: FC<MarkdownEditorProps> = (props) => (
  <MilkdownProvider>
    <CrepeEditor {...props} />
  </MilkdownProvider>
);
