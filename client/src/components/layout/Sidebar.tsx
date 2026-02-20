import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { 
  LayoutDashboard, 
  Users, 
  Calendar, 
  Settings, 
  LogOut, 
  Activity,
  Database,
  UserCog,
  Shield,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const allNavItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/", page: "dashboard" },
  { icon: Users, label: "Leads", href: "/leads", page: "leads" },
  { icon: Calendar, label: "Appointments", href: "/appointments", page: "appointments" },
];

const systemItems = [
  { icon: UserCog, label: "Team", href: "/team", page: "team" },
  { icon: Database, label: "Master Data", href: "/masters", page: "masters" },
];

export function Sidebar() {
  const [location] = useLocation();
  const { logout, user } = useAuth();
  const { crmUser, roleName, roleCode, canViewPage } = useCurrentUser();

  const navItems = allNavItems.filter(item => canViewPage(item.page));
  const filteredSystemItems = systemItems.filter(item => canViewPage(item.page));

  const displayName = crmUser?.name || `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || "User";
  const displayEmail = crmUser?.email || user?.email || "";

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

      <div className="flex-1 py-6 px-4 space-y-1 overflow-y-auto">
        <div className="text-xs font-semibold text-muted-foreground mb-4 px-2 uppercase tracking-wider">
          Main Menu
        </div>
        {navItems.map((item) => {
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

        {filteredSystemItems.length > 0 && (
          <>
            <div className="mt-8 text-xs font-semibold text-muted-foreground mb-4 px-2 uppercase tracking-wider">
              System
            </div>
            {filteredSystemItems.map((item) => (
              <Link key={item.href} href={item.href}>
                <div
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium cursor-pointer",
                    location === item.href
                      ? "bg-primary text-white"
                      : "text-muted-foreground hover-elevate"
                  )}
                  data-testid={`nav-${item.page}`}
                >
                  <item.icon className={cn("w-5 h-5", location === item.href ? "text-white" : "")} />
                  {item.label}
                </div>
              </Link>
            ))}
          </>
        )}
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
