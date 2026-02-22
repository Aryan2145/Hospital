import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import {
  Building2,
  Users,
  UserPlus,
  Activity,
  CreditCard,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
} from "lucide-react";

export default function AdminDashboard() {
  const { data: stats, isLoading } = useQuery<any>({
    queryKey: ["/api/admin/stats"],
  });

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="h-full flex items-center justify-center"><LoadingSpinner /></div>
      </AdminLayout>
    );
  }

  const statCards = [
    { label: "Total Hospitals", value: stats?.totalTenants || 0, icon: Building2, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Total CRM Users", value: stats?.totalUsers || 0, icon: Users, color: "text-green-600", bg: "bg-green-50" },
    { label: "Total Leads", value: stats?.totalLeads || 0, icon: UserPlus, color: "text-purple-600", bg: "bg-purple-50" },
    { label: "Total Episodes", value: stats?.totalEpisodes || 0, icon: Activity, color: "text-indigo-600", bg: "bg-indigo-50" },
    { label: "Active Subscriptions", value: stats?.activeSubscriptions || 0, icon: CreditCard, color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "Suspended Tenants", value: stats?.suspendedTenants || 0, icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50" },
  ];

  return (
    <AdminLayout>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900" data-testid="text-admin-title">Platform Overview</h1>
          <p className="text-slate-500 mt-1">Monitor all hospitals and subscriptions across the platform</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {statCards.map((card) => (
            <Card key={card.label} className="p-5 border border-slate-200 shadow-sm hover:shadow-md transition-shadow" data-testid={`stat-card-${card.label.toLowerCase().replace(/\s/g, "-")}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 font-medium">{card.label}</p>
                  <p className="text-3xl font-bold text-slate-900 mt-1">{card.value}</p>
                </div>
                <div className={`w-12 h-12 rounded-xl ${card.bg} flex items-center justify-center`}>
                  <card.icon className={`w-6 h-6 ${card.color}`} />
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Hospital Overview</h2>
            <Link href="/admin/hospitals">
              <span className="text-sm text-orange-600 hover:text-orange-700 font-medium cursor-pointer flex items-center gap-1" data-testid="link-view-all-hospitals">
                View All <ArrowRight className="w-4 h-4" />
              </span>
            </Link>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Hospital</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Subdomain</th>
                  <th className="text-center text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Users</th>
                  <th className="text-center text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Leads</th>
                  <th className="text-center text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Episodes</th>
                  <th className="text-center text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {stats?.tenantStats?.map((t: any) => (
                  <tr key={t.tenantId} className="border-b border-slate-50 hover:bg-slate-50 transition-colors" data-testid={`row-tenant-${t.tenantId}`}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{t.displayName || t.tenantName}</div>
                      <div className="text-xs text-slate-400">{t.tenantName}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{t.subdomain}</td>
                    <td className="px-4 py-3 text-center text-sm font-medium text-slate-900">{t.users}</td>
                    <td className="px-4 py-3 text-center text-sm font-medium text-slate-900">{t.leads}</td>
                    <td className="px-4 py-3 text-center text-sm font-medium text-slate-900">{t.episodes}</td>
                    <td className="px-4 py-3 text-center">
                      <Badge
                        variant={t.subscriptionStatus === "Active" ? "default" : "destructive"}
                        className={t.subscriptionStatus === "Active" ? "bg-emerald-100 text-emerald-700 border-emerald-200" : ""}
                        data-testid={`badge-status-${t.tenantId}`}
                      >
                        {t.subscriptionStatus}
                      </Badge>
                    </td>
                  </tr>
                ))}
                {(!stats?.tenantStats || stats.tenantStats.length === 0) && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400">No hospitals onboarded yet</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
