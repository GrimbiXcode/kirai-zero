import type { PreferenceDto, SharedPreferenceDto } from "shared";
import { t } from "../i18n";
import { kindLabel } from "../lib/labels";

type Entry = PreferenceDto | SharedPreferenceDto;

function hasVisibility(entry: Entry): entry is PreferenceDto {
  return "visibility" in entry;
}

export function PreferenceRow({
  entry,
  onClick,
}: {
  entry: Entry;
  onClick?: () => void;
}) {
  const content = (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{entry.item.name}</span>
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
