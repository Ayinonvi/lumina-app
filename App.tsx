import { useEffect, useState } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { supabase } from "./lib/supabase";
import type { Session } from "@supabase/supabase-js";

// Pages
import AccessPage from "./pages/AccessPage";
import QuestionnairePage from "./pages/QuestionnairePage";
import ResultsPage from "./pages/ResultsPage";
import AdminPage from "./pages/AdminPage";
import LoadingScreen from "./components/ui/LoadingScreen";

const ADMIN_EMAIL = "naomi.kpoviessi@gmail.com";

function ProtectedRoute({
  children,
  session,
}: {
  children: React.ReactNode;
  session: Session | null;
}) {
  if (!session) return <Navigate to="/acces" replace />;
  return <>{children}</>;
}

function AdminRoute({
  children,
  session,
}: {
  children: React.ReactNode;
  session: Session | null;
}) {
  if (!session || session.user.email !== ADMIN_EMAIL) {
    return <Navigate to="/acces" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession) {
        navigate("/app", { replace: true });
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  if (loading) return <LoadingScreen />;

  return (
    <Routes>
      <Route path="/acces" element={<AccessPage />} />

      <Route
        path="/app"
        element={
          <ProtectedRoute session={session}>
            <QuestionnairePage session={session!} />
          </ProtectedRoute>
        }
      />

      <Route
        path="/app/resultats/:id?"
        element={
          <ProtectedRoute session={session}>
            <ResultsPage session={session!} />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin"
        element={
          <AdminRoute session={session}>
            <AdminPage session={session!} />
          </AdminRoute>
        }
      />

      <Route
        path="/"
        element={
          session ? (
            <Navigate to="/app" replace />
          ) : (
            <Navigate to="/acces" replace />
          )
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
