import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Building2,
  Plus,
  Ban,
  CheckCircle,
  Users,
  UserPlus,
  Globe,
  Phone,
  Mail,
  User,
  ExternalLink,
  Calendar,
} from "lucide-react";

function fmtDate(val: string | null | undefined) {
  if (!val) return "—";
  const d = new Date(val);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default function AdminHospitals() {
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", subdomain: "", displayName: "", contactPerson: "", contactEmail: "", contactPhone: "" });

  const { data: stats, isLoading } = useQuery<any>({
    queryKey: ["/api/admin/stats"],
  });

  const createTenant = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/tenants", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tenants/all"] });
      setShowAdd(false);
      setForm({ name: "", subdomain: "", displayName: "", contactPerson: "", contactEmail: "", contactPhone: "" });
      toast({ title: "Hospital added successfully" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const suspendTenant = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/admin/tenants/${id}/suspend`, { reason: "Manual suspension by admin" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "Hospital suspended" });
    },
  });

  const activateTenant = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/admin/tenants/${id}/activate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "Hospital activated" });
    },
  });

  const switchTenant = useMutation({
    mutationFn: async (tenantId: number) => {
      const res = await apiRequest("POST", "/api/auth/switch-tenant", { tenantId });
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: `Switched to ${data.tenant?.displayName || data.tenant?.name}` });
      window.location.href = "/";
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  if (isLoading) {
    return <AdminLayout><div className="h-full flex items-center justify-center"><LoadingSpinner /></div></AdminLayout>;
  }

  const tenantList = stats?.tenantStats || [];

  return (
    <AdminLayout>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900" data-testid="text-hospitals-title">Hospital Management</h1>
            <p className="text-slate-500 mt-1">Onboard and manage hospitals on the platform</p>
          </div>
          <Dialog open={showAdd} onOpenChange={setShowAdd}>
            <DialogTrigger asChild>
              <Button className="bg-orange-600 hover:bg-orange-700" data-testid="button-add-hospital">
                <Plus className="w-4 h-4 mr-2" /> Add Hospital
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Onboard New Hospital</DialogTitle>
              </DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); createTenant.mutate(form); }} className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label>Hospital Name *</Label>
                    <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Apollo Hospital" required data-testid="input-hospital-name" />
                  </div>
                  <div>
                    <Label>Subdomain *</Label>
                    <Input value={form.subdomain} onChange={e => setForm(f => ({ ...f, subdomain: e.target.value }))} placeholder="e.g. apollo" required data-testid="input-hospital-subdomain" />
                  </div>
                  <div>
                    <Label>Display Name</Label>
                    <Input value={form.displayName} onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))} placeholder="Short display name" data-testid="input-hospital-display" />
                  </div>
                  <div className="col-span-2 border-t pt-4">
                    <p className="text-sm font-medium text-slate-700 mb-3">Contact Person</p>
                  </div>
                  <div>
                    <Label>Name</Label>
                    <Input value={form.contactPerson} onChange={e => setForm(f => ({ ...f, contactPerson: e.target.value }))} placeholder="Contact person name" data-testid="input-contact-person" />
                  </div>
                  <div>
                    <Label>Phone</Label>
                    <Input value={form.contactPhone} onChange={e => setForm(f => ({ ...f, contactPhone: e.target.value }))} placeholder="+91 98765 43210" data-testid="input-contact-phone" />
                  </div>
                  <div className="col-span-2">
                    <Label>Email</Label>
                    <Input value={form.contactEmail} onChange={e => setForm(f => ({ ...f, contactEmail: e.target.value }))} placeholder="admin@hospital.com" type="email" data-testid="input-contact-email" />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
                  <Button type="submit" className="bg-orange-600 hover:bg-orange-700" disabled={createTenant.isPending} data-testid="button-submit-hospital">
                    {createTenant.isPending ? "Adding..." : "Add Hospital"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {tenantList.map((t: any) => (
            <Card key={t.tenantId} className="p-5 border border-slate-200 shadow-sm hover:shadow-md transition-shadow" data-testid={`card-hospital-${t.tenantId}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                    <Building2 className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <button
                      className="font-semibold text-slate-900 hover:text-blue-600 hover:underline text-left cursor-pointer transition-colors leading-tight"
                      onClick={() => switchTenant.mutate(t.tenantId)}
                      disabled={switchTenant.isPending}
                      data-testid={`link-open-hospital-${t.tenantId}`}
                    >
                      {t.displayName || t.tenantName}
                    </button>
                    <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5"><Globe className="w-3 h-3" />{t.subdomain}</p>
                  </div>
                </div>
                <Badge
                  variant={t.subscriptionStatus === "Active" ? "default" : "destructive"}
                  className={t.subscriptionStatus === "Active" ? "bg-emerald-100 text-emerald-700 border-emerald-200" : ""}
                >
                  {t.subscriptionStatus}
                </Badge>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-3" data-testid={`text-created-${t.tenantId}`}>
                <Calendar className="w-3 h-3 shrink-0" />
                <span>Onboarded {fmtDate(t.createdAt)}</span>
                {t.contactPerson && (
                  <>
                    <span className="text-slate-300">·</span>
                    <User className="w-3 h-3 shrink-0" />
                    <span className="truncate max-w-[120px]">{t.contactPerson}</span>
                  </>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-slate-50 rounded-md p-2 text-center">
                  <div className="text-lg font-bold text-slate-900" data-testid={`stat-users-${t.tenantId}`}>{t.users}</div>
                  <div className="text-[10px] text-slate-500 uppercase font-medium">Users</div>
                </div>
                <div className="bg-slate-50 rounded-md p-2 text-center">
                  <div className="text-lg font-bold text-slate-900" data-testid={`stat-leads-${t.tenantId}`}>{t.leads}</div>
                  <div className="text-[10px] text-slate-500 uppercase font-medium">Leads</div>
                </div>
                <div className="bg-slate-50 rounded-md p-2 text-center">
                  <div className="text-lg font-bold text-slate-900" data-testid={`stat-episodes-${t.tenantId}`}>{t.episodes}</div>
                  <div className="text-[10px] text-slate-500 uppercase font-medium">Episodes</div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-blue-600 border-blue-200 hover:bg-blue-50"
                  onClick={() => switchTenant.mutate(t.tenantId)}
                  disabled={switchTenant.isPending}
                  data-testid={`button-open-hospital-${t.tenantId}`}
                >
                  <ExternalLink className="w-3.5 h-3.5 mr-1" /> Open Hospital
                </Button>
                {t.subscriptionStatus === "Active" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
                    onClick={() => suspendTenant.mutate(t.tenantId)}
                    disabled={suspendTenant.isPending}
                    data-testid={`button-suspend-${t.tenantId}`}
                  >
                    <Ban className="w-3.5 h-3.5 mr-1" /> Suspend
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                    onClick={() => activateTenant.mutate(t.tenantId)}
                    disabled={activateTenant.isPending}
                    data-testid={`button-activate-${t.tenantId}`}
                  >
                    <CheckCircle className="w-3.5 h-3.5 mr-1" /> Activate
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>

        {tenantList.length === 0 && (
          <div className="text-center py-16 text-slate-400">
            <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg">No hospitals onboarded yet</p>
            <p className="text-sm">Click "Add Hospital" to get started</p>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
