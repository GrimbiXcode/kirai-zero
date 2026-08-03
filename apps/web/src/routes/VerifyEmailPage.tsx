import { useEffect, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useVerifyEmail } from "../api/hooks";
import { Spinner } from "../components/Spinner";
import { t } from "../i18n";
import { messageFor } from "../lib/errorMessage";

/**
 * Redeems the confirmation link. Works signed in or signed out — the token
 * identifies the account on its own, and someone who opens the mail on a
 * different device should not have to sign in first.
 */
export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const verify = useVerifyEmail();
  const { mutate } = verify;

  // The token is single use, so React's development double-invoke must not
  // spend it twice — the second call would report the first one's success as
  // an invalid token.
  const attempted = useRef(false);
  useEffect(() => {
    if (token === "" || attempted.current) return;
    attempted.current = true;
    mutate(token);
  }, [token, mutate]);

  const running = token !== "" && !verify.isSuccess && !verify.isError;

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">{t("app.name")}</h1>
      <h2 className="mt-8 text-lg font-medium">{t("auth.verify.title")}</h2>

      <div className="mt-4 space-y-4">
        {running && <Spinner label={t("common.loading")} />}

        {verify.isSuccess && (
          <p
            role="status"
            className="rounded-xl bg-yes-soft px-3 py-2 text-sm text-yes"
          >
            {t("auth.verify.done")}
          </p>
        )}

        {(token === "" || verify.isError) && (
          <p role="alert" className="rounded-xl bg-no-soft px-3 py-2 text-sm text-no">
            {token === "" ? t("auth.verify.noToken") : messageFor(verify.error, "common.error")}
          </p>
        )}

        {!running && (
          <p className="text-center text-sm">
            <Link className="text-accent underline" to="/">
              {t("auth.verify.continue")}
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
