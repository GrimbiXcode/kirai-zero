import { useEffect, useRef, useState } from "react";
import {
  STANCES,
  VISIBILITIES,
  type ItemDto,
  type PreferenceDto,
  type Stance,
  type Visibility,
} from "shared";
import { t } from "../i18n";
import { kindLabel, stanceLabel, visibilityLabel } from "../lib/labels";

export interface PreferenceDraft {
  stance: Stance;
  note: string;
  visibility: Visibility;
}

/**
 * One entry, edited in a sheet. The stance buttons save on tap, which is the
 * whole interaction for most entries; note and visibility sit below for the
 * few that need them.
 *
 * There is deliberately no field for *why* — see docs/decisions.md.
 */
export function PreferenceSheet({
  item,
  existing,
  onSave,
  onDelete,
  onClose,
}: {
  item: ItemDto;
  existing?: PreferenceDto;
  onSave: (draft: PreferenceDraft) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [stance, setStance] = useState<Stance>(existing?.stance ?? "like");
  const [note, setNote] = useState(existing?.note ?? "");
  const [visibility, setVisibility] = useState<Visibility>(
    existing?.visibility ?? "friends",
  );
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dialogRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  function save(next: Partial<PreferenceDraft> = {}) {
    onSave({ stance, note, visibility, ...next });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/30 sm:items-center">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={item.name}
        tabIndex={-1}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-paper p-4 pb-8 outline-none sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">{item.name}</h2>
            <p className="text-sm text-muted">{kindLabel(item.kind)}</p>
          </div>
          <button type="button" className="btn-ghost" onClick={onClose}>
            {t("common.close")}
          </button>
        </div>

        <fieldset className="mt-5">
          <legend className="field-label">{t("lists.stanceLabel")}</legend>
          <div className="flex flex-wrap gap-2">
            {STANCES.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={stance === option}
                onClick={() => {
                  setStance(option);
                  // Save straight away: this is the whole interaction for most
                  // entries, and a separate confirm step would double the work.
                  save({ stance: option });
                }}
                className={`btn ${
                  stance === option
                    ? "bg-accent text-white"
                    : "border border-line bg-white text-ink hover:bg-accent-soft"
                }`}
              >
                {stanceLabel(option)}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="mt-5">
          <label className="field-label" htmlFor="note">
            {t("lists.noteLabel")}{" "}
            <span className="font-normal text-muted">
              ({t("common.optional")})
            </span>
          </label>
          <input
            id="note"
            className="field-input"
            maxLength={280}
            placeholder={t("lists.notePlaceholder")}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            onBlur={() => save()}
          />
        </div>

        <fieldset className="mt-5">
          <legend className="field-label">{t("lists.visibilityLabel")}</legend>
          <div className="flex flex-wrap gap-2">
            {VISIBILITIES.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={visibility === option}
                onClick={() => {
                  setVisibility(option);
                  save({ visibility: option });
                }}
                className={`chip border ${
                  visibility === option
                    ? "border-accent bg-accent-soft text-accent"
                    : "border-line bg-white text-muted"
                }`}
              >
                {visibilityLabel(option)}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="mt-6 flex gap-2">
          <button
            type="button"
            className="btn-primary flex-1"
            onClick={() => {
              save();
              onClose();
            }}
          >
            {t("common.save")}
          </button>
          {onDelete && (
            <button type="button" className="btn-danger" onClick={onDelete}>
              {t("lists.remove")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
