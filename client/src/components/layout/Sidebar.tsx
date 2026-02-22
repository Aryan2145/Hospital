import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { 
  LayoutDashboard, 
  Users, 
  Calendar, 
  LogOut, 
  Activity,
  Database,
  UserCog,
  Shield,
  FlaskConical,
  Megaphone,
  Plug,
  Mail,
  MessageSquare,
  HeartPulse,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type NavItem = { icon: any; label: string; href: string; page: string };

const sections: { label: string; items: NavItem[] }[] = [
  {
    label: "Reports & Dashboards",
    items: [
      { icon: LayoutDashboard, label: "Dashboard", href: "/", page: "dashboard" },
    ],
  },
  {
    label: "Transactions",
    items: [
      { icon: Megaphone, label: "Campaigns", href: "/campaigns", page: "campaigns" },
      { icon: Users, label: "Leads", href: "/leads", page: "leads" },
      { icon: Calendar, label: "Appointments", href: "/appointments", page: "appointments" },
    ],
  },
  {
    label: "Masters",
    items: [
      { icon: Database, label: "Master Data", href: "/masters", page: "masters" },
    ],
  },
  {
    label: "Configurations",
    items: [
      { icon: UserCog, label: "Team", href: "/team", page: "team" },
      { icon: Plug, label: "Connectors", href: "/connectors", page: "connectors" },
      { icon: Mail, label: "Email Settings", href: "/email-settings", page: "email-settings" },
      { icon: MessageSquare, label: "WhatsApp", href: "/whatsapp-settings", page: "whatsapp-settings" },
      { icon: FlaskConical, label: "Testing", href: "/testing", page: "testing" },
    ],
  },
];

export function Sidebar() {
  const [location] = useLocation();
  const { logout, user } = useAuth();
  const { crmUser, roleName, roleCode, canViewPage } = useCurrentUser();

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
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center shadow-lg shadow-primary/20">
            <Activity className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-xl tracking-tight" style={{color: 'hsl(208, 79%, 28%)'}}>VIROC</h1>
            <p className="text-xs text-muted-foreground font-medium">CRM Workspace</p>
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
        <Button
          variant="outline"
          size="sm"
          onClick={() => logout()}
          className="w-full"
          data-testid="button-logout"
        >
          <LogOut className="w-3.5 h-3.5 mr-2" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}
