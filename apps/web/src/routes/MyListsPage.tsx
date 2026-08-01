import { useMemo, useState } from "react";
import { isNegative, isPositive, type ItemDto, type PreferenceDto } from "shared";
import {
  useDeletePreference,
  usePreferences,
  useUpsertPreference,
} from "../api/hooks";
import { PreferenceRow } from "../components/PreferenceRow";
import { PreferenceSheet, type PreferenceDraft } from "../components/PreferenceSheet";
import { ItemPicker } from "../components/ItemPicker";
import { Spinner } from "../components/Spinner";
import { t } from "../i18n";

interface Editing {
  item: ItemDto;
  existing?: PreferenceDto;
}

export function MyListsPage() {
  const preferences = usePreferences();
  const upsert = useUpsertPreference();
  const remove = useDeletePreference();
  const [editing, setEditing] = useState<Editing | null>(null);

  const entries = useMemo(() => preferences.data ?? [], [preferences.data]);
  const likes = entries.filter((entry) => isPositive(entry.stance));
  const dislikes = entries.filter((entry) => isNegative(entry.stance));
  const neutral = entries.filter((entry) => entry.stance === "neutral");
  const chosenItemIds = useMemo(
    () => new Set(entries.map((entry) => entry.item.id)),
    [entries],
  );

  async function save(draft: PreferenceDraft) {
    if (!editing) return;
    await upsert.mutateAsync({
      itemId: editing.item.id,
      stance: draft.stance,
      reason: draft.reason,
      note: draft.note.trim() === "" ? undefined : draft.note.trim(),
      visibility: draft.visibility,
    });
  }

  async function removeEntry() {
    if (!editing) return;
    await remove.mutateAsync(editing.item.id);
    setEditing(null);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          {t("lists.title")}
        </h1>
        <p className="mt-1 text-sm text-muted">{t("lists.intro")}</p>
      </div>

      <ItemPicker
        excludedItemIds={chosenItemIds}
        onSelect={(item) => setEditing({ item })}
      />

      {preferences.isPending ? (
        <Spinner label={t("common.loading")} />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2">
          <section aria-labelledby="likes-heading">
            <h2
              id="likes-heading"
              className="mb-2 text-sm font-semibold tracking-wide text-yes uppercase"
            >
              {t("lists.likes")}
            </h2>
            {likes.length === 0 ? (
              <p className="text-sm text-muted">{t("lists.empty.likes")}</p>
            ) : (
              <ul className="space-y-2">
                {likes.map((entry) => (
                  <PreferenceRow
                    key={entry.id}
                    entry={entry}
                    onClick={() =>
                      setEditing({ item: entry.item, existing: entry })
                    }
                  />
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="dislikes-heading">
            <h2
              id="dislikes-heading"
              className="mb-2 text-sm font-semibold tracking-wide text-no uppercase"
            >
              {t("lists.dislikes")}
            </h2>
            {dislikes.length === 0 ? (
              <p className="text-sm text-muted">{t("lists.empty.dislikes")}</p>
            ) : (
              <ul className="space-y-2">
                {dislikes.map((entry) => (
                  <PreferenceRow
                    key={entry.id}
                    entry={entry}
                    onClick={() =>
                      setEditing({ item: entry.item, existing: entry })
                    }
                  />
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      {/* "Egal" belongs to neither column, but an entry must never disappear
          just because someone answered that way. */}
      {neutral.length > 0 && (
        <section aria-labelledby="neutral-heading">
          <h2
            id="neutral-heading"
            className="mb-2 text-sm font-semibold tracking-wide text-muted uppercase"
          >
            {t("lists.neutral")}
          </h2>
          <ul className="space-y-2">
            {neutral.map((entry) => (
              <PreferenceRow
                key={entry.id}
                entry={entry}
                onClick={() => setEditing({ item: entry.item, existing: entry })}
              />
            ))}
          </ul>
        </section>
      )}

      {editing && (
        <PreferenceSheet
          item={editing.item}
          existing={editing.existing}
          onSave={(draft) => void save(draft)}
          onDelete={editing.existing ? () => void removeEntry() : undefined}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
