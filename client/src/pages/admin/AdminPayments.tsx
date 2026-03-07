import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useState } from "react";
import { fmtDate, fmtDateRange } from "@/lib/date-utils";
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
  Receipt,
  Plus,
  Building2,
  IndianRupee,
  Calendar,
  FileText,
  CreditCard,
} from "lucide-react";

export default function AdminPayments() {
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    tenantId: "", subscriptionId: "", amount: 0, paymentDate: "",
    paymentMethod: "Bank Transfer", transactionRef: "", invoiceNumber: "",
    periodStart: "", periodEnd: "", notes: "",
  });

  const { data: payments, isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/payments"],
  });

  const { data: subs } = useQuery<any[]>({
    queryKey: ["/api/admin/subscriptions"],
  });

  const { data: stats } = useQuery<any>({
    queryKey: ["/api/admin/stats"],
  });

  const recordPayment = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/admin/payments", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/payments"] });
      setShowAdd(false);
      setForm({ tenantId: "", subscriptionId: "", amount: 0, paymentDate: "", paymentMethod: "Bank Transfer", transactionRef: "", invoiceNumber: "", periodStart: "", periodEnd: "", notes: "" });
      toast({ title: "Payment recorded" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  if (isLoading) {
    return <AdminLayout><div className="h-full flex items-center justify-center"><LoadingSpinner /></div></AdminLayout>;
  }

  const tenantList = stats?.tenantStats || [];
  const selectedTenantSubs = subs?.filter((s: any) => String(s.tenantId) === form.tenantId) || [];
  const totalCollected = payments?.reduce((sum: number, p: any) => sum + (p.amount || 0), 0) || 0;

  return (
    <AdminLayout>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900" data-testid="text-payments-title">Payment Records</h1>
            <p className="text-slate-500 mt-1">Track and record subscription payments manually</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs text-slate-400 uppercase font-semibold">Total Collected</p>
              <p className="text-xl font-bold text-slate-900 flex items-center gap-0.5">
                <IndianRupee className="w-4 h-4" />{totalCollected.toLocaleString()}
              </p>
            </div>
            <Dialog open={showAdd} onOpenChange={setShowAdd}>
              <DialogTrigger asChild>
                <Button className="bg-orange-600 hover:bg-orange-700" data-testid="button-record-payment">
                  <Plus className="w-4 h-4 mr-2" /> Record Payment
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
                <form onSubmit={(e) => {
                  e.preventDefault();
                  recordPayment.mutate({
                    ...form,
                    tenantId: Number(form.tenantId),
                    subscriptionId: Number(form.subscriptionId),
                    amount: Number(form.amount),
                  });
                }} className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <Label>Hospital *</Label>
                      <Select value={form.tenantId} onValueChange={v => setForm(f => ({ ...f, tenantId: v, subscriptionId: "" }))}>
                        <SelectTrigger data-testid="select-payment-tenant"><SelectValue placeholder="Select hospital" /></SelectTrigger>
                        <SelectContent>
                          {tenantList.map((t: any) => (
                            <SelectItem key={t.tenantId} value={String(t.tenantId)}>{t.displayName || t.tenantName}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2">
                      <Label>Subscription *</Label>
                      <Select value={form.subscriptionId} onValueChange={v => setForm(f => ({ ...f, subscriptionId: v }))}>
                        <SelectTrigger data-testid="select-payment-sub"><SelectValue placeholder="Select subscription" /></SelectTrigger>
                        <SelectContent>
                          {selectedTenantSubs.map((s: any) => (
                            <SelectItem key={s.id} value={String(s.id)}>
                              {s.planName} ({s.status}) - INR {s.amount?.toLocaleString()}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Amount (INR) *</Label>
                      <Input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: Number(e.target.value) }))} required data-testid="input-payment-amount" />
                    </div>
                    <div>
                      <Label>Payment Date *</Label>
                      <Input type="date" value={form.paymentDate} onChange={e => setForm(f => ({ ...f, paymentDate: e.target.value }))} required data-testid="input-payment-date" />
                    </div>
                    <div>
                      <Label>Payment Method</Label>
                      <Select value={form.paymentMethod} onValueChange={v => setForm(f => ({ ...f, paymentMethod: v }))}>
                        <SelectTrigger data-testid="select-payment-method"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                          <SelectItem value="UPI">UPI</SelectItem>
                          <SelectItem value="Cheque">Cheque</SelectItem>
                          <SelectItem value="Cash">Cash</SelectItem>
                          <SelectItem value="Credit Card">Credit Card</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Transaction Ref</Label>
                      <Input value={form.transactionRef} onChange={e => setForm(f => ({ ...f, transactionRef: e.target.value }))} placeholder="UTR / Cheque No." data-testid="input-transaction-ref" />
                    </div>
                    <div>
                      <Label>Invoice Number</Label>
                      <Input value={form.invoiceNumber} onChange={e => setForm(f => ({ ...f, invoiceNumber: e.target.value }))} placeholder="INV-001" data-testid="input-invoice-number" />
                    </div>
                    <div>
                      <Label>Period Start</Label>
                      <Input type="date" value={form.periodStart} onChange={e => setForm(f => ({ ...f, periodStart: e.target.value }))} data-testid="input-period-start" />
                    </div>
                    <div>
                      <Label>Period End</Label>
                      <Input type="date" value={form.periodEnd} onChange={e => setForm(f => ({ ...f, periodEnd: e.target.value }))} data-testid="input-period-end" />
                    </div>
                    <div className="col-span-2">
                      <Label>Notes</Label>
                      <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} data-testid="input-payment-notes" />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
                    <Button type="submit" className="bg-orange-600 hover:bg-orange-700" disabled={recordPayment.isPending} data-testid="button-submit-payment">
                      {recordPayment.isPending ? "Recording..." : "Record Payment"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Hospital</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Date</th>
                <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Amount</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Method</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Invoice</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Period</th>
                <th className="text-center text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {payments?.map((p: any) => (
                <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors" data-testid={`row-payment-${p.id}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-slate-400" />
                      <span className="font-medium text-slate-900">{p.tenantName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {p.paymentDate ? fmtDate(p.paymentDate) : "-"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-medium text-slate-900 flex items-center justify-end gap-0.5">
                      <IndianRupee className="w-3.5 h-3.5" />{(p.amount || 0).toLocaleString()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    <div className="flex items-center gap-1">
                      <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                      {p.paymentMethod || "-"}
                    </div>
                    {p.transactionRef && <div className="text-xs text-slate-400 mt-0.5">Ref: {p.transactionRef}</div>}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {p.invoiceNumber ? (
                      <div className="flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5 text-slate-400" />
                        {p.invoiceNumber}
                      </div>
                    ) : "-"}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {p.periodStart && p.periodEnd ? (
                      <span>{fmtDateRange(p.periodStart, p.periodEnd)}</span>
                    ) : "-"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">{p.status}</Badge>
                  </td>
                </tr>
              ))}
              {(!payments || payments.length === 0) && (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                  <Receipt className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  No payments recorded yet
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
}
