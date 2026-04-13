import { AppLayout } from "@/components/layout/AppLayout";
import { useLocation, Link } from "wouter";
import { useState, useMemo } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  Clock,
  Shield,
  ShieldCheck,
  FileText,
  Megaphone,
  Phone,
  Lock,
  Eye,
  Timer,
  ClipboardList,
  KeyRound,
  Bell,
  UserCheck,
  Layers,
  BookOpen,
  ExternalLink,
  AlertTriangle,
  Search,
  ChevronDown,
  ChevronRight,
  Users,
  Calendar,
  HeartPulse,
  Gift,
  CalendarDays,
  Database,
  Plug,
  Paintbrush,
  Brain,
  Stethoscope,
  LayoutDashboard,
  Settings,
  Info,
  Menu,
  X,
  Ticket,
  Scissors,
  Link2,
  BedDouble,
  Receipt,
  LifeBuoy,
  MessageSquare,
} from "lucide-react";
import { SiFacebook, SiInstagram } from "react-icons/si";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type ComplianceItem = {
  id: string;
  title: string;
  description: string;
  status: "done" | "partial" | "pending";
  icon: any;
  details: string[];
};

const COMPLIANCE_ITEMS: ComplianceItem[] = [
  {
    id: "phi-masking",
    title: "PHI Data Masking",
    description: "Server-side masking of Protected Health Information based on user access level",
    status: "done",
    icon: Eye,
    details: [
      "API responses mask contact fields (phone, email) for users with Masked access level",
      "Clinical fields (diagnosis, treatment plan, insurance) hidden at None access level",
      "Applied to lead list, lead detail, and patient detail endpoints",
      "Three-tier access: Full (all data visible), Masked (contact info partially hidden), None (PHI restricted)",
    ],
  },
  {
    id: "login-security",
    title: "Login Security & Account Lockout",
    description: "Failed login tracking with automatic account lockout to prevent brute-force attacks",
    status: "done",
    icon: Lock,
    details: [
      "Failed login attempts tracked per user account",
      "Account automatically locks after 5 consecutive failed attempts",
      "15-minute lockout duration before retry is allowed",
      "Both standard and admin login protected with lockout",
      "Generic error messages prevent user enumeration on admin portal",
      "IP-based rate limiting on login endpoints",
    ],
  },
  {
    id: "session-security",
    title: "Session Security",
    description: "Session lifetime management and log sanitization",
    status: "done",
    icon: Timer,
    details: [
      "Session TTL reduced to 24 hours (from 7 days)",
      "PHI fields automatically sanitized from server logs",
      "Sensitive fields (phone, email, diagnosis) never written to log files",
    ],
  },
  {
    id: "idle-timeout",
    title: "Inactivity Timeout",
    description: "Automatic session timeout after 30 minutes of inactivity",
    status: "done",
    icon: Clock,
    details: [
      "Frontend monitors mouse, keyboard, scroll, and touch activity",
      "30-minute idle threshold triggers warning modal",
      "5-minute countdown warning before automatic logout",
      "User can extend session by clicking 'Stay Logged In'",
    ],
  },
  {
    id: "audit-logging",
    title: "Audit Access Logging",
    description: "Comprehensive logging of who accessed what patient/lead data and when",
    status: "done",
    icon: ClipboardList,
    details: [
      "Lead and patient record views logged with user ID, timestamp, and IP address",
      "Data exports (CSV downloads) logged with table name and record count",
      "Communication preference changes logged",
      "Admin-only access log viewer available via API",
    ],
  },
  {
    id: "encryption",
    title: "Credential Encryption",
    description: "AES-256-GCM encryption for integration credentials at rest",
    status: "done",
    icon: KeyRound,
    details: [
      "Integration API keys and tokens encrypted using AES-256-GCM",
      "Encryption key derived from server session secret",
      "Encrypt/decrypt utility available for all platform connector credentials",
    ],
  },
  {
    id: "communication-prefs",
    title: "Communication Preferences",
    description: "Per-patient/lead opt-in and opt-out tracking for each communication channel",
    status: "done",
    icon: Bell,
    details: [
      "WhatsApp, SMS, Email, and Phone Call channel preferences tracked",
      "Toggle controls on Lead Detail page sidebar",
      "Tenant ownership validated before preference updates",
      "Preferences stored per-lead and per-patient",
    ],
  },
  {
    id: "consent-capture",
    title: "Consent Capture",
    description: "Explicit patient consent for data collection and processing",
    status: "done",
    icon: UserCheck,
    details: [
      "Consent checkbox in New Lead creation form",
      "Consent status badge visible on Lead Detail page",
      "Consent timestamp and method recorded",
      "API endpoints for updating consent on leads and patients",
    ],
  },
  {
    id: "rbac",
    title: "Role-Based Access Control",
    description: "4-tier role hierarchy with granular PHI access levels",
    status: "done",
    icon: Shield,
    details: [
      "SYS_ADMIN, ADMIN, MANAGER, AGENT/COUNSELLOR roles",
      "PHI access levels configurable per user (Full/Masked/None)",
      "Access scope types: All, Branch, Self",
      "Page-level visibility controls based on role",
    ],
  },
  {
    id: "data-retention",
    title: "Data Retention Policy",
    description: "Automated data retention and purge schedules for compliance",
    status: "pending",
    icon: Layers,
    details: [
      "Configurable retention periods per data category",
      "Automated purge of expired access logs",
      "Archival workflow for old lead/episode records",
      "Retention policy configuration UI for admins",
    ],
  },
  {
    id: "field-encryption",
    title: "Field-Level Encryption for PHI",
    description: "Encrypt sensitive patient data fields at rest in the database",
    status: "pending",
    icon: ShieldCheck,
    details: [
      "Encrypt phone numbers, email, diagnosis at the database column level",
      "Transparent decrypt on read for authorized users",
      "Key rotation support",
    ],
  },
  {
    id: "audit-dashboard",
    title: "Audit Dashboard & Reports",
    description: "Visual dashboard for security officers to review access patterns and anomalies",
    status: "pending",
    icon: FileText,
    details: [
      "Access log visualizations with filters by user, date, entity type",
      "Anomaly detection for unusual access patterns",
      "Exportable audit reports for compliance reviews",
      "Scheduled audit report emails to compliance officers",
    ],
  },
  {
    id: "2fa",
    title: "Two-Factor Authentication",
    description: "OTP-based second factor for high-privilege accounts",
    status: "pending",
    icon: Lock,
    details: [
      "SMS/Email OTP for ADMIN and SYS_ADMIN login",
      "Configurable per-tenant enforcement policy",
      "Backup codes for account recovery",
    ],
  },
  {
    id: "hipaa-baa",
    title: "HIPAA BAA & Documentation",
    description: "Business Associate Agreements and formal compliance documentation",
    status: "pending",
    icon: FileText,
    details: [
      "Formal HIPAA compliance documentation package",
      "Business Associate Agreement templates",
      "Risk assessment documentation",
      "Incident response procedures",
    ],
  },
];

type HelpTopic = {
  id: string;
  title: string;
  icon: any;
  isExternal?: boolean;
  href?: string;
};

type HelpSection = {
  id: string;
  title: string;
  icon: any;
  topics: HelpTopic[];
};

const HELP_SECTIONS: HelpSection[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    icon: BookOpen,
    topics: [
      { id: "overview", title: "Platform Overview", icon: Info },
      { id: "logging-in", title: "Logging In", icon: Lock },
      { id: "navigation", title: "Navigating the CRM", icon: Menu },
      { id: "roles", title: "Understanding Your Role", icon: Shield },
    ],
  },
  {
    id: "leads",
    title: "Lead Management",
    icon: Users,
    topics: [
      { id: "creating-leads", title: "Creating & Importing Leads", icon: Users },
      { id: "csv-import", title: "CSV Lead Import", icon: FileText },
      { id: "google-sheets-import", title: "Google Sheets Import", icon: Database },
      { id: "lifecycle", title: "Lead Lifecycle Stages", icon: ArrowRight },
      { id: "kanban", title: "Kanban Workspace", icon: LayoutDashboard },
      { id: "lead-detail", title: "Lead Detail Page", icon: FileText },
      { id: "merge-duplicates", title: "Merge & Duplicates", icon: Users },
      { id: "nurture-engine", title: "Nurture Engine", icon: Bell },
      { id: "dormant-detection", title: "Dormant Lead Detection", icon: Clock },
    ],
  },
  {
    id: "appointments",
    title: "Appointments",
    icon: Calendar,
    topics: [
      { id: "scheduling", title: "Scheduling Appointments", icon: Calendar },
      { id: "opd-timings", title: "Doctor OPD Timings", icon: Clock },
      { id: "doctor-availability", title: "Doctor Availability Calendar", icon: CalendarDays },
      { id: "check-in", title: "Check-In Process", icon: CheckCircle2 },
    ],
  },
  {
    id: "episodes",
    title: "Consultation Episodes",
    icon: HeartPulse,
    topics: [
      { id: "episode-lifecycle", title: "Episode Lifecycle", icon: ArrowRight },
      { id: "consultation-log", title: "Consultation Log & Outcomes", icon: ClipboardList },
      { id: "clinical-tab", title: "Clinical Information", icon: Stethoscope },
      { id: "financial-tab", title: "Financial & Billing", icon: FileText },
      { id: "quotation-builder", title: "Quotation Builder", icon: Receipt },
      { id: "room-allocation", title: "Room Allocation", icon: BedDouble },
      { id: "surgery-scheduling", title: "Surgery Scheduling", icon: Scissors },
      { id: "insurance-tab", title: "Insurance & Pre-Auth", icon: Shield },
      { id: "family-tab", title: "Family & Decision Status", icon: Users },
      { id: "treatment-planning", title: "Treatment Planning", icon: FileText },
      { id: "intelligence", title: "Episode Intelligence", icon: Brain },
    ],
  },
  {
    id: "post-care",
    title: "Post-Care & Follow-Up",
    icon: Stethoscope,
    topics: [
      { id: "protocols", title: "Setting Up Protocols", icon: Settings },
      { id: "auto-triggering", title: "How Auto-Triggering Works", icon: Bell },
      { id: "timeline", title: "Post-Care Timeline", icon: Clock },
    ],
  },
  {
    id: "referrals",
    title: "Referral Management",
    icon: Gift,
    topics: [
      { id: "creating-referrals", title: "Creating Referrals", icon: Gift },
      { id: "referral-ready", title: "Marking Episodes Referral-Ready", icon: CheckCircle2 },
      { id: "tracking-outcomes", title: "Tracking & Outcomes", icon: LayoutDashboard },
    ],
  },
  {
    id: "events",
    title: "Event Management",
    icon: CalendarDays,
    topics: [
      { id: "creating-events", title: "Creating Events", icon: CalendarDays },
      { id: "registrations", title: "Registrations & Attendance", icon: Users },
      { id: "convert-to-lead", title: "Converting Attendees to Leads", icon: ArrowRight },
      { id: "event-resources", title: "Event Resource Links", icon: Link2 },
    ],
  },
  {
    id: "campaigns",
    title: "Campaigns & Marketing",
    icon: Megaphone,
    topics: [
      { id: "campaign-setup", title: "Campaign Setup", icon: Megaphone },
      { id: "campaign-dashboard", title: "Campaign Dashboard & Stats", icon: LayoutDashboard },
      { id: "campaign-resources", title: "Campaign Resource Links", icon: Link2 },
      { id: "naming-conventions", title: "Naming Conventions", icon: FileText },
      { id: "utm-tracking", title: "UTM Tracking", icon: ExternalLink },
      { id: "meta-integration", title: "Connecting Meta to CRM", icon: SiFacebook, isExternal: true, href: "/help/meta-integration" },
    ],
  },
  {
    id: "masters",
    title: "Master Data",
    icon: Database,
    topics: [
      { id: "master-tables", title: "Managing Master Tables", icon: Database },
      { id: "approval-workflow", title: "Approval Workflow", icon: CheckCircle2 },
      { id: "bulk-import-export", title: "Bulk Import & Export", icon: FileText },
    ],
  },
  {
    id: "configurations",
    title: "Configurations",
    icon: Settings,
    topics: [
      { id: "connectors", title: "Connectors Setup", icon: Plug },
      { id: "meta-integration", title: "Connecting Meta to CRM", icon: SiFacebook, isExternal: true, href: "/help/meta-integration" },
      { id: "email-settings", title: "Email / SMTP Settings", icon: Bell },
      { id: "whatsapp-settings", title: "WhatsApp Business Settings", icon: Phone },
      { id: "wati-whatsapp", title: "Connecting WhatsApp via WATI", icon: MessageSquare },
      { id: "branding", title: "Branding Customization", icon: Paintbrush },
      { id: "intelligence-config", title: "Intelligence Config", icon: Brain },
      { id: "sla-reminders", title: "SLA & Reminder Policies", icon: Bell },
    ],
  },
  {
    id: "dashboards",
    title: "Dashboards & Reports",
    icon: LayoutDashboard,
    topics: [
      { id: "role-dashboards", title: "Role-Based Dashboards", icon: LayoutDashboard },
      { id: "surgery-calendar", title: "Surgery Calendar", icon: CalendarDays },
      { id: "telephony-reports", title: "Telephony Reports", icon: Phone },
    ],
  },
  {
    id: "security",
    title: "Security & Compliance",
    icon: ShieldCheck,
    topics: [
      { id: "rbac-guide", title: "Role-Based Access Control", icon: Shield },
      { id: "phi-masking", title: "PHI Masking", icon: Eye },
      { id: "session-security", title: "Session & Login Security", icon: Lock },
      { id: "audit-logging", title: "Audit Logging", icon: ClipboardList },
      { id: "consent-prefs", title: "Consent & Communication Prefs", icon: UserCheck },
      { id: "data-security-compliance", title: "Data Security & Compliance", icon: ShieldCheck, isExternal: true, href: "/help/data-security" },
    ],
  },
  {
    id: "user-management",
    title: "User Management (Admin)",
    icon: Users,
    topics: [
      { id: "creating-users", title: "Creating CRM Users", icon: UserCheck },
      { id: "role-assignment", title: "Role & Access Assignment", icon: Shield },
      { id: "password-management", title: "Password Reset & Management", icon: KeyRound },
      { id: "branch-management", title: "Branch Management", icon: Settings },
    ],
  },
  {
    id: "help-ticketing",
    title: "Help & Support Tickets",
    icon: LifeBuoy,
    topics: [
      { id: "submitting-tickets", title: "Submitting Support Tickets", icon: Ticket },
      { id: "tracking-tickets", title: "Tracking Your Tickets", icon: ClipboardList },
      { id: "admin-ticket-mgmt", title: "Admin Ticket Management", icon: Settings },
    ],
  },
];

function getArticleContent(sectionId: string, topicId: string): { title: string; content: JSX.Element } | null {
  const key = `${sectionId}/${topicId}`;
  const articles: Record<string, { title: string; content: JSX.Element }> = {
    "getting-started/overview": {
      title: "Platform Overview",
      content: (
        <div className="space-y-6">
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">What is myProSys Hospital CRM?</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-3">
              myProSys Hospital CRM is a comprehensive, multi-tenant platform designed specifically for hospitals and healthcare organizations. It streamlines the entire patient journey — from initial lead capture through consultation, treatment, post-care, and referral — in one unified system.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              The platform replaces spreadsheets, disconnected tools, and manual tracking with an intelligent CRM that automates follow-ups, manages appointments, tracks treatment episodes, and provides real-time dashboards for every level of your organization.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Key Capabilities</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { title: "Lead Management", desc: "Capture, qualify, and convert patient inquiries with automated nurturing" },
                { title: "Appointment Scheduling", desc: "Token-based scheduling with doctor OPD timings and check-in workflow" },
                { title: "Consultation Episodes", desc: "Track treatments from consultation through surgery to post-care" },
                { title: "Campaign Tracking", desc: "Attribute leads to campaigns with full UTM tracking and Meta Ads integration" },
                { title: "Event Management", desc: "Manage health camps, webinars, and seminars with registration tracking" },
                { title: "Referral Management", desc: "Track and manage patient referrals with conversion analytics" },
                { title: "Post-Care Protocols", desc: "Automated follow-up task chains after treatment completion" },
                { title: "Role-Based Dashboards", desc: "Tailored analytics for admins, managers, agents, and counsellors" },
              ].map((item, i) => (
                <Card key={i} className="p-3">
                  <h3 className="text-sm font-semibold text-foreground mb-1">{item.title}</h3>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </Card>
              ))}
            </div>
          </section>
          <TipBox>The CRM is designed so that every team member — from tele-callers to hospital administrators — has exactly the tools and data they need for their role.</TipBox>
        </div>
      ),
    },
    "getting-started/logging-in": {
      title: "Logging In",
      content: (
        <div className="space-y-6">
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">How to Log In</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Access the CRM by navigating to your hospital's CRM URL. You will see a login screen where you can enter your credentials.
            </p>
            <StepList steps={[
              "Open your browser and navigate to your hospital's CRM URL",
              "Enter your registered mobile number and password",
              "Click 'Sign In' to access your dashboard",
              "If this is your first login, contact your administrator for your initial credentials",
            ]} />
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Forgot Password</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-3">
              If you forget your password, you can reset it from the login page:
            </p>
            <StepList steps={[
              "Click 'Forgot Password?' on the login screen",
              "Enter your registered mobile number",
              "Choose your preferred reset method: Email or SMS",
              "Email: A password reset link is sent to your registered email address. Click the link to set a new password.",
              "SMS: A temporary password is sent to your mobile number via SMS. Use it to log in, then change your password.",
            ]} />
            <TipBox>If you don't receive the reset email, check your spam folder. If SMS is not available, contact your administrator who can reset your password directly from Team Management.</TipBox>
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Account Security</h2>
            <ul className="space-y-2">
              <li className="flex items-start gap-2 text-sm text-muted-foreground">
                <Lock className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <span><strong>Account Lockout:</strong> After 5 consecutive failed login attempts, your account is locked for 15 minutes. Wait and try again, or contact your administrator.</span>
              </li>
              <li className="flex items-start gap-2 text-sm text-muted-foreground">
                <Timer className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <span><strong>Session Timeout:</strong> For security, your session expires after 24 hours. You will also be logged out after 30 minutes of inactivity, with a 5-minute warning before logout.</span>
              </li>
              <li className="flex items-start gap-2 text-sm text-muted-foreground">
                <Shield className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <span><strong>Stay Logged In:</strong> When you see the inactivity warning, click "Stay Logged In" to extend your session.</span>
              </li>
              <li className="flex items-start gap-2 text-sm text-muted-foreground">
                <KeyRound className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <span><strong>Change Password:</strong> You can change your password anytime from your profile. Go to your user menu and select "Change Password." Enter your current password and set a new one.</span>
              </li>
            </ul>
          </section>
          <WarningBox>Never share your login credentials. Each user account tracks activities for audit purposes, so shared accounts compromise security and accountability.</WarningBox>
        </div>
      ),
    },
    "getting-started/navigation": {
      title: "Navigating the CRM",
      content: (
        <div className="space-y-6">
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Sidebar Navigation</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              The left sidebar is your primary navigation. It is organized into logical sections based on what you do:
            </p>
            <div className="space-y-4">
              {[
                { title: "Reports & Dashboards", desc: "Your personalized dashboard and telephony call reports. This is your home screen and daily starting point.", icon: LayoutDashboard },
                { title: "Transactions", desc: "Where you do your day-to-day work — managing campaigns, events, leads, appointments, consultation episodes, and referrals.", icon: FileText },
                { title: "Masters", desc: "Reference data that powers the system — lead sources, departments, treatment types, and more. Includes the approval queue for pending changes.", icon: Database },
                { title: "Configurations", desc: "System settings — platform connectors (Meta, WhatsApp, Telephony), hospital branding, intelligence engine settings, and post-care protocols.", icon: Settings },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                  <item.icon className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
          <TipBox>The sections and menu items visible to you depend on your role. Agents and Counsellors see fewer configuration options than Admins and Managers.</TipBox>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Mobile Navigation</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              On mobile devices, the sidebar is hidden by default. Tap the menu icon (three horizontal lines) in the top-left corner to open the navigation drawer. Tap any menu item to navigate, and the drawer will close automatically.
            </p>
          </section>
        </div>
      ),
    },
    "getting-started/roles": {
      title: "Understanding Your Role",
      content: (
        <div className="space-y-6">
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Role Hierarchy</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              The CRM uses a 4-tier role hierarchy. Each role has specific permissions and sees a tailored view of the system:
            </p>
            <div className="space-y-3">
              {[
                { role: "System Admin (SYS_ADMIN)", desc: "Platform-level administrator. Manages hospitals (tenants), subscriptions, and system-wide settings. Accesses the separate Admin Panel.", color: "bg-red-50 text-red-700 border-red-200" },
                { role: "Admin (ADMIN)", desc: "Hospital-level administrator. Full access to all data and configurations for their hospital. Manages users, master data, connectors, branding, and views all dashboards.", color: "bg-orange-50 text-orange-700 border-orange-200" },
                { role: "Manager (MANAGER)", desc: "Team leader. Sees their team's data plus their own. Can view team performance dashboards, overdue tasks, and manage lead assignments. Access scope can be Branch-level or All.", color: "bg-blue-50 text-blue-700 border-blue-200" },
                { role: "Agent / Counsellor", desc: "Frontline staff. Agents (Tele-Callers) handle initial lead contact and qualification. Counsellors manage consultation episodes and treatment follow-up. Both see only their own assigned data by default.", color: "bg-green-50 text-green-700 border-green-200" },
              ].map((item, i) => (
                <Card key={i} className={`p-3 border ${item.color.split(' ')[2]}`}>
                  <h3 className="text-sm font-semibold text-foreground mb-1">{item.role}</h3>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </Card>
              ))}
            </div>
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">PHI Access Levels</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-3">
              Each user is assigned a Protected Health Information (PHI) access level that controls what patient data they can see:
            </p>
            <div className="space-y-2">
              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                <Eye className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span><strong>Full:</strong> All patient data visible including phone, email, diagnosis, and treatment details.</span>
              </div>
              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                <Eye className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <span><strong>Masked:</strong> Contact information (phone, email) is partially hidden (e.g., 98XXXXX003). Clinical fields remain visible.</span>
              </div>
              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                <Eye className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                <span><strong>None:</strong> Contact information is fully hidden. Clinical fields (diagnosis, treatment plan, insurance) are also hidden.</span>
              </div>
            </div>
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Access Scope</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-2">
              Your access scope determines whose data you can see:
            </p>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li><strong>Self:</strong> Only records assigned to you.</li>
              <li><strong>Branch:</strong> Records assigned to anyone in your branch.</li>
              <li><strong>All:</strong> Records across all branches (typically for Admins).</li>
            </ul>
          </section>
        </div>
      ),
    },
    "leads/creating-leads": {
      title: "Creating & Importing Leads",
      content: (
        <div className="space-y-6">
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Creating a Lead Manually</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              To create a new lead, navigate to <strong>Transactions &gt; Leads</strong> and click the "New Lead" button.
            </p>
            <h3 className="text-sm font-semibold text-foreground mb-2">Required Fields</h3>
            <FieldTable fields={[
              { field: "Patient Name", desc: "Full name of the patient or inquiry contact" },
              { field: "Phone", desc: "Primary contact number (used for duplicate detection)" },
              { field: "Lead Source", desc: "Where this lead came from (e.g., Walk-in, Meta Ads, Referral)" },
              { field: "Assigned To", desc: "The CRM user who will handle this lead" },
            ]} />
            <h3 className="text-sm font-semibold text-foreground mb-2 mt-4">Optional Fields</h3>
            <FieldTable fields={[
              { field: "Email", desc: "Patient's email address" },
              { field: "City / State / Country", desc: "Location details" },
              { field: "Campaign", desc: "Link to a specific marketing campaign" },
              { field: "Treatment Interest", desc: "The treatment the patient is interested in" },
              { field: "Consent", desc: "Checkbox indicating patient has given consent for data processing" },
              { field: "Remarks", desc: "Initial notes about the inquiry" },
            ]} />
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Duplicate Detection</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              When you enter a phone number, the system automatically checks for existing leads with the same number. If a duplicate is found, you will be alerted and can choose to view the existing lead instead of creating a duplicate.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Automatic Lead Capture</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Leads can also be created automatically from:
            </p>
            <ul className="list-disc ml-5 space-y-1 text-sm text-muted-foreground">
              <li><strong>Meta Lead Ads:</strong> Facebook and Instagram lead form submissions are synced automatically via the Meta connector</li>
              <li><strong>Telephony (Callyzer):</strong> Incoming calls from unknown numbers can auto-create leads</li>
              <li><strong>Event Registrations:</strong> Event attendees can be converted to leads</li>
              <li><strong>Lead Capture Rules:</strong> Configurable rules route leads from specific sources to designated team members</li>
            </ul>
          </section>
          <TipBox>Always check for duplicates before creating a lead manually. The system uses phone number matching, but slight variations (country code differences) could bypass detection.</TipBox>
        </div>
      ),
    },
    "leads/csv-import": {
      title: "CSV Lead Import",
      content: (
        <div className="space-y-6">
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Bulk Import from CSV</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              The CSV Import tool allows you to bulk-upload leads from a local file. Navigate to <strong>Leads &gt; Import Leads</strong> or use the import button on the Leads page.
            </p>
            <StepList steps={[
              "Download the sample CSV template to see the required column format",
              "Prepare your CSV file with lead data (Name, Phone, Email, etc.)",
              "Drag and drop the file or click to upload your CSV",
              "Map your CSV column headers to the CRM lead fields (e.g., 'Full Name' → 'name')",
              "Configure import settings: Duplicate Strategy, Default Lead Status, and Default Tags",
              "Review the preview and click Import to process",
            ]} />
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Duplicate Handling Strategies</h2>
            <FieldTable fields={[
              { field: "Skip", desc: "If a lead with the same phone number already exists, skip the row entirely" },
              { field: "Update Blank Fields Only", desc: "Only fill in fields that are currently empty on the existing lead" },
              { field: "Overwrite", desc: "Replace existing lead data with the imported data" },
            ]} />
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Import History</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Every import is logged with a timestamp, status (completed/failed), success count, and failure count. You can review past imports at the bottom of the import page.
            </p>
          </section>
          <TipBox>Always download and use the sample template to ensure your columns are formatted correctly. Phone numbers should include country codes for best duplicate detection.</TipBox>
        </div>
      ),
    },
    "leads/google-sheets-import": {
      title: "Google Sheets Import",
      content: (
        <div className="space-y-6">
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Import from Google Sheets</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              The Google Sheets Import allows you to pull leads directly from a live Google Spreadsheet. This is ideal for ongoing lead capture from Google Forms or shared spreadsheets.
            </p>
            <StepList steps={[
              "Navigate to the Google Sheets Import page from the Leads menu",
              "Enter your Google API Key and paste the Google Sheet URL",
              "Select the specific sheet tab to import from",
              "Map the spreadsheet columns to CRM fields (Name, Phone, Email, UTM Source, etc.)",
              "Preview the first few rows to verify the mapping is correct",
              "Configure duplicate handling, default status, and tags",
              "Click Import to start the process",
            ]} />
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">4-Step Import Wizard</h2>
            <FieldTable fields={[
              { field: "Step 1: Connect", desc: "Enter API key and sheet URL, then verify connection" },
              { field: "Step 2: Map", desc: "Map spreadsheet columns to CRM lead fields" },
              { field: "Step 3: Preview", desc: "Review first rows of data before importing" },
              { field: "Step 4: Result", desc: "View import summary with success/failure counts" },
            ]} />
          </section>
          <WarningBox>The Google API Key must have read access to the Google Sheets API. Contact your administrator if you need help setting up API credentials.</WarningBox>
        </div>
      ),
    },
    "leads/lifecycle": {
      title: "Lead Lifecycle Stages",
      content: (
        <div className="space-y-6">
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Lead Status Flow</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Every lead progresses through a defined set of stages. The system tracks movement between stages and calculates time spent at each stage for SLA monitoring.
            </p>
            <div className="space-y-2">
              {[
                { stage: "Raw Lead Captured", desc: "New lead just entered the system. No contact has been attempted yet.", color: "bg-gray-100" },
                { stage: "Contacted", desc: "Agent has made initial contact with the lead. Conversation has started.", color: "bg-blue-50" },
                { stage: "Qualified", desc: "Lead has been assessed and shows genuine interest in treatment.", color: "bg-blue-100" },
                { stage: "Appointment Booked", desc: "A consultation appointment has been scheduled for this lead.", color: "bg-indigo-50" },
                { stage: "Reminder Running", desc: "Automated appointment reminders are being sent. Mapped to Appointment Booked in the funnel.", color: "bg-indigo-100" },
                { stage: "Consultation In Progress", desc: "Patient has checked in and is with the doctor.", color: "bg-violet-50" },
                { stage: "Consultation Done", desc: "Doctor has completed the consultation and logged the outcome.", color: "bg-violet-100" },
                { stage: "Nurture", desc: "Lead is being nurtured via automated follow-up sequences.", color: "bg-amber-50" },
                { stage: "Closed Won", desc: "Lead has converted — treatment confirmed or completed.", color: "bg-green-50" },
                { stage: "Closed Lost", desc: "Lead has been lost — patient not proceeding.", color: "bg-red-50" },
                { stage: "No Show", desc: "Patient did not attend their scheduled appointment.", color: "bg-orange-50" },
                { stage: "Dormant", desc: "No activity for 5+ days. System auto-detects and creates re-engagement tasks.", color: "bg-gray-50" },
              ].map((item, i) => (
                <div key={i} className={`flex items-center gap-3 px-3 py-2 rounded-lg ${item.color}`}>
                  <div className="w-6 h-6 rounded-full bg-white border-2 border-primary/30 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">{i + 1}</div>
                  <div>
                    <span className="text-sm font-semibold text-foreground">{item.stage}</span>
                    <span className="text-xs text-muted-foreground ml-2">— {item.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Unified Patient Journey Funnel</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              The visual funnel bar you see on lead cards and the workspace shows a simplified view: <strong>Raw → Contact → Qual → Appt → Consult</strong> for lead-only records. When a lead has an episode, the funnel extends to show the full 12-stage journey through treatment stages. Past stages show in green, the current stage in blue (lead phase) or violet (episode phase), and future stages in gray.
            </p>
          </section>
        </div>
      ),
    },
    "leads/kanban": {
      title: "Kanban Workspace",
      content: (
        <div className="space-y-6">
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Using the Kanban Board</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              The Kanban view on the Leads page provides a visual, column-based view of your leads organized by their current status. Each column represents a lead status, and each card represents a lead.
            </p>
            <StepList steps={[
              "Navigate to Transactions > Leads",
              "Toggle to the Kanban view using the view switcher at the top",
              "Each column shows leads in that status with a count badge",
              "Click on any lead card to open the Lead Detail page",
              "Use the filters at the top to narrow down by date range, assigned user, or lead source",
            ]} />
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Kanban Card Information</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Each Kanban card displays: patient name, phone number (masked if your PHI access is limited), lead source, age of the lead, treatment interest, and the mini patient journey funnel bar showing progress.
            </p>
          </section>
          <TipBox>The Kanban board is ideal for getting a quick visual overview of your pipeline. For detailed filtering and sorting, switch to the List view.</TipBox>
        </div>
      ),
    },
    "leads/lead-detail": {
      title: "Lead Detail Page",
      content: (
        <div className="space-y-6">
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Lead Detail Layout</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Clicking on any lead opens the Lead Detail page with comprehensive information organized into sections:
            </p>
            <div className="space-y-3">
              {[
                { title: "Header", desc: "Patient name, status badge, lead age, consent badge, and the patient journey funnel bar." },
                { title: "Contact Information", desc: "Phone, email, city, state, country. Visibility depends on your PHI access level." },
                { title: "Lead Details", desc: "Source, campaign, treatment interest, assigned user, and any UTM parameters." },
                { title: "Activity Timeline", desc: "Chronological log of all activities — calls, status changes, notes, appointments, and system events." },
                { title: "Next Actions", desc: "Upcoming tasks and follow-ups. You can create new next actions or delegate them to other team members." },
                { title: "Clinical Notes", desc: "Medical notes with full audit trail showing who added or edited each note." },
                { title: "Communication Preferences", desc: "Per-channel opt-in/opt-out toggles for WhatsApp, SMS, Email, and Phone." },
                { title: "Episodes", desc: "If the lead has consultation episodes, they are listed here with links to episode detail." },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                  <span><strong>{item.title}:</strong> {item.desc}</span>
                </div>
              ))}
            </div>
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Changing Lead Status</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Use the status dropdown on the lead detail page to change the lead's current status. Some transitions trigger automations — for example, moving to "Nurture" starts the nurture task chain, and "Appointment Booked" can trigger reminder sequences.
            </p>
          </section>
        </div>
      ),
    },
    "leads/merge-duplicates": {
      title: "Merge & Duplicates",
      content: (
        <div className="space-y-6">
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Duplicate Detection</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              The system automatically detects potential duplicates based on phone number when creating new leads. If a duplicate is found, you are alerted before the lead is created.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Merging Leads</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              When duplicate leads exist, administrators and managers can merge them into a single record:
            </p>
            <StepList steps={[
              "Identify the duplicate leads (usually found by phone number search)",
              "Select the primary lead (the one that will be kept)",
              "Review the data from both records — activities, notes, and attachments from the secondary lead will be merged into the primary",
              "Confirm the merge — the secondary lead will be marked as merged and all references will point to the primary lead",
            ]} />
          </section>
          <WarningBox>Lead merging is irreversible. Always verify you are merging the correct records before confirming.</WarningBox>
        </div>
      ),
    },
    "leads/nurture-engine": {
      title: "Nurture Engine",
      content: (
        <div className="space-y-6">
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">How the Nurture Engine Works</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              The Nurture Engine is an automated follow-up system that activates when a lead is moved to the "Nurture" status. It creates a sequence of scheduled tasks to ensure consistent follow-up over time.
            </p>
            <h3 className="text-sm font-semibold text-foreground mb-2">Default Nurture Schedule</h3>
            <FieldTable fields={[
              { field: "Day 1", desc: "First follow-up call/message" },
              { field: "Day 3", desc: "Second follow-up" },
              { field: "Day 7", desc: "One-week check-in" },
              { field: "Day 14", desc: "Two-week follow-up" },
              { field: "Day 30", desc: "Monthly check-in" },
              { field: "Day 60", desc: "Final follow-up before dormancy" },
            ]} />
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Escalation & Completion</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              If nurture tasks are overdue and not completed, the system can escalate them to the assigned user's manager. If a lead converts (moves to Appointment Booked or Consultation Done) during nurturing, the remaining nurture tasks are automatically cancelled.
            </p>
          </section>
          <TipBox>The nurture engine works best when agents complete each task promptly and log the outcome. This ensures the system has accurate data for the next scheduled follow-up.</TipBox>
        </div>
      ),
    },
    "leads/dormant-detection": {
      title: "Dormant Lead Detection",
      content: (
        <div className="space-y-6">
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">What is Dormant Detection?</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              The system automatically identifies leads that have had no activity for 5 or more days. These leads are flagged as potentially "Dormant" and re-engagement tasks are created to prompt follow-up.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Exclusions</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-3">
              Not all inactive leads are considered dormant. The system excludes leads that are in active engagement statuses:
            </p>
            <ul className="list-disc ml-5 space-y-1 text-sm text-muted-foreground">
              <li>Appointment Booked (waiting for their appointment)</li>
              <li>Reminder Running (actively being reminded)</li>
              <li>Consultation Done (in the episode phase)</li>
              <li>Nurture (already being nurtured)</li>
              <li>Leads with future scheduled appointments</li>
            </ul>
          </section>
        </div>
      ),
    },
    "appointments/scheduling": {
      title: "Scheduling Appointments",
      content: (
        <div className="space-y-6">
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Creating an Appointment</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Appointments can be created from the Appointments page or directly from a Lead Detail page. The system uses a token-based scheduling approach.
            </p>
            <StepList steps={[
              "Navigate to Transactions > Appointments or click 'Book Appointment' on a lead detail page",
              "Select the patient/lead for the appointment",
              "Choose the doctor and verify their availability via OPD timings",
              "Select the appointment date and time slot",
              "Choose the appointment type (New Consultation, Follow-up, etc.)",
              "Add any notes or special instructions",
              "Save the appointment — the lead status automatically updates to 'Appointment Booked'",
            ]} />
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Appointment Types</h2>
            <FieldTable fields={[
              { field: "New Consultation", desc: "First-time visit with a doctor" },
              { field: "Follow-up", desc: "Return visit for ongoing treatment" },
              { field: "Review", desc: "Post-treatment review appointment" },
            ]} />
          </section>
          <TipBox>Always check doctor availability before booking. The OPD Timings page shows each doctor's schedule, including any leave or blocked dates.</TipBox>
        </div>
      ),
    },
    "appointments/opd-timings": {
      title: "Doctor OPD Timings",
      content: (
        <div className="space-y-6">
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Managing Doctor Schedules</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              OPD (Out-Patient Department) Timings define when each doctor is available for consultations. This information is used by the appointment scheduling system to ensure appointments are only booked during available slots.
            </p>
            <h3 className="text-sm font-semibold text-foreground mb-2">Schedule Components</h3>
            <FieldTable fields={[
              { field: "Recurring Slots", desc: "Regular weekly schedule (e.g., Monday–Friday 9 AM to 1 PM)" },
              { field: "Leave/Exceptions", desc: "Specific dates when the doctor is unavailable (holidays, conferences)" },
              { field: "Consultation Location", desc: "Which branch or facility the doctor is at on each day" },
            ]} />
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Viewing Availability</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              The doctor availability calendar shows a visual view of each doctor's schedule. Green slots indicate available times, and blocked/red slots show unavailable periods. Admins and Managers can edit doctor schedules from the Master Data section.
            </p>
          </section>
        </div>
      ),
    },
    "appointments/doctor-availability": {
      title: "Doctor Availability Calendar",
      content: (
        <div className="space-y-6">
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Availability Calendar</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              The Doctor Availability page provides a monthly calendar view showing doctor leaves and availability. Navigate to <strong>Appointments &gt; Doctor Availability</strong> to access it.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Key Features</h2>
            <FieldTable fields={[
              { field: "Monthly Calendar View", desc: "A visual calendar where days with scheduled leaves are highlighted in red" },
              { field: "Doctor Filter", desc: "Filter the calendar by a specific doctor or view all doctors at once" },
              { field: "Leave Records", desc: "Each leave shows the doctor's name, leave dates (from-to), and the reason" },
              { field: "Upcoming Leaves", desc: "A sidebar list showing the next 10 scheduled leaves across all doctors" },
            ]} />
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Quick Stats</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-3">
              Dashboard cards at the top provide at-a-glance information:
            </p>
            <FieldTable fields={[
              { field: "Active Doctors", desc: "Total number of doctors currently active in the system" },
              { field: "Leaves This Month", desc: "Count of leave days scheduled in the current month" },
              { field: "Total Leave Records", desc: "Historical count of all leave records" },
            ]} />
          </section>
          <TipBox>Check the availability calendar before scheduling appointments to avoid booking patients on days when their doctor is on leave.</TipBox>
        </div>
      ),
    },
    "appointments/check-in": {
      title: "Check-In Process",
      content: (
        <div className="space-y-6">
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Patient Check-In</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              When a patient arrives for their appointment, the front desk checks them in through the CRM. This triggers important workflow automations.
            </p>
            <StepList steps={[
              "Navigate to Transactions > Appointments",
              "Find the patient's appointment (use search or filter by today's date)",
              "Click the 'Check In' button on the appointment row",
              "The system records the check-in time and updates the appointment status",
              "An Episode (Consultation In Progress) is automatically created for the patient",
              "The lead status updates to 'Consultation In Progress'",
            ]} />
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">What Happens at Check-In</h2>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span>Check-in timestamp is recorded for the appointment</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span>A new Consultation Episode is created (status: "Consultation In Progress")</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span>The lead transitions to the episode phase of the patient journey</span>
              </li>
            </ul>
          </section>
          <WarningBox>The "Consultation Done" action on the appointments page requires an episode to exist. Always check in the patient first before marking consultation as done.</WarningBox>
        </div>
      ),
    },
    "episodes/episode-lifecycle": {
      title: "Episode Lifecycle",
      content: (
        <div className="space-y-6">
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">What is an Episode?</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              An Episode represents a specific treatment journey for a patient. While a Lead tracks the initial inquiry and qualification, an Episode tracks everything from consultation through treatment completion and post-care. A single lead can have multiple episodes (e.g., a patient who comes for knee replacement and later returns for hip replacement).
            </p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Episode Status Flow</h2>
            <div className="space-y-2">
              {[
                { stage: "Consultation In Progress", desc: "Created automatically at check-in. Patient is with the doctor." },
                { stage: "Consultation Done", desc: "Doctor has completed consultation and logged the outcome." },
                { stage: "Treatment Planning", desc: "Treatment plan is being prepared — costs, timelines, procedures." },
                { stage: "Surgery Scheduled", desc: "Surgery/procedure date has been confirmed." },
                { stage: "Surgery Done", desc: "The surgical procedure has been completed." },
                { stage: "In Treatment", desc: "Patient is undergoing active treatment (inpatient or ongoing care)." },
                { stage: "Post Care", desc: "Treatment complete, patient is in post-care follow-up phase." },
                { stage: "Follow Up", desc: "Long-term follow-up phase." },
                { stage: "Completed", desc: "Episode fully completed — all follow-ups done." },
                { stage: "Discontinued", desc: "Treatment discontinued by patient or doctor." },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/50">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">{i + 1}</div>
                  <div>
                    <span className="text-sm font-semibold text-foreground">{item.stage}</span>
                    <span className="text-xs text-muted-foreground ml-2">— {item.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      ),
    },
    "episodes/consultation-log": {
      title: "Consultation Log & Outcomes",
      content: (
        <div className="space-y-6">
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Logging a Consultation Outcome</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              After a doctor completes a consultation, the outcome is logged in the Episode Detail page. This is a critical step that determines the next phase of the patient's journey.
            </p>
            <h3 className="text-sm font-semibold text-foreground mb-2">Consultation Outcomes</h3>
            <FieldTable fields={[
              { field: "Treatment Recommended", desc: "Doctor recommends a treatment/procedure. Episode continues to Treatment Planning." },
              { field: "Follow-up Required", desc: "Patient needs another consultation or further evaluation." },
              { field: "Conservative Treatment", desc: "Non-surgical treatment recommended (medication, physiotherapy, etc.)." },
              { field: "Referred", desc: "Patient referred to another specialist or facility." },
              { field: "No Treatment Required", desc: "Doctor determines no treatment is needed. Auto-closes the episode." },
              { field: "Patient Did Not Proceed", desc: "Patient decides not to proceed with treatment. Auto-closes the episode." },
            ]} />
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Remark Chips</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Each consultation outcome has configurable remark chips — predefined tags that provide quick categorization. These are managed through the Consultation Outcome Remarks master table and can be customized per hospital. You can select one or more chips and add free-text remarks.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Next Actions</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              For outcomes that don't auto-close the episode, a Next Action panel appears allowing you to schedule follow-up tasks, set the next appointment date, and assign the follow-up to a team member. The episode status automatically transitions to "Consultation Done" when the log is submitted.
            </p>
          </section>
        </div>
      ),
    },
    "episodes/clinical-tab": {
      title: "Clinical Information",
      content: (
        <div className="space-y-6">
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Clinical Tab Overview</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              The Clinical tab is the default view on the Episode Detail page. It contains the core medical information for this treatment episode, divided into three sections: Episode Details, Case Ownership, and Clinical Information.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Episode Details</h2>
            <FieldTable fields={[
              { field: "Episode Name", desc: "The name/title of this treatment episode (e.g., 'Robotic Knee Replacement - Right')" },
              { field: "Type", desc: "Episode type classification" },
              { field: "Status", desc: "Current status in the episode lifecycle" },
              { field: "Start Date", desc: "When this episode was created (typically at check-in)" },
              { field: "End Date", desc: "When the episode was completed or discontinued" },
              { field: "Lead ID", desc: "Link back to the original lead record" },
            ]} />
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Case Ownership</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-3">
              Each episode can have up to three doctor assignments for different phases of care:
            </p>
            <FieldTable fields={[
              { field: "Primary Doctor (Case Owner)", desc: "The main consulting doctor responsible for this case. Required field." },
              { field: "Surgery Doctor", desc: "The surgeon performing the procedure (if different from the primary doctor)" },
              { field: "Post-Care Doctor", desc: "The doctor responsible for post-operative care and follow-up" },
            ]} />
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Clinical Information</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-3">
              The Clinical Information card contains the medical details of the case:
            </p>
            <FieldTable fields={[
              { field: "Diagnosis", desc: "The medical diagnosis for this episode" },
              { field: "Treatment Plan", desc: "Detailed treatment plan as determined by the doctor" },
              { field: "Notes", desc: "Additional clinical notes and observations" },
            ]} />
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Editing Clinical Notes</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Clinical notes have a special edit workflow with audit controls:
            </p>
            <StepList steps={[
              "Click the pencil (edit) icon on the Clinical Information card",
              "The fields switch to edit mode — modify Diagnosis, Treatment Plan, and Notes as needed",
              "Click 'Save' — a dialog will ask you to provide a reason for the edit",
              "Enter the reason (minimum 10 characters) explaining why the change was made",
              "Click 'Confirm Save' — the edit is saved and the reason is recorded in the audit trail",
            ]} />
          </section>
          <WarningBox>Clinical note edits are tracked with full audit trails including who made the change, when, and why. Only users with the appropriate role permissions can edit clinical notes.</WarningBox>
        </div>
      ),
    },
    "episodes/financial-tab": {
      title: "Financial & Billing",
      content: (
        <div className="space-y-6">
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Financial Tab Overview</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              The Financial tab on the Episode Detail page manages all cost-related information for a treatment episode — from initial quotation through billing and discount approval.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Quote & Billing</h2>
            <FieldTable fields={[
              { field: "Initial Quote (₹)", desc: "The original quoted amount for the treatment. Editable until a discount is approved." },
              { field: "Discount (₹)", desc: "The discount amount applied. Shows 'Approved Discount' once approved by management." },
              { field: "Final Quote (₹)", desc: "Auto-calculated: Initial Quote minus Approved Discount. Read-only." },
              { field: "Actual Bill (₹)", desc: "The actual amount billed to the patient after treatment" },
              { field: "Variance (₹)", desc: "Auto-calculated: Final Quote minus Actual Bill. Shows 'Under budget' (green) or 'Over budget' (red)." },
            ]} />
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Discount Approval Workflow</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Discounts go through a formal approval process to maintain financial controls:
            </p>
            <StepList steps={[
              "Counsellor enters the discount percentage and amount in the Negotiation & Discount section",
              "Add discount notes explaining why the discount is being offered",
              "Click 'Submit for Approval' — the discount request enters 'Pending' status",
              "An Admin or Manager reviews the request and can Approve or Revoke it",
              "If Approved: the discount is applied and the Final Quote updates automatically",
              "If Revoked: the reviewer provides a reason, and the discount is removed",
            ]} />
            <h3 className="text-sm font-semibold text-foreground mb-2 mt-4">Discount Status Badges</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Badge className="bg-muted text-muted-foreground text-[10px]">Draft</Badge>
                <span>— Discount has not been submitted yet</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Badge className="bg-amber-100 text-amber-800 text-[10px]">Pending</Badge>
                <span>— Submitted, waiting for manager/admin approval</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Badge className="bg-green-100 text-green-800 text-[10px]">Approved</Badge>
                <span>— Discount approved and applied to the final quote</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Badge className="bg-red-100 text-red-800 text-[10px]">Revoked</Badge>
                <span>— Discount rejected by management</span>
              </div>
            </div>
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Quotation Builder Integration</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              The Financial tab includes a Quotation Builder that lets you create itemized cost breakdowns using Cost Heads from master data (e.g., Surgery Charges, Room Charges, Implant Cost, Pharmacy). The total from the quotation feeds directly into the Initial Quote field. See the dedicated <strong>Quotation Builder</strong> topic for full details.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Revenue Tracking</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              The Financial tab also contributes to pipeline value and realized revenue calculations on the dashboard. The Initial Quote feeds into the pipeline value, and the Actual Bill feeds into realized revenue once the episode is completed.
            </p>
          </section>
          <TipBox>Once a discount is approved, the Initial Quote and discount fields become read-only. If a correction is needed, an Admin must first revoke the existing discount.</TipBox>
        </div>
      ),
    },
    "episodes/insurance-tab": {
      title: "Insurance & Pre-Auth",
      content: (
        <div className="space-y-6">
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Insurance Tab Overview</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              The Insurance tab manages all insurance-related details for a treatment episode. It is only relevant when the patient has insurance coverage. Toggle the "Insurance Applicable" switch to enable the insurance fields.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Enabling Insurance</h2>
            <StepList steps={[
              "Open the Episode Detail page and click the Insurance tab",
              "Toggle the 'Insurance Applicable' switch to ON",
              "The Insurance Provider and Pre-Authorization sections will appear",
            ]} />
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Insurance Provider Details</h2>
            <FieldTable fields={[
              { field: "Insurer", desc: "The insurance company (e.g., Star Health, HDFC ERGO). Selected from master data." },
              { field: "TPA", desc: "Third-Party Administrator handling claims processing (e.g., Medi Assist, Vidal Health)" },
              { field: "Policy Type", desc: "Type of insurance policy (e.g., Individual, Family Floater, Group)" },
            ]} />
            <TipBox>If the insurer, TPA, or policy type you need isn't in the list, click 'Request New' next to the field. This submits a new entry to the Master Data approval queue.</TipBox>
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Pre-Authorization</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-3">
              Pre-authorization (pre-auth) is the process of getting approval from the insurance company before the treatment begins. Track the full pre-auth lifecycle:
            </p>
            <FieldTable fields={[
              { field: "Pre-Auth Status", desc: "Current status (e.g., Not Submitted, Submitted, Approved, Rejected, Enhancement Required)" },
              { field: "Submitted At", desc: "Date/time when the pre-auth request was submitted (auto-recorded)" },
              { field: "Approved Amount", desc: "The amount approved by the insurance company (₹)" },
              { field: "Rejection Reason", desc: "If rejected, the reason provided by the insurer (selected from master data)" },
            ]} />
          </section>
          <WarningBox>Insurance details are part of Protected Health Information (PHI). Users with 'None' PHI access level will not see insurance information.</WarningBox>
        </div>
      ),
    },
    "episodes/family-tab": {
      title: "Family & Decision Status",
      content: (
        <div className="space-y-6">
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Family Tab Overview</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              The Family & Decision Status tab tracks the family's involvement in the treatment decision. This is especially important in orthopedic surgery decisions where family support and agreement are critical for successful outcomes.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Family & Decision Fields</h2>
            <FieldTable fields={[
              { field: "Family Discussion Done", desc: "Toggle switch — has the family been consulted about the treatment plan? Turn ON after the counsellor has discussed with the family." },
              { field: "Second Opinion Taken", desc: "Toggle switch — has the patient sought a second medical opinion? This is common for major surgeries and helps track patient readiness." },
              { field: "Decision Status", desc: "Current family decision status from the dropdown (see options below)" },
              { field: "Decision Notes", desc: "Free-text area for detailed notes about the family's concerns, questions, and feedback" },
            ]} />
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Decision Status Options</h2>
            <div className="space-y-2">
              {[
                { status: "Pending", desc: "No decision made yet — family is still considering" },
                { status: "Approved by Family", desc: "Family agrees with the treatment plan and gives consent to proceed" },
                { status: "Rejected by Family", desc: "Family does not agree with the proposed treatment" },
                { status: "Seeking Second Opinion", desc: "Patient/family wants another doctor's opinion before deciding" },
                { status: "Decided to Proceed", desc: "Final decision to go ahead with the treatment" },
                { status: "Decided Not to Proceed", desc: "Final decision not to proceed with treatment" },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                  <span><strong>{item.status}:</strong> {item.desc}</span>
                </div>
              ))}
            </div>
          </section>
          <TipBox>Tracking family decisions helps counsellors identify which episodes need more engagement. A patient with "Seeking Second Opinion" status may need additional support to address their concerns about the treatment.</TipBox>
        </div>
      ),
    },
    "episodes/treatment-planning": {
      title: "Treatment Planning",
      content: (
        <div className="space-y-6">
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Treatment Planning Phase</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Once a consultation concludes with "Treatment Recommended," the episode moves to the Treatment Planning phase. This is where the detailed treatment plan is prepared.
            </p>
            <h3 className="text-sm font-semibold text-foreground mb-2">Key Fields in Treatment Planning</h3>
            <FieldTable fields={[
              { field: "Treatment Type", desc: "The specific procedure or treatment (from master data)" },
              { field: "Estimated Cost", desc: "Projected cost of the treatment" },
              { field: "Discount", desc: "Any applicable discount (may require manager/admin approval)" },
              { field: "Insurance / TPA", desc: "Insurance provider and pre-authorization details" },
              { field: "Conversion Stage", desc: "Where the patient is in their decision process" },
              { field: "Revenue Probability", desc: "System-calculated likelihood of conversion based on stage and engagement" },
            ]} />
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Discount Approval Workflow</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              If a discount exceeds the counsellor's authorized limit, it triggers an approval request to the manager or admin. The episode shows a pending approval badge until the discount is approved or rejected.
            </p>
          </section>
        </div>
      ),
    },
    "episodes/intelligence": {
      title: "Episode Intelligence",
      content: (
        <div className="space-y-6">
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Temperature Engine</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              The Temperature Engine automatically categorizes leads and episodes as Hot, Warm, or Cold based on engagement signals:
            </p>
            <div className="space-y-2">
              <div className="flex items-center gap-2 px-3 py-2 rounded bg-red-50">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span className="text-sm font-semibold text-foreground">Hot</span>
                <span className="text-xs text-muted-foreground">— Recent activity, appointment booked, high engagement</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 rounded bg-amber-50">
                <div className="w-3 h-3 rounded-full bg-amber-500" />
                <span className="text-sm font-semibold text-foreground">Warm</span>
                <span className="text-xs text-muted-foreground">— Some engagement but not yet committed, moderate recency</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 rounded bg-blue-50">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span className="text-sm font-semibold text-foreground">Cold</span>
                <span className="text-xs text-muted-foreground">— Low engagement, no recent contact, extended inactivity</span>
              </div>
            </div>
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Auto-Handover Engine</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              The Auto-Handover Engine automatically assigns or transfers leads/episodes to the appropriate team based on stage transitions. For example, when a lead progresses from qualification to consultation, it can be automatically handed over from the tele-calling team to the counselling team.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Revenue Probability</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              The system calculates a revenue probability percentage for each episode based on the treatment type, current conversion stage, and historical conversion data. This powers the pipeline value calculations on the dashboard and helps managers forecast revenue.
            </p>
          </section>
        </div>
      ),
    },
    "episodes/quotation-builder": {
      title: "Quotation Builder",
      content: (
        <div className="space-y-6">
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">What is the Quotation Builder?</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              The Quotation Builder allows counsellors to create detailed, itemized cost breakdowns for a patient's treatment. Instead of a single lump-sum quote, you can list individual cost items — each linked to a Cost Head from master data — giving the patient a transparent view of what they are paying for.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Creating a Quotation</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              The Quotation Builder is available on the Financial tab of the Episode Detail page.
            </p>
            <StepList steps={[
              "Open the Episode Detail page and navigate to the Financial tab",
              "Scroll to the Quotation Builder section",
              "Click 'Add Item' to add a line item to the quotation",
              "Select a Cost Head (e.g., Surgery Charges, Room Charges, Anaesthesia, Implant Cost, Pharmacy, Investigation, Physiotherapy)",
              "Enter the amount for that item and an optional description",
              "Repeat to add all applicable cost items",
              "The total is automatically calculated as the sum of all line items",
              "Save the quotation — the total feeds into the episode's Initial Quote field",
            ]} />
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Quotation Item Fields</h2>
            <FieldTable fields={[
              { field: "Cost Head", desc: "Category of the charge — selected from the Cost Heads master table (e.g., Surgery Charges, Room Charges, Implant Cost)" },
              { field: "Description", desc: "Optional free-text description of the charge (e.g., 'Ceramic knee implant — Smith & Nephew')" },
              { field: "Amount (₹)", desc: "The amount for this line item" },
            ]} />
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Managing Cost Heads</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Cost Heads are managed in the Master Data section. Common cost heads include Surgery Charges, Room Charges, Anaesthesia, Investigation, Pharmacy, Implant Cost, Physiotherapy, Doctor Fees, and Miscellaneous. Admins can add new cost heads through the master data workflow with approval.
            </p>
          </section>
          <TipBox>Use the Quotation Builder for every treatment plan to give patients a clear, professional cost breakdown. This builds trust and reduces billing disputes later.</TipBox>
        </div>
      ),
    },
    "episodes/room-allocation": {
      title: "Room Allocation",
      content: (
        <div className="space-y-6">
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Room Allocation for Episodes</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              When a patient is admitted for treatment, you can assign a room type and room number to their episode. This is tracked on the Clinical tab of the Episode Detail page.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Room Allocation Fields</h2>
            <FieldTable fields={[
              { field: "Room Type", desc: "Category of room — selected from the Room Types master table (e.g., General Ward, Semi-Private, Private, Deluxe, Suite, ICU, HDU, NICU, Day Care)" },
              { field: "Room Number", desc: "Specific room number or identifier within the hospital" },
            ]} />
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Managing Room Types</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Room Types are managed in the Master Data section. The system comes pre-configured with common room types (General Ward, Semi-Private, Private, Deluxe, Suite, ICU, HDU, NICU, Day Care). Admins can add additional room types through the master data workflow.
            </p>
          </section>
          <TipBox>Room allocation helps track bed utilization and is especially useful for billing — different room types have different daily charges which can be added as a line item in the Quotation Builder.</TipBox>
        </div>
      ),
    },
    "episodes/surgery-scheduling": {
      title: "Surgery Scheduling",
      content: (
        <div className="space-y-6">
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Scheduling a Surgery</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              When an episode reaches the treatment planning or surgery scheduling phase, you can schedule the surgery date and time directly from the Episode Detail page.
            </p>
            <StepList steps={[
              "Open the Episode Detail page",
              "Click the 'Schedule Surgery' button (available when the episode is in Treatment Planning or later stages)",
              "A scheduling dialog opens with the following fields",
              "Select the surgery date and time",
              "Assign the operating surgeon (defaults to the episode's Surgery Doctor if set)",
              "Select the surgery type and operating theatre/room if applicable",
              "Add any pre-operative notes or special instructions",
              "Optionally set surgery alerts for the team",
              "Click 'Schedule' to confirm — the episode status automatically moves to 'Surgery Scheduled'",
            ]} />
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Surgery Details Display</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-3">
              Once a surgery is scheduled, the details are prominently displayed on the Episode Detail page in a highlighted card showing:
            </p>
            <FieldTable fields={[
              { field: "Surgery Date & Time", desc: "The scheduled date and time of the procedure" },
              { field: "Operating Surgeon", desc: "The doctor performing the surgery" },
              { field: "Status", desc: "Surgery Scheduled, Surgery Done, or Cancelled" },
              { field: "Pre-Op Notes", desc: "Any special instructions or preparation notes" },
            ]} />
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Automated Actions</h2>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span>A high-priority task is auto-created for surgery preparation</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span>The surgery appears on the Surgery Calendar for team visibility</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span>Surgery date and time are shown in the patient journey timeline</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span>Episode status transitions to "Surgery Scheduled" automatically</span>
              </li>
            </ul>
          </section>
          <WarningBox>Surgery scheduling validates that all required fields (date, time, surgeon) are provided. The system prevents scheduling surgeries in the past.</WarningBox>
        </div>
      ),
    },
    "post-care/protocols": {
      title: "Setting Up Protocols",
      content: (
        <div className="space-y-6">
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">What are Post-Care Protocols?</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Post-Care Protocols are configurable follow-up schedules that automatically create tasks when a patient's episode reaches the "Post Care" or "Completed" stage. They ensure no patient falls through the cracks after treatment.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Creating a Protocol</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Navigate to <strong>Configurations &gt; Post-Care Protocols</strong> to create and manage protocols.
            </p>
            <StepList steps={[
              "Click 'New Protocol' to create a new post-care protocol",
              "Enter the protocol name (e.g., 'Post Knee Replacement Follow-Up')",
              "Add steps — each step defines a follow-up task at a specific number of days after the episode status change",
              "For each step, set: Days After (e.g., 7, 30, 90, 180, 365), Task Title, and Assignee Type",
              "Assignee Types: Post Care Owner (episode owner), Counsellor, or Round Robin (auto-distribute)",
              "Save the protocol — it will automatically apply to matching episodes",
            ]} />
          </section>
          <TipBox>Create protocol templates for your most common procedures. For example, a "Standard Post-Surgery" protocol with Day 7, 30, 90, and 365 follow-ups.</TipBox>
        </div>
      ),
    },
    "post-care/auto-triggering": {
      title: "How Auto-Triggering Works",
      content: (
        <div className="space-y-6">
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Automatic Activation</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Post-Care Protocols activate automatically based on episode status changes:
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span>When an episode moves to <strong>"Post Care"</strong> status, matching protocols start</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span>When an episode moves to <strong>"Completed"</strong> status, protocols also trigger</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span>Each protocol step creates a scheduled task with the calculated due date</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span>Tasks are assigned based on the step's assignee type (Post Care Owner, Counsellor, or Round Robin)</span>
              </li>
            </ul>
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Example</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              If a "Post Knee Replacement" protocol has steps at Day 7, Day 30, Day 90, and Day 365, and the episode moves to "Post Care" on January 1st, the system will automatically create tasks due on January 8th, January 31st, April 1st, and January 1st of the following year.
            </p>
          </section>
        </div>
      ),
    },
    "post-care/timeline": {
      title: "Post-Care Timeline",
      content: (
        <div className="space-y-6">
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Viewing the Timeline</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              The Episode Detail page includes a Post-Care Timeline component that visualizes all protocol steps in a chronological view. Each step shows:
            </p>
            <FieldTable fields={[
              { field: "Step Number", desc: "The sequence order of the follow-up step" },
              { field: "Task Title", desc: "Description of the follow-up action" },
              { field: "Days After", desc: "Number of days after the trigger event" },
              { field: "Due Date", desc: "Calculated actual date the task is due" },
              { field: "Status", desc: "Whether the task is pending, completed, or overdue" },
              { field: "Assigned To", desc: "The team member responsible for this follow-up" },
            ]} />
          </section>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Completed steps show a green check, overdue steps show a red alert, and upcoming steps show in the default style. This gives counsellors and managers a quick visual of where each patient stands in their post-care journey.
          </p>
        </div>
      ),
    },
    "referrals/creating-referrals": {
      title: "Creating Referrals",
      content: (
        <div className="space-y-6">
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">What is a Referral?</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              A Referral tracks when a patient, doctor, or partner refers someone to your hospital. The referral module captures who referred, through which channel, and whether the referral converted into a new patient.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Creating a Referral</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Navigate to <strong>Transactions &gt; Referrals</strong> and click "New Referral."
            </p>
            <h3 className="text-sm font-semibold text-foreground mb-2">Referral Fields</h3>
            <FieldTable fields={[
              { field: "Referrer Name", desc: "Name of the person who made the referral" },
              { field: "Referrer Phone", desc: "Contact number of the referrer" },
              { field: "Channel", desc: "How the referral was made (Word of Mouth, Doctor Referral, Referral Card, etc.)" },
              { field: "Referred Patient Name", desc: "Name of the person being referred" },
              { field: "Referred Patient Phone", desc: "Contact number of the referred patient" },
              { field: "Treatment Interest", desc: "What treatment the referred patient is interested in" },
              { field: "Outcome", desc: "Current status of the referral (Pending, Contacted, Converted, Lost)" },
              { field: "Resulting Lead", desc: "The CRM lead created from this referral (linked automatically or manually)" },
            ]} />
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Referral Channels</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Available channels: Word of Mouth, Referral Card, Doctor Referral, Staff Referral, Social Media, Patient Testimonial, Community Event, and Other. These help you understand which referral methods are most effective.
            </p>
          </section>
        </div>
      ),
    },
    "referrals/referral-ready": {
      title: "Marking Episodes Referral-Ready",
      content: (
        <div className="space-y-6">
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Referral-Ready Status</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              When a patient's treatment is going well and they might be willing to refer others, you can mark their episode as "Referral Ready." This flags the episode for the referral team.
            </p>
            <StepList steps={[
              "Open the Episode Detail page for the patient",
              "Look for the 'Mark as Referral Ready' button (available for eligible episode statuses)",
              "Click the button to mark the episode as referral-ready",
              "The episode will show a 'Referral Ready' badge with the date it was marked",
              "The referral team can then follow up with the patient to request referrals",
            ]} />
          </section>
          <TipBox>The best time to ask for referrals is when patients are happiest with their treatment outcome — typically during the Post Care or Follow Up stages.</TipBox>
        </div>
      ),
    },
    "referrals/tracking-outcomes": {
      title: "Tracking & Outcomes",
      content: (
        <div className="space-y-6">
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Referral Dashboard</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              The Referrals page displays key metrics at the top:
            </p>
            <FieldTable fields={[
              { field: "Total Referrals", desc: "All referrals created in the system" },
              { field: "Converted", desc: "Referrals that resulted in new patients/leads" },
              { field: "Pending", desc: "Referrals still being followed up" },
              { field: "Conversion Rate", desc: "Percentage of referrals that converted" },
            ]} />
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Tracking Referral Outcomes</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Update the outcome field on each referral as it progresses. When a referral converts, link it to the resulting CRM lead for complete attribution tracking. The system validates that the linked lead belongs to your hospital to prevent cross-tenant data leaks.
            </p>
          </section>
        </div>
      ),
    },
    "events/creating-events": {
      title: "Creating Events",
      content: (
        <div className="space-y-6">
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Event Types</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-3">
              The Event Management module supports various event types for hospital marketing and community engagement:
            </p>
            <FieldTable fields={[
              { field: "Health Camp", desc: "Community health screening and awareness events" },
              { field: "Seminar", desc: "Educational presentations for patients or medical professionals" },
              { field: "Webinar", desc: "Online educational or marketing sessions" },
              { field: "Workshop", desc: "Hands-on training or rehabilitation workshops" },
              { field: "Community Outreach", desc: "Outreach programs in local communities" },
              { field: "Other", desc: "Any other type of hospital event" },
            ]} />
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Creating an Event</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Navigate to <strong>Transactions &gt; Events</strong> and click "New Event."
            </p>
            <StepList steps={[
              "Enter the event code (unique identifier), name, and type",
              "Set the venue and event dates (start and end)",
              "Define the capacity (maximum attendees)",
              "Set the budget if applicable",
              "Optionally link to a campaign for attribution tracking",
              "Save the event — it will appear on the Events page as a card",
            ]} />
          </section>
        </div>
      ),
    },
    "events/registrations": {
      title: "Registrations & Attendance",
      content: (
        <div className="space-y-6">
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Managing Registrations</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Each event has a registration table where you can add and manage attendees. Click on an event card to open the Event Detail page with the registrations table.
            </p>
            <h3 className="text-sm font-semibold text-foreground mb-2">Registration Fields</h3>
            <FieldTable fields={[
              { field: "Name", desc: "Attendee's full name" },
              { field: "Phone", desc: "Contact number" },
              { field: "Email", desc: "Email address (optional)" },
              { field: "Status", desc: "Registration status (Registered, Confirmed, Attended, No-Show, Cancelled)" },
              { field: "Source", desc: "How they registered (Walk-in, Online, Phone, etc.)" },
            ]} />
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Marking Attendance</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              On the day of the event, use the attendance features:
            </p>
            <ul className="list-disc ml-5 space-y-1 text-sm text-muted-foreground">
              <li><strong>Individual Check-In:</strong> Click the check-in button next to each attendee</li>
              <li><strong>Bulk Attendance:</strong> Select multiple attendees using checkboxes and use the bulk action to mark all as "Attended" at once</li>
            </ul>
          </section>
          <TipBox>Use the bulk attendance feature for large events like health camps where checking in attendees one by one would be too slow.</TipBox>
        </div>
      ),
    },
    "events/convert-to-lead": {
      title: "Converting Attendees to Leads",
      content: (
        <div className="space-y-6">
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Convert to Lead</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              After an event, you can convert interested attendees into CRM leads for follow-up. This connects your event marketing directly into the sales pipeline.
            </p>
            <StepList steps={[
              "Open the Event Detail page",
              "In the registrations table, select the attendees you want to convert",
              "Click the 'Convert to Lead' button",
              "The system checks for duplicate phone numbers — if an existing lead has the same phone, the registration is linked to the existing lead",
              "For new leads, a lead record is created with the event as the source",
              "The event registration record is updated with a link to the resulting lead",
            ]} />
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Event Attribution</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              When a lead is created from an event registration, the event source is preserved on the lead record. If the event is linked to a campaign, the campaign attribution also carries over. This gives you complete tracking from event → lead → episode → revenue.
            </p>
          </section>
        </div>
      ),
    },
    "events/event-resources": {
      title: "Event Resource Links",
      content: (
        <div className="space-y-6">
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">What are Event Resource Links?</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Resource Links allow you to attach external URLs to events — such as registration forms, landing pages, posters, invitations, brochures, and videos. These links are shared across the team so everyone has quick access to event materials.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Available Link Types</h2>
            <FieldTable fields={[
              { field: "Registration Form", desc: "Link to the event's registration form (Google Form, Typeform, etc.)" },
              { field: "Landing Page", desc: "Event landing page or microsite URL" },
              { field: "Poster", desc: "Link to the event poster creative (Google Drive, Canva, etc.)" },
              { field: "Invitation", desc: "Digital invitation or e-invite link" },
              { field: "Brochure", desc: "Event brochure or information document" },
              { field: "Video", desc: "Promotional video or event teaser" },
              { field: "Other", desc: "Any other type of resource link" },
            ]} />
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Adding Resource Links</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Resource links can be added when creating or editing an event:
            </p>
            <StepList steps={[
              "Open the Create Event or Edit Event dialog",
              "Scroll to the 'Resource Links' section at the bottom",
              "Click 'Add Link' to add a new resource link",
              "Select the link type from the dropdown",
              "Enter the URL (must be a valid http or https URL)",
              "Optionally add a custom label for the link",
              "Add more links as needed — you can reorder them by drag or remove them",
              "Save the event — all links are saved along with the event",
            ]} />
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Viewing Resource Links</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              On the Event Detail page, resource links appear in a dedicated "Resource Links" card. Each link shows its type icon, label, and a clickable URL that opens in a new browser tab. This makes it easy for anyone on the team to quickly access event materials.
            </p>
          </section>
          <TipBox>Use Google Drive or similar cloud storage to host your event creatives, then add the shareable links here. This ensures everyone on the team has access to the latest versions.</TipBox>
        </div>
      ),
    },
    "campaigns/campaign-setup": {
      title: "Campaign Setup",
      content: (
        <div className="space-y-6">
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Creating a Campaign</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Campaigns organize your marketing efforts and enable attribution tracking. Navigate to <strong>Transactions &gt; Campaigns</strong> to create and manage campaigns.
            </p>
            <StepList steps={[
              "Click 'New Campaign' to create a new campaign",
              "Enter the campaign name following the naming convention (see Naming Conventions topic)",
              "Select the funnel stage: TOFU (Top of Funnel), MOFU (Middle), or BOFU (Bottom)",
              "Choose the platform (Meta, Google, WhatsApp, etc.)",
              "Set the target audience description",
              "Specify the campaign channel from the master data list",
              "Enter the budget if applicable",
              "Save the campaign — it will be available for linking to leads",
            ]} />
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Linking Campaigns to Leads</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              When creating or editing a lead, you can link it to a campaign using the Campaign field. For leads coming from Meta Lead Ads, the campaign is linked automatically via the Meta connector. This enables end-to-end attribution from campaign spend to patient revenue.
            </p>
          </section>
        </div>
      ),
    },
    "campaigns/campaign-dashboard": {
      title: "Campaign Dashboard & Stats",
      content: (
        <div className="space-y-6">
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Campaign Statistics</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              At the top of the Campaigns page, four summary cards give you an at-a-glance overview of your marketing activity:
            </p>
            <FieldTable fields={[
              { field: "Total Campaigns", desc: "Count of all campaigns created in the system" },
              { field: "Active", desc: "Number of currently running (active) campaigns" },
              { field: "Total Budget", desc: "Aggregated budget across all campaigns (₹)" },
              { field: "Platforms", desc: "Count of unique advertising platforms being used" },
            ]} />
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Supported Platforms</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-3">
              The CRM supports campaigns across multiple advertising platforms:
            </p>
            <div className="grid grid-cols-2 gap-2">
              {["Meta (Facebook & Instagram)", "Google Ads", "LinkedIn", "X (Twitter)", "YouTube", "Microsoft Ads (Bing)", "WhatsApp", "Offline"].map((p, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                  {p}
                </div>
              ))}
            </div>
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Search & Filters</h2>
            <FieldTable fields={[
              { field: "Search", desc: "Text search across campaign names" },
              { field: "Platform Filter", desc: "Filter campaigns by advertising platform" },
              { field: "Status Filter", desc: "Show only Active or Inactive campaigns" },
            ]} />
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Campaign Detail View</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-3">
              Click any campaign to open its detail dialog with three tabs:
            </p>
            <FieldTable fields={[
              { field: "Details Tab", desc: "Full metadata — platform, objective, funnel stage, channel, target audience, budget, dates, and name breakdown" },
              { field: "Resources Tab", desc: "View all attached resource links (Posters, Reels, Videos, Ad Creatives, Landing Pages) with clickable URLs. Add or manage links from the Edit dialog." },
              { field: "UTM Parameters Tab", desc: "View and copy individual UTM parameters or the full UTM query string for tracking URLs" },
            ]} />
          </section>
          <TipBox>The auto-increment feature automatically suggests the next ad number (Ad2, Ad3, etc.) when you create a campaign with the same platform, objective, and month as an existing one.</TipBox>
        </div>
      ),
    },
    "campaigns/campaign-resources": {
      title: "Campaign Resource Links",
      content: (
        <div className="space-y-6">
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">What are Campaign Resource Links?</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Campaign Resource Links let you attach external URLs to campaigns — such as ad creatives, posters, reels, videos, and landing pages. This keeps all campaign assets organized and accessible to everyone on the marketing team.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Available Link Types</h2>
            <FieldTable fields={[
              { field: "Poster", desc: "Static image creative — poster or banner design" },
              { field: "Reel", desc: "Short-form video content (Instagram Reels, YouTube Shorts)" },
              { field: "Video", desc: "Full-length video ad or promotional content" },
              { field: "Ad Creative", desc: "General ad creative asset — carousel images, display ads, etc." },
              { field: "Landing Page", desc: "The campaign's landing page or lead capture page URL" },
              { field: "Other", desc: "Any other type of campaign resource" },
            ]} />
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Adding Resource Links to Campaigns</h2>
            <StepList steps={[
              "Open the Create Campaign or Edit Campaign dialog",
              "Scroll to the 'Creative / Resource Links' section",
              "Click 'Add Link' to add a resource",
              "Select the type (Poster, Reel, Video, Ad Creative, Landing Page, Other)",
              "Paste the URL — must be a valid http or https URL (e.g., Google Drive link, Canva share URL)",
              "Optionally add a descriptive label (e.g., 'Main Banner v2')",
              "Add as many links as needed",
              "Save the campaign — links are saved automatically",
            ]} />
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Viewing Campaign Resources</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-3">
              When you open a campaign's detail dialog, the Resources tab shows all attached links. Each link displays:
            </p>
            <ul className="list-disc ml-5 space-y-1 text-sm text-muted-foreground">
              <li>A type icon indicating the kind of resource (Poster, Reel, Video, etc.)</li>
              <li>The label or URL as the display text</li>
              <li>A clickable link that opens in a new browser tab</li>
            </ul>
          </section>
          <TipBox>Store your campaign creatives on Google Drive and add the shareable links here. This way, the entire team can access the latest ad assets without searching through email or chat.</TipBox>
        </div>
      ),
    },
    "campaigns/naming-conventions": {
      title: "Naming Conventions",
      content: (
        <div className="space-y-6">
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Campaign Naming Format</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              The CRM uses a standardized campaign naming convention for consistency and easy identification:
            </p>
            <Card className="p-4 bg-muted/50 font-mono text-sm text-foreground">
              Prefix_Platform_Objective_Year_Month_Ad#
            </Card>
            <h3 className="text-sm font-semibold text-foreground mb-2 mt-4">Components</h3>
            <FieldTable fields={[
              { field: "Prefix", desc: "Hospital or brand identifier (e.g., VIROC)" },
              { field: "Platform", desc: "Where the ad runs (META, GOOGLE, WHATSAPP)" },
              { field: "Objective", desc: "Campaign goal (LEADS, AWARENESS, CONVERSION)" },
              { field: "Year", desc: "4-digit year (e.g., 2026)" },
              { field: "Month", desc: "2-digit month (e.g., 04)" },
              { field: "Ad#", desc: "Sequential ad number within the month" },
            ]} />
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Example</h2>
            <Card className="p-4 bg-muted/50 font-mono text-sm text-foreground">
              VIROC_META_LEADS_2026_04_01
            </Card>
            <p className="text-sm text-muted-foreground mt-2">
              This represents: Viroc hospital, Meta platform, Lead generation objective, April 2026, first ad.
            </p>
          </section>
          <TipBox>Consistent naming makes it easy to filter, search, and compare campaign performance across periods and platforms.</TipBox>
        </div>
      ),
    },
    "campaigns/utm-tracking": {
      title: "UTM Tracking",
      content: (
        <div className="space-y-6">
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">What is UTM Tracking?</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              UTM (Urchin Tracking Module) parameters are tags added to URLs that identify where traffic and leads come from. The CRM captures and stores these parameters on every lead for granular marketing attribution.
            </p>
            <h3 className="text-sm font-semibold text-foreground mb-2">UTM Parameters</h3>
            <FieldTable fields={[
              { field: "utm_source", desc: "The platform or referrer (e.g., facebook, google, newsletter)" },
              { field: "utm_medium", desc: "The marketing medium (e.g., cpc, social, email)" },
              { field: "utm_campaign", desc: "The specific campaign name" },
              { field: "utm_term", desc: "The keyword or targeting term (optional)" },
              { field: "utm_content", desc: "Differentiates similar content or ad variations (optional)" },
            ]} />
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">How It Works in the CRM</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              When a lead enters the CRM from a digital source (Meta Lead Ads, landing page, etc.), the UTM parameters from the original URL are automatically captured and stored with the lead record. You can see these on the Lead Detail page and filter/analyze by UTM parameters on the dashboard.
            </p>
          </section>
        </div>
      ),
    },
    "masters/master-tables": {
      title: "Managing Master Tables",
      content: (
        <div className="space-y-6">
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">What is Master Data?</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Master Data is the reference data that powers the entire CRM. These are configurable lookup tables that define the options available throughout the system — like lead sources, treatment types, departments, and more.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Navigate to <strong>Masters &gt; Master Data</strong> to view and manage all master tables. The tables are organized into categories (see the full list below).
            </p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Adding & Editing Records</h2>
            <StepList steps={[
              "Navigate to Masters > Master Data",
              "Select the master table you want to edit from the dropdown or list",
              "Click 'Add New' to create a new record, or click on an existing record to edit it",
              "Fill in the required fields (name, code, and any table-specific fields)",
              "Submit the record — it enters the Approval Queue for review",
              "Once approved by an authorized user, the record becomes active",
            ]} />
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Master Data Categories</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-3">
              Master data tables are organized into logical categories:
            </p>
            <div className="space-y-3">
              {[
                { cat: "Location", tables: "Countries, States, Cities, Areas" },
                { cat: "Organisation", tables: "Organisations, Branches, Departments, Designations, Employment Types, System Roles, CRM Users, Calling Lines, User-Line Assignments" },
                { cat: "Doctors", tables: "Doctors, Treatment Departments, OPD Timings, Doctor Leave Exceptions" },
                { cat: "Lead Generation", tables: "Lead Source Categories, Lead Sources, Referrers, Corporate Insurances" },
                { cat: "Consultation", tables: "Conversion Stages, Consultation Outcome Remarks" },
                { cat: "Activity & Workflow", tables: "Lead Statuses" },
                { cat: "Communication", tables: "Message Templates (SMS, Email, WhatsApp, Push), Holidays, Tags" },
                { cat: "Insurance", tables: "Insurers, TPAs, Policy Types, Pre-Auth Statuses, Rejection Reasons" },
                { cat: "Governance", tables: "SLA Rules, Reminder Policies, Data Retention Policies" },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                  <span><strong>{item.cat}:</strong> {item.tables}</span>
                </div>
              ))}
            </div>
          </section>
          <TipBox>Master data changes go through an approval workflow to prevent accidental modifications. Only Admins and Managers can approve pending changes.</TipBox>
        </div>
      ),
    },
    "masters/approval-workflow": {
      title: "Approval Workflow",
      content: (
        <div className="space-y-6">
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">How Approval Works</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              All master data changes (create, update, delete) go through a two-step approval process to ensure data integrity:
            </p>
            <StepList steps={[
              "A user submits a master data change (new record, edit, or deletion request)",
              "The change enters the Approval Queue with status 'Pending'",
              "An authorized reviewer (Admin or Manager) reviews the change in the Approval Queue",
              "The reviewer can Approve (change goes live) or Reject (change is discarded) the request",
              "The submitter is notified of the decision",
            ]} />
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Approval Queue</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Navigate to <strong>Masters &gt; Approval Queue</strong> to see all pending master data changes. The queue shows the table name, record details, who submitted it, and when. Each item has Approve and Reject buttons for quick processing.
            </p>
          </section>
          <WarningBox>Approved changes take effect immediately across the system. Rejected changes are permanently discarded. Review carefully before approving.</WarningBox>
        </div>
      ),
    },
    "masters/bulk-import-export": {
      title: "Bulk Import & Export",
      content: (
        <div className="space-y-6">
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Exporting Master Data</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              You can export any master table to CSV format for offline review or record-keeping:
            </p>
            <StepList steps={[
              "Navigate to the master table you want to export",
              "Click the Export/Download button",
              "The system generates a CSV file with all records in that table",
              "The export action is logged in the audit trail",
            ]} />
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Importing Master Data</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              For bulk setup or updates, you can import records from a CSV file:
            </p>
            <StepList steps={[
              "Download the template CSV for the target master table — the template uses friendly, human-readable column names (e.g., 'Treatment Name' instead of 'name')",
              "Fill in the data following the template format",
              "Upload the CSV file using the Import button",
              "The system validates each row and provides clear, descriptive error messages if any rows fail validation",
              "Valid records are submitted to the Approval Queue for review",
              "An Admin or Manager reviews and approves the imported records",
              "Approved records become active in the system immediately",
            ]} />
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Import Error Handling</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              If any rows fail validation during import, the system provides clear error messages using friendly field names (e.g., "Treatment Name is required" instead of technical column names). This makes it easy to identify and fix issues in your CSV before re-uploading.
            </p>
          </section>
          <TipBox>Always use the provided template when importing data. The templates include all required and optional columns with friendly names that match what you see in the CRM interface.</TipBox>
        </div>
      ),
    },
    "configurations/connectors": {
      title: "Connectors Setup",
      content: (
        <div className="space-y-6">
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Platform Connectors</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Connectors integrate the CRM with external platforms. Navigate to <strong>Configurations &gt; Connectors</strong> to set up and manage integrations.
            </p>
            <div className="space-y-3">
              {[
                { name: "Meta (Facebook & Instagram)", desc: "Connect your Meta Business account to sync lead ad submissions, track campaign performance, and pull ad insights (impressions, clicks, spend, CPC, CTR)." },
                { name: "WhatsApp Business API", desc: "Send automated appointment reminders, follow-up messages, and template-based communications via WhatsApp." },
                { name: "Telephony (Callyzer)", desc: "Capture call logs automatically, track call duration and outcomes, and auto-create leads from incoming calls." },
                { name: "SMTP Email", desc: "Configure per-tenant email settings for sending appointment confirmations, reminders, and notifications." },
                { name: "Google Forms", desc: "Capture leads from Google Form submissions and route them into the CRM pipeline." },
              ].map((item, i) => (
                <Card key={i} className="p-3">
                  <h3 className="text-sm font-semibold text-foreground mb-1">{item.name}</h3>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </Card>
              ))}
            </div>
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Lead Capture Rules</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-3">
              In addition to platform connectors, you can set up Lead Capture Rules to automatically ingest leads from various sources:
            </p>
            <div className="space-y-3">
              {[
                { name: "Meta Lead Ads", desc: "Automatically capture leads from Facebook and Instagram lead ad forms." },
                { name: "Google Forms", desc: "Route Google Form submissions directly into the CRM pipeline." },
                { name: "Telephony (Callyzer)", desc: "Auto-create leads from incoming calls via the telephony integration." },
                { name: "WhatsApp Business", desc: "Capture leads from WhatsApp conversations and inquiries." },
                { name: "Google Sheets", desc: "Pull leads from shared Google Spreadsheets on a configured schedule." },
                { name: "Custom Webhook", desc: "Set up a webhook endpoint to receive leads from any external system." },
              ].map((item, i) => (
                <Card key={i} className="p-3">
                  <h3 className="text-sm font-semibold text-foreground mb-1">{item.name}</h3>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </Card>
              ))}
            </div>
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Connector Security</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              All connector credentials (API keys, tokens, secrets) are encrypted at rest using AES-256-GCM encryption. Credentials are never displayed in plain text after saving — only the connection status is shown.
            </p>
          </section>
        </div>
      ),
    },
    "configurations/email-settings": {
      title: "Email / SMTP Settings",
      content: (
        <div className="space-y-6">
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Overview</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-3">
              The CRM uses SMTP (Simple Mail Transfer Protocol) to send outbound emails such as <strong>Password Reset links</strong>, appointment confirmations, and system notifications. Each hospital can configure its own email settings under <strong>Configurations &gt; Email / SMTP Settings</strong>.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Most hospitals use <strong>Google Workspace (GWS)</strong> for their email. This guide walks you through the complete setup — from generating the App Password in Google Workspace Admin to entering the details in the CRM.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">What You Need Before You Start</h2>
            <ul className="list-disc ml-5 space-y-2 text-sm text-muted-foreground">
              <li>A <strong>Google Workspace</strong> account (e.g., noreply@yourhospital.com) — this will be your sender email</li>
              <li><strong>2-Step Verification</strong> must be turned ON for that Google account</li>
              <li>Access to <strong>Google Workspace Admin Console</strong> (admin.google.com) if 2-Step Verification is not yet enabled</li>
              <li><strong>Admin</strong> or <strong>System Admin</strong> role in myProSys Hospital CRM</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Part 1: Google Workspace Admin Setup</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-3">
              Your Google Workspace administrator needs to complete these steps first:
            </p>
            <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-4 mb-4">
              <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-2">Step A — Enable 2-Step Verification (Organization-wide)</h3>
              <ol className="list-decimal ml-5 space-y-1.5 text-sm text-blue-700 dark:text-blue-300">
                <li>Sign in to <strong>admin.google.com</strong> with your GWS admin account</li>
                <li>Go to <strong>Security &gt; Authentication &gt; 2-Step Verification</strong></li>
                <li>Check <strong>"Allow users to turn on 2-Step Verification"</strong></li>
                <li>Click <strong>Save</strong></li>
                <li>Wait a few minutes for the policy to propagate across your organization</li>
              </ol>
            </div>
            <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-4 mb-4">
              <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-2">Step B — Turn on 2-Step Verification for the Sender Account</h3>
              <ol className="list-decimal ml-5 space-y-1.5 text-sm text-blue-700 dark:text-blue-300">
                <li>Sign in to <strong>myaccount.google.com</strong> as the sender email (e.g., noreply@yourhospital.com)</li>
                <li>Go to <strong>Security &gt; Signing in to Google &gt; 2-Step Verification</strong></li>
                <li>Click <strong>Get Started</strong> and follow the setup wizard (phone verification)</li>
                <li>Complete the setup — you'll need this for App Passwords</li>
              </ol>
            </div>
            <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-2">Step C — Generate an App Password</h3>
              <ol className="list-decimal ml-5 space-y-1.5 text-sm text-blue-700 dark:text-blue-300">
                <li>While still signed in as the sender account, go to <strong>myaccount.google.com/apppasswords</strong></li>
                <li>You may need to re-enter your password</li>
                <li>Under <strong>"App name"</strong>, type <strong>myProSys CRM</strong> (or any name you prefer)</li>
                <li>Click <strong>Create</strong></li>
                <li>Google will show a <strong>16-character password</strong> (e.g., <code>abcd efgh ijkl mnop</code>)</li>
                <li><strong>Copy this password immediately</strong> — it is shown only once</li>
                <li>Remove the spaces — your App Password is: <code>abcdefghijklmnop</code></li>
              </ol>
            </div>
            <WarningBox>The App Password is displayed only once. If you lose it, you'll need to delete the old one and generate a new one from the same page.</WarningBox>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Part 2: Enter SMTP Settings in the CRM</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-3">
              Now that you have the App Password, enter the settings in the CRM:
            </p>
            <StepList steps={[
              "Log in to the CRM as Admin or System Admin",
              "Navigate to Configurations > Email / SMTP Settings",
              "Fill in the fields as shown below",
              "Click Save to store the configuration",
              "Use the 'Send Test Email' button to verify the connection",
            ]} />
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">SMTP Server Settings</h2>
            <FieldTable fields={[
              { field: "SMTP Host", desc: "smtp.gmail.com (for Google Workspace / Gmail)" },
              { field: "SMTP Port", desc: "587 (TLS — recommended) or 465 (SSL)" },
              { field: "Username", desc: "Your full sender email address, e.g., noreply@yourhospital.com" },
              { field: "Password", desc: "The 16-character App Password generated in Step C above (NOT your regular Google password)" },
              { field: "Security", desc: "TLS (recommended for port 587)" },
            ]} />
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Sender Information</h2>
            <FieldTable fields={[
              { field: "From Email", desc: "The email address recipients will see (e.g., noreply@yourhospital.com). Must match the authenticated account." },
              { field: "From Name", desc: "The display name shown in recipients' inbox (e.g., 'Viroc Super Specialty Orthopaedic Hospital')" },
            ]} />
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Google Workspace Quick Reference</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-border rounded-lg">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left p-3 font-semibold text-foreground border-b border-border">CRM Field</th>
                    <th className="text-left p-3 font-semibold text-foreground border-b border-border">Value for Google Workspace</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border"><td className="p-3 text-muted-foreground">SMTP Host</td><td className="p-3 font-mono text-foreground">smtp.gmail.com</td></tr>
                  <tr className="border-b border-border"><td className="p-3 text-muted-foreground">SMTP Port</td><td className="p-3 font-mono text-foreground">587</td></tr>
                  <tr className="border-b border-border"><td className="p-3 text-muted-foreground">Username</td><td className="p-3 font-mono text-foreground">noreply@yourhospital.com</td></tr>
                  <tr className="border-b border-border"><td className="p-3 text-muted-foreground">Password</td><td className="p-3 font-mono text-foreground">abcdefghijklmnop (App Password)</td></tr>
                  <tr className="border-b border-border"><td className="p-3 text-muted-foreground">Security</td><td className="p-3 font-mono text-foreground">TLS</td></tr>
                  <tr className="border-b border-border"><td className="p-3 text-muted-foreground">From Email</td><td className="p-3 font-mono text-foreground">noreply@yourhospital.com</td></tr>
                  <tr><td className="p-3 text-muted-foreground">From Name</td><td className="p-3 font-mono text-foreground">Your Hospital Name</td></tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">What Emails Does the CRM Send?</h2>
            <ul className="list-disc ml-5 space-y-1.5 text-sm text-muted-foreground">
              <li><strong>Password Reset Links:</strong> When users click "Forgot Password" on the login page</li>
              <li><strong>Appointment Confirmations:</strong> Sent to patients when appointments are booked</li>
              <li><strong>System Notifications:</strong> Approval requests, escalation alerts</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Troubleshooting Common Errors</h2>
            <div className="space-y-3">
              <div className="bg-red-50 dark:bg-red-950/30 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-red-700 dark:text-red-400 mb-1">Error: "535-5.7.8 Username and Password not accepted"</h4>
                <ul className="list-disc ml-5 space-y-1 text-sm text-red-600 dark:text-red-400">
                  <li>You are using the regular Google password instead of the <strong>App Password</strong></li>
                  <li>The App Password has been revoked — generate a new one</li>
                  <li>2-Step Verification is not enabled on the sender account</li>
                </ul>
              </div>
              <div className="bg-red-50 dark:bg-red-950/30 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-red-700 dark:text-red-400 mb-1">Error: "Connection timeout" or "ECONNREFUSED"</h4>
                <ul className="list-disc ml-5 space-y-1 text-sm text-red-600 dark:text-red-400">
                  <li>Wrong SMTP Host or Port — verify you're using <code>smtp.gmail.com</code> and port <code>587</code></li>
                  <li>Your network/firewall may be blocking outbound SMTP connections</li>
                </ul>
              </div>
              <div className="bg-red-50 dark:bg-red-950/30 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-red-700 dark:text-red-400 mb-1">Error: "App Passwords not available"</h4>
                <ul className="list-disc ml-5 space-y-1 text-sm text-red-600 dark:text-red-400">
                  <li>2-Step Verification is not turned on — complete Step B first</li>
                  <li>Your Google Workspace admin has not allowed 2-Step Verification — ask them to complete Step A</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Non-Google Email Providers</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-3">
              If your hospital uses a different email provider, use these SMTP settings:
            </p>
            <FieldTable fields={[
              { field: "Microsoft 365 / Outlook", desc: "Host: smtp.office365.com, Port: 587, Security: TLS" },
              { field: "Amazon SES", desc: "Host: email-smtp.<region>.amazonaws.com, Port: 587, Security: TLS" },
              { field: "Zoho Mail", desc: "Host: smtp.zoho.com, Port: 587, Security: TLS" },
              { field: "Custom / Self-hosted", desc: "Use your IT team's SMTP host, port, and credentials" },
            ]} />
          </section>

          <TipBox>We recommend creating a dedicated sender email like <strong>noreply@yourhospital.com</strong> or <strong>crm@yourhospital.com</strong> in your Google Workspace. This keeps CRM emails separate from personal mailboxes and makes it easier to manage App Passwords.</TipBox>
          <WarningBox>SMTP credentials are encrypted at rest. After saving, the password is never displayed in plain text — only the connection status is shown. Each hospital (tenant) has its own independent email configuration. Never share App Passwords via email or chat.</WarningBox>
        </div>
      ),
    },
    "configurations/whatsapp-settings": {
      title: "WhatsApp Business Settings",
      content: (
        <div className="space-y-6">
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">WhatsApp Business API Integration</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Connect your hospital's WhatsApp Business account to send automated messages to patients. Navigate to <strong>Configurations &gt; WhatsApp Business Settings</strong>.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Configuration Fields</h2>
            <FieldTable fields={[
              { field: "Phone Number ID", desc: "Your WhatsApp Business Phone Number ID from Meta Business Manager" },
              { field: "Business Account ID", desc: "Your WhatsApp Business Account ID" },
              { field: "Permanent Access Token", desc: "A long-lived access token from Meta for API authentication (stored encrypted)" },
              { field: "Integration Toggle", desc: "Enable or disable the WhatsApp integration without removing credentials" },
            ]} />
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Message Templates</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-3">
              WhatsApp Business API requires pre-approved message templates. You can configure templates for:
            </p>
            <ul className="list-disc ml-5 space-y-1 text-sm text-muted-foreground">
              <li><strong>Appointment Confirmations:</strong> Sent when an appointment is booked</li>
              <li><strong>Appointment Reminders:</strong> Sent before the scheduled appointment</li>
              <li><strong>Follow-Up Messages:</strong> Sent as part of post-care or nurture workflows</li>
            </ul>
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Testing the Connection</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              After saving your credentials, use the "Send Test Message" button to verify the integration is working correctly. Enter a phone number and send a test template message to confirm delivery.
            </p>
          </section>
          <TipBox>WhatsApp message templates must be approved by Meta before they can be used. Create templates in the Meta Business Manager and reference them here by template name.</TipBox>
        </div>
      ),
    },
    "configurations/wati-whatsapp": {
      title: "Connecting WhatsApp via WATI",
      content: (
        <div className="space-y-6">
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">What is WATI?</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              WATI is a WhatsApp Business API provider used to connect your hospital's WhatsApp number for automated messaging, patient follow-ups, and appointment reminders.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Setup Requirements</h2>
            <FieldTable fields={[
              { field: "WATI Account", desc: "An active WATI account with your hospital's WhatsApp number onboarded" },
              { field: "API Credentials", desc: "Your WATI API token / access key for CRM integration" },
              { field: "Approved Templates", desc: "Pre-approved message templates for reminders, confirmations, and follow-ups" },
              { field: "Verified Number", desc: "A WhatsApp Business number already verified inside WATI" },
            ]} />
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">How to Connect WATI</h2>
            <StepList steps={[
              "Log in to your WATI dashboard",
              "Copy the API token or access key from the WATI developer/integration settings",
              "Open the CRM and go to Configurations > WhatsApp Business Settings",
              "Select WATI as the provider if available, or enter the WATI credentials in the WhatsApp configuration form",
              "Paste the API token, business/account details, and the verified phone number information",
              "Save the configuration",
              "Use the Send Test Message button to confirm messages are delivered successfully",
            ]} />
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Best Practices</h2>
            <ul className="list-disc ml-5 space-y-1 text-sm text-muted-foreground">
              <li>Use approved WhatsApp templates for all automated messages</li>
              <li>Keep your WATI API token secure and never share it in chat or email</li>
              <li>Ensure the WhatsApp number is monitored by your support or communication team</li>
            </ul>
          </section>
          <TipBox>If you are using WATI specifically for WhatsApp communication, coordinate template approvals and sender number setup with your WATI account manager before enabling the integration in the CRM.</TipBox>
        </div>
      ),
    },
    "configurations/branding": {
      title: "Branding Customization",
      content: (
        <div className="space-y-6">
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">White-Label Branding</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Each hospital (tenant) can customize the CRM's appearance to match their brand. Navigate to <strong>Configurations &gt; Branding</strong> to manage these settings.
            </p>
            <h3 className="text-sm font-semibold text-foreground mb-2">Customizable Elements</h3>
            <FieldTable fields={[
              { field: "Display Name", desc: "The hospital name shown in the sidebar and headers" },
              { field: "Logo", desc: "Hospital logo displayed in the sidebar (recommended: 200x200px, PNG or SVG)" },
              { field: "Favicon", desc: "Browser tab icon" },
              { field: "Primary Color", desc: "Main brand color used throughout the interface" },
              { field: "Accent Color", desc: "Secondary color used for highlights and action buttons" },
            ]} />
          </section>
          <TipBox>Branding changes take effect immediately for all users of that hospital. Preview the changes before saving to ensure colors and logos look good together.</TipBox>
        </div>
      ),
    },
    "configurations/intelligence-config": {
      title: "Intelligence Config",
      content: (
        <div className="space-y-6">
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Intelligence Engine Settings</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              The Intelligence Configuration page lets administrators fine-tune the automated engines that power lead scoring and workflow automation:
            </p>
            <div className="space-y-3">
              {[
                { name: "Temperature Engine", desc: "Configure the thresholds for Hot/Warm/Cold lead scoring. Adjust activity recency weights, engagement scoring factors, and temperature transition rules." },
                { name: "Auto-Handover Engine", desc: "Set up stage-based team assignment rules. Define which team handles each lead/episode stage and configure automatic handover triggers." },
                { name: "Dormant Detection", desc: "Configure the inactivity threshold (default: 5 days), exclusion statuses, and the re-engagement task template." },
                { name: "Revenue Probability", desc: "Set conversion probability percentages for each pipeline stage. These are used to calculate pipeline value on dashboards." },
              ].map((item, i) => (
                <Card key={i} className="p-3">
                  <h3 className="text-sm font-semibold text-foreground mb-1">{item.name}</h3>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </Card>
              ))}
            </div>
          </section>
        </div>
      ),
    },
    "configurations/sla-reminders": {
      title: "SLA & Reminder Policies",
      content: (
        <div className="space-y-6">
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">SLA Rules</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Service Level Agreement (SLA) rules define the maximum time a lead should stay in each status before requiring action. When SLA thresholds are breached, the system flags the lead and can trigger escalation.
            </p>
            <FieldTable fields={[
              { field: "Lead Status", desc: "The status this SLA applies to (e.g., Raw Lead Captured)" },
              { field: "Max Duration", desc: "Maximum hours/days the lead should stay in this status" },
              { field: "Escalation", desc: "What happens when the SLA is breached (alert, escalate to manager)" },
            ]} />
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Reminder Policies</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Reminder policies define automated reminders for appointments and follow-up tasks:
            </p>
            <ul className="list-disc ml-5 space-y-1 text-sm text-muted-foreground">
              <li><strong>Appointment Reminders:</strong> Automated reminders sent to patients before their scheduled appointments</li>
              <li><strong>Task Reminders:</strong> Notifications to staff when tasks are approaching due dates</li>
              <li><strong>Overdue Alerts:</strong> Escalation alerts when tasks pass their due dates</li>
            </ul>
          </section>
        </div>
      ),
    },
    "dashboards/role-dashboards": {
      title: "Role-Based Dashboards",
      content: (
        <div className="space-y-6">
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Dashboard Overview</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Each user role sees a tailored dashboard when they log in. The dashboard is your command center — showing the metrics, tasks, and insights most relevant to your job.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Admin Dashboard</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-3">
              The Admin dashboard provides a hospital-wide overview with management-level KPIs and intelligence:
            </p>
            <h3 className="text-sm font-semibold text-foreground mb-2">KPI Cards</h3>
            <FieldTable fields={[
              { field: "Total Leads", desc: "Total lead count with 'new today' trend indicator" },
              { field: "Active Episodes", desc: "Active treatment episodes with surgery count" },
              { field: "Pipeline Value (₹)", desc: "Financial value of all active episodes" },
              { field: "Revenue Realized (₹)", desc: "Total completed revenue" },
              { field: "Today Appointments", desc: "Today's appointment count with pending indicator" },
            ]} />
            <h3 className="text-sm font-semibold text-foreground mb-2 mt-3">Secondary Stats</h3>
            <FieldTable fields={[
              { field: "Hot Leads", desc: "High-priority leads needing immediate attention" },
              { field: "Dormant Leads", desc: "Leads with no activity for 5+ days" },
              { field: "Overdue Actions", desc: "Combined overdue lead and episode follow-ups" },
              { field: "Insurance Cases", desc: "Active insurance-related episodes" },
            ]} />
            <h3 className="text-sm font-semibold text-foreground mb-2 mt-3">Charts & Analytics</h3>
            <ul className="list-disc ml-5 space-y-1 text-sm text-muted-foreground">
              <li><strong>CRM Lead Pipeline:</strong> Horizontal bar chart showing lead distribution across stages (Raw → Won)</li>
              <li><strong>Episode Status Distribution:</strong> Pie chart of Active, Consultations, Surgeries, Completed, Discontinued</li>
              <li><strong>Lead Temperature Chart:</strong> Bar chart breakdown by temperature (Very Hot to Dormant)</li>
              <li><strong>No-Show Rate by Doctor:</strong> Doctor-wise no-show counts and percentage rates</li>
              <li><strong>Drop-Off by Stage:</strong> Where leads are lost and the associated lost revenue</li>
            </ul>
            <h3 className="text-sm font-semibold text-foreground mb-2 mt-3">Other Sections</h3>
            <ul className="list-disc ml-5 space-y-1 text-sm text-muted-foreground">
              <li><strong>My Today's Tasks:</strong> System tasks and follow-up actions due today</li>
              <li><strong>My Overdue Tasks:</strong> Tasks past their due date</li>
              <li><strong>Dormant Leads:</strong> List of leads needing re-engagement</li>
              <li><strong>Team Performance:</strong> Table with team member stats (Total Leads, Untouched, New Today, Overdue)</li>
            </ul>
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Manager Dashboard</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-3">
              The Manager dashboard focuses on team oversight and departmental lead flow:
            </p>
            <FieldTable fields={[
              { field: "KPI Cards", desc: "My Leads, Hot Leads, Active Episodes, Today Appointments" },
              { field: "Stat Cards", desc: "Overdue Actions, Today's Actions, Dormant Leads, Untouched Leads" },
              { field: "Team Overdue Tasks", desc: "Overdue actions assigned to team members (unique to managers)" },
              { field: "Team Performance", desc: "Per-member stats table with lead counts and activity" },
            ]} />
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Agent (Tele-Caller) Dashboard</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-3">
              The Agent dashboard is optimized for call center staff with call performance metrics:
            </p>
            <FieldTable fields={[
              { field: "My Call Performance", desc: "Today's calls, weekly calls, average duration, outbound vs inbound, and call outcomes (Interested, Confirmed, Callback, Not Available)" },
              { field: "My Lead Sources", desc: "Progress bar breakdown showing lead counts and conversions per source" },
              { field: "My Conversion Funnel", desc: "Horizontal bar chart of personal lead progression (Raw → Won)" },
              { field: "My Recent Activity", desc: "Chronological feed of calls, notes, and activity logs" },
            ]} />
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Counsellor Dashboard</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-3">
              The Counsellor dashboard focuses on episode management and revenue tracking:
            </p>
            <FieldTable fields={[
              { field: "My Episode Progress", desc: "Active and completed episode counts, surgery cases, total episodes" },
              { field: "My Revenue Pipeline", desc: "Active pipeline value (₹), realized revenue, and expected revenue" },
              { field: "My Conversion Funnel", desc: "Personal lead progression bar chart" },
              { field: "My Recent Activity", desc: "Chronological activity feed" },
            ]} />
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Conversion Ratios</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-3">
              The dashboard includes key conversion ratios that track surgical pipeline efficiency:
            </p>
            <FieldTable fields={[
              { field: "Treatment Planned → Surgery Scheduled %", desc: "Percentage of episodes that move from treatment planning to having a surgery date confirmed. Indicates how effectively patients are being converted from plan to commitment." },
              { field: "Surgery Scheduled → Surgery Done %", desc: "Percentage of scheduled surgeries that are actually completed. Tracks follow-through and identifies drop-offs or cancellations." },
            ]} />
          </section>
          <TipBox>The "My Today's Tasks" and "My Overdue Tasks" cards appear on every role's dashboard. Use them in morning huddles to review what needs to be done today.</TipBox>
        </div>
      ),
    },
    "dashboards/surgery-calendar": {
      title: "Surgery Calendar",
      content: (
        <div className="space-y-6">
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Surgery Calendar Overview</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              The Surgery Calendar provides a visual calendar view of all upcoming scheduled surgeries. It helps surgical teams, counsellors, and administrators plan resources, avoid scheduling conflicts, and maintain oversight of the surgery pipeline.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Accessing the Surgery Calendar</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Navigate to <strong>Reports & Dashboards &gt; Surgery Calendar</strong> to access the calendar view. The calendar shows all future scheduled surgeries with key details.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Calendar Features</h2>
            <FieldTable fields={[
              { field: "Monthly/Weekly View", desc: "Switch between monthly and weekly calendar views to see surgeries at different granularity" },
              { field: "Surgery Cards", desc: "Each scheduled surgery appears as a card on the calendar showing patient name, procedure type, and surgeon" },
              { field: "Branch Filter", desc: "Filter surgeries by hospital branch" },
              { field: "Doctor Filter", desc: "Filter by the operating surgeon" },
              { field: "Department Filter", desc: "Filter by treatment department" },
            ]} />
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Surgery Details</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Click on any surgery card in the calendar to see full details including the patient name, episode reference, surgery type, scheduled date and time, operating surgeon, and pre-operative notes. You can navigate directly to the episode detail page from the calendar.
            </p>
          </section>
          <TipBox>Use the Surgery Calendar in daily morning huddles to review the day's surgical schedule. Filter by your branch to see only relevant surgeries.</TipBox>
        </div>
      ),
    },
    "dashboards/telephony-reports": {
      title: "Telephony Reports",
      content: (
        <div className="space-y-6">
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Call Activity Reports</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Navigate to <strong>Reports & Dashboards &gt; Telephony Reports</strong> to view detailed call activity data captured through the telephony integration.
            </p>
            <h3 className="text-sm font-semibold text-foreground mb-2">Summary Cards</h3>
            <FieldTable fields={[
              { field: "Total Calls", desc: "Combined count of incoming and outgoing calls" },
              { field: "Average Duration", desc: "Average call duration across all calls" },
              { field: "Lead Conversions", desc: "Calls that resulted in new lead creation or lead matching" },
            ]} />
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Report Tabs</h2>
            <div className="space-y-3">
              <Card className="p-3">
                <h3 className="text-sm font-semibold text-foreground mb-1">Call Logs</h3>
                <p className="text-xs text-muted-foreground">Detailed table of all calls — Incoming, Outgoing, and Missed — with timestamps, durations, and phone numbers. Each row shows the Match Status: whether the call was matched to an existing lead, used to auto-create a new lead, or remained unmatched.</p>
              </Card>
              <Card className="p-3">
                <h3 className="text-sm font-semibold text-foreground mb-1">Employee Performance</h3>
                <p className="text-xs text-muted-foreground">Summary table showing per-employee call statistics: total calls, total duration, average duration, and lead match rate. Use this to compare team member productivity.</p>
              </Card>
              <Card className="p-3">
                <h3 className="text-sm font-semibold text-foreground mb-1">Telecalling Team</h3>
                <p className="text-xs text-muted-foreground">Management tab for mapping telephony employee IDs to CRM user accounts. This mapping ensures calls are attributed to the correct CRM users for performance tracking.</p>
              </Card>
            </div>
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Export & Filtering</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Use the date range filter to focus on specific periods. The Export button generates a CSV file of the filtered call logs for external analysis or reporting.
            </p>
          </section>
          <TipBox>Telephony reports help managers evaluate team calling activity, identify underperforming agents, and correlate call volume with lead conversion rates. Use these reports in weekly reviews to spot trends and adjust team workload.</TipBox>
        </div>
      ),
    },
    "security/rbac-guide": {
      title: "Role-Based Access Control",
      content: (
        <div className="space-y-6">
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">RBAC Overview</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Role-Based Access Control (RBAC) ensures each user only sees and can modify the data appropriate to their role. The CRM implements a 4-tier role hierarchy with granular controls.
            </p>
            <h3 className="text-sm font-semibold text-foreground mb-2">Role Permissions Matrix</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-4 font-semibold text-foreground">Capability</th>
                    <th className="text-center py-2 px-2 font-semibold text-foreground">Admin</th>
                    <th className="text-center py-2 px-2 font-semibold text-foreground">Manager</th>
                    <th className="text-center py-2 px-2 font-semibold text-foreground">Agent</th>
                    <th className="text-center py-2 px-2 font-semibold text-foreground">Counsellor</th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  {[
                    { cap: "View All Leads", admin: true, mgr: true, agent: false, cns: false },
                    { cap: "View Own Leads", admin: true, mgr: true, agent: true, cns: true },
                    { cap: "Create Leads", admin: true, mgr: true, agent: true, cns: true },
                    { cap: "Manage Master Data", admin: true, mgr: true, agent: false, cns: false },
                    { cap: "Approve Master Data", admin: true, mgr: true, agent: false, cns: false },
                    { cap: "Manage Users", admin: true, mgr: false, agent: false, cns: false },
                    { cap: "Configure Connectors", admin: true, mgr: false, agent: false, cns: false },
                    { cap: "View Dashboards", admin: true, mgr: true, agent: true, cns: true },
                    { cap: "Branding Settings", admin: true, mgr: false, agent: false, cns: false },
                  ].map((row, i) => (
                    <tr key={i} className="border-b border-muted/50">
                      <td className="py-1.5 pr-4">{row.cap}</td>
                      <td className="text-center py-1.5 px-2">{row.admin ? "✓" : "—"}</td>
                      <td className="text-center py-1.5 px-2">{row.mgr ? "✓" : "—"}</td>
                      <td className="text-center py-1.5 px-2">{row.agent ? "✓" : "—"}</td>
                      <td className="text-center py-1.5 px-2">{row.cns ? "✓" : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ),
    },
    "security/phi-masking": {
      title: "PHI Masking",
      content: (
        <div className="space-y-6">
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Protected Health Information Masking</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              The CRM implements server-side masking of Protected Health Information (PHI) to comply with healthcare data privacy requirements. Masking is applied at the API level — the server never sends full data to clients who don't have authorization to see it.
            </p>
            <h3 className="text-sm font-semibold text-foreground mb-2">Masking Levels</h3>
            <FieldTable fields={[
              { field: "Full Access", desc: "User sees all patient data — phone, email, diagnosis, treatment details. Typically for Admins and Counsellors." },
              { field: "Masked Access", desc: "Phone numbers show as 98XXXXX003. Email shows as j***@example.com. Clinical data is visible. For Agents who need some context." },
              { field: "No Access", desc: "Phone and email are fully hidden. Clinical fields (diagnosis, treatment plan, insurance details) are also hidden. For roles that don't need PHI." },
            ]} />
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">What Gets Masked</h2>
            <ul className="list-disc ml-5 space-y-1 text-sm text-muted-foreground">
              <li>Phone numbers (primary and alternate)</li>
              <li>Email addresses</li>
              <li>Diagnosis and clinical notes (at None level)</li>
              <li>Treatment plan details (at None level)</li>
              <li>Insurance information (at None level)</li>
            </ul>
          </section>
        </div>
      ),
    },
    "security/session-security": {
      title: "Session & Login Security",
      content: (
        <div className="space-y-6">
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Login Protection</h2>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <Lock className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <span><strong>Account Lockout:</strong> 5 consecutive failed login attempts lock the account for 15 minutes. This prevents brute-force password attacks.</span>
              </li>
              <li className="flex items-start gap-2">
                <Shield className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <span><strong>Rate Limiting:</strong> IP-based rate limiting prevents excessive login attempts from a single source.</span>
              </li>
              <li className="flex items-start gap-2">
                <Eye className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <span><strong>Anti-Enumeration:</strong> Login error messages don't reveal whether a username exists, preventing attackers from enumerating valid accounts.</span>
              </li>
            </ul>
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Session Management</h2>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <Timer className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <span><strong>Session TTL:</strong> Sessions expire after 24 hours, requiring re-authentication.</span>
              </li>
              <li className="flex items-start gap-2">
                <Clock className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <span><strong>Inactivity Timeout:</strong> 30 minutes of no mouse, keyboard, or touch activity triggers a warning. After 5 more minutes, the session ends automatically.</span>
              </li>
              <li className="flex items-start gap-2">
                <ClipboardList className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <span><strong>Log Sanitization:</strong> PHI fields are automatically stripped from server logs to prevent accidental data exposure in log files.</span>
              </li>
            </ul>
          </section>
        </div>
      ),
    },
    "security/audit-logging": {
      title: "Audit Logging",
      content: (
        <div className="space-y-6">
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">What Gets Logged</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              The CRM maintains a comprehensive audit trail of data access and actions for compliance and security monitoring:
            </p>
            <FieldTable fields={[
              { field: "Lead/Patient Views", desc: "Every time a user views a lead or patient record, logged with user ID, timestamp, and IP address" },
              { field: "Data Exports", desc: "CSV downloads and data exports, including which table and how many records" },
              { field: "Communication Pref Changes", desc: "When opt-in/opt-out preferences are modified" },
              { field: "Login Activity", desc: "Successful and failed login attempts with timestamps" },
              { field: "Status Changes", desc: "Lead and episode status transitions with before/after values" },
            ]} />
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Viewing Audit Logs</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Audit logs are accessible to Admins via the API. Each log entry includes: user ID, action type, entity type and ID, IP address, user agent, and timestamp. This data is essential for compliance audits and investigating security incidents.
            </p>
          </section>
        </div>
      ),
    },
    "security/consent-prefs": {
      title: "Consent & Communication Prefs",
      content: (
        <div className="space-y-6">
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Patient Consent</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              The CRM tracks explicit patient consent for data collection and processing:
            </p>
            <ul className="list-disc ml-5 space-y-1 text-sm text-muted-foreground">
              <li>A consent checkbox is included in the New Lead creation form</li>
              <li>The Lead Detail page shows a consent status badge (Consent Given / No Consent)</li>
              <li>Consent timestamp and method are recorded for audit purposes</li>
              <li>Consent can be updated via the Lead Detail page or through API endpoints</li>
            </ul>
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Communication Preferences</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Each lead/patient has per-channel communication preferences with opt-in/opt-out controls:
            </p>
            <FieldTable fields={[
              { field: "WhatsApp", desc: "Toggle opt-in/opt-out for WhatsApp messages" },
              { field: "SMS", desc: "Toggle opt-in/opt-out for SMS messages" },
              { field: "Email", desc: "Toggle opt-in/opt-out for email communications" },
              { field: "Phone Call", desc: "Toggle opt-in/opt-out for phone call contacts" },
            ]} />
            <p className="text-sm text-muted-foreground leading-relaxed mt-3">
              These preferences are accessible from the Lead Detail sidebar. Changes are validated against tenant ownership and logged in the audit trail.
            </p>
          </section>
        </div>
      ),
    },
    "user-management/creating-users": {
      title: "Creating CRM Users",
      content: (
        <div className="space-y-6">
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Adding New Users (Admin Only)</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Only Admins can create new CRM user accounts. Each user needs a unique employee code and phone number.
            </p>
            <h3 className="text-sm font-semibold text-foreground mb-2">User Fields</h3>
            <FieldTable fields={[
              { field: "Employee Code", desc: "Unique identifier (e.g., VIROC-001). Cannot be changed after creation." },
              { field: "Name", desc: "Full name of the employee" },
              { field: "Phone", desc: "Mobile number (used for login)" },
              { field: "Email", desc: "Work email address" },
              { field: "Role", desc: "System role (Admin, Manager, Agent, Counsellor)" },
              { field: "Department", desc: "Which department they belong to" },
              { field: "Branch", desc: "Which hospital branch they are assigned to" },
              { field: "PHI Access Level", desc: "Level of patient data visibility (Full, Masked, None)" },
              { field: "Access Scope", desc: "Data scope (Self, Branch, All)" },
              { field: "Password", desc: "Initial login password (user should change on first login)" },
            ]} />
          </section>
          <TipBox>Follow the principle of least privilege — assign the minimum PHI access level and scope needed for each user's job function.</TipBox>
        </div>
      ),
    },
    "user-management/role-assignment": {
      title: "Role & Access Assignment",
      content: (
        <div className="space-y-6">
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Assigning Roles</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              When creating or editing a user, select the appropriate role based on their job function:
            </p>
            <FieldTable fields={[
              { field: "Admin", desc: "Hospital management staff who need full system access and configuration capabilities" },
              { field: "Manager", desc: "Team leads who manage a group of agents/counsellors and need visibility into their team's performance" },
              { field: "Agent", desc: "Tele-callers who handle initial lead contact, qualification, and appointment booking" },
              { field: "Counsellor", desc: "Patient counsellors who manage consultations, treatment episodes, and patient follow-up" },
            ]} />
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Configuring Access</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              In addition to the role, configure these access settings per user:
            </p>
            <ul className="list-disc ml-5 space-y-2 text-sm text-muted-foreground">
              <li><strong>PHI Access Level:</strong> Controls how much patient health information the user can see. Set to "Masked" or "None" for users who don't need to see full patient contact details.</li>
              <li><strong>Access Scope:</strong> Controls whose data the user can see. "Self" means only their own assigned records. "Branch" means all records in their branch. "All" means cross-branch visibility.</li>
            </ul>
          </section>
          <WarningBox>Changing a user's role or access level takes effect immediately. The user may need to log out and back in for all UI changes to reflect.</WarningBox>
        </div>
      ),
    },
    "user-management/password-management": {
      title: "Password Reset & Management",
      content: (
        <div className="space-y-6">
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Self-Service Password Reset</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Users can reset their own password from the login page using the "Forgot Password?" link. The system supports two delivery methods:
            </p>
            <FieldTable fields={[
              { field: "Email Reset", desc: "A password reset link is sent to the user's registered email address. The link expires after a set period for security." },
              { field: "SMS Reset", desc: "A temporary password is sent to the user's registered mobile number via SMS. The user can log in with the temporary password and then change it." },
            ]} />
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Admin Password Reset</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Admins can reset a user's password directly from the Team Management page. This is useful when:
            </p>
            <ul className="list-disc ml-5 space-y-1 text-sm text-muted-foreground">
              <li>A user has lost access to both their email and phone</li>
              <li>A new employee needs initial credentials set up</li>
              <li>An account needs to be unlocked after too many failed attempts</li>
            </ul>
            <StepList steps={[
              "Navigate to Team Management (Admin only)",
              "Find the user whose password needs resetting",
              "Click the 'Reset Password' action on their row",
              "Enter the new password and confirm it",
              "The password is updated immediately — inform the user of their new credentials securely",
            ]} />
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Change Password (Logged-In Users)</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Any logged-in user can change their own password:
            </p>
            <StepList steps={[
              "Click on your user profile or the Change Password option in the user menu",
              "Enter your current (old) password",
              "Enter and confirm your new password",
              "Click 'Change Password' to save",
            ]} />
          </section>
          <WarningBox>When performing an admin password reset, communicate the new password to the user through a secure channel (in person or phone call). Never send passwords via email or chat.</WarningBox>
        </div>
      ),
    },
    "user-management/branch-management": {
      title: "Branch Management",
      content: (
        <div className="space-y-6">
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Multi-Branch Setup</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              The CRM supports multi-branch hospitals through the branch management system. Each branch operates with data isolation while the central administration maintains oversight.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">How Branches Work</h2>
            <ul className="list-disc ml-5 space-y-2 text-sm text-muted-foreground">
              <li><strong>Data Isolation:</strong> Users with "Branch" scope only see leads, appointments, and episodes from their assigned branch</li>
              <li><strong>Central Oversight:</strong> Admins and users with "All" scope can see data across all branches</li>
              <li><strong>Branch Assignment:</strong> Each user is assigned to a primary branch. Leads and episodes are tagged with the branch of the handling user</li>
              <li><strong>Branch Master Data:</strong> Branches are managed in the Master Data section under Organisation</li>
            </ul>
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Hub & Spoke Model</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              The multi-branch architecture supports a Hub & Spoke model — a central hospital (hub) with satellite clinics or outreach centers (spokes). Each spoke operates as a branch with its own team and data, while the hub maintains centralized dashboards, reporting, and administration.
            </p>
          </section>
        </div>
      ),
    },
    "help-ticketing/submitting-tickets": {
      title: "Submitting Support Tickets",
      content: (
        <div className="space-y-6">
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">What are Support Tickets?</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              The Help Ticketing System allows any CRM user to report bugs, request new features, or ask for help directly within the platform. Tickets are tracked, assigned, and resolved by the support team — no external email or phone calls needed.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Creating a New Ticket</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Navigate to <strong>Support &gt; Support Tickets</strong> from the sidebar, or click the "Report Issue / Request Feature" link at the bottom of any Help Centre article.
            </p>
            <StepList steps={[
              "Click 'New Ticket' to open the submission form",
              "Select the ticket type: Bug Report or Feature Request",
              "Enter a clear, descriptive title summarizing the issue or request",
              "Provide detailed description — include steps to reproduce for bugs, or a clear explanation of the desired feature",
              "Set the priority level (Low, Medium, High, Critical)",
              "Submit the ticket — you will receive a unique ticket number (e.g., TKT-001)",
            ]} />
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Ticket Fields</h2>
            <FieldTable fields={[
              { field: "Type", desc: "Bug Report (something is broken) or Feature Request (something new is needed)" },
              { field: "Title", desc: "Brief summary of the issue or request" },
              { field: "Description", desc: "Detailed explanation with context, steps to reproduce, and expected vs actual behavior" },
              { field: "Priority", desc: "Low (cosmetic), Medium (usable workaround), High (blocking workflow), Critical (system down)" },
              { field: "Status", desc: "Auto-set to 'Open' on creation. Updated by the support team as work progresses." },
            ]} />
          </section>
          <TipBox>For bug reports, include as much detail as possible — the page where the issue occurs, what you clicked, what you expected to happen, and what actually happened. Screenshots help too.</TipBox>
        </div>
      ),
    },
    "help-ticketing/tracking-tickets": {
      title: "Tracking Your Tickets",
      content: (
        <div className="space-y-6">
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Viewing Your Tickets</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              The Support Tickets page shows all tickets you have submitted. You can see the status, priority, creation date, and any responses from the support team.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Ticket Statuses</h2>
            <div className="space-y-2">
              {[
                { status: "Open", desc: "Ticket has been submitted and is awaiting review", color: "bg-blue-50" },
                { status: "In Progress", desc: "Support team is actively working on this ticket", color: "bg-amber-50" },
                { status: "Resolved", desc: "The issue has been fixed or the feature has been implemented", color: "bg-green-50" },
                { status: "Closed", desc: "Ticket has been completed and closed", color: "bg-gray-50" },
              ].map((item, i) => (
                <div key={i} className={`flex items-center gap-3 px-3 py-2 rounded-lg ${item.color}`}>
                  <span className="text-sm font-semibold text-foreground min-w-[100px]">{item.status}</span>
                  <span className="text-xs text-muted-foreground">— {item.desc}</span>
                </div>
              ))}
            </div>
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Clickable Ticket Numbers</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Each ticket has a unique ticket number (e.g., TKT-001) that is clickable. Click the ticket number to open the full ticket detail view with the complete conversation history, status updates, and any resolution notes.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Ticket Visibility</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              You can see all tickets that you have created, regardless of which team member is handling them. Managers can also see tickets submitted by members of their team. Admins have visibility into all tickets within their hospital.
            </p>
          </section>
        </div>
      ),
    },
    "help-ticketing/admin-ticket-mgmt": {
      title: "Admin Ticket Management",
      content: (
        <div className="space-y-6">
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Support Admin Portal</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Admins and designated support staff have access to the Support Admin Portal where they can manage all incoming tickets across the hospital.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Admin Capabilities</h2>
            <FieldTable fields={[
              { field: "View All Tickets", desc: "See every ticket submitted by any user within the hospital" },
              { field: "Assign Tickets", desc: "Assign tickets to specific support team members for resolution" },
              { field: "Update Status", desc: "Move tickets through the workflow: Open → In Progress → Resolved → Closed" },
              { field: "Add Responses", desc: "Add resolution notes and communicate updates back to the ticket creator" },
              { field: "Priority Management", desc: "Escalate or de-escalate ticket priority based on impact assessment" },
              { field: "Team Management", desc: "Manage the support team roster and ticket assignment rules" },
            ]} />
          </section>
          <section>
            <h2 className="text-lg font-bold text-foreground mb-3">Ticket Creator Information</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Each ticket displays who created it, including their name and role. This helps the support team understand the context and prioritize accordingly — for example, a critical bug reported by a Manager affecting their team may need faster attention than a cosmetic request.
            </p>
          </section>
          <TipBox>Review and triage new tickets daily. Acknowledging tickets quickly (even before resolving them) improves user satisfaction and trust in the support system.</TipBox>
        </div>
      ),
    },
  };
  return articles[key] || null;
}

function StepList({ steps }: { steps: string[] }) {
  return (
    <ol className="space-y-2">
      {steps.map((step, i) => (
        <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground">
          <span className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0 mt-0.5">{i + 1}</span>
          <span>{step}</span>
        </li>
      ))}
    </ol>
  );
}

function FieldTable({ fields }: { fields: { field: string; desc: string }[] }) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/50">
            <th className="text-left py-2 px-3 font-semibold text-foreground text-xs">Field</th>
            <th className="text-left py-2 px-3 font-semibold text-foreground text-xs">Description</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((f, i) => (
            <tr key={i} className="border-t border-muted/50">
              <td className="py-1.5 px-3 text-xs font-medium text-foreground whitespace-nowrap">{f.field}</td>
              <td className="py-1.5 px-3 text-xs text-muted-foreground">{f.desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TipBox({ children }: { children: React.ReactNode }) {
  return (
    <Card className="p-3 border-blue-200 bg-blue-50/50">
      <div className="flex items-start gap-2">
        <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-blue-800 leading-relaxed">{children}</p>
      </div>
    </Card>
  );
}

function WarningBox({ children }: { children: React.ReactNode }) {
  return (
    <Card className="p-3 border-amber-200 bg-amber-50/50">
      <div className="flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-800 leading-relaxed">{children}</p>
      </div>
    </Card>
  );
}

function StatusBadge({ status }: { status: "done" | "partial" | "pending" }) {
  if (status === "done") {
    return (
      <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px] gap-1" data-testid="badge-status-done">
        <CheckCircle2 className="w-3 h-3" /> Implemented
      </Badge>
    );
  }
  if (status === "partial") {
    return (
      <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px] gap-1" data-testid="badge-status-partial">
        <Clock className="w-3 h-3" /> In Progress
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-muted-foreground text-[10px] gap-1" data-testid="badge-status-pending">
      <Circle className="w-3 h-3" /> Planned
    </Badge>
  );
}

function ComplianceCard({ item }: { item: ComplianceItem }) {
  const Icon = item.icon;
  return (
    <Card className="p-4 hover:shadow-md transition-shadow" data-testid={`compliance-card-${item.id}`}>
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${item.status === "done" ? "bg-green-50" : item.status === "partial" ? "bg-amber-50" : "bg-gray-50"}`}>
          <Icon className={`w-4.5 h-4.5 ${item.status === "done" ? "text-green-600" : item.status === "partial" ? "text-amber-600" : "text-gray-400"}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
            <StatusBadge status={item.status} />
          </div>
          <p className="text-xs text-muted-foreground mb-2">{item.description}</p>
          <ul className="space-y-1">
            {item.details.map((detail, i) => (
              <li key={i} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                <span className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${item.status === "done" ? "bg-green-400" : item.status === "partial" ? "bg-amber-400" : "bg-gray-300"}`} />
                {detail}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Card>
  );
}

function HelpNavSidebar({
  sections,
  activeSectionId,
  activeTopicId,
  onSelectTopic,
  searchQuery,
  onSearchChange,
  onClose,
}: {
  sections: HelpSection[];
  activeSectionId: string;
  activeTopicId: string;
  onSelectTopic: (sectionId: string, topicId: string, href?: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onClose?: () => void;
}) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set([activeSectionId]));

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return sections;
    const q = searchQuery.toLowerCase();
    return sections
      .map(section => ({
        ...section,
        topics: section.topics.filter(
          t => t.title.toLowerCase().includes(q) || section.title.toLowerCase().includes(q)
        ),
      }))
      .filter(s => s.topics.length > 0);
  }, [sections, searchQuery]);

  const allExpanded = useMemo(() => {
    if (searchQuery.trim()) return new Set(filteredSections.map(s => s.id));
    return expandedSections;
  }, [searchQuery, filteredSections, expandedSections]);

  return (
    <div className="flex flex-col h-full" data-testid="help-nav-sidebar">
      <div className="p-3 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-primary" />
            <span className="text-sm font-bold text-foreground">Help Topics</span>
          </div>
          {onClose && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose} data-testid="button-close-help-nav">
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search topics..."
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            className="pl-8 h-8 text-xs"
            data-testid="input-help-search"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {filteredSections.map(section => {
          const isExpanded = allExpanded.has(section.id);
          const SectionIcon = section.icon;
          return (
            <div key={section.id}>
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                data-testid={`help-section-${section.id}`}
              >
                {isExpanded ? <ChevronDown className="w-3 h-3 flex-shrink-0" /> : <ChevronRight className="w-3 h-3 flex-shrink-0" />}
                <SectionIcon className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">{section.title}</span>
                <Badge variant="outline" className="ml-auto text-[9px] px-1 py-0">{section.topics.length}</Badge>
              </button>
              {isExpanded && (
                <div className="pb-1">
                  {section.topics.map(topic => {
                    const isActive = section.id === activeSectionId && topic.id === activeTopicId;
                    const TopicIcon = topic.icon;
                    return (
                      <button
                        key={topic.id}
                        onClick={() => onSelectTopic(section.id, topic.id, topic.isExternal ? topic.href : undefined)}
                        className={cn(
                          "w-full flex items-center gap-2 pl-9 pr-3 py-1.5 text-xs transition-colors",
                          isActive
                            ? "bg-primary/10 text-primary font-medium"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                        )}
                        data-testid={`help-topic-${section.id}-${topic.id}`}
                      >
                        <TopicIcon className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate text-left">{topic.title}</span>
                        {topic.isExternal && <ExternalLink className="w-2.5 h-2.5 ml-auto flex-shrink-0 opacity-50" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
        {filteredSections.length === 0 && (
          <div className="px-3 py-6 text-center text-xs text-muted-foreground">
            No topics found for "{searchQuery}"
          </div>
        )}
      </div>
    </div>
  );
}

export default function HelpCenter() {
  const [location, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  if (location === "/help/data-security") {
    return <DataSecurityPage />;
  }

  const pathParts = location.replace("/help", "").split("/").filter(Boolean);
  let activeSectionId = pathParts[0] || "getting-started";
  let activeTopicId = pathParts[1] || "";

  const sectionExists = HELP_SECTIONS.find(s => s.id === activeSectionId);
  if (!sectionExists) {
    activeSectionId = "getting-started";
    activeTopicId = "overview";
  } else if (!activeTopicId) {
    activeTopicId = sectionExists.topics[0]?.id || "";
  }

  const handleSelectTopic = (sectionId: string, topicId: string, externalHref?: string) => {
    if (externalHref) {
      navigate(externalHref);
      return;
    }
    navigate(`/help/${sectionId}/${topicId}`);
    setMobileNavOpen(false);
  };

  const article = getArticleContent(activeSectionId, activeTopicId);
  const currentSection = HELP_SECTIONS.find(s => s.id === activeSectionId);
  const currentTopic = currentSection?.topics.find(t => t.id === activeTopicId);

  return (
    <AppLayout>
      <div className="flex h-full overflow-hidden" data-testid="help-center-page">
        <div className="hidden md:flex w-64 border-r border-border bg-card flex-shrink-0 flex-col">
          <HelpNavSidebar
            sections={HELP_SECTIONS}
            activeSectionId={activeSectionId}
            activeTopicId={activeTopicId}
            onSelectTopic={handleSelectTopic}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />
        </div>

        {mobileNavOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div className="absolute inset-0 bg-black/50" onClick={() => setMobileNavOpen(false)} />
            <div className="absolute left-0 top-0 bottom-0 w-72 bg-card shadow-xl">
              <HelpNavSidebar
                sections={HELP_SECTIONS}
                activeSectionId={activeSectionId}
                activeTopicId={activeTopicId}
                onSelectTopic={handleSelectTopic}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                onClose={() => setMobileNavOpen(false)}
              />
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-4 md:px-8 py-6">
            <div className="flex items-center gap-2 mb-6 md:hidden">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMobileNavOpen(true)}
                data-testid="button-open-help-nav"
              >
                <Menu className="w-4 h-4 mr-1" />
                Topics
              </Button>
            </div>

            {currentSection && currentTopic && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-4" data-testid="help-breadcrumb">
                <span>Help</span>
                <ChevronRight className="w-3 h-3" />
                <span>{currentSection.title}</span>
                <ChevronRight className="w-3 h-3" />
                <span className="text-foreground font-medium">{currentTopic.title}</span>
              </div>
            )}

            {article ? (
              <div data-testid="help-article-content">
                <h1 className="text-xl font-bold text-foreground mb-6" data-testid="text-article-title">{article.title}</h1>
                {article.content}
              </div>
            ) : (
              <div className="text-center py-12">
                <BookOpen className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <h2 className="text-lg font-semibold text-foreground mb-1">Topic Not Found</h2>
                <p className="text-sm text-muted-foreground">
                  This help topic is coming soon. Please select another topic from the navigation.
                </p>
              </div>
            )}

            <div className="mt-10 pt-6 border-t border-border">
              <div className="flex flex-col items-center gap-3">
                <p className="text-sm text-muted-foreground">Can't find what you need? Report an issue or request a feature.</p>
                <Link
                  href="/support-tickets"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
                  data-testid="link-report-issue"
                >
                  <Ticket className="w-4 h-4" />
                  Report Issue / Request Feature
                </Link>
              </div>
              <p className="text-xs text-muted-foreground text-center mt-4">
                myProSys Hospital CRM — Help & Resources
              </p>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function DataSecurityPage() {
  const [, navigate] = useLocation();

  const doneItems = COMPLIANCE_ITEMS.filter(i => i.status === "done");
  const partialItems = COMPLIANCE_ITEMS.filter(i => i.status === "partial");
  const pendingItems = COMPLIANCE_ITEMS.filter(i => i.status === "pending");
  const doneCount = doneItems.length;
  const totalCount = COMPLIANCE_ITEMS.length;
  const compliancePercent = Math.round((doneCount / totalCount) * 100);

  return (
    <AppLayout>
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 md:px-8 py-8">
          <button
            onClick={() => navigate("/help")}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
            data-testid="button-back-to-help"
          >
            <ArrowRight className="w-3.5 h-3.5 rotate-180" />
            Back to Help & Resources
          </button>

          <div className="flex items-start gap-4 mb-8">
            <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="w-6 h-6 text-green-600" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-foreground mb-1" data-testid="text-security-title">Data Security & Compliance</h1>
              <p className="text-sm text-muted-foreground">
                Healthcare-grade security measures protecting patient data. This tracker shows implemented protections and planned enhancements.
              </p>
            </div>
          </div>

          <Card className="p-5 mb-8 border-2 border-green-100 bg-green-50/30">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-green-600" />
                <span className="text-sm font-bold text-foreground">Compliance Score</span>
              </div>
              <span className="text-2xl font-bold text-green-700" data-testid="text-compliance-score">{compliancePercent}%</span>
            </div>
            <div className="w-full h-3 bg-white rounded-full overflow-hidden mb-2">
              <div
                className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${compliancePercent}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{doneCount} implemented</span>
              {partialItems.length > 0 && <span>{partialItems.length} in progress</span>}
              <span>{pendingItems.length} planned</span>
            </div>
          </Card>

          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <h2 className="text-lg font-bold text-foreground">Implemented ({doneItems.length})</h2>
          </div>
          <div className="space-y-3 mb-8">
            {doneItems.map((item) => (
              <ComplianceCard key={item.id} item={item} />
            ))}
          </div>

          {partialItems.length > 0 && (
            <>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 rounded-full bg-amber-500" />
                <h2 className="text-lg font-bold text-foreground">In Progress ({partialItems.length})</h2>
              </div>
              <div className="space-y-3 mb-8">
                {partialItems.map((item) => (
                  <ComplianceCard key={item.id} item={item} />
                ))}
              </div>
            </>
          )}

          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 rounded-full bg-gray-300" />
            <h2 className="text-lg font-bold text-foreground">Planned ({pendingItems.length})</h2>
          </div>
          <div className="space-y-3 mb-8">
            {pendingItems.map((item) => (
              <ComplianceCard key={item.id} item={item} />
            ))}
          </div>

          <Card className="p-4 border-amber-200 bg-amber-50/50 mt-8">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-1">Compliance Notice</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  This compliance tracker reflects the current state of security measures implemented in the myProSys Hospital CRM platform. Planned items are on the roadmap and will be implemented in upcoming releases. For regulatory inquiries or compliance audits, please contact your system administrator.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
