import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ApiError } from "../api/client";
import {
  useDeletePerson,
  useFriends,
  useLinkPerson,
  usePerson,
  useUnlinkPerson,
  useUpdatePerson,
} from "../api/hooks";
import { PersonNotes } from "../components/PersonNotes";
import { Spinner } from "../components/Spinner";
import { hasTranslation, t } from "../i18n";

export function PersonPage() {
  const { personId = "" } = useParams();
  const navigate = useNavigate();
  const person = usePerson(personId);
  const update = useUpdatePerson(personId);
  const link = useLinkPerson(personId);
  const unlink = useUnlinkPerson(personId);
  const remove = useDeletePerson();
  const friends = useFriends();

  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");

  if (person.isPending) return <Spinner label={t("common.loading")} />;
  if (person.isError || !person.data) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted">{t("profile.notFound")}</p>
        <Link className="btn-secondary" to="/freunde">
          {t("common.back")}
        </Link>
      </div>
    );
  }

  const data = person.data;

  async function submitRename(event: FormEvent) {
    event.preventDefault();
    await update.mutateAsync({ displayName: name });
    setRenaming(false);
  }

  async function submitLink(event: FormEvent) {
    event.preventDefault();
    await link.mutateAsync(handle);
    setHandle("");
  }

  // The key is assembled from an API error code, so it has to be narrowed
  // before `t` will accept it.
  const linkErrorKey =
    link.error instanceof ApiError ? `persons.error.${link.error.code}` : null;
  const linkError =
    linkErrorKey && hasTranslation(linkErrorKey) ? t(linkErrorKey) : null;

  return (
    <div className="space-y-6">
      <div>
        <Link className="text-sm text-accent underline" to="/freunde">
          {t("common.back")}
        </Link>

        {renaming ? (
          <form onSubmit={submitRename} className="mt-2 flex gap-2">
            <input
              className="field-input"
              aria-label={t("persons.rename")}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <button type="submit" className="btn-primary">
              {t("common.save")}
            </button>
          </form>
        ) : (
          <div className="mt-2 flex items-center justify-between gap-3">
            <h1 className="text-xl font-semibold tracking-tight">
              {t("persons.title", { name: data.displayName })}
            </h1>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setName(data.displayName);
                setRenaming(true);
              }}
            >
              {t("persons.rename")}
            </button>
          </div>
        )}

        <p className="mt-1 text-sm text-muted">
          {t("persons.intro", { name: data.displayName })}
        </p>
      </div>

      <section
        aria-labelledby="person-link-heading"
        className="card space-y-2"
      >
        <h2 id="person-link-heading" className="text-sm font-semibold">
          {data.linkedUser
            ? t("persons.linkedTo", { handle: data.linkedUser.handle })
            : t("persons.notLinked")}
        </h2>

        {data.linkedUser ? (
          <button
            type="button"
            className="btn-secondary"
            onClick={() => unlink.mutate(undefined as never)}
          >
            {t("persons.unlink")}
          </button>
        ) : (
          <>
            <p className="text-sm text-muted">{t("persons.linkHint")}</p>
            {friends.data?.length === 0 ? (
              <p className="text-sm text-muted">{t("persons.linkNoFriends")}</p>
            ) : (
              <form onSubmit={submitLink} className="flex gap-2">
                <label className="sr-only" htmlFor="link-handle">
                  {t("persons.link")}
                </label>
                <select
                  id="link-handle"
                  className="field-input"
                  value={handle}
                  onChange={(event) => setHandle(event.target.value)}
                >
                  <option value="">—</option>
                  {friends.data?.map((friend) => (
                    <option key={friend.user.id} value={friend.user.handle}>
                      {friend.user.displayName} (@{friend.user.handle})
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={handle === "" || link.isPending}
                >
                  {t("persons.linkSubmit")}
                </button>
              </form>
            )}
            {linkError && (
              <p role="alert" className="text-sm text-no">
                {linkError}
              </p>
            )}
          </>
        )}
      </section>

      <PersonNotes
        personId={data.id}
        entries={data.entries}
        subjectName={data.displayName}
      />

      <button
        type="button"
        className="btn-danger w-full"
        onClick={() => {
          const confirmed = window.confirm(
            t("persons.deleteConfirm", { name: data.displayName }),
          );
          if (confirmed) {
            remove.mutate(data.id, { onSuccess: () => navigate("/freunde") });
          }
        }}
      >
        {t("persons.delete")}
      </button>
    </div>
  );
}
