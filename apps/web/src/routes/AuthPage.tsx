import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiError } from "../api/client";
import { useLogin, useRegister } from "../api/hooks";
import { hasTranslation, t } from "../i18n";

/** Maps the API's stable error codes onto translated messages, falling back to
 *  a generic one for codes this screen does not know about. */
function messageFor(error: unknown): string {
  if (error instanceof ApiError) {
    const key = `auth.error.${error.code}`;
    if (hasTranslation(key)) return t(key);
  }
  return t("auth.error.generic");
}

export function AuthPage({ mode }: { mode: "login" | "register" }) {
  const navigate = useNavigate();
  const login = useLogin();
  const register = useRegister();
  const pending = login.isPending || register.isPending;
  const error = login.error ?? register.error;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (mode === "login") {
      await login.mutateAsync({ email, password });
    } else {
      await register.mutateAsync({ email, password, handle, displayName });
    }
    navigate("/");
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">{t("app.name")}</h1>
      <p className="mt-1 text-sm text-muted">{t("app.tagline")}</p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4" noValidate>
        <h2 className="text-lg font-medium">
          {mode === "login" ? t("auth.login.title") : t("auth.register.title")}
        </h2>

        {mode === "register" && (
          <>
            <div>
              <label className="field-label" htmlFor="displayName">
                {t("auth.field.displayName")}
              </label>
              <input
                id="displayName"
                className="field-input"
                autoComplete="name"
                required
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
              />
            </div>
            <div>
              <label className="field-label" htmlFor="handle">
                {t("auth.field.handle")}
              </label>
              <input
                id="handle"
                className="field-input"
                autoComplete="username"
                autoCapitalize="none"
                required
                value={handle}
                onChange={(event) => setHandle(event.target.value)}
              />
              <p className="field-hint">{t("auth.handle.hint")}</p>
            </div>
          </>
        )}

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

        <div>
          <label className="field-label" htmlFor="password">
            {t("auth.field.password")}
          </label>
          <input
            id="password"
            type="password"
            className="field-input"
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {mode === "register" && (
            <p className="field-hint">{t("auth.password.hint")}</p>
          )}
        </div>

        {error && (
          <p role="alert" className="rounded-xl bg-no-soft px-3 py-2 text-sm text-no">
            {messageFor(error)}
          </p>
        )}

        <button type="submit" className="btn-primary w-full" disabled={pending}>
          {mode === "login" ? t("auth.login.submit") : t("auth.register.submit")}
        </button>

        <p className="text-center text-sm">
          {mode === "login" ? (
            <Link className="text-accent underline" to="/registrieren">
              {t("auth.login.toRegister")}
            </Link>
          ) : (
            <Link className="text-accent underline" to="/">
              {t("auth.register.toLogin")}
            </Link>
          )}
        </p>
      </form>

      <p className="mt-8 text-xs text-muted">{t("auth.privacyNote")}</p>
    </div>
  );
}
