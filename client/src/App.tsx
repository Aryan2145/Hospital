import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { useAuth } from "@/hooks/use-auth";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

// Pages
import Landing from "@/pages/Landing";
import Dashboard from "@/pages/Dashboard";
import LeadsWorkspace from "@/pages/LeadsWorkspace";
import LeadDetailPage from "@/pages/LeadDetailPage";
import MasterData from "@/pages/MasterData";
import TeamManagement from "@/pages/TeamManagement";
import AppointmentsPage from "@/pages/AppointmentsPage";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <div className="h-screen flex items-center justify-center"><LoadingSpinner /></div>;
  if (!isAuthenticated) return <Landing />;

  return <Component />;
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <div className="h-screen flex items-center justify-center"><LoadingSpinner /></div>;

  return (
    <Switch>
      <Route path="/">
        {isAuthenticated ? <Dashboard /> : <Landing />}
      </Route>
      
      <Route path="/leads">
         {isAuthenticated ? <LeadsWorkspace /> : <Landing />}
      </Route>

      <Route path="/leads/:id">
         {isAuthenticated ? <LeadDetailPage /> : <Landing />}
      </Route>

      <Route path="/appointments">
         {isAuthenticated ? <AppointmentsPage /> : <Landing />}
      </Route>

      <Route path="/team">
         {isAuthenticated ? <TeamManagement /> : <Landing />}
      </Route>

      <Route path="/masters">
         {isAuthenticated ? <MasterData /> : <Landing />}
      </Route>

      <Route path="/api/login">
        {/* Redirect handled by hook/page logic or backend directly, but fallback here */}
        <Landing />
      </Route>

      {/* Fallback to 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
