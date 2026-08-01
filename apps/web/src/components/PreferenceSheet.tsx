import { useEffect, useRef, useState } from "react";
import {
  isHealthCritical,
  REASONS,
  STANCES,
  VISIBILITIES,
  type ItemDto,
  type PreferenceDto,
  type Reason,
  type Stance,
  type Visibility,
} from "shared";
import { t } from "../i18n";
import { kindLabel, reasonLabel, stanceLabel, visibilityLabel } from "../lib/labels";

export interface PreferenceDraft {
  stance: Stance;
  reason: Reason;
  note: string;
  visibility: Visibility;
}

/**
 * One entry, edited in a sheet. The stance buttons save on tap so the common
 * case — "I do not like this, that is all" — takes a single interaction;
 * reason, note and visibility sit below for the cases that need them.
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
  const [reason, setReason] = useState<Reason>(existing?.reason ?? "taste");
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
    onSave({ stance, reason, note, visibility, ...next });
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

        <fieldset className="mt-5">
          <legend className="field-label">{t("lists.reasonLabel")}</legend>
          <div className="flex flex-wrap gap-2">
            {REASONS.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={reason === option}
                onClick={() => {
                  setReason(option);
                  save({ reason: option });
                }}
                className={`chip border ${
                  reason === option
                    ? "border-accent bg-accent-soft text-accent"
                    : "border-line bg-white text-muted"
                }`}
              >
                {reasonLabel(option)}
              </button>
            ))}
          </div>
          {isHealthCritical(reason) && (
            // Health data under Art. 9 GDPR: the consent has to be visible at
            // the moment it is given, not buried in a privacy statement.
            <p className="mt-2 rounded-xl bg-accent-soft px-3 py-2 text-xs text-ink">
              {t("lists.healthConsent")}
            </p>
          )}
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
