import { AppLayout } from "@/components/layout/AppLayout";
import { useLocation } from "wouter";
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
} from "lucide-react";
import { SiFacebook, SiInstagram } from "react-icons/si";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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

type HelpDoc = {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: any;
  iconBg: string;
  category: string;
};

const HELP_DOCS: HelpDoc[] = [
  {
    id: "meta-integration",
    title: "Meta (Facebook & Instagram) Integration Guide",
    description: "Complete setup guide for connecting your Meta Business ad accounts, configuring lead capture rules, and tracking campaign performance with UTM attribution.",
    href: "/help/meta-integration",
    icon: SiFacebook,
    iconBg: "bg-blue-50",
    category: "Integrations",
  },
  {
    id: "data-security",
    title: "Data Security & Compliance Status",
    description: "Healthcare-grade security compliance tracker showing implemented protections and upcoming security enhancements for patient data.",
    href: "/help/data-security",
    icon: ShieldCheck,
    iconBg: "bg-green-50",
    category: "Security & Compliance",
  },
];

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

export default function HelpCenter() {
  const [location, navigate] = useLocation();

  if (location === "/help/data-security") {
    return <DataSecurityPage />;
  }

  const doneCount = COMPLIANCE_ITEMS.filter(i => i.status === "done").length;
  const totalCount = COMPLIANCE_ITEMS.length;
  const compliancePercent = Math.round((doneCount / totalCount) * 100);

  return (
    <AppLayout title="Help & Resources">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 md:px-8 py-8">
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground" data-testid="text-help-title">Help & Resources</h1>
                <p className="text-sm text-muted-foreground">Guides, documentation, and compliance information</p>
              </div>
            </div>
          </div>

          <div className="mb-6">
            <div className="flex items-center gap-3 mb-1">
              <ShieldCheck className="w-5 h-5 text-green-600" />
              <span className="text-sm font-semibold text-foreground">Overall Compliance</span>
              <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">{compliancePercent}%</Badge>
            </div>
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mt-2 mb-1">
              <div
                className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${compliancePercent}%` }}
                data-testid="progress-compliance"
              />
            </div>
            <p className="text-xs text-muted-foreground">{doneCount} of {totalCount} security measures implemented</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {HELP_DOCS.map((doc) => {
              const Icon = doc.icon;
              return (
                <Card
                  key={doc.id}
                  role="button"
                  tabIndex={0}
                  className="p-5 cursor-pointer hover:shadow-lg transition-all group border-2 hover:border-primary/30"
                  onClick={() => navigate(doc.href)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") navigate(doc.href); }}
                  data-testid={`help-card-${doc.id}`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl ${doc.iconBg} flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform`}>
                      <Icon className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-[10px]">{doc.category}</Badge>
                      </div>
                      <h3 className="text-sm font-bold text-foreground mb-1 group-hover:text-primary transition-colors">{doc.title}</h3>
                      <p className="text-xs text-muted-foreground leading-relaxed">{doc.description}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all flex-shrink-0 mt-1" />
                  </div>
                </Card>
              );
            })}
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
    <AppLayout title="Data Security & Compliance">
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
