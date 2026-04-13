import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { 
  LayoutDashboard, 
  Users, 
  Calendar, 
  LogOut, 
  Activity,
  Database,
  UserCog,
  Shield,
  Megaphone,
  Plug,
  HeartPulse,
  Paintbrush,
  ClipboardCheck,
  Phone,
  Brain,
  HelpCircle,
  Stethoscope,
  Gift,
  CalendarDays,
  Settings2,
  Ticket,
  CalendarClock,
  KeyRound,
  UserCheck,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useTenantBranding } from "@/hooks/use-tenant-branding";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

type NavItem = { icon: any; label: string; href: string; page: string };

const sections: { label: string; items: NavItem[] }[] = [
  {
    label: "Reports & Dashboards",
    items: [
      { icon: LayoutDashboard, label: "Dashboard", href: "/", page: "dashboard" },
      { icon: Phone, label: "Telephony Reports", href: "/callyzer-reports", page: "connectors" },
    ],
  },
  {
    label: "Transactions",
    items: [
      { icon: Megaphone, label: "Campaigns", href: "/campaigns", page: "campaigns" },
      { icon: CalendarDays, label: "Events", href: "/events", page: "campaigns" },
      { icon: Users, label: "Leads", href: "/leads", page: "leads" },
      { icon: Calendar, label: "Appointments", href: "/appointments", page: "appointments" },
      { icon: HeartPulse, label: "Consultation Episodes", href: "/transactions", page: "transactions" },
      { icon: Gift, label: "Referrals", href: "/referrals", page: "transactions" },
      { icon: CalendarClock, label: "Surgery Schedule", href: "/surgery-calendar", page: "transactions" },
      { icon: UserCheck, label: "Contact Directory", href: "/contact-directory", page: "leads" },
    ],
  },
  {
    label: "Masters",
    items: [
      { icon: Database, label: "Master Data", href: "/masters", page: "masters" },
      { icon: ClipboardCheck, label: "Approval Queue", href: "/master-approval", page: "masters" },
    ],
  },
  {
    label: "Configurations",
    items: [
      { icon: Plug, label: "Connectors", href: "/connectors", page: "connectors" },
      { icon: Paintbrush, label: "Branding", href: "/branding", page: "branding" },
      { icon: Brain, label: "Intelligence Config", href: "/intelligence-config", page: "connectors" },
      { icon: Stethoscope, label: "Post-Care Protocols", href: "/post-care-protocols", page: "connectors" },
      { icon: Settings2, label: "Referral Settings", href: "/referral-config", page: "connectors" },
      { icon: UserCheck, label: "Discount Approvers", href: "/discount-approvers", page: "connectors" },
    ],
  },
  {
    label: "Support",
    items: [
      { icon: Ticket, label: "Help Tickets", href: "/support-tickets", page: "support" },
      { icon: HelpCircle, label: "Help Center", href: "/help", page: "support" },
    ],
  },
];

export function Sidebar() {
  const [location] = useLocation();
  const { logout, user } = useAuth();
  const { crmUser, roleName, roleCode, canViewPage } = useCurrentUser();
  const { displayName: tenantDisplayName, logoUrl: tenantLogo } = useTenantBranding();
  const { toast } = useToast();
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [cpCurrent, setCpCurrent] = useState("");
  const [cpNew, setCpNew] = useState("");
  const [cpConfirm, setCpConfirm] = useState("");
  const [cpLoading, setCpLoading] = useState(false);

  const displayName = crmUser?.name || `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || "User";
  const displayEmail = crmUser?.email || user?.email || "";

  const visibleSections = sections
    .map(section => ({
      ...section,
      items: section.items.filter(item => canViewPage(item.page)),
    }))
    .filter(section => section.items.length > 0);

  return (
    <div className="h-screen w-64 bg-card border-r border-border flex flex-col z-20">
      <div className="p-6 border-b border-border/50">
        <div className="flex items-center gap-3">
          {tenantLogo ? (
            <img src={tenantLogo} alt="Logo" className="h-10 max-w-[40px] object-contain rounded-xl" data-testid="img-sidebar-logo" />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center shadow-lg shadow-primary/20">
              <Activity className="w-6 h-6 text-white" />
            </div>
          )}
          <div>
            <h1 className="font-bold text-lg tracking-tight leading-tight" style={{color: 'hsl(208, 79%, 28%)'}} data-testid="text-sidebar-brand">{tenantDisplayName}</h1>
            <p className="text-xs text-muted-foreground font-medium">Hospital CRM</p>
          </div>
        </div>
      </div>

      <div className="flex-1 py-4 px-4 overflow-y-auto">
        {visibleSections.map((section, idx) => (
          <div key={section.label} className={cn(idx > 0 && "mt-6")}>
            <div className="text-xs font-semibold text-muted-foreground mb-3 px-2 uppercase tracking-wider">
              {section.label}
            </div>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = item.href === "/" ? location === "/" : location.startsWith(item.href);
                return (
                  <Link key={item.href} href={item.href}>
                    <div
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium cursor-pointer",
                        isActive
                          ? "bg-primary text-white"
                          : "text-muted-foreground hover-elevate"
                      )}
                      data-testid={`nav-${item.page}`}
                    >
                      <item.icon className={cn("w-5 h-5", isActive ? "text-white" : "text-muted-foreground")} />
                      {item.label}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-border bg-muted/50">
        <div className="flex items-center gap-3 mb-3">
          <img 
            src={user?.profileImageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=0f4c81&color=fff`} 
            alt="User" 
            className="w-10 h-10 rounded-full border-2 border-background"
            data-testid="img-user-avatar"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground truncate" data-testid="text-user-name">
              {displayName}
            </p>
            <div className="flex items-center gap-1.5">
              {roleName && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0" data-testid="badge-user-role">
                  <Shield className="w-2.5 h-2.5 mr-0.5" />
                  {roleName}
                </Badge>
              )}
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground truncate mb-2 px-1" data-testid="text-user-email">{displayEmail}</p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowChangePassword(true)}
            className="flex-1"
            data-testid="button-change-password"
          >
            <KeyRound className="w-3.5 h-3.5 mr-1" />
            Password
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => logout()}
            className="flex-1"
            data-testid="button-logout"
          >
            <LogOut className="w-3.5 h-3.5 mr-1" />
            Sign Out
          </Button>
        </div>
      </div>

      <Dialog open={showChangePassword} onOpenChange={setShowChangePassword}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (cpNew !== cpConfirm) {
                toast({ title: "Passwords do not match", variant: "destructive" });
                return;
              }
              if (cpNew.length < 6) {
                toast({ title: "Password must be at least 6 characters", variant: "destructive" });
                return;
              }
              setCpLoading(true);
              try {
                const res = await fetch("/api/auth/change-password", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  credentials: "include",
                  body: JSON.stringify({ currentPassword: cpCurrent, newPassword: cpNew }),
                });
                const data = await res.json();
                if (!res.ok) {
                  toast({ title: data.message || "Failed to change password", variant: "destructive" });
                } else {
                  toast({ title: "Password changed successfully" });
                  setShowChangePassword(false);
                  setCpCurrent("");
                  setCpNew("");
                  setCpConfirm("");
                }
              } catch {
                toast({ title: "Failed to change password", variant: "destructive" });
              } finally {
                setCpLoading(false);
              }
            }}
            className="space-y-4"
            data-testid="form-change-password"
          >
            <div>
              <Label htmlFor="cp-current">Current Password</Label>
              <Input id="cp-current" type="password" value={cpCurrent} onChange={(e) => setCpCurrent(e.target.value)} required data-testid="input-current-password" />
            </div>
            <div>
              <Label htmlFor="cp-new">New Password</Label>
              <Input id="cp-new" type="password" value={cpNew} onChange={(e) => setCpNew(e.target.value)} required minLength={6} data-testid="input-new-password" />
            </div>
            <div>
              <Label htmlFor="cp-confirm">Confirm New Password</Label>
              <Input id="cp-confirm" type="password" value={cpConfirm} onChange={(e) => setCpConfirm(e.target.value)} required minLength={6} data-testid="input-confirm-password" />
            </div>
            <Button type="submit" className="w-full" disabled={cpLoading} data-testid="button-submit-change-password">
              {cpLoading ? "Changing..." : "Change Password"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
