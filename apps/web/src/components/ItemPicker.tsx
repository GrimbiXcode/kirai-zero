import { useState } from "react";
import { ITEM_KINDS, slugify, type ItemDto, type ItemKind } from "shared";
import { useCreateItem, useItemSearch } from "../api/hooks";
import { t } from "../i18n";
import { kindLabel } from "../lib/labels";

/**
 * Search box over the shared catalogue with a fallback for things it does not
 * know yet. Picking an existing entry is one tap; creating one asks for the
 * kind, because that is what keeps "Schokolade the food" and "Schokolade the
 * gift" from collapsing into each other.
 */
export function ItemPicker({
  onSelect,
  excludedItemIds,
}: {
  onSelect: (item: ItemDto) => void;
  excludedItemIds: Set<string>;
}) {
  const [query, setQuery] = useState("");
  const results = useItemSearch(query);
  const createItem = useCreateItem();

  const trimmed = query.trim();
  const visible = (results.data ?? []).filter(
    (item) => !excludedItemIds.has(item.id),
  );
  const hasExactMatch = (results.data ?? []).some(
    (item) => item.slug === slugify(trimmed),
  );

  function choose(item: ItemDto) {
    setQuery("");
    onSelect(item);
  }

  async function create(kind: ItemKind) {
    const response = await createItem.mutateAsync({ name: trimmed, kind });
    choose(response.item);
  }

  return (
    <div>
      <label className="field-label" htmlFor="item-search">
        {t("lists.search.label")}
      </label>
      <input
        id="item-search"
        className="field-input"
        type="search"
        autoComplete="off"
        placeholder={t("lists.search.placeholder")}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />

      {trimmed.length >= 2 && (
        <div className="mt-2 space-y-1">
          {visible.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => choose(item)}
              className="flex w-full items-center justify-between rounded-xl border border-line bg-white px-3 py-2.5 text-left hover:bg-accent-soft"
            >
              <span>{item.name}</span>
              <span className="chip bg-line/50 text-muted">
                {kindLabel(item.kind)}
              </span>
            </button>
          ))}

          {results.isFetched && visible.length === 0 && (
            <p className="px-1 py-2 text-sm text-muted">
              {t("lists.search.noResults")}
            </p>
          )}

          {results.isFetched && !hasExactMatch && (
            <div className="rounded-xl border border-dashed border-line p-3">
              <p className="text-sm text-muted">
                {t("lists.create", { name: trimmed })}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {ITEM_KINDS.map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    className="chip border border-line bg-white hover:bg-accent-soft"
                    disabled={createItem.isPending}
                    onClick={() => void create(kind)}
                  >
                    {kindLabel(kind)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
