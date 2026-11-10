import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { getSession } from "@/lib/store";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import { LoginPage } from "@/pages/login";
import { SearchPage } from "@/pages/search";
import { AdminPage } from "@/pages/admin";
import { AdminSetupPage } from "@/pages/admin-setup";
import NotFound from "@/pages/not-found";
import { useSessionTimeout } from "@/hooks/use-session-timeout";
import { SessionTimeoutModal } from "@/components/session-timeout-modal";
import { ThemeProvider } from "@/components/theme-provider";
import { SiteLock } from "@/components/SiteLock";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function RootRedirect() {
  const session = getSession();
  const [, navigate] = useLocation();
  
  useEffect(() => {
    if (!session) {
      navigate("/login");
    } else if (session.role === "admin") {
      navigate("/admin");
    } else {
      navigate("/search");
    }
  }, [session, navigate]);
  
  return null;
}

function Router() {
  return (
    <Switch>
      <Route path="/">
        <RootRedirect />
      </Route>
      <Route path="/login">
        <Layout><LoginPage /></Layout>
      </Route>
      <Route path="/search">
        <Layout><SearchPage /></Layout>
      </Route>
      <Route path="/admin">
        <AdminPage />
      </Route>
      <Route path="/admin-setup">
        <AdminSetupPage />
      </Route>
      <Route>
        <Layout><NotFound /></Layout>
      </Route>
    </Switch>
  );
}

function SessionGuard() {
  const [, navigate] = useLocation();
  const { showWarning, secondsLeft, stayLoggedIn, logout } = useSessionTimeout(() => {
    navigate("/login");
  });

  return (
    <SessionTimeoutModal
      open={showWarning}
      secondsLeft={secondsLeft}
      onStay={stayLoggedIn}
      onLogout={logout}
    />
  );
}

function App() {
  return (
    <SiteLock>
      <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
              <SessionGuard />
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </SiteLock>
  );
}

export default App;
