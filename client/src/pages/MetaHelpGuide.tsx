import { ArrowLeft, CheckCircle2, AlertTriangle, HelpCircle, Link2, BarChart3, Users, Shield, RefreshCw, Settings, Plug, Eye, MousePointerClick, Target, IndianRupee, Zap, BookOpen, ChevronDown, ChevronRight, ExternalLink, Copy, Globe } from "lucide-react";
import { SiFacebook, SiInstagram } from "react-icons/si";
import { useLocation } from "wouter";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";

function Section({ id, title, icon: Icon, children }: { id: string; title: string; icon: any; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
          <Icon className="w-4 h-4 text-blue-600" />
        </div>
        <h2 className="text-xl font-semibold text-foreground">{title}</h2>
      </div>
      <div className="pl-[42px]">{children}</div>
    </section>
  );
}

function Step({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 mb-4">
      <div className="w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
        {number}
      </div>
      <div>
        <p className="font-medium text-foreground mb-1">{title}</p>
        <div className="text-sm text-muted-foreground leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

function FAQ({ question, children }: { question: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-3.5 text-left hover:bg-slate-50 transition-colors"
        data-testid={`faq-toggle-${question.slice(0, 20).replace(/\s/g, "-").toLowerCase()}`}
      >
        <span className="font-medium text-sm text-foreground pr-4">{question}</span>
        {open ? <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
      </button>
      {open && <div className="px-3.5 pb-3.5 text-sm text-muted-foreground leading-relaxed border-t pt-3">{children}</div>}
    </div>
  );
}

function InfoBox({ type, children }: { type: "info" | "warning" | "success"; children: React.ReactNode }) {
  const styles = {
    info: "bg-blue-50 border-blue-200 text-blue-800",
    warning: "bg-amber-50 border-amber-200 text-amber-800",
    success: "bg-green-50 border-green-200 text-green-800",
  };
  const icons = { info: HelpCircle, warning: AlertTriangle, success: CheckCircle2 };
  const IconEl = icons[type];
  return (
    <div className={`flex gap-2.5 p-3 rounded-lg border text-sm leading-relaxed ${styles[type]}`}>
      <IconEl className="w-4 h-4 flex-shrink-0 mt-0.5" />
      <div>{children}</div>
    </div>
  );
}

const TOC_ITEMS = [
  { id: "purpose", label: "Why Connect Meta" },
  { id: "before-you-begin", label: "Before You Begin" },
  { id: "what-gets-connected", label: "What Gets Connected" },
  { id: "what-data-comes-in", label: "What Data Comes In" },
  { id: "step-by-step", label: "Step-by-Step Setup" },
  { id: "meta-setup", label: "Meta Business Setup" },
  { id: "lead-capture", label: "Lead Capture Rules" },
  { id: "after-connection", label: "After Connection" },
  { id: "where-to-see-data", label: "Where to See Data" },
  { id: "utm-tracking", label: "UTM Tracking & Attribution" },
  { id: "permissions", label: "Permissions Required" },
  { id: "multi-tenant", label: "Multi-Tenant Isolation" },
  { id: "troubleshooting", label: "Troubleshooting" },
  { id: "checklist", label: "Quick Checklist" },
  { id: "faq", label: "FAQ" },
];

export default function MetaHelpGuide() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white" data-testid="meta-help-guide-page">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors"
          data-testid="button-back-home"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </button>

        <div className="flex items-start gap-4 mb-10">
          <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center flex-shrink-0">
            <SiFacebook className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground" data-testid="text-guide-title">Connecting Meta to MyProSys Hospital CRM</h1>
            <p className="text-muted-foreground mt-1">Complete guide for connecting Facebook & Instagram to capture leads, track campaigns, and monitor ad performance</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-10">
          <nav className="hidden lg:block sticky top-6 self-start">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Contents</p>
            <ul className="space-y-1.5">
              {TOC_ITEMS.map(item => (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    className="text-sm text-muted-foreground hover:text-primary transition-colors block py-0.5"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="space-y-10">
            <Section id="purpose" title="Why Connect Meta" icon={Globe}>
              <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                Hospitals run marketing campaigns on Facebook and Instagram to attract patients. Without a direct connection, your team would need to manually download leads from Meta, upload them into the CRM, and separately check campaign performance in Ads Manager.
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                Connecting Meta to MyProSys Hospital CRM eliminates this manual effort. Once connected:
              </p>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1.5 ml-1">
                <li><strong>Leads from your Facebook and Instagram lead forms</strong> flow directly into the Leads Workspace, ready for your telecalling or front desk team to act on</li>
                <li><strong>Campaign performance data</strong> (spend, impressions, clicks, conversions) syncs into the CRM so you can see marketing ROI alongside patient journey data</li>
                <li><strong>Source attribution is preserved</strong> — you can trace which campaign, ad set, or creative brought in each patient</li>
              </ul>
            </Section>

            <Section id="before-you-begin" title="Before You Begin" icon={Settings}>
              <p className="text-sm text-muted-foreground leading-relaxed mb-3">Make sure you have the following in place before starting the connection:</p>
              <div className="space-y-2">
                <div className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-muted-foreground"><strong>Admin access in MyProSys CRM</strong> — You need to be an Admin or Manager to access the Connectors page</span>
                </div>
                <div className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-muted-foreground"><strong>Meta Business Manager access</strong> — You must be an admin of the Facebook Business Manager that owns the Ad Account, Page, and Lead Forms</span>
                </div>
                <div className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-muted-foreground"><strong>A Meta Developer App</strong> — You'll need to create one at developers.facebook.com (free, takes 5 minutes)</span>
                </div>
                <div className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-muted-foreground"><strong>Your Ad Account ID</strong> — Found in Meta Business Manager under Accounts &rarr; Ad Accounts</span>
                </div>
              </div>
              <InfoBox type="info">
                Each hospital connects its own Meta account separately. You will only see data from your own hospital's campaigns and lead forms — never from another hospital on the platform.
              </InfoBox>
            </Section>

            <Section id="what-gets-connected" title="What Gets Connected" icon={Link2}>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">When you connect Meta, the following assets from your hospital's Meta Business Manager are linked:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 border rounded-lg bg-white">
                  <div className="flex items-center gap-2 mb-1.5">
                    <SiFacebook className="w-4 h-4 text-blue-600" />
                    <span className="font-medium text-sm">Facebook Page</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Your hospital's Facebook Page where ads are published and lead forms are hosted</p>
                </div>
                <div className="p-3 border rounded-lg bg-white">
                  <div className="flex items-center gap-2 mb-1.5">
                    <SiInstagram className="w-4 h-4 text-pink-600" />
                    <span className="font-medium text-sm">Instagram Account</span>
                  </div>
                  <p className="text-xs text-muted-foreground">If linked to your Facebook Page, Instagram lead ads are also captured</p>
                </div>
                <div className="p-3 border rounded-lg bg-white">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Users className="w-4 h-4 text-green-600" />
                    <span className="font-medium text-sm">Lead Forms</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Instant Forms (Lead Ads) where patients fill in their name, phone, and inquiry details</p>
                </div>
                <div className="p-3 border rounded-lg bg-white">
                  <div className="flex items-center gap-2 mb-1.5">
                    <BarChart3 className="w-4 h-4 text-orange-600" />
                    <span className="font-medium text-sm">Ad Account</span>
                  </div>
                  <p className="text-xs text-muted-foreground">The advertising account used to run campaigns — this is where spend and performance data comes from</p>
                </div>
              </div>
            </Section>

            <Section id="what-data-comes-in" title="What Data Comes Into MyProSys" icon={BarChart3}>
              <div className="space-y-6">
                <div>
                  <h3 className="font-medium text-foreground mb-2 flex items-center gap-2">
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">A</Badge>
                    Leads Data
                  </h3>
                  <p className="text-sm text-muted-foreground mb-2">Every time a patient fills out your Facebook or Instagram lead form, a new lead is created in the CRM with:</p>
                  <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-1">
                    <li>Patient name, phone number, email (as captured in the form)</li>
                    <li>Lead source automatically tagged as "Facebook" or "Instagram"</li>
                    <li>Campaign name, ad set, and ad creative details (if UTM parameters are configured)</li>
                    <li>The lead appears in the <strong>Leads Workspace</strong> with status "Raw Lead Captured"</li>
                    <li>If lead capture rules are configured, the lead is automatically assigned to a team member</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-medium text-foreground mb-2 flex items-center gap-2">
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">B</Badge>
                    Campaign Insights & Performance Data
                  </h3>
                  <p className="text-sm text-muted-foreground mb-2">The CRM pulls the following metrics from your Meta Ad Account:</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {[
                      { icon: Eye, label: "Impressions", desc: "How many times your ads were shown" },
                      { icon: MousePointerClick, label: "Clicks", desc: "How many people clicked on your ad" },
                      { icon: IndianRupee, label: "Spend", desc: "Total amount spent in INR" },
                      { icon: Target, label: "CTR", desc: "Click-through rate (percentage)" },
                      { icon: IndianRupee, label: "CPC", desc: "Cost per click in INR" },
                      { icon: Eye, label: "Reach", desc: "Unique people who saw your ad" },
                      { icon: Users, label: "Conversions", desc: "Lead form fills and registrations" },
                    ].map(m => (
                      <div key={m.label} className="p-2.5 border rounded bg-white">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <m.icon className="w-3.5 h-3.5 text-primary" />
                          <span className="text-xs font-medium">{m.label}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground">{m.desc}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">These metrics are available at the account level and per campaign. Data syncs when you click <strong>Sync</strong> or <strong>Insights</strong> on the Connectors page.</p>
                </div>
              </div>
            </Section>

            <Section id="step-by-step" title="Step-by-Step: Connecting Meta in the CRM" icon={Plug}>
              <Step number={1} title="Open the Connectors page">
                <p>From the CRM sidebar, go to <strong>Configurations</strong> &rarr; <strong>Connectors</strong>. You will see the available platform connectors listed as cards.</p>
              </Step>
              <Step number={2} title="Find the Meta connector card">
                <p>Look for the card labeled <strong>"Meta (Facebook & Instagram)"</strong> with the Facebook icon. It will show a status of "Not configured" if this is your first time.</p>
              </Step>
              <Step number={3} title='Click "Connect"'>
                <p>Click the <strong>Connect</strong> button on the Meta card. A configuration dialog will open with four fields to fill in.</p>
              </Step>
              <Step number={4} title="Fill in the connection details">
                <p>Enter the following four values (see the next section for where to find each one):</p>
                <div className="mt-2 space-y-3">
                  <div className="p-3 bg-slate-50 rounded-lg border">
                    <p className="font-medium text-foreground text-sm">App ID</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Your Meta Developer App's unique identifier. Found at developers.facebook.com &rarr; My Apps &rarr; select your app &rarr; Settings &rarr; Basic.</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border">
                    <p className="font-medium text-foreground text-sm">App Secret</p>
                    <p className="text-xs text-muted-foreground mt-0.5">The private key for your app. Found at developers.facebook.com &rarr; Settings &rarr; Basic &rarr; click "Show" next to App Secret. You'll need to enter your Facebook password to reveal it.</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border">
                    <p className="font-medium text-foreground text-sm">Access Token</p>
                    <p className="text-xs text-muted-foreground mt-0.5">A long-lived or system user token that authorises the CRM to read your ad data and leads. See the "Meta Business Setup" section below for how to generate one that does not expire.</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border">
                    <p className="font-medium text-foreground text-sm">Ad Account ID</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Your advertising account identifier, in the format <code className="bg-slate-200 px-1 rounded text-xs">act_1234567890</code>. Found in Meta Business Manager &rarr; Business Settings &rarr; Accounts &rarr; Ad Accounts. The number is also visible in the Ads Manager URL.</p>
                  </div>
                </div>
              </Step>
              <Step number={5} title='Click "Save & Connect"'>
                <p>The CRM will save your credentials and attempt to verify the connection. If successful, the card status will change to <strong>"Connected"</strong> with a green badge.</p>
              </Step>
              <Step number={6} title="Test and sync">
                <p>After connecting, click <strong>Sync</strong> to pull in your latest campaign data. Click <strong>Insights</strong> to view a summary of your ad performance right inside the CRM.</p>
              </Step>
            </Section>

            <Section id="meta-setup" title="Setting Up Meta Business Manager" icon={SiFacebook}>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                This section explains how to create the credentials you need on Meta's side. You only need to do this once.
              </p>

              <h3 className="font-medium text-foreground mb-2">Creating a Meta Developer App</h3>
              <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-1.5 ml-1 mb-4">
                <li>Go to <strong>developers.facebook.com</strong> and log in with your Facebook account</li>
                <li>Click <strong>"My Apps"</strong> in the top-right corner</li>
                <li>Click <strong>"Create App"</strong></li>
                <li>Select the <strong>"Business"</strong> app type</li>
                <li>Give the app a name (e.g., "MyProSys CRM - [Hospital Name]")</li>
                <li>Select your Business Manager account and click <strong>"Create App"</strong></li>
                <li>Once created, go to <strong>Settings &rarr; Basic</strong> to find your <strong>App ID</strong> and <strong>App Secret</strong></li>
              </ol>

              <h3 className="font-medium text-foreground mb-2">Generating a System User Access Token (Recommended — Does Not Expire)</h3>
              <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-1.5 ml-1 mb-4">
                <li>Go to <strong>business.facebook.com</strong> &rarr; <strong>Business Settings</strong></li>
                <li>In the left menu, click <strong>Users &rarr; System Users</strong></li>
                <li>Click <strong>"Add"</strong> and create a new system user (name it "MyProSys CRM")</li>
                <li>Set the role to <strong>"Admin"</strong></li>
                <li>Click <strong>"Generate New Token"</strong></li>
                <li>Select your Meta Developer App from the dropdown</li>
                <li>
                  Grant the following permissions:
                  <ul className="list-disc list-inside ml-4 mt-1 space-y-0.5">
                    <li><code className="bg-slate-100 px-1 rounded text-xs">ads_read</code> — Read campaign and ad performance data</li>
                    <li><code className="bg-slate-100 px-1 rounded text-xs">ads_management</code> — Access campaign structure and metadata</li>
                    <li><code className="bg-slate-100 px-1 rounded text-xs">leads_read</code> — Retrieve lead form submissions</li>
                    <li><code className="bg-slate-100 px-1 rounded text-xs">pages_read_engagement</code> — Access page-level data</li>
                    <li><code className="bg-slate-100 px-1 rounded text-xs">pages_manage_ads</code> — Access ad-related page data</li>
                  </ul>
                </li>
                <li>Click <strong>"Generate Token"</strong> and <strong>copy the token immediately</strong> — you will not be able to see it again</li>
                <li>Then go to <strong>Accounts &rarr; Ad Accounts</strong>, select your ad account, click <strong>"Add People"</strong>, and add the system user with <strong>"View Performance"</strong> access</li>
              </ol>

              <InfoBox type="warning">
                <strong>Important:</strong> A system user token does not expire — this is the recommended approach for production use. If you use a personal user token from the Graph API Explorer instead, it will expire after 60 days and you will need to reconnect.
              </InfoBox>

              <h3 className="font-medium text-foreground mt-4 mb-2">Finding Your Ad Account ID</h3>
              <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-1.5 ml-1">
                <li>In Meta Business Manager, go to <strong>Business Settings &rarr; Accounts &rarr; Ad Accounts</strong></li>
                <li>Select your hospital's ad account — you'll see the Account ID (a number like <code className="bg-slate-100 px-1 rounded text-xs">1234567890</code>)</li>
                <li>In the CRM, enter it with the <code className="bg-slate-100 px-1 rounded text-xs">act_</code> prefix: <code className="bg-slate-100 px-1 rounded text-xs">act_1234567890</code></li>
              </ol>
            </Section>

            <Section id="lead-capture" title="Setting Up Lead Capture Rules" icon={Users}>
              <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                After connecting Meta, you should set up a <strong>Lead Capture Rule</strong> to tell the CRM how to handle incoming leads from your Facebook/Instagram forms. This controls assignment, duplicate handling, and field mapping.
              </p>
              <Step number={1} title="Create a new Lead Capture Rule">
                <p>On the same Connectors page, scroll down to the <strong>"Lead Capture Rules"</strong> section and click <strong>"New Rule"</strong>.</p>
              </Step>
              <Step number={2} title="Configure the rule">
                <div className="space-y-2 mt-1">
                  <p><strong>Name:</strong> Give it a descriptive name (e.g., "Facebook Lead Ads")</p>
                  <p><strong>Source Type:</strong> Select <strong>"Meta Lead Ads"</strong></p>
                  <p><strong>Active:</strong> Set to <strong>"Yes"</strong></p>
                </div>
              </Step>
              <Step number={3} title="Set assignment strategy">
                <p>Choose how incoming leads should be distributed to your team:</p>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  <li><strong>Round Robin</strong> — Distributes leads evenly among selected team members, one by one</li>
                  <li><strong>Specific Employees</strong> — Sends all leads to specific people you select</li>
                </ul>
              </Step>
              <Step number={4} title="Configure duplicate handling">
                <p>When a lead with the same phone number already exists in the system:</p>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  <li><strong>Skip</strong> — Ignore the duplicate, keep the existing lead as is</li>
                  <li><strong>Update Blank Only</strong> — Fill in only the fields that are currently empty on the existing lead</li>
                  <li><strong>Overwrite</strong> — Replace existing data with the new submission</li>
                </ul>
              </Step>
              <Step number={5} title="Map form fields (optional)">
                <p>If your Meta lead form uses custom field names, use the <strong>Field Mapping</strong> section to map them to the correct CRM fields (Name, Phone, Email, etc.).</p>
              </Step>
              <Step number={6} title='Click "Create Rule"'>
                <p>The rule is now active. All future lead form submissions matching this rule will be processed automatically.</p>
              </Step>
            </Section>

            <Section id="after-connection" title="What Happens After Successful Connection" icon={CheckCircle2}>
              <div className="space-y-3">
                <div className="flex items-start gap-2.5 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">The Meta connector card shows <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-[10px] mx-1">Connected</Badge> status</span>
                </div>
                <div className="flex items-start gap-2.5 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-muted-foreground"><strong>Leads</strong> from your Facebook and Instagram lead forms start arriving in the <strong>Leads Workspace</strong> automatically, tagged with the source</span>
                </div>
                <div className="flex items-start gap-2.5 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-muted-foreground"><strong>Campaign insights</strong> become available when you click <strong>Sync</strong> or <strong>Insights</strong> on the connector card</span>
                </div>
                <div className="flex items-start gap-2.5 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">If lead capture rules are active, incoming leads are automatically assigned to the designated team members</span>
                </div>
                <div className="flex items-start gap-2.5 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">All data remains <strong>tenant-specific</strong> — only your hospital's data is visible, never another hospital's</span>
                </div>
              </div>
            </Section>

            <Section id="where-to-see-data" title="Where to See the Synced Data" icon={Eye}>
              <div className="space-y-4">
                <div className="p-4 border rounded-lg bg-white">
                  <h3 className="font-medium text-foreground mb-1.5 flex items-center gap-2">
                    <Users className="w-4 h-4 text-green-600" />
                    Leads Workspace
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Navigate to <strong>Leads Workspace</strong> from the sidebar. Leads from Meta forms appear here with their source tagged as "Facebook" or "Instagram". Use the Kanban board to move them through your pipeline (Raw &rarr; Contacted &rarr; Qualified &rarr; Appointment Booked, and so on). Each lead's detail page shows the full source attribution including UTM parameters if configured.
                  </p>
                </div>
                <div className="p-4 border rounded-lg bg-white">
                  <h3 className="font-medium text-foreground mb-1.5 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-blue-600" />
                    Connectors &rarr; Meta Insights
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    On the <strong>Connectors</strong> page, click <strong>Insights</strong> on the Meta card to see a live summary of your ad account's performance: Impressions, Clicks, Spend, CTR, CPC, Reach, and Conversions. Click <strong>Sync</strong> to refresh the data.
                  </p>
                </div>
                <div className="p-4 border rounded-lg bg-white">
                  <h3 className="font-medium text-foreground mb-1.5 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-orange-600" />
                    Campaigns Page
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    The <strong>Campaigns</strong> page (under Marketing in the sidebar) lets you manage campaign records, generate standardised UTM tracking links, and monitor which campaigns are driving leads into your pipeline.
                  </p>
                </div>
                <div className="p-4 border rounded-lg bg-white">
                  <h3 className="font-medium text-foreground mb-1.5 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-purple-600" />
                    Dashboard
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    The management <strong>Dashboard</strong> shows the overall lead pipeline (how many leads are at each stage), conversion rates, and intelligence metrics. Leads that came from Meta campaigns are included in these aggregated KPIs, and you can trace their journey from raw lead to conversion.
                  </p>
                </div>
              </div>
            </Section>

            <Section id="utm-tracking" title="UTM Tracking & Campaign Attribution" icon={Link2}>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                UTM parameters are small tags added to URLs that tell the CRM exactly which campaign, ad set, and creative brought in a particular lead. This is how you measure which marketing effort is actually working.
              </p>

              <h3 className="font-medium text-foreground mb-2">What Are UTM Parameters?</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                UTM stands for "Urchin Tracking Module." They are standard tags added to the end of a URL. When someone clicks that URL, the tags travel with them and get recorded by the CRM.
              </p>
              <div className="p-3 bg-slate-50 rounded-lg border mb-4 overflow-x-auto">
                <p className="text-xs font-mono text-muted-foreground">
                  https://yourhospital.com/inquiry<span className="text-primary font-semibold">?utm_source=facebook&utm_medium=cpc&utm_campaign=viroc_meta_leadgen_2025_mar_ad1&utm_term=knee_replacement&utm_content=video_testimonial</span>
                </p>
              </div>
              <div className="space-y-2 mb-6">
                {[
                  { param: "utm_source", desc: "Where the traffic came from", example: "facebook, instagram, google" },
                  { param: "utm_medium", desc: "The type of marketing channel", example: "cpc (paid click), organic, email" },
                  { param: "utm_campaign", desc: "The specific campaign name", example: "viroc_meta_leadgen_2025_mar_ad1" },
                  { param: "utm_term", desc: "The target keyword or audience", example: "knee_replacement, hip_surgery" },
                  { param: "utm_content", desc: "Which specific ad creative was used", example: "video_testimonial, patient_story_banner" },
                ].map(u => (
                  <div key={u.param} className="p-2.5 border rounded bg-white flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                    <code className="text-xs font-mono font-semibold text-primary bg-blue-50 px-2 py-0.5 rounded w-fit">{u.param}</code>
                    <span className="text-xs text-muted-foreground flex-1">{u.desc}</span>
                    <span className="text-[11px] text-muted-foreground/70">e.g., {u.example}</span>
                  </div>
                ))}
              </div>

              <h3 className="font-medium text-foreground mb-2">How UTMs Work with Meta Campaigns</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-3">There are two scenarios depending on the type of Meta ad you are running:</p>

              <div className="space-y-4 mb-6">
                <div className="p-4 border rounded-lg bg-white">
                  <h4 className="font-medium text-sm text-foreground mb-1.5">Scenario 1: Ads That Send People to a Landing Page (Website Clicks)</h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    When your ad links to your hospital's website or a landing page, you add UTM parameters to the destination URL. Meta supports dynamic parameters that automatically fill in the campaign and ad details:
                  </p>
                  <div className="p-2.5 bg-slate-50 rounded border text-xs font-mono text-muted-foreground overflow-x-auto">
                    utm_source=facebook&utm_medium=cpc&utm_campaign={"{{campaign.name}}"}&utm_term={"{{adset.name}}"}&utm_content={"{{ad.name}}"}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Meta replaces <code className="bg-slate-100 px-1 rounded">{"{{campaign.name}}"}</code>, <code className="bg-slate-100 px-1 rounded">{"{{adset.name}}"}</code>, and <code className="bg-slate-100 px-1 rounded">{"{{ad.name}}"}</code> with actual names when the ad is clicked. When the patient fills a form on your website, these parameters are captured and stored on the lead record.
                  </p>
                </div>

                <div className="p-4 border rounded-lg bg-white">
                  <h4 className="font-medium text-sm text-foreground mb-1.5">Scenario 2: Lead Form Ads (Instant Forms)</h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    With Lead Ads, the patient fills a form directly on Facebook or Instagram — there is no landing page URL. In this case, UTM data can be passed using:
                  </p>
                  <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-1">
                    <li><strong>Hidden fields</strong> in the lead form — add custom fields with UTM values that are pre-filled but not shown to the patient</li>
                    <li><strong>URL parameters on the form link</strong> — Meta passes tracking parameters that the CRM's lead capture rule can map to UTM fields</li>
                    <li><strong>Campaign naming convention</strong> — The CRM's UTM generator creates standardized campaign names that can be matched back to leads</li>
                  </ul>
                </div>
              </div>

              <h3 className="font-medium text-foreground mb-2">Using the CRM's UTM Generator</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                MyProSys includes a built-in UTM generator on the <strong>Campaigns</strong> page. When you create a campaign:
              </p>
              <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-1.5 ml-1 mb-3">
                <li>Select the <strong>Platform</strong> (Meta, Google, LinkedIn, etc.) — the system automatically sets <code className="bg-slate-100 px-1 rounded text-xs">utm_source</code> and <code className="bg-slate-100 px-1 rounded text-xs">utm_medium</code></li>
                <li>Fill in the campaign details (Objective, Year, Month, Ad Number) — the system generates a standardised <code className="bg-slate-100 px-1 rounded text-xs">utm_campaign</code> value</li>
                <li>Optionally add <code className="bg-slate-100 px-1 rounded text-xs">utm_term</code> (target audience or keyword) and <code className="bg-slate-100 px-1 rounded text-xs">utm_content</code> (specific creative or artwork variant)</li>
                <li>The full UTM string is shown as a preview that you can copy and paste into your Meta ad's tracking parameters</li>
              </ol>

              <InfoBox type="info">
                <strong>Example:</strong> When you select "Meta" as the platform and "LeadGen" as the objective for March 2025 Ad 1, the system generates:
                <code className="block mt-1.5 text-xs bg-blue-100 px-2 py-1 rounded">?utm_source=facebook&utm_medium=cpc&utm_campaign=viroc_meta_leadgen_2025_mar_ad1</code>
              </InfoBox>

              <h3 className="font-medium text-foreground mt-4 mb-2">How UTMs Enable Campaign Performance Evaluation</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                Once UTM parameters are attached to leads, the CRM can answer critical business questions:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  { q: "Which campaign brought the most leads?", a: "Group leads by utm_campaign" },
                  { q: "Which creative/artwork performs best?", a: "Compare leads by utm_content" },
                  { q: "Which audience segment converts?", a: "Analyse leads by utm_term" },
                  { q: "Facebook vs Instagram — which works?", a: "Filter leads by utm_source" },
                  { q: "What's the cost per converted patient?", a: "Combine spend data with lead conversion status" },
                  { q: "Which campaigns generate surgery cases?", a: "Trace UTM → Lead → Episode → Surgery" },
                ].map((item, i) => (
                  <div key={i} className="p-2.5 border rounded bg-white">
                    <p className="text-xs font-medium text-foreground">{item.q}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{item.a}</p>
                  </div>
                ))}
              </div>
            </Section>

            <Section id="permissions" title="Permissions Required from Meta" icon={Shield}>
              <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                When generating your access token, you need to grant the following permissions. Here's what each one does in simple terms:
              </p>
              <div className="space-y-2">
                {[
                  { perm: "ads_read", why: "Allows the CRM to read your campaign performance data — impressions, clicks, spend, and conversion metrics" },
                  { perm: "ads_management", why: "Allows access to your campaign structure — campaign names, ad sets, ad creatives, budgets, and scheduling" },
                  { perm: "leads_read", why: "Allows the CRM to retrieve lead form submissions — the patient's name, phone, and other details they filled in" },
                  { perm: "pages_read_engagement", why: "Allows reading data from your Facebook Page, which is required since lead forms are hosted on your Page" },
                  { perm: "pages_manage_ads", why: "Allows access to ad-related data on your Page, needed to link lead forms to campaigns" },
                ].map(p => (
                  <div key={p.perm} className="flex items-start gap-3 p-3 border rounded-lg bg-white">
                    <code className="text-xs font-mono font-semibold text-primary bg-blue-50 px-2 py-0.5 rounded flex-shrink-0 mt-0.5">{p.perm}</code>
                    <span className="text-sm text-muted-foreground">{p.why}</span>
                  </div>
                ))}
              </div>
              <InfoBox type="warning">
                If any of these permissions are not granted, the connection may partially work — for example, you might see campaign insights but not receive leads, or vice versa. Always grant all five permissions.
              </InfoBox>
            </Section>

            <Section id="multi-tenant" title="Multi-Tenant Isolation" icon={Shield}>
              <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                MyProSys is a multi-tenant platform — multiple hospitals use the same system, but each hospital's data is completely separate. Here's how this works with the Meta integration:
              </p>
              <div className="space-y-2">
                <div className="flex items-start gap-2.5 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">Each hospital connects its own Meta assets separately — your App ID, Token, and Ad Account ID are stored only for your hospital</span>
                </div>
                <div className="flex items-start gap-2.5 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">Leads captured from your forms are tagged with your hospital's tenant ID and appear only in your Leads Workspace</span>
                </div>
                <div className="flex items-start gap-2.5 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">Campaign insights are fetched from your specific Ad Account — you will never see another hospital's ad spend or performance</span>
                </div>
                <div className="flex items-start gap-2.5 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">If you reconnect or update your token, only your hospital's integration is affected</span>
                </div>
              </div>
            </Section>

            <Section id="troubleshooting" title="Troubleshooting Common Issues" icon={AlertTriangle}>
              <div className="space-y-3">
                {[
                  {
                    issue: "Connection shows \"Error\" after saving",
                    fixes: ["Verify the Ad Account ID includes the act_ prefix", "Check that the Access Token has not expired", "Ensure the system user has been added to the Ad Account in Business Settings", "Confirm all five permissions were granted when generating the token"],
                  },
                  {
                    issue: "Leads are not coming into the CRM",
                    fixes: ["Confirm a Lead Capture Rule exists with Source Type set to \"Meta Lead Ads\" and Active set to \"Yes\"", "Check that the lead form is published and the ad is running", "Verify the webhook URL is correctly configured in Meta's Webhooks settings", "Test by submitting a test lead through Meta's Lead Ads Testing Tool"],
                  },
                  {
                    issue: "Insights are not updating or showing zeros",
                    fixes: ["Click Sync on the connector card to trigger a manual refresh", "Ensure the Ad Account has active or recent campaigns with spend", "Check that the ads_read permission was granted", "The date range defaults to last 30 days — if campaigns are older, they may not appear"],
                  },
                  {
                    issue: "Token expired — insights stopped working",
                    fixes: ["If using a personal token, it expires after 60 days — generate a new one from the Graph API Explorer and extend it", "Recommended: Switch to a System User token which does not expire", "Click Configure on the Meta card, update the Access Token, and click Save"],
                  },
                  {
                    issue: "Wrong Page or Ad Account connected",
                    fixes: ["Click Configure on the Meta card and update the Ad Account ID", "In Meta Business Manager, verify which Ad Account is linked to the correct Page and Lead Forms", "Each hospital should connect only its own ad account"],
                  },
                ].map((item, i) => (
                  <div key={i} className="p-3.5 border rounded-lg bg-white">
                    <p className="font-medium text-sm text-foreground mb-2 flex items-center gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                      {item.issue}
                    </p>
                    <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-1">
                      {item.fixes.map((fix, j) => <li key={j}>{fix}</li>)}
                    </ul>
                  </div>
                ))}
              </div>
            </Section>

            <Section id="checklist" title="Quick Setup Checklist" icon={CheckCircle2}>
              <p className="text-sm text-muted-foreground mb-3">Use this checklist to make sure everything is in place:</p>
              <div className="space-y-2">
                {[
                  "Meta Developer App created at developers.facebook.com",
                  "App ID and App Secret noted from App Settings",
                  "System User created in Meta Business Manager",
                  "Access Token generated with all 5 required permissions",
                  "System User added to Ad Account with View Performance access",
                  "Ad Account ID noted (with act_ prefix)",
                  "All four fields entered in CRM Connectors → Meta card",
                  "Connection tested — status shows Connected",
                  "Lead Capture Rule created with Source Type = Meta Lead Ads",
                  "Assignment strategy configured (Round Robin or Specific Employees)",
                  "Duplicate handling preference set",
                  "Meta Webhook configured to send lead data to CRM webhook URL",
                  "UTM parameters added to ad campaigns for attribution tracking",
                  "Test lead submitted to verify end-to-end flow",
                ].map((item, i) => (
                  <label key={i} className="flex items-start gap-2.5 text-sm cursor-pointer group">
                    <input type="checkbox" className="mt-1 rounded border-slate-300" data-testid={`checklist-item-${i}`} />
                    <span className="text-muted-foreground group-hover:text-foreground transition-colors">{item}</span>
                  </label>
                ))}
              </div>
            </Section>

            <Section id="faq" title="Frequently Asked Questions" icon={HelpCircle}>
              <div className="space-y-2">
                <FAQ question="Can one hospital connect multiple Facebook Pages?">
                  <p>The current connector links to one Ad Account at a time. If your hospital runs ads from a single Ad Account across multiple Pages, all leads from those Pages will come in. If you have separate Ad Accounts per Page, you would need to connect the primary one that handles lead generation.</p>
                </FAQ>
                <FAQ question="Can I reconnect if my token expires?">
                  <p>Yes. Go to Connectors, click <strong>Configure</strong> on the Meta card, paste in the new Access Token, and click <strong>Save</strong>. The connection will resume without losing any previously synced data. To avoid this entirely, use a System User Token which does not expire.</p>
                </FAQ>
                <FAQ question="Will old leads also sync, or only new ones?">
                  <p>The webhook-based lead capture processes leads in real time — it captures new submissions from the moment the webhook is active. If you have historical leads from before the connection was set up, you can export them as a CSV from Meta Ads Manager and import them using the CRM's Lead Import page.</p>
                </FAQ>
                <FAQ question="Where will I see campaign performance data?">
                  <p>Click <strong>Insights</strong> on the Meta connector card (under Configurations → Connectors) to see account-level metrics. The Campaigns page shows campaign records with UTM attribution. The Dashboard shows aggregated lead pipeline and conversion KPIs that include Meta-sourced leads.</p>
                </FAQ>
                <FAQ question="I connected successfully but I'm not seeing leads — why?">
                  <p>Most likely a Lead Capture Rule hasn't been set up yet, or the Meta Webhook hasn't been configured to send data to the CRM's webhook URL. Check both configurations. Also verify the lead form is published and the ad campaign is active.</p>
                </FAQ>
                <FAQ question="How do I track which specific ad creative brought in a lead?">
                  <p>Use the <code className="bg-slate-100 px-1 rounded text-xs">utm_content</code> parameter. In Meta Ads Manager, add <code className="bg-slate-100 px-1 rounded text-xs">utm_content={"{{ad.name}}"}</code> to your ad's URL parameters. This will record the ad/creative name on each lead in the CRM, allowing you to compare creative performance.</p>
                </FAQ>
                <FAQ question="Does another hospital on the platform see my leads or campaign data?">
                  <p>No, absolutely not. Each hospital operates in a completely isolated tenant. Your Meta credentials, leads, insights, and all CRM data are visible only to your hospital's users. There is no cross-tenant data access.</p>
                </FAQ>
                <FAQ question="What happens if I select the wrong Ad Account?">
                  <p>You would see insights from the wrong account, and leads may not come in if the lead forms are under a different account. Simply click Configure on the Meta card, correct the Ad Account ID, and save. The CRM will start using the correct account immediately.</p>
                </FAQ>
              </div>
            </Section>

            <div className="mt-10 pt-6 border-t text-center">
              <p className="text-xs text-muted-foreground">
                &copy; {new Date().getFullYear()} MyProSys Hospital CRM. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
