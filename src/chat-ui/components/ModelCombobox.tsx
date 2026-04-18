import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { BodhiModelInfo } from "@/lib/bodhi-models";
import type { ApiFormat } from "@bodhiapp/bodhi-js-react/api";

interface ModelComboboxProps {
  models: BodhiModelInfo[];
  selected: string;
  onSelect: (id: string, fmt: ApiFormat) => void;
  disabled?: boolean;
}

function subsequenceMatch(text: string, query: string): boolean {
  let i = 0;
  for (const ch of text) {
    if (ch === query[i]) i++;
    if (i === query.length) return true;
  }
  return false;
}

export default function ModelCombobox({
  models,
  selected,
  onSelect,
  disabled,
}: ModelComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const activeRef = useRef<HTMLButtonElement | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return models;
    return models.filter((m) => subsequenceMatch(m.id.toLowerCase(), q));
  }, [models, search]);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const commit = (m: BodhiModelInfo) => {
    onSelect(m.id, m.apiFormat);
    setSearch("");
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        setActiveIndex(0);
        if (!next) setSearch("");
      }}
    >
      <PopoverTrigger
        data-testid="model-selector"
        disabled={disabled || models.length === 0}
        className={cn(
          "inline-flex h-8 items-center justify-between gap-1.5 rounded-md border border-input bg-background px-2.5 text-sm font-normal",
          "hover:bg-muted disabled:pointer-events-none disabled:opacity-50",
          "w-[180px]",
        )}
      >
        <span className="truncate text-xs">{selected || "No models"}</span>
        <ChevronsUpDown className="ml-1 size-3.5 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-[240px] p-0" align="end">
        <div className="p-2 border-b">
          <Input
            data-testid="model-search-input"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={(e) => {
              if (filtered.length === 0) return;
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActiveIndex((i) => (i + 1) % filtered.length);
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActiveIndex((i) => (i - 1 + filtered.length) % filtered.length);
              } else if (e.key === "Enter") {
                e.preventDefault();
                const idx = Math.min(activeIndex, filtered.length - 1);
                commit(filtered[idx]);
              }
            }}
            placeholder="Search models..."
            className="h-8"
            autoFocus
          />
        </div>
        <div className="max-h-64 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <div
              data-testid="model-option-empty"
              className="px-2 py-1.5 text-sm text-muted-foreground"
            >
              No models match
            </div>
          ) : (
            filtered.map((m, idx) => (
              <button
                key={m.id}
                ref={idx === activeIndex ? activeRef : null}
                type="button"
                role="option"
                aria-selected={selected === m.id}
                data-testid={`model-option-${m.id}`}
                data-active={idx === activeIndex ? "true" : undefined}
                onMouseEnter={() => setActiveIndex(idx)}
                onClick={() => commit(m)}
                className={cn(
                  "flex w-full items-center justify-between px-2 py-1.5 text-sm text-left",
                  idx === activeIndex ? "bg-accent" : selected === m.id && "bg-muted",
                )}
              >
                <span className="truncate">{m.id}</span>
                {selected === m.id && <Check className="size-4 shrink-0 opacity-70" />}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
