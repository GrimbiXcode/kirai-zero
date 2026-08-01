import { useEffect, useRef, useState } from "react";
import {
  isSpecialCategory,
  REASONS,
  STANCES,
  VISIBILITIES,
  type ItemDto,
  type PreferenceDto,
  type Reason,
  type Stance,
  type Visibility,
} from "shared";
import { formatDate, t } from "../i18n";
import { kindLabel, reasonLabel, stanceLabel, visibilityLabel } from "../lib/labels";

export interface PreferenceDraft {
  stance: Stance;
  reason: Reason;
  note: string;
  visibility: Visibility;
  consentGiven: boolean;
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
  const [consentGiven, setConsentGiven] = useState(
    existing?.consentedAt != null,
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

  const draft: PreferenceDraft = {
    stance,
    reason,
    note,
    visibility,
    consentGiven,
  };
  /** A special-category reason may not be stored before consent is given. */
  const isSavable = (candidate: PreferenceDraft) =>
    !isSpecialCategory(candidate.reason) || candidate.consentGiven;

  /**
   * Saves the merged draft, unless it is one the server would rightly refuse.
   * Silently skipping is correct here: the affected controls stay visible and
   * the sheet explains why saving is blocked.
   */
  function save(next: Partial<PreferenceDraft> = {}) {
    const merged = { ...draft, ...next };
    if (!isSavable(merged)) return;
    onSave(merged);
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
        </fieldset>

        {/*
          Art. 9(2)(a) GDPR asks for an explicit declaration, not merely an
          unambiguous action. A notice next to the reason buttons would not be
          one, so this is a separate, unticked checkbox that gates saving —
          and it appears at the moment the choice is made, not in a policy
          document nobody opens.
        */}
        {isSpecialCategory(reason) && (
          <section className="mt-4 rounded-xl border border-accent/30 bg-accent-soft p-3">
            <h3 className="text-sm font-semibold">{t("lists.consentTitle")}</h3>
            <p className="mt-1 text-xs text-ink">{t("lists.consentIntro")}</p>
            <label className="mt-3 flex items-start gap-2 text-xs text-ink">
              <input
                type="checkbox"
                className="mt-0.5 size-4 shrink-0 accent-[var(--color-accent)]"
                checked={consentGiven}
                onChange={(event) => {
                  const next = event.target.checked;
                  setConsentGiven(next);
                  if (next) save({ consentGiven: next });
                }}
              />
              <span>{t("lists.consentCheckbox")}</span>
            </label>
            <p className="mt-2 text-xs text-muted">{t("lists.consentDetails")}</p>
            {existing?.consentedAt && consentGiven && (
              <p className="mt-2 text-xs text-muted">
                {t("lists.consentGivenAt", {
                  date: formatDate(existing.consentedAt),
                })}
              </p>
            )}
            {!consentGiven && (
              <p role="alert" className="mt-2 text-xs font-medium text-no">
                {t("lists.consentRequired")}
              </p>
            )}
          </section>
        )}

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
            disabled={!isSavable(draft)}
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
