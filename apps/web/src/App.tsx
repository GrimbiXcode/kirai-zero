import { Navigate, Route, Routes } from "react-router-dom";
import { useSession } from "./api/hooks";
import { Layout } from "./components/Layout";
import { Spinner } from "./components/Spinner";
import { t } from "./i18n";
import { AuthPage } from "./routes/AuthPage";
import { FriendProfilePage } from "./routes/FriendProfilePage";
import { FriendsPage } from "./routes/FriendsPage";
import { MyListsPage } from "./routes/MyListsPage";
import { SettingsPage } from "./routes/SettingsPage";

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
        <Route path="/registrieren" element={<AuthPage mode="register" />} />
        <Route path="*" element={<AuthPage mode="login" />} />
      </Routes>
    );
  }

  return (
    <Layout user={session.data}>
      <Routes>
        <Route path="/" element={<MyListsPage />} />
        <Route path="/freunde" element={<FriendsPage />} />
        <Route path="/freunde/:userId" element={<FriendProfilePage />} />
        <Route path="/einstellungen" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
