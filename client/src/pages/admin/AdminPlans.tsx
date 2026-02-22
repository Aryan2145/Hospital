import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Package,
  Plus,
  Users,
  UserPlus,
  Building2,
  IndianRupee,
  Edit,
} from "lucide-react";

export default function AdminPlans() {
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [editingPlan, setEditingPlan] = useState<any>(null);
  const [form, setForm] = useState({
    name: "", code: "", description: "", billingCycle: "monthly",
    price: 0, currency: "INR", maxUsers: 0, maxLeadsPerMonth: 0, maxBranches: 0,
  });

  const { data: plans, isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/plans"],
  });

  const createPlan = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/admin/plans", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/plans"] });
      setShowAdd(false);
      resetForm();
      toast({ title: "Plan created" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updatePlan = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest("PATCH", `/api/admin/plans/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/plans"] });
      setEditingPlan(null);
      resetForm();
      toast({ title: "Plan updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const resetForm = () => setForm({ name: "", code: "", description: "", billingCycle: "monthly", price: 0, currency: "INR", maxUsers: 0, maxLeadsPerMonth: 0, maxBranches: 0 });

  const openEdit = (plan: any) => {
    setForm({
      name: plan.name, code: plan.code, description: plan.description || "",
      billingCycle: plan.billingCycle, price: plan.price, currency: plan.currency,
      maxUsers: plan.maxUsers || 0, maxLeadsPerMonth: plan.maxLeadsPerMonth || 0, maxBranches: plan.maxBranches || 0,
    });
    setEditingPlan(plan);
  };

  if (isLoading) {
    return <AdminLayout><div className="h-full flex items-center justify-center"><LoadingSpinner /></div></AdminLayout>;
  }

  const formDialog = (isEdit: boolean) => (
    <form onSubmit={(e) => {
      e.preventDefault();
      const payload = { ...form, price: Number(form.price), maxUsers: Number(form.maxUsers), maxLeadsPerMonth: Number(form.maxLeadsPerMonth), maxBranches: Number(form.maxBranches) };
      if (isEdit) updatePlan.mutate({ id: editingPlan.id, data: payload });
      else createPlan.mutate(payload);
    }} className="space-y-4 mt-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label>Plan Name *</Label>
          <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Professional" required data-testid="input-plan-name" />
        </div>
        <div>
          <Label>Code *</Label>
          <Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="e.g. PRO" required disabled={isEdit} data-testid="input-plan-code" />
        </div>
        <div>
          <Label>Billing Cycle</Label>
          <Select value={form.billingCycle} onValueChange={v => setForm(f => ({ ...f, billingCycle: v }))}>
            <SelectTrigger data-testid="select-billing-cycle"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="quarterly">Quarterly</SelectItem>
              <SelectItem value="annual">Annual</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Price (INR)</Label>
          <Input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: Number(e.target.value) }))} data-testid="input-plan-price" />
        </div>
        <div>
          <Label>Max Users</Label>
          <Input type="number" value={form.maxUsers} onChange={e => setForm(f => ({ ...f, maxUsers: Number(e.target.value) }))} placeholder="0 = unlimited" data-testid="input-max-users" />
        </div>
        <div>
          <Label>Max Leads/Month</Label>
          <Input type="number" value={form.maxLeadsPerMonth} onChange={e => setForm(f => ({ ...f, maxLeadsPerMonth: Number(e.target.value) }))} placeholder="0 = unlimited" data-testid="input-max-leads" />
        </div>
        <div>
          <Label>Max Branches</Label>
          <Input type="number" value={form.maxBranches} onChange={e => setForm(f => ({ ...f, maxBranches: Number(e.target.value) }))} placeholder="0 = unlimited" data-testid="input-max-branches" />
        </div>
        <div className="col-span-2">
          <Label>Description</Label>
          <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} data-testid="input-plan-desc" />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={() => { setShowAdd(false); setEditingPlan(null); resetForm(); }}>Cancel</Button>
        <Button type="submit" className="bg-orange-600 hover:bg-orange-700" disabled={createPlan.isPending || updatePlan.isPending} data-testid="button-submit-plan">
          {isEdit ? "Update Plan" : "Create Plan"}
        </Button>
      </div>
    </form>
  );

  return (
    <AdminLayout>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900" data-testid="text-plans-title">Subscription Plans</h1>
            <p className="text-slate-500 mt-1">Define pricing tiers and feature limits for hospitals</p>
          </div>
          <Dialog open={showAdd} onOpenChange={(o) => { setShowAdd(o); if (!o) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="bg-orange-600 hover:bg-orange-700" data-testid="button-add-plan">
                <Plus className="w-4 h-4 mr-2" /> Create Plan
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Create Subscription Plan</DialogTitle></DialogHeader>
              {formDialog(false)}
            </DialogContent>
          </Dialog>
        </div>

        <Dialog open={!!editingPlan} onOpenChange={(o) => { if (!o) { setEditingPlan(null); resetForm(); } }}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Edit Plan: {editingPlan?.name}</DialogTitle></DialogHeader>
            {formDialog(true)}
          </DialogContent>
        </Dialog>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {plans?.map((plan: any) => (
            <Card key={plan.id} className="p-5 border border-slate-200 shadow-sm hover:shadow-md transition-shadow" data-testid={`card-plan-${plan.id}`}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-lg text-slate-900">{plan.name}</h3>
                  <p className="text-xs text-slate-400 font-mono">{plan.code}</p>
                </div>
                <Badge variant={plan.isActive ? "default" : "secondary"} className={plan.isActive ? "bg-emerald-100 text-emerald-700" : ""}>
                  {plan.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>

              <div className="flex items-baseline gap-1 mb-4">
                <IndianRupee className="w-5 h-5 text-slate-700" />
                <span className="text-3xl font-bold text-slate-900">{(plan.price || 0).toLocaleString()}</span>
                <span className="text-sm text-slate-400">/{plan.billingCycle}</span>
              </div>

              {plan.description && <p className="text-sm text-slate-500 mb-4">{plan.description}</p>}

              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Users className="w-4 h-4 text-slate-400" />
                  <span>{plan.maxUsers || "Unlimited"} Users</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <UserPlus className="w-4 h-4 text-slate-400" />
                  <span>{plan.maxLeadsPerMonth || "Unlimited"} Leads/month</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Building2 className="w-4 h-4 text-slate-400" />
                  <span>{plan.maxBranches || "Unlimited"} Branches</span>
                </div>
              </div>

              <Button variant="outline" size="sm" className="w-full" onClick={() => openEdit(plan)} data-testid={`button-edit-plan-${plan.id}`}>
                <Edit className="w-3.5 h-3.5 mr-1" /> Edit Plan
              </Button>
            </Card>
          ))}
        </div>

        {(!plans || plans.length === 0) && (
          <div className="text-center py-16 text-slate-400">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg">No subscription plans yet</p>
            <p className="text-sm">Create your first plan to start assigning to hospitals</p>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
