import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useState } from "react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  CreditCard,
  Plus,
  Calendar,
  Building2,
  IndianRupee,
} from "lucide-react";

export default function AdminSubscriptions() {
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    tenantId: "", planId: "", startDate: "", endDate: "",
    billingCycle: "monthly", amount: 0, gracePeriodDays: 7, notes: "",
  });

  const { data: subs, isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/subscriptions"],
  });

  const { data: plans } = useQuery<any[]>({
    queryKey: ["/api/admin/plans"],
  });

  const { data: stats } = useQuery<any>({
    queryKey: ["/api/admin/stats"],
  });

  const createSub = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/admin/subscriptions", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setShowAdd(false);
      toast({ title: "Subscription created" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateSub = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest("PATCH", `/api/admin/subscriptions/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "Subscription updated" });
    },
  });

  if (isLoading) {
    return <AdminLayout><div className="h-full flex items-center justify-center"><LoadingSpinner /></div></AdminLayout>;
  }

  const tenantList = stats?.tenantStats || [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Active": return "bg-emerald-100 text-emerald-700 border-emerald-200";
      case "Suspended": return "bg-red-100 text-red-700 border-red-200";
      case "Expired": return "bg-amber-100 text-amber-700 border-amber-200";
      case "Cancelled": return "bg-slate-100 text-slate-600 border-slate-200";
      default: return "";
    }
  };

  return (
    <AdminLayout>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900" data-testid="text-subscriptions-title">Subscriptions</h1>
            <p className="text-slate-500 mt-1">Manage hospital subscription assignments</p>
          </div>
          <Dialog open={showAdd} onOpenChange={setShowAdd}>
            <DialogTrigger asChild>
              <Button className="bg-orange-600 hover:bg-orange-700" data-testid="button-add-subscription">
                <Plus className="w-4 h-4 mr-2" /> Assign Subscription
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Assign Subscription to Hospital</DialogTitle></DialogHeader>
              <form onSubmit={(e) => {
                e.preventDefault();
                createSub.mutate({
                  ...form,
                  tenantId: Number(form.tenantId),
                  planId: Number(form.planId),
                  amount: Number(form.amount),
                  gracePeriodDays: Number(form.gracePeriodDays),
                });
              }} className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label>Hospital *</Label>
                    <Select value={form.tenantId} onValueChange={v => setForm(f => ({ ...f, tenantId: v }))}>
                      <SelectTrigger data-testid="select-sub-tenant"><SelectValue placeholder="Select hospital" /></SelectTrigger>
                      <SelectContent>
                        {tenantList.map((t: any) => (
                          <SelectItem key={t.tenantId} value={String(t.tenantId)}>{t.displayName || t.tenantName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Label>Plan *</Label>
                    <Select value={form.planId} onValueChange={v => {
                      const plan = plans?.find((p: any) => String(p.id) === v);
                      setForm(f => ({ ...f, planId: v, amount: plan?.price || 0, billingCycle: plan?.billingCycle || "monthly" }));
                    }}>
                      <SelectTrigger data-testid="select-sub-plan"><SelectValue placeholder="Select plan" /></SelectTrigger>
                      <SelectContent>
                        {plans?.map((p: any) => (
                          <SelectItem key={p.id} value={String(p.id)}>{p.name} - INR {p.price?.toLocaleString()}/{p.billingCycle}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Start Date *</Label>
                    <Input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} required data-testid="input-sub-start" />
                  </div>
                  <div>
                    <Label>End Date *</Label>
                    <Input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} required data-testid="input-sub-end" />
                  </div>
                  <div>
                    <Label>Amount (INR)</Label>
                    <Input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: Number(e.target.value) }))} data-testid="input-sub-amount" />
                  </div>
                  <div>
                    <Label>Grace Period (days)</Label>
                    <Input type="number" value={form.gracePeriodDays} onChange={e => setForm(f => ({ ...f, gracePeriodDays: Number(e.target.value) }))} data-testid="input-sub-grace" />
                  </div>
                  <div className="col-span-2">
                    <Label>Notes</Label>
                    <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} data-testid="input-sub-notes" />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
                  <Button type="submit" className="bg-orange-600 hover:bg-orange-700" disabled={createSub.isPending} data-testid="button-submit-subscription">
                    {createSub.isPending ? "Creating..." : "Assign Subscription"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Hospital</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Plan</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Period</th>
                <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Amount</th>
                <th className="text-center text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Status</th>
                <th className="text-center text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {subs?.map((sub: any) => (
                <tr key={sub.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors" data-testid={`row-sub-${sub.id}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-slate-400" />
                      <span className="font-medium text-slate-900">{sub.tenantName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">{sub.planName}</td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-slate-600 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {sub.startDate ? format(new Date(sub.startDate), "dd MMM yyyy") : "-"} - {sub.endDate ? format(new Date(sub.endDate), "dd MMM yyyy") : "-"}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-0.5 text-sm font-medium text-slate-900">
                      <IndianRupee className="w-3.5 h-3.5" />
                      {(sub.amount || 0).toLocaleString()}
                    </div>
                    <div className="text-xs text-slate-400">{sub.billingCycle}</div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge className={getStatusColor(sub.status)}>{sub.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {sub.status === "Active" && (
                      <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 text-xs"
                        onClick={() => updateSub.mutate({ id: sub.id, data: { status: "Suspended", suspendedAt: new Date().toISOString(), suspendedReason: "Manual suspension" } })}
                        data-testid={`button-suspend-sub-${sub.id}`}>
                        Suspend
                      </Button>
                    )}
                    {sub.status === "Suspended" && (
                      <Button variant="ghost" size="sm" className="text-emerald-600 hover:text-emerald-700 text-xs"
                        onClick={() => updateSub.mutate({ id: sub.id, data: { status: "Active", suspendedAt: null, suspendedReason: null } })}
                        data-testid={`button-reactivate-sub-${sub.id}`}>
                        Reactivate
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {(!subs || subs.length === 0) && (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                  <CreditCard className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  No subscriptions yet. Assign a plan to a hospital to get started.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
}
