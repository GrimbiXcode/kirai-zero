import type {
  AssertionStatus,
  PreferenceDto,
  SharedPreferenceDto,
} from "shared";
import { t } from "../i18n";
import { kindLabel, statusLabel } from "../lib/labels";

type Entry = PreferenceDto | SharedPreferenceDto;

function hasVisibility(entry: Entry): entry is PreferenceDto {
  return "visibility" in entry;
}

const STATUS_STYLE: Record<AssertionStatus, string> = {
  confirmed: "bg-yes-soft text-yes",
  contradicted: "bg-no-soft text-no",
  unconfirmed: "bg-line/50 text-muted",
};

export function PreferenceRow({
  entry,
  onClick,
  status,
}: {
  entry: Entry;
  onClick?: () => void;
  /** Only for notes about a linked person; own and friends' entries have none. */
  status?: AssertionStatus | null;
}) {
  const content = (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{entry.item.name}</span>
        {status && (
          <span className={`chip ${STATUS_STYLE[status]}`}>
            {statusLabel(status)}
          </span>
        )}
        {hasVisibility(entry) && entry.visibility === "private" && (
          <span className="chip bg-line/50 text-muted">
            {t("lists.visibility.private")}
          </span>
        )}
      </div>
      <div className="mt-0.5 text-xs text-muted">
        {kindLabel(entry.item.kind)}
        {entry.note && ` · ${entry.note}`}
      </div>
    </>
  );

  if (!onClick) {
    return <li className="card">{content}</li>;
  }

  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="card w-full text-left hover:bg-accent-soft"
        aria-label={t("lists.edit")}
      >
        {content}
      </button>
    </li>
  );
}
