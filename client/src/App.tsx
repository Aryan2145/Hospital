import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DynamicFavicon } from "@/components/DynamicFavicon";
import { IdleTimeout } from "@/components/IdleTimeout";
import NotFound from "@/pages/not-found";
import { useAuth } from "@/hooks/use-auth";
import { useCurrentUser } from "@/hooks/use-current-user";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { AlertTriangle } from "lucide-react";

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
import EmailSettingsPage from "@/pages/EmailSettingsPage";
import WhatsAppSettingsPage from "@/pages/WhatsAppSettingsPage";
import PendingApproval from "@/pages/PendingApproval";
import TestingInterface from "@/pages/TestingInterface";
import LeadImportPage from "@/pages/LeadImportPage";
import GoogleSheetsImportPage from "@/pages/GoogleSheetsImportPage";
import BrandingSettings from "@/pages/BrandingSettings";
import EpisodeDetailPage from "@/pages/EpisodeDetailPage";
import DoctorAvailabilityPage from "@/pages/DoctorAvailabilityPage";
import MasterApprovalPage from "@/pages/MasterApproval";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminHospitals from "@/pages/admin/AdminHospitals";
import AdminPlans from "@/pages/admin/AdminPlans";
import AdminSubscriptions from "@/pages/admin/AdminSubscriptions";
import AdminPayments from "@/pages/admin/AdminPayments";
import CallyzerReportsPage from "@/pages/CallyzerReportsPage";
import IntelligenceConfigPage from "@/pages/IntelligenceConfigPage";
import PostCareProtocolsPage from "@/pages/PostCareProtocolsPage";
import ReferralConfigPage from "@/pages/ReferralConfigPage";
import ReferralsPage from "@/pages/ReferralsPage";
import EventsPage from "@/pages/EventsPage";
import EventDetailPage from "@/pages/EventDetailPage";
import AdminLogin from "@/pages/admin/AdminLogin";
import PrivacyPolicy from "@/pages/PrivacyPolicy";
import MetaHelpGuide from "@/pages/MetaHelpGuide";
import HelpCenter from "@/pages/HelpCenter";
import SupportTicketsPage from "@/pages/SupportTicketsPage";
import SupportAdminLogin from "@/pages/support-admin/SupportAdminLogin";
import SupportAdminDashboard from "@/pages/support-admin/SupportAdminDashboard";
import SurgeryCalendarPage from "@/pages/SurgeryCalendarPage";
import ContactDirectoryPage from "@/pages/ContactDirectoryPage";

function TenantSuspended() {
  return (
    <div className="h-screen flex items-center justify-center bg-gradient-to-b from-slate-50 to-white" data-testid="tenant-suspended-screen">
      <div className="text-center max-w-lg px-8 py-12">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-amber-50 flex items-center justify-center">
          <AlertTriangle className="w-10 h-10 text-amber-500" />
        </div>
        <h2 className="text-2xl font-semibold text-slate-800 mb-3" data-testid="text-suspended-title">We'll Be Right Back</h2>
        <p className="text-slate-500 leading-relaxed mb-4" data-testid="text-suspended-message">
          Your CRM access is currently on hold while we sort out a few account details. This is typically related to a subscription renewal and is usually resolved quickly.
        </p>
        <p className="text-sm text-slate-400 leading-relaxed">
          If you believe this is an error or need immediate assistance, please reach out to your hospital administrator or contact the myProSys support team. We appreciate your patience and are happy to help.
        </p>
      </div>
    </div>
  );
}

function RoleGate({ page, children }: { page: string; children: React.ReactNode }) {
  const { isLoading, isRegistered, canViewPage, tenantSuspended, isSysAdmin } = useCurrentUser();

  if (isLoading) return <div className="h-screen flex items-center justify-center"><LoadingSpinner /></div>;
  if (!isRegistered) return <PendingApproval />;
  if (tenantSuspended && !isSysAdmin) return <TenantSuspended />;
  if (!canViewPage(page)) return <Redirect to="/" />;

  return <>{children}</>;
}

function SysAdminGate({ children }: { children: React.ReactNode }) {
  const { isLoading, isRegistered, isSysAdmin } = useCurrentUser();

  if (isLoading) return <div className="h-screen flex items-center justify-center"><LoadingSpinner /></div>;
  if (!isRegistered || !isSysAdmin) return <Redirect to="/" />;

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

      <Route path="/dashboard">
        {isAuthenticated ? (
          <Redirect to="/" />
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

      <Route path="/doctor-availability">
        {isAuthenticated ? (
          <Redirect to="/appointments" />
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

      <Route path="/callyzer-reports">
        {isAuthenticated ? (
          <RoleGate page="connectors"><CallyzerReportsPage /></RoleGate>
        ) : <Landing />}
      </Route>

      <Route path="/connectors">
        {isAuthenticated ? (
          <RoleGate page="connectors"><ConnectorsPage /></RoleGate>
        ) : <Landing />}
      </Route>

      <Route path="/email-settings">
        {isAuthenticated ? (
          <RoleGate page="email-settings"><EmailSettingsPage /></RoleGate>
        ) : <Landing />}
      </Route>

      <Route path="/whatsapp-settings">
        {isAuthenticated ? (
          <RoleGate page="whatsapp-settings"><WhatsAppSettingsPage /></RoleGate>
        ) : <Landing />}
      </Route>

      <Route path="/masters">
        {isAuthenticated ? (
          <RoleGate page="masters"><MasterData /></RoleGate>
        ) : <Landing />}
      </Route>

      <Route path="/lead-import">
        {isAuthenticated ? (
          <RoleGate page="leads"><LeadImportPage /></RoleGate>
        ) : <Landing />}
      </Route>

      <Route path="/google-sheets-import">
        {isAuthenticated ? (
          <RoleGate page="leads"><GoogleSheetsImportPage /></RoleGate>
        ) : <Landing />}
      </Route>

      <Route path="/episodes/:id">
        {isAuthenticated ? (
          <RoleGate page="transactions"><EpisodeDetailPage /></RoleGate>
        ) : <Landing />}
      </Route>

      <Route path="/master-approval">
        {isAuthenticated ? (
          <RoleGate page="masters"><MasterApprovalPage /></RoleGate>
        ) : <Landing />}
      </Route>

      <Route path="/branding">
        {isAuthenticated ? (
          <RoleGate page="branding"><BrandingSettings /></RoleGate>
        ) : <Landing />}
      </Route>

      <Route path="/intelligence-config">
        {isAuthenticated ? (
          <RoleGate page="connectors"><IntelligenceConfigPage /></RoleGate>
        ) : <Landing />}
      </Route>

      <Route path="/post-care-protocols">
        {isAuthenticated ? (
          <RoleGate page="connectors"><PostCareProtocolsPage /></RoleGate>
        ) : <Landing />}
      </Route>

      <Route path="/referral-config">
        {isAuthenticated ? (
          <RoleGate page="connectors"><ReferralConfigPage /></RoleGate>
        ) : <Landing />}
      </Route>

      <Route path="/referrals">
        {isAuthenticated ? (
          <RoleGate page="transactions"><ReferralsPage /></RoleGate>
        ) : <Landing />}
      </Route>

      <Route path="/surgery-calendar">
        {isAuthenticated ? (
          <RoleGate page="transactions"><SurgeryCalendarPage /></RoleGate>
        ) : <Landing />}
      </Route>

      <Route path="/events/:id">
        {isAuthenticated ? (
          <RoleGate page="campaigns"><EventDetailPage /></RoleGate>
        ) : <Landing />}
      </Route>

      <Route path="/events">
        {isAuthenticated ? (
          <RoleGate page="campaigns"><EventsPage /></RoleGate>
        ) : <Landing />}
      </Route>

      <Route path="/testing">
        {isAuthenticated ? (
          <RoleGate page="testing"><TestingInterface /></RoleGate>
        ) : <Landing />}
      </Route>

      <Route path="/privacy-policy">
        <PrivacyPolicy />
      </Route>

      <Route path="/help/meta-integration">
        <MetaHelpGuide />
      </Route>

      <Route path="/help/data-security">
        {isAuthenticated ? <HelpCenter /> : <Landing />}
      </Route>

      <Route path="/help/:section/:topic">
        {isAuthenticated ? <HelpCenter /> : <Landing />}
      </Route>

      <Route path="/help/:section">
        {isAuthenticated ? <HelpCenter /> : <Landing />}
      </Route>

      <Route path="/help">
        {isAuthenticated ? <HelpCenter /> : <Landing />}
      </Route>

      <Route path="/forgot-password">
        {isAuthenticated ? <Redirect to="/" /> : <ForgotPassword />}
      </Route>

      <Route path="/reset-password">
        {isAuthenticated ? <Redirect to="/" /> : <ResetPassword />}
      </Route>

      <Route path="/admin/login">
        {isAuthenticated ? <SysAdminGate><Redirect to="/admin" /></SysAdminGate> : <AdminLogin />}
      </Route>
      <Route path="/admin">
        {isAuthenticated ? <SysAdminGate><AdminDashboard /></SysAdminGate> : <AdminLogin />}
      </Route>
      <Route path="/admin/hospitals">
        {isAuthenticated ? <SysAdminGate><AdminHospitals /></SysAdminGate> : <AdminLogin />}
      </Route>
      <Route path="/admin/plans">
        {isAuthenticated ? <SysAdminGate><AdminPlans /></SysAdminGate> : <AdminLogin />}
      </Route>
      <Route path="/admin/subscriptions">
        {isAuthenticated ? <SysAdminGate><AdminSubscriptions /></SysAdminGate> : <AdminLogin />}
      </Route>
      <Route path="/admin/payments">
        {isAuthenticated ? <SysAdminGate><AdminPayments /></SysAdminGate> : <AdminLogin />}
      </Route>

      <Route path="/support-tickets">
        {isAuthenticated ? <RoleGate page="support"><SupportTicketsPage /></RoleGate> : <Landing />}
      </Route>

      <Route path="/support-admin/dashboard">
        <SupportAdminDashboard />
      </Route>
      <Route path="/support-admin">
        <SupportAdminLogin />
      </Route>

      <Route path="/contact-directory">
        {isAuthenticated ? (
          <RoleGate page="leads"><ContactDirectoryPage /></RoleGate>
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
        <DynamicFavicon />
        <Toaster />
        <IdleTimeout />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
