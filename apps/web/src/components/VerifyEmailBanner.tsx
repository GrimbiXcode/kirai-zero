import { useResendVerification } from "../api/hooks";
import { t } from "../i18n";

/**
 * A reminder, never a barrier: nothing in the app is locked behind the
 * confirmation. It exists so a mistyped address turns up now, while the person
 * is still here to fix it, rather than the day they need it to get back in.
 */
export function VerifyEmailBanner() {
  const resend = useResendVerification();

  return (
    <div className="mx-4 mb-2 rounded-2xl border border-line bg-accent-soft px-4 py-3 text-sm">
      <p>{t("auth.banner.unverified")}</p>
      {resend.isSuccess ? (
        <p role="status" className="mt-2 text-muted">
          {t("auth.banner.resent")}
        </p>
      ) : (
        <button
          type="button"
          className="mt-2 underline"
          disabled={resend.isPending}
          onClick={() => resend.mutate()}
        >
          {t("auth.banner.resend")}
        </button>
      )}
      {resend.isError && (
        <p role="alert" className="mt-2 text-no">
          {t("auth.banner.resendFailed")}
        </p>
      )}
    </div>
  );
}
