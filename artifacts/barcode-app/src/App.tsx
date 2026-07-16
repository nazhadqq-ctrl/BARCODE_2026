import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/">
        <AdminPage />
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
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
          <SessionGuard />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
