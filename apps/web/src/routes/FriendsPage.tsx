import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  useAcceptFriendRequest,
  useCancelFriendRequest,
  useDeclineFriendRequest,
  useFriendRequests,
  useFriends,
  useRemoveFriend,
  useSendFriendRequest,
  useUserSearch,
} from "../api/hooks";
import { Spinner } from "../components/Spinner";
import { formatDate, t } from "../i18n";

export function FriendsPage() {
  const [handleInput, setHandleInput] = useState("");
  const [submittedHandle, setSubmittedHandle] = useState("");

  const friends = useFriends();
  const requests = useFriendRequests();
  const search = useUserSearch(submittedHandle);
  const sendRequest = useSendFriendRequest();
  const accept = useAcceptFriendRequest();
  const decline = useDeclineFriendRequest();
  const cancel = useCancelFriendRequest();
  const removeFriend = useRemoveFriend();

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    setSubmittedHandle(handleInput.trim().toLowerCase());
  }

  const found = search.data?.[0];

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-xl font-semibold tracking-tight">
          {t("friends.title")}
        </h1>

        <form onSubmit={submitSearch} className="mt-4 flex gap-2">
          <div className="flex-1">
            <label className="sr-only" htmlFor="friend-handle">
              {t("friends.search.label")}
            </label>
            <input
              id="friend-handle"
              className="field-input"
              autoCapitalize="none"
              autoComplete="off"
              placeholder={t("friends.search.placeholder")}
              value={handleInput}
              onChange={(event) => setHandleInput(event.target.value)}
            />
          </div>
          <button type="submit" className="btn-secondary">
            {t("friends.search.submit")}
          </button>
        </form>

        {submittedHandle.length >= 2 && search.isFetched && (
          <div className="mt-3">
            {!found ? (
              <p className="text-sm text-muted">
                {t("friends.search.notFound")}
              </p>
            ) : (
              <div className="card flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{found.user.displayName}</p>
                  <p className="text-sm text-muted">@{found.user.handle}</p>
                </div>
                {found.relation === "none" ? (
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={sendRequest.isPending}
                    onClick={() => sendRequest.mutate(found.user.handle)}
                  >
                    {t("friends.add")}
                  </button>
                ) : (
                  <span className="text-sm text-muted">
                    {t(`friends.relation.${found.relation}`)}
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      {(requests.data?.incoming.length ?? 0) > 0 && (
        <section aria-labelledby="incoming-requests-heading">
          <h2
            id="incoming-requests-heading"
            className="mb-2 text-sm font-semibold tracking-wide text-muted uppercase"
          >
            {t("friends.requests.incoming")}
          </h2>
          <ul className="space-y-2">
            {requests.data?.incoming.map((entry) => (
              <li key={entry.id} className="card flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{entry.user.displayName}</p>
                  <p className="text-sm text-muted">@{entry.user.handle}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => accept.mutate(entry.id)}
                  >
                    {t("friends.accept")}
                  </button>
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => decline.mutate(entry.id)}
                  >
                    {t("friends.decline")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(requests.data?.outgoing.length ?? 0) > 0 && (
        <section aria-labelledby="outgoing-requests-heading">
          <h2
            id="outgoing-requests-heading"
            className="mb-2 text-sm font-semibold tracking-wide text-muted uppercase"
          >
            {t("friends.requests.outgoing")}
          </h2>
          <ul className="space-y-2">
            {requests.data?.outgoing.map((entry) => (
              <li key={entry.id} className="card flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{entry.user.displayName}</p>
                  <p className="text-sm text-muted">@{entry.user.handle}</p>
                </div>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => cancel.mutate(entry.id)}
                >
                  {t("friends.cancel")}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="friends-list-heading">
        <h2
          id="friends-list-heading"
          className="mb-2 text-sm font-semibold tracking-wide text-muted uppercase"
        >
          {t("friends.list")}
        </h2>
        {friends.isPending ? (
          <Spinner label={t("common.loading")} />
        ) : friends.data?.length === 0 ? (
          <p className="text-sm text-muted">{t("friends.empty")}</p>
        ) : (
          <ul className="space-y-2">
            {friends.data?.map((friend) => (
              <li key={friend.user.id} className="card">
                <div className="flex items-center justify-between gap-3">
                  <Link
                    to={`/freunde/${friend.user.id}`}
                    className="flex-1"
                    aria-label={t("friends.view")}
                  >
                    <p className="font-medium">{friend.user.displayName}</p>
                    <p className="text-sm text-muted">
                      @{friend.user.handle} ·{" "}
                      {t("friends.since", {
                        date: formatDate(friend.friendsSince),
                      })}
                    </p>
                  </Link>
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => {
                      const confirmed = window.confirm(
                        t("friends.removeConfirm", {
                          name: friend.user.displayName,
                        }),
                      );
                      if (confirmed) removeFriend.mutate(friend.user.id);
                    }}
                  >
                    {t("friends.remove")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
