import { useState } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Menu, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/use-auth";
import { useCurrentUser } from "@/hooks/use-current-user";
import { queryClient } from "@/lib/queryClient";
import { useIsMobile } from "@/hooks/use-mobile";
import { Badge } from "@/components/ui/badge";
import {
  LayoutDashboard,
  Building2,
  CreditCard,
  Receipt,
  Package,
  Shield,
  LogOut,
  Activity,
  ShieldAlert,
  FlaskConical,
  Trash2,
} from "lucide-react";

type NavItem = { icon: any; label: string; href: string };

const adminNavItems: NavItem[] = [
  { icon: LayoutDashboard, label: "Platform Overview", href: "/admin" },
  { icon: Building2, label: "Hospitals", href: "/admin/hospitals" },
  { icon: Package, label: "Subscription Plans", href: "/admin/plans" },
  { icon: CreditCard, label: "Subscriptions", href: "/admin/subscriptions" },
  { icon: Receipt, label: "Payment Records", href: "/admin/payments" },
  { icon: Trash2, label: "Data Deletion", href: "/admin/data-deletion" },
  { icon: ShieldAlert, label: "Error Logs", href: "/admin/error-logs" },
  { icon: FlaskConical, label: "Demo Seed", href: "/admin/seed-demo" },
];

function AdminSidebar() {
  const [location] = useLocation();
  const { logout, user } = useAuth();
  const { crmUser, roleName } = useCurrentUser();
  const displayName = crmUser?.name || `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || "User";

  return (
    <div className="h-screen w-64 text-white flex flex-col z-20" style={{ backgroundColor: '#0a3d2a' }}>
      <div className="p-6" style={{ borderBottomColor: 'rgba(255,255,255,0.12)', borderBottomWidth: '1px' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-lg">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-tight leading-tight text-white" data-testid="text-admin-brand">RGB Hospital CRM</h1>
            <p className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.5)' }}>System Admin</p>
          </div>
        </div>
      </div>

      <div className="flex-1 py-4 px-4 overflow-y-auto">
        <div className="text-xs font-semibold mb-3 px-2 uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>
          Platform Management
        </div>
        <div className="space-y-0.5">
          {adminNavItems.map((item) => {
            const isActive = item.href === "/admin" ? location === "/admin" : location.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium cursor-pointer transition-colors",
                    isActive
                      ? "bg-orange-600 text-white"
                      : "hover:text-white"
                  )}
                  style={!isActive ? { color: 'rgba(255,255,255,0.6)' } : undefined}
                  onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'; }}
                  onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = 'transparent'; }}
                  data-testid={`admin-nav-${item.label.toLowerCase().replace(/\s/g, "-")}`}
                >
                  <item.icon className={cn("w-5 h-5", isActive ? "text-white" : "")} style={!isActive ? { color: 'rgba(255,255,255,0.4)' } : undefined} />
                  {item.label}
                </div>
              </Link>
            );
          })}
        </div>

        <div className="mt-8">
          <Link href="/">
            <div
              className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium cursor-pointer transition-colors hover:text-white"
              style={{ color: 'rgba(255,255,255,0.6)' }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              data-testid="admin-nav-back-crm"
            >
              <ArrowLeft className="w-5 h-5" style={{ color: 'rgba(255,255,255,0.4)' }} />
              Back to CRM
            </div>
          </Link>
        </div>
      </div>

      <div className="p-4" style={{ borderTopColor: 'rgba(255,255,255,0.12)', borderTopWidth: '1px', backgroundColor: 'rgba(0,0,0,0.15)' }}>
        <div className="flex items-center gap-3 mb-3">
          <img
            src={user?.profileImageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=ea580c&color=fff`}
            alt="User"
            className="w-10 h-10 rounded-full"
            style={{ borderWidth: '2px', borderColor: 'rgba(255,255,255,0.2)', borderStyle: 'solid' }}
            data-testid="img-admin-avatar"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white truncate" data-testid="text-admin-user-name">
              {displayName}
            </p>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-orange-600/20 text-orange-400 border-orange-600/30">
              <Shield className="w-2.5 h-2.5 mr-0.5" />
              {roleName || "System Admin"}
            </Badge>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            try {
              await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
            } catch (e) {}
            queryClient.setQueryData(["/api/auth/user"], null);
            queryClient.setQueryData(["/api/me"], null);
            window.location.href = "/admin/login";
          }}
          className="w-full text-white/80 hover:text-white"
          style={{ borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'transparent' }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          data-testid="button-admin-logout"
        >
          <LogOut className="w-3.5 h-3.5 mr-2" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}

export function AdminLayout({ children, className }: { children: React.ReactNode; className?: string }) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  if (isMobile) {
    return (
      <div className="flex flex-col h-screen bg-slate-50">
        <header className="flex items-center gap-2 px-4 py-2 shrink-0 z-30" style={{ backgroundColor: '#0a3d2a', borderBottomColor: 'rgba(255,255,255,0.1)', borderBottomWidth: '1px' }}>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0 text-white hover:bg-white/10" data-testid="button-admin-mobile-menu">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-64 border-0">
              <div onClick={() => setOpen(false)}>
                <AdminSidebar />
              </div>
            </SheetContent>
          </Sheet>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-orange-500" />
            <span className="font-bold text-lg tracking-tight text-white">RGB Hospital CRM</span>
            <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.5)' }}>Admin</span>
          </div>
        </header>
        <main className={className || "flex-1 overflow-auto bg-slate-50"}>
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50">
      <AdminSidebar />
      <main className={className || "flex-1 overflow-auto bg-slate-50"}>
        {children}
      </main>
    </div>
  );
}
