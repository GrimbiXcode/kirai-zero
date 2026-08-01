import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import type { CurrentUser } from "shared";
import { useFriendRequests } from "../api/hooks";
import { t, type TranslationKey } from "../i18n";

const TABS: { to: string; label: TranslationKey }[] = [
  { to: "/", label: "nav.lists" },
  { to: "/freunde", label: "nav.friends" },
  { to: "/einstellungen", label: "nav.settings" },
];

export function Layout({
  user,
  children,
}: {
  user: CurrentUser;
  children: ReactNode;
}) {
  const requests = useFriendRequests();
  const pending = requests.data?.incoming.length ?? 0;

  return (
    <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col">
      <header className="flex items-baseline justify-between px-4 pt-6 pb-2">
        <span className="text-lg font-semibold tracking-tight">
          {t("app.name")}
        </span>
        <span className="text-sm text-muted">@{user.handle}</span>
      </header>

      <main className="flex-1 px-4 pb-24">{children}</main>

      {/* Bottom bar on phones, where the thumb is; it stays at the bottom on
          wider screens too so the app behaves the same everywhere. */}
      <nav className="fixed inset-x-0 bottom-0 border-t border-line bg-white/95 backdrop-blur">
        <ul className="mx-auto flex w-full max-w-2xl">
          {TABS.map((tab) => (
            <li key={tab.to} className="flex-1">
              <NavLink
                to={tab.to}
                end={tab.to === "/"}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-0.5 px-2 py-3 text-xs font-medium ${
                    isActive ? "text-accent" : "text-muted"
                  }`
                }
              >
                <span className="relative">
                  {t(tab.label)}
                  {tab.to === "/freunde" && pending > 0 && (
                    <span
                      className="absolute -top-1 -right-3 rounded-full bg-accent px-1.5 text-[10px] leading-4 text-white"
                      aria-label={t("friends.requests.incoming")}
                    >
                      {pending}
                    </span>
                  )}
                </span>
              </NavLink>
            </li>
          ))}
        </ul>
        <div className="h-[env(safe-area-inset-bottom)]" />
      </nav>
    </div>
  );
}
