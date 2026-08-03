import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useRequestPasswordReset } from "../api/hooks";
import { t } from "../i18n";
import { messageFor } from "../lib/errorMessage";

/**
 * The confirmation is deliberately vague: it says a mail is on its way *if*
 * the address is registered, and says it whether or not that is true. Anything
 * more specific would turn this form into a way to find out who has an account
 * here — the same reason the API answers 204 in both cases.
 */
export function ForgotPasswordPage() {
  const request = useRequestPasswordReset();
  const [email, setEmail] = useState("");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    request.mutate(email);
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">{t("app.name")}</h1>

      {request.isSuccess ? (
        <div className="mt-8 space-y-4">
          <h2 className="text-lg font-medium">{t("auth.forgot.title")}</h2>
          <p
            role="status"
            className="rounded-xl bg-yes-soft px-3 py-2 text-sm text-yes"
          >
            {t("auth.forgot.sent")}
          </p>
          <p className="text-sm text-muted">{t("auth.forgot.sentHint")}</p>
          <p className="text-center text-sm">
            <Link className="text-accent underline" to="/">
              {t("auth.reset.toLogin")}
            </Link>
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-8 space-y-4" noValidate>
          <h2 className="text-lg font-medium">{t("auth.forgot.title")}</h2>
          <p className="text-sm text-muted">{t("auth.forgot.intro")}</p>

          <div>
            <label className="field-label" htmlFor="email">
              {t("auth.field.email")}
            </label>
            <input
              id="email"
              type="email"
              className="field-input"
              autoComplete="email"
              autoCapitalize="none"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          {request.error && (
            <p
              role="alert"
              className="rounded-xl bg-no-soft px-3 py-2 text-sm text-no"
            >
              {messageFor(request.error, "common.error")}
            </p>
          )}

          <button
            type="submit"
            className="btn-primary w-full"
            disabled={request.isPending}
          >
            {t("auth.forgot.submit")}
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
