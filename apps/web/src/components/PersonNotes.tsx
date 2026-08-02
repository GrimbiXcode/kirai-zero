import { useMemo, useState } from "react";
import {
  isNegative,
  isPositive,
  type ItemDto,
  type PersonEntryDto,
} from "shared";
import { useDeletePersonEntry, useUpsertPersonEntry } from "../api/hooks";
import { ItemPicker } from "./ItemPicker";
import { PreferenceRow } from "./PreferenceRow";
import { PreferenceSheet, type PreferenceDraft } from "./PreferenceSheet";
import { t } from "../i18n";

interface Editing {
  item: ItemDto;
  existing?: PersonEntryDto;
}

/**
 * The note editor for one person, shared by the person page and the notes
 * block on a friend's profile — the two differ only in what surrounds them.
 */
export function PersonNotes({
  personId,
  entries,
  subjectName,
  labelledBy,
}: {
  personId: string;
  entries: PersonEntryDto[];
  /** Whose preferences these guesses are about — the headings say so, or they
   *  read as if the owner were talking about themselves. */
  subjectName: string;
  labelledBy?: string;
}) {
  const upsert = useUpsertPersonEntry();
  const remove = useDeletePersonEntry();
  const [editing, setEditing] = useState<Editing | null>(null);

  const chosenItemIds = useMemo(
    () => new Set(entries.map((entry) => entry.item.id)),
    [entries],
  );
  const likes = entries.filter((entry) => isPositive(entry.stance));
  const dislikes = entries.filter((entry) => isNegative(entry.stance));
  const neutral = entries.filter((entry) => entry.stance === "neutral");

  async function save(draft: PreferenceDraft) {
    if (!editing) return;
    await upsert.mutateAsync({
      personId,
      itemId: editing.item.id,
      stance: draft.stance,
      note: draft.note.trim() === "" ? undefined : draft.note.trim(),
    });
  }

  async function removeEntry() {
    if (!editing) return;
    await remove.mutateAsync({ personId, itemId: editing.item.id });
    setEditing(null);
  }

  const group = (title: string, rows: PersonEntryDto[], tone: string) =>
    rows.length === 0 ? null : (
      <section>
        <h3 className={`mb-2 text-sm font-semibold tracking-wide uppercase ${tone}`}>
          {title}
        </h3>
        <ul className="space-y-2">
          {rows.map((entry) => (
            <PreferenceRow
              key={entry.id}
              entry={entry}
              status={entry.status}
              onClick={() => setEditing({ item: entry.item, existing: entry })}
            />
          ))}
        </ul>
      </section>
    );

  return (
    <div className="space-y-4" aria-labelledby={labelledBy}>
      <ItemPicker
        excludedItemIds={chosenItemIds}
        onSelect={(item) => setEditing({ item })}
      />

      {entries.length === 0 ? (
        <p className="text-sm text-muted">{t("persons.notesEmpty")}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {group(t("profile.likes", { name: subjectName }), likes, "text-yes")}
          {group(
            t("profile.dislikes", { name: subjectName }),
            dislikes,
            "text-no",
          )}
          {group(t("lists.neutral"), neutral, "text-muted")}
        </div>
      )}

      {editing && (
        <PreferenceSheet
          item={editing.item}
          existing={
            editing.existing
              ? { ...editing.existing, visibility: "private" }
              : undefined
          }
          showVisibility={false}
          onSave={(draft) => void save(draft)}
          onDelete={editing.existing ? () => void removeEntry() : undefined}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
