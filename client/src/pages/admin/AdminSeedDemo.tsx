import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  FlaskConical,
  Users,
  UserPlus,
  Activity,
  CalendarCheck,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Clock,
} from "lucide-react";

type DemoStats = {
  exists: false;
} | {
  exists: true;
  tenantId: number;
  tenantName: string;
  tenantCreatedAt: string;
  lastSeededAt: string | null;
  leads: number;
  episodes: number;
  appointments: number;
  users: number;
};

type SeedResult = {
  message: string;
  stats: Record<string, number | string>;
  lastSeededAt: string | null;
  timestampPersisted: boolean;
};

export default function AdminSeedDemo() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [lastSeedResult, setLastSeedResult] = useState<SeedResult | null>(null);

  const { data: stats, isLoading } = useQuery<DemoStats>({
    queryKey: ["/api/admin/seed-demo-stats"],
  });

  const seedMutation = useMutation<SeedResult, Error>({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/seed-demo-tenant");
      return res.json() as Promise<SeedResult>;
    },
    onSuccess: async (data) => {
      setLastSeedResult(data);
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/seed-demo-stats"] });
      toast({
        title: "Demo tenant seeded successfully",
        description: data.message,
      });
    },
    onError: (err) => {
      toast({
        title: "Seed failed",
        description: err.message || "An error occurred while seeding the demo tenant.",
        variant: "destructive",
      });
    },
  });

  const statCards = stats?.exists
    ? [
        { label: "Leads", value: stats.leads, icon: UserPlus, color: "text-blue-600", bg: "bg-blue-50" },
        { label: "Episodes", value: stats.episodes, icon: Activity, color: "text-indigo-600", bg: "bg-indigo-50" },
        { label: "Appointments", value: stats.appointments, icon: CalendarCheck, color: "text-purple-600", bg: "bg-purple-50" },
        { label: "CRM Users", value: stats.users, icon: Users, color: "text-emerald-600", bg: "bg-emerald-50" },
      ]
    : [];

  return (
    <AdminLayout>
      <div className="p-6 max-w-5xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center">
              <FlaskConical className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900" data-testid="text-seed-demo-title">
                Demo Tenant Seed
              </h1>
              <p className="text-slate-500 text-sm">
                Manage and re-seed the RGB Demo Hospital tenant used for sales demos and onboarding.
              </p>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <LoadingSpinner />
          </div>
        ) : (
          <>
            <Card className="p-5 border border-slate-200 shadow-sm mb-6" data-testid="card-demo-tenant-status">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <Building2 className="w-5 h-5 text-slate-400" />
                  <div>
                    <p className="text-sm font-semibold text-slate-700" data-testid="text-demo-tenant-name">
                      {stats?.exists ? stats.tenantName : "Demo Tenant Not Found"}
                    </p>
                    {stats?.exists && stats.lastSeededAt && (
                      <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5" data-testid="text-last-seeded-at">
                        <Clock className="w-3 h-3" />
                        Last seeded: {new Date(stats.lastSeededAt).toLocaleString()}
                      </p>
                    )}
                    {stats?.exists && !stats.lastSeededAt && (
                      <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5" data-testid="text-never-seeded">
                        <Clock className="w-3 h-3" />
                        Never seeded via this UI
                      </p>
                    )}
                  </div>
                </div>
                <Badge
                  variant={stats?.exists ? "default" : "destructive"}
                  className={stats?.exists ? "bg-emerald-100 text-emerald-700 border-emerald-200" : ""}
                  data-testid="badge-demo-tenant-status"
                >
                  {stats?.exists ? "Exists" : "Not Seeded"}
                </Badge>
              </div>
            </Card>

            {stats?.exists && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                {statCards.map((card) => (
                  <Card
                    key={card.label}
                    className="p-4 border border-slate-200 shadow-sm"
                    data-testid={`stat-card-${card.label.toLowerCase()}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-slate-500 font-medium">{card.label}</p>
                      <div className={`w-8 h-8 rounded-lg ${card.bg} flex items-center justify-center`}>
                        <card.icon className={`w-4 h-4 ${card.color}`} />
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-slate-900" data-testid={`value-${card.label.toLowerCase()}`}>
                      {card.value.toLocaleString()}
                    </p>
                  </Card>
                ))}
              </div>
            )}

            {!stats?.exists && (
              <Card className="p-5 border border-amber-200 bg-amber-50 mb-6" data-testid="card-no-demo-tenant">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                  <p className="text-sm text-amber-800">
                    No demo tenant found with subdomain <strong>rgb-demo</strong>. Click "Seed Demo Tenant" below to create and populate it.
                  </p>
                </div>
              </Card>
            )}

            <Card className="p-5 border border-slate-200 shadow-sm mb-6" data-testid="card-seed-action">
              <div className="flex items-start gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 mb-1">Re-seed Demo Tenant</p>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    This will wipe all existing demo tenant data and rebuild it from scratch with 1,000+ leads, 200+ episodes, 300+ appointments, and named demo scenarios. The operation typically takes 30–60 seconds. Other tenants are never affected.
                  </p>
                </div>
                <Button
                  onClick={() => seedMutation.mutate()}
                  disabled={seedMutation.isPending}
                  className="bg-orange-600 hover:bg-orange-700 text-white shrink-0"
                  data-testid="button-seed-demo-tenant"
                >
                  {seedMutation.isPending ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Seeding…
                    </>
                  ) : (
                    <>
                      <FlaskConical className="w-4 h-4 mr-2" />
                      {stats?.exists ? "Re-seed Demo Tenant" : "Seed Demo Tenant"}
                    </>
                  )}
                </Button>
              </div>
            </Card>

            {lastSeedResult && (
              <Card
                className="p-5 border border-emerald-200 bg-emerald-50 shadow-sm"
                data-testid="card-seed-result"
              >
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <p className="text-sm font-semibold text-emerald-800" data-testid="text-seed-success-message">
                    {lastSeedResult.message}
                  </p>
                </div>
                {!lastSeedResult.timestampPersisted && (
                  <div className="flex items-center gap-2 mb-3 p-2 bg-amber-50 border border-amber-200 rounded-md" data-testid="warning-timestamp-not-persisted">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <p className="text-xs text-amber-700">
                      Seed completed, but the last-seed timestamp could not be saved. The "Last seeded" time above may not update until the next successful run.
                    </p>
                  </div>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {Object.entries(lastSeedResult.stats)
                    .filter(([key]) => key !== "tenantId")
                    .map(([key, val]) => (
                      <div
                        key={key}
                        className="bg-white rounded-md px-3 py-2 border border-emerald-100"
                        data-testid={`seed-stat-${key}`}
                      >
                        <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">
                          {key.replace(/([A-Z])/g, " $1").trim()}
                        </p>
                        <p className="text-lg font-bold text-slate-800">{String(val)}</p>
                      </div>
                    ))}
                </div>
              </Card>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
}
