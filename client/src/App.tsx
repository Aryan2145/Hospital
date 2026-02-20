import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { useAuth } from "@/hooks/use-auth";
import { useCurrentUser } from "@/hooks/use-current-user";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

import Landing from "@/pages/Landing";
import Dashboard from "@/pages/Dashboard";
import LeadsWorkspace from "@/pages/LeadsWorkspace";
import LeadDetailPage from "@/pages/LeadDetailPage";
import MasterData from "@/pages/MasterData";
import TeamManagement from "@/pages/TeamManagement";
import AppointmentsPage from "@/pages/AppointmentsPage";
import CampaignsPage from "@/pages/CampaignsPage";
import TransactionsPage from "@/pages/TransactionsPage";
import ConnectorsPage from "@/pages/ConnectorsPage";
import PendingApproval from "@/pages/PendingApproval";
import TestingInterface from "@/pages/TestingInterface";

function RoleGate({ page, children }: { page: string; children: React.ReactNode }) {
  const { isLoading, isRegistered, canViewPage } = useCurrentUser();

  if (isLoading) return <div className="h-screen flex items-center justify-center"><LoadingSpinner /></div>;
  if (!isRegistered) return <PendingApproval />;
  if (!canViewPage(page)) return <Redirect to="/" />;

  return <>{children}</>;
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <div className="h-screen flex items-center justify-center"><LoadingSpinner /></div>;

  return (
    <Switch>
      <Route path="/">
        {isAuthenticated ? (
          <RoleGate page="dashboard"><Dashboard /></RoleGate>
        ) : <Landing />}
      </Route>

      <Route path="/leads">
        {isAuthenticated ? (
          <RoleGate page="leads"><LeadsWorkspace /></RoleGate>
        ) : <Landing />}
      </Route>

      <Route path="/leads/:id">
        {isAuthenticated ? (
          <RoleGate page="leads"><LeadDetailPage /></RoleGate>
        ) : <Landing />}
      </Route>

      <Route path="/appointments">
        {isAuthenticated ? (
          <RoleGate page="appointments"><AppointmentsPage /></RoleGate>
        ) : <Landing />}
      </Route>

      <Route path="/team">
        {isAuthenticated ? (
          <RoleGate page="team"><TeamManagement /></RoleGate>
        ) : <Landing />}
      </Route>

      <Route path="/campaigns">
        {isAuthenticated ? (
          <RoleGate page="campaigns"><CampaignsPage /></RoleGate>
        ) : <Landing />}
      </Route>

      <Route path="/transactions">
        {isAuthenticated ? (
          <RoleGate page="transactions"><TransactionsPage /></RoleGate>
        ) : <Landing />}
      </Route>

      <Route path="/connectors">
        {isAuthenticated ? (
          <RoleGate page="connectors"><ConnectorsPage /></RoleGate>
        ) : <Landing />}
      </Route>

      <Route path="/masters">
        {isAuthenticated ? (
          <RoleGate page="masters"><MasterData /></RoleGate>
        ) : <Landing />}
      </Route>

      <Route path="/testing">
        {isAuthenticated ? (
          <RoleGate page="testing"><TestingInterface /></RoleGate>
        ) : <Landing />}
      </Route>

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
