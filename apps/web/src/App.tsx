import { Navigate, Route, Routes } from "react-router-dom";
import { useSession } from "./api/hooks";
import { Layout } from "./components/Layout";
import { Spinner } from "./components/Spinner";
import { t } from "./i18n";
import { AuthPage } from "./routes/AuthPage";
import { ForgotPasswordPage } from "./routes/ForgotPasswordPage";
import { FriendProfilePage } from "./routes/FriendProfilePage";
import { FriendsPage } from "./routes/FriendsPage";
import { MyListsPage } from "./routes/MyListsPage";
import { PersonPage } from "./routes/PersonPage";
import { ResetPasswordPage } from "./routes/ResetPasswordPage";
import { SettingsPage } from "./routes/SettingsPage";
import { VerifyEmailPage } from "./routes/VerifyEmailPage";

/**
 * The screens a mailed link can land on. They belong in both branches below: a
 * reset link is followed while signed out, a confirmation link usually while
 * signed in, and neither may fall through to the login form or to the
 * catch-all redirect.
 */
function mailLinkRoutes() {
  return [
    <Route
      key="verify"
      path="/e-mail-bestaetigen"
      element={<VerifyEmailPage />}
    />,
    <Route key="reset" path="/passwort-neu" element={<ResetPasswordPage />} />,
  ];
}

export function App() {
  const session = useSession();

  if (session.isPending) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner label={t("common.loading")} />
      </div>
    );
  }

  if (!session.data) {
    return (
      <Routes>
        {mailLinkRoutes()}
        <Route path="/registrieren" element={<AuthPage mode="register" />} />
        <Route path="/passwort-vergessen" element={<ForgotPasswordPage />} />
        <Route path="*" element={<AuthPage mode="login" />} />
      </Routes>
    );
  }

  return (
    <Layout user={session.data}>
      <Routes>
        {mailLinkRoutes()}
        <Route path="/" element={<MyListsPage />} />
        <Route path="/freunde" element={<FriendsPage />} />
        <Route path="/freunde/:userId" element={<FriendProfilePage />} />
        <Route path="/personen/:personId" element={<PersonPage />} />
        <Route path="/einstellungen" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
