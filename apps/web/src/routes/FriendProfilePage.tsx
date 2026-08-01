import { Link, useParams } from "react-router-dom";
import { useFriendProfile } from "../api/hooks";
import { PreferenceRow } from "../components/PreferenceRow";
import { Spinner } from "../components/Spinner";
import { t } from "../i18n";

export function FriendProfilePage() {
  const { userId = "" } = useParams();
  const profile = useFriendProfile(userId);

  if (profile.isPending) return <Spinner label={t("common.loading")} />;

  // A missing friendship is answered with 404 by the API, which is also the
  // right message here: this profile is simply not visible to you.
  if (profile.isError || !profile.data) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted">{t("profile.notFound")}</p>
        <Link className="btn-secondary" to="/freunde">
          {t("common.back")}
        </Link>
      </div>
    );
  }

  const { user, likes, dislikes } = profile.data;

  return (
    <div className="space-y-6">
      <div>
        <Link className="text-sm text-accent underline" to="/freunde">
          {t("common.back")}
        </Link>
        <h1 className="mt-2 text-xl font-semibold tracking-tight">
          {user.displayName}
        </h1>
        <p className="text-sm text-muted">@{user.handle}</p>
        <p className="mt-2 text-sm text-muted">{t("profile.giftHint")}</p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <section aria-labelledby="profile-likes-heading">
          <h2
            id="profile-likes-heading"
            className="mb-2 text-sm font-semibold tracking-wide text-yes uppercase"
          >
            {t("profile.likes", { name: user.displayName })}
          </h2>
          {likes.length === 0 ? (
            <p className="text-sm text-muted">
              {t("profile.emptyLikes", { name: user.displayName })}
            </p>
          ) : (
            <ul className="space-y-2">
              {likes.map((entry) => (
                <PreferenceRow key={entry.id} entry={entry} />
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="profile-dislikes-heading">
          <h2
            id="profile-dislikes-heading"
            className="mb-2 text-sm font-semibold tracking-wide text-no uppercase"
          >
            {t("profile.dislikes", { name: user.displayName })}
          </h2>
          {dislikes.length === 0 ? (
            <p className="text-sm text-muted">{t("profile.emptyDislikes")}</p>
          ) : (
            <ul className="space-y-2">
              {dislikes.map((entry) => (
                <PreferenceRow key={entry.id} entry={entry} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
