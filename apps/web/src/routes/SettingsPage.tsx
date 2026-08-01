import { useState } from "react";
import { api } from "../api/client";
import { useDeleteAccount, useLogout, useSession } from "../api/hooks";
import { t } from "../i18n";

export function SettingsPage() {
  const session = useSession();
  const logout = useLogout();
  const deleteAccount = useDeleteAccount();
  const [exporting, setExporting] = useState(false);

  /**
   * Fetched rather than linked: the native build authenticates with a bearer
   * header, which a plain download link cannot carry.
   */
  async function downloadExport() {
    setExporting(true);
    try {
      const data = await api<unknown>("/api/me/export");
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "kirai-zero-export.json";
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold tracking-tight">
        {t("settings.title")}
      </h1>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">
          {t("settings.account")}
        </h2>
        <div className="card">
          <p className="font-medium">{session.data?.displayName}</p>
          <p className="text-sm text-muted">@{session.data?.handle}</p>
          <p className="text-sm text-muted">{session.data?.email}</p>
        </div>
        <button
          type="button"
          className="btn-secondary w-full"
          onClick={() => logout.mutate()}
        >
          {t("settings.logout")}
        </button>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">
          {t("settings.data")}
        </h2>
        <div className="card">
          <p className="text-sm text-muted">{t("settings.exportHint")}</p>
          <button
            type="button"
            className="btn-secondary mt-3 w-full"
            disabled={exporting}
            onClick={() => void downloadExport()}
          >
            {t("settings.export")}
          </button>
        </div>
        <div className="card">
          <p className="text-sm text-muted">{t("settings.deleteHint")}</p>
          <button
            type="button"
            className="btn-danger mt-3 w-full"
            disabled={deleteAccount.isPending}
            onClick={() => {
              if (window.confirm(t("settings.deleteConfirm"))) {
                deleteAccount.mutate();
              }
            }}
          >
            {t("settings.delete")}
          </button>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">
          {t("settings.privacy")}
        </h2>
        <p className="text-sm text-muted">{t("settings.privacyText")}</p>
      </section>
    </div>
  );
}
