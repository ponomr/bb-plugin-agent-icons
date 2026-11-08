import { useMemo, useState, type ReactNode } from "react";
import { Input } from "../../../components/ui/input";
import { cn } from "../../../lib/utils";
import { useStrings } from "../strings";

export interface GridItem {
  id: string;
  name: string;
  render: () => ReactNode;
}

const FILTER_FROM = 30;

/** Square buttons of at least 44 px, labelled by the icon name; a filter appears for big sets. */
export function IconGrid({
  items,
  selected,
  onSelect,
  empty,
}: {
  items: readonly GridItem[];
  selected: string | undefined;
  onSelect: (item: GridItem) => void;
  empty: string;
}) {
  const s = useStrings();
  const [filter, setFilter] = useState("");
  const shown = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    return needle ? items.filter((i) => i.name.toLowerCase().includes(needle)) : items;
  }, [items, filter]);

  if (items.length === 0) return <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>;

  return (
    <div className="flex flex-col gap-2">
      {items.length > FILTER_FROM ? (
        <Input aria-label={s.filterByName} placeholder={s.filterByName} value={filter} onChange={(e) => setFilter(e.target.value)} />
      ) : null}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(44px,1fr))] gap-1">
        {shown.map((item) => (
          <button
            key={item.id}
            type="button"
            title={item.name}
            aria-label={item.name}
            aria-pressed={item.id === selected}
            onClick={() => onSelect(item)}
            className={cn(
              "flex size-11 items-center justify-center rounded-md border border-transparent text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              item.id === selected && "border-primary bg-accent",
            )}
          >
            {item.render()}
          </button>
        ))}
      </div>
      {shown.length === 0 ? <p className="text-center text-sm text-muted-foreground">{s.nothingFound}</p> : null}
    </div>
  );
}
