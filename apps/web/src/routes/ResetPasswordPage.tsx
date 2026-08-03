import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useConfirmPasswordReset } from "../api/hooks";
import { t } from "../i18n";
import { messageFor } from "../lib/errorMessage";

/**
 * The token arrives in the query string and is posted from here rather than
 * being redeemed by opening the link itself: a GET would be triggered by the
 * scanners and link previews that sit between a mail server and an inbox, and
 * the token only works once.
 */
export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const confirm = useConfirmPasswordReset();
  const [password, setPassword] = useState("");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    confirm.mutate(
      { token, password },
      {
        // Every session ended with the reset, this one included — signing in
        // again is the point, not an inconvenience.
        onSuccess: () => navigate("/", { replace: true }),
      },
    );
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">{t("app.name")}</h1>

      {token === "" ? (
        <div className="mt-8 space-y-4">
          <h2 className="text-lg font-medium">{t("auth.reset.title")}</h2>
          <p role="alert" className="rounded-xl bg-no-soft px-3 py-2 text-sm text-no">
            {t("auth.reset.noToken")}
          </p>
          <p className="text-center text-sm">
            <Link className="text-accent underline" to="/passwort-vergessen">
              {t("auth.reset.retry")}
            </Link>
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-8 space-y-4" noValidate>
          <h2 className="text-lg font-medium">{t("auth.reset.title")}</h2>
          <p className="text-sm text-muted">{t("auth.reset.intro")}</p>

          <div>
            <label className="field-label" htmlFor="password">
              {t("auth.reset.newPassword")}
            </label>
            <input
              id="password"
              type="password"
              className="field-input"
              autoComplete="new-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <p className="field-hint">{t("auth.password.hint")}</p>
          </div>

          {confirm.error && (
            <div
              role="alert"
              className="rounded-xl bg-no-soft px-3 py-2 text-sm text-no"
            >
              <p>{messageFor(confirm.error, "common.error")}</p>
              <p className="mt-1">
                <Link className="underline" to="/passwort-vergessen">
                  {t("auth.reset.retry")}
                </Link>
              </p>
            </div>
          )}

          <button
            type="submit"
            className="btn-primary w-full"
            disabled={confirm.isPending}
          >
            {t("auth.reset.submit")}
          </button>

          <p className="text-center text-sm">
            <Link className="text-accent underline" to="/">
              {t("auth.reset.toLogin")}
            </Link>
          </p>
        </form>
      )}
    </div>
  );
}
