import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Sidebar } from "@/components/layout/Sidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { fmtDate } from "@/lib/date-utils";
import {
  Plus,
  Users,
  UserPlus,
  TrendingUp,
  Gift,
  Phone,
  Filter,
  Search,
  ArrowUpDown,
  User,
} from "lucide-react";

const REFERRAL_CHANNELS = [
  "Word of Mouth",
  "Referral Card",
  "Doctor Referral",
  "Staff Referral",
  "Social Media",
  "Patient Testimonial",
  "Community Event",
  "Other",
];

const REFERRAL_OUTCOMES = [
  "Pending",
  "Contacted",
  "Appointment Booked",
  "Consulted",
  "Converted",
  "Won",
  "Lost",
  "Not Interested",
];

type ReferralRecord = {
  id: number;
  referrerId: number | null;
  referrerPatientId: number | null;
  referrerLeadId: number | null;
  referredName: string;
  referredPhone: string;
  referredEmail: string | null;
  referralChannel: string;
  referralDate: string;
  referralNotes: string | null;
  resultingLeadId: number | null;
  outcome: string;
  outcomeDate: string | null;
  status: string;
  referrerName: string | null;
  referrerType: string | null;
  referrerPatientName: string | null;
  resultingLeadName: string | null;
  resultingLeadStatus: string | null;
};

type ReferralStats = {
  total: number;
  converted: number;
  pending: number;
  conversionRate: number;
  topReferrers: Array<{ name: string; count: number; converted: number }>;
  channelBreakdown: Record<string, number>;
};

export default function ReferralsPage() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingReferral, setEditingReferral] = useState<ReferralRecord | null>(null);
  const [filterOutcome, setFilterOutcome] = useState("all");
  const [filterChannel, setFilterChannel] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [formData, setFormData] = useState({
    referredName: "",
    referredPhone: "",
    referredEmail: "",
    referralChannel: "Word of Mouth",
    referralNotes: "",
    referrerId: null as number | null,
    referrerPatientId: null as number | null,
    referrerLeadId: null as number | null,
    referrerExternalName: "",
    referrerExternalPhone: "",
    outcome: "Pending",
  });
  const [referrerMode, setReferrerMode] = useState<"patient" | "other">("patient");

  const { data: referralsList = [], isLoading } = useQuery<ReferralRecord[]>({
    queryKey: ["/api/referrals"],
  });

  const { data: stats } = useQuery<ReferralStats>({
    queryKey: ["/api/referrals/stats"],
  });

  const { data: referrersList = [] } = useQuery<Array<{ id: number; name: string; type: string; status: string }>>({
    queryKey: ["/api/masters/referrers"],
  });

  type TreatedPatient = { id: string; name: string; phone: string; type: string; episodeStatus: string; patientId?: number; leadId?: number };
  const { data: treatedPatients = [] } = useQuery<TreatedPatient[]>({
    queryKey: ["/api/referrals/treated-patients"],
  });

  const [patientSearch, setPatientSearch] = useState("");
  const filteredTreatedPatients = useMemo(() => {
    if (!patientSearch.trim()) return treatedPatients;
    const term = patientSearch.toLowerCase();
    return treatedPatients.filter(p => p.name.toLowerCase().includes(term) || p.phone.includes(term));
  }, [treatedPatients, patientSearch]);

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/referrals", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/referrals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/referrals/stats"] });
      setDialogOpen(false);
      toast({ title: "Referral recorded successfully" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest("PATCH", `/api/referrals/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/referrals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/referrals/stats"] });
      setDialogOpen(false);
      toast({ title: "Referral updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  function openCreate() {
    setEditingReferral(null);
    setFormData({ referredName: "", referredPhone: "", referredEmail: "", referralChannel: "Word of Mouth", referralNotes: "", referrerId: null, referrerPatientId: null, referrerLeadId: null, referrerExternalName: "", referrerExternalPhone: "", outcome: "Pending" });
    setReferrerMode("patient");
    setPatientSearch("");
    setDialogOpen(true);
  }

  function openEdit(ref: ReferralRecord) {
    setEditingReferral(ref);
    const hasExternal = (ref as any).referrerExternalName;
    setReferrerMode(hasExternal ? "other" : "patient");
    setFormData({
      referredName: ref.referredName,
      referredPhone: ref.referredPhone,
      referredEmail: ref.referredEmail || "",
      referralChannel: ref.referralChannel,
      referralNotes: ref.referralNotes || "",
      referrerId: ref.referrerId,
      referrerPatientId: ref.referrerPatientId,
      referrerLeadId: ref.referrerLeadId,
      referrerExternalName: (ref as any).referrerExternalName || "",
      referrerExternalPhone: (ref as any).referrerExternalPhone || "",
      outcome: ref.outcome,
    });
    setPatientSearch("");
    setDialogOpen(true);
  }

  function handleSave() {
    if (!formData.referredName.trim() || !formData.referredPhone.trim()) {
      toast({ title: "Referred person's name and phone are required", variant: "destructive" });
      return;
    }
    if (referrerMode === "other" && !formData.referrerExternalName.trim()) {
      toast({ title: "Referrer name is required when using 'Others'", variant: "destructive" });
      return;
    }

    const payload: any = {
      referredName: formData.referredName,
      referredPhone: formData.referredPhone,
      referredEmail: formData.referredEmail || null,
      referralChannel: formData.referralChannel,
      referralNotes: formData.referralNotes || null,
      outcome: formData.outcome,
    };

    if (referrerMode === "patient") {
      payload.referrerPatientId = formData.referrerPatientId;
      payload.referrerLeadId = formData.referrerLeadId;
      payload.referrerId = formData.referrerId;
      payload.referrerExternalName = null;
      payload.referrerExternalPhone = null;
    } else {
      payload.referrerExternalName = formData.referrerExternalName;
      payload.referrerExternalPhone = formData.referrerExternalPhone || null;
      payload.referrerPatientId = null;
      payload.referrerLeadId = null;
      payload.referrerId = null;
    }

    if (editingReferral) {
      updateMutation.mutate({ id: editingReferral.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  const filteredReferrals = referralsList.filter(r => {
    if (filterOutcome !== "all" && r.outcome !== filterOutcome) return false;
    if (filterChannel !== "all" && r.referralChannel !== filterChannel) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return r.referredName.toLowerCase().includes(term) ||
        r.referredPhone.includes(term) ||
        (r.referrerName || "").toLowerCase().includes(term) ||
        (r.referrerPatientName || "").toLowerCase().includes(term);
    }
    return true;
  });

  const outcomeColor = (outcome: string) => {
    switch (outcome) {
      case "Won": case "Converted": return "default";
      case "Appointment Booked": case "Consulted": return "secondary";
      case "Contacted": return "outline";
      case "Lost": case "Not Interested": return "destructive";
      default: return "outline";
    }
  };

  return (
    <div className="flex h-screen bg-background" data-testid="page-referrals">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-6 max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Gift className="h-7 w-7 text-primary" />
              <div>
                <h1 className="text-2xl font-bold text-foreground" data-testid="text-page-title">Referral Management</h1>
                <p className="text-sm text-muted-foreground">Track and manage patient referrals</p>
              </div>
            </div>
            <Button onClick={openCreate} data-testid="button-create-referral">
              <Plus className="h-4 w-4 mr-2" />
              Record Referral
            </Button>
          </div>

          {stats && (
            <div className="grid grid-cols-4 gap-4 mb-6">
              <Card data-testid="card-stat-total">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/30">
                      <Users className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold" data-testid="text-total-referrals">{stats.total}</p>
                      <p className="text-xs text-muted-foreground">Total Referrals</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card data-testid="card-stat-converted">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-green-50 dark:bg-green-950/30">
                      <UserPlus className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold" data-testid="text-converted">{stats.converted}</p>
                      <p className="text-xs text-muted-foreground">Converted</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card data-testid="card-stat-pending">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30">
                      <Phone className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold" data-testid="text-pending">{stats.pending}</p>
                      <p className="text-xs text-muted-foreground">Pending</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card data-testid="card-stat-conversion-rate">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-violet-50 dark:bg-violet-950/30">
                      <TrendingUp className="h-5 w-5 text-violet-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold" data-testid="text-conversion-rate">{stats.conversionRate}%</p>
                      <p className="text-xs text-muted-foreground">Conversion Rate</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {stats && stats.topReferrers.length > 0 && (
            <Card className="mb-6" data-testid="card-top-referrers">
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold mb-3">Top Referrers</h3>
                <div className="grid grid-cols-5 gap-3">
                  {stats.topReferrers.slice(0, 5).map((ref, i) => (
                    <div key={i} className="text-center p-3 rounded-lg bg-muted/30 border">
                      <p className="font-medium text-sm truncate">{ref.name}</p>
                      <p className="text-lg font-bold text-primary">{ref.count}</p>
                      <p className="text-xs text-muted-foreground">{ref.converted} converted</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search by name, phone, or referrer..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                data-testid="input-search"
              />
            </div>
            <Select value={filterOutcome} onValueChange={setFilterOutcome}>
              <SelectTrigger className="w-[180px]" data-testid="select-filter-outcome">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Outcome" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Outcomes</SelectItem>
                {REFERRAL_OUTCOMES.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterChannel} onValueChange={setFilterChannel}>
              <SelectTrigger className="w-[180px]" data-testid="select-filter-channel">
                <SelectValue placeholder="Channel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Channels</SelectItem>
                {REFERRAL_CHANNELS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center h-48 text-muted-foreground">Loading...</div>
          ) : filteredReferrals.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <Gift className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
                <h3 className="text-lg font-medium text-muted-foreground mb-2">No Referrals Found</h3>
                <p className="text-sm text-muted-foreground/70 mb-4">Record your first referral to start tracking.</p>
                <Button onClick={openCreate} variant="outline" data-testid="button-create-first">
                  <Plus className="h-4 w-4 mr-2" />
                  Record First Referral
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm" data-testid="table-referrals">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3 font-medium">Referred Person</th>
                    <th className="text-left p-3 font-medium">Referred By</th>
                    <th className="text-left p-3 font-medium">Channel</th>
                    <th className="text-left p-3 font-medium">Date</th>
                    <th className="text-left p-3 font-medium">Outcome</th>
                    <th className="text-left p-3 font-medium">Resulting Lead</th>
                    <th className="text-right p-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReferrals.map(ref => (
                    <tr key={ref.id} className="border-t hover:bg-muted/20" data-testid={`row-referral-${ref.id}`}>
                      <td className="p-3">
                        <div className="font-medium">{ref.referredName}</div>
                        <div className="text-xs text-muted-foreground">{ref.referredPhone}</div>
                      </td>
                      <td className="p-3">
                        <div className="text-sm">{ref.referrerName || ref.referrerPatientName || "—"}</div>
                        {ref.referrerType && <div className="text-xs text-muted-foreground">{ref.referrerType}</div>}
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" className="text-xs">{ref.referralChannel}</Badge>
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {ref.referralDate ? fmtDate(ref.referralDate) : "—"}
                      </td>
                      <td className="p-3">
                        <Badge variant={outcomeColor(ref.outcome) as any} className="text-xs">{ref.outcome}</Badge>
                      </td>
                      <td className="p-3">
                        {ref.resultingLeadName ? (
                          <div>
                            <div className="text-sm">{ref.resultingLeadName}</div>
                            <div className="text-xs text-muted-foreground">{ref.resultingLeadStatus}</div>
                          </div>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="p-3 text-right">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(ref)} data-testid={`button-edit-${ref.id}`}>
                          Edit
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg" aria-describedby="referral-dialog-desc">
          <DialogHeader>
            <DialogTitle data-testid="text-dialog-title">
              {editingReferral ? "Update Referral" : "Record New Referral"}
            </DialogTitle>
            <p id="referral-dialog-desc" className="text-sm text-muted-foreground">
              {editingReferral ? "Update referral details and outcome" : "Record a new patient referral"}
            </p>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Referred Person Name *</Label>
                <Input
                  value={formData.referredName}
                  onChange={e => setFormData({ ...formData, referredName: e.target.value })}
                  placeholder="Full name"
                  data-testid="input-referred-name"
                />
              </div>
              <div>
                <Label>Phone *</Label>
                <Input
                  value={formData.referredPhone}
                  onChange={e => setFormData({ ...formData, referredPhone: e.target.value })}
                  placeholder="+91..."
                  data-testid="input-referred-phone"
                />
              </div>
            </div>

            <div>
              <Label>Email</Label>
              <Input
                value={formData.referredEmail}
                onChange={e => setFormData({ ...formData, referredEmail: e.target.value })}
                placeholder="email@example.com"
                data-testid="input-referred-email"
              />
            </div>

            <div>
              <Label className="mb-2 block">Referred By (Referrer)</Label>
              <div className="flex gap-2 mb-3">
                <Button
                  type="button"
                  size="sm"
                  variant={referrerMode === "patient" ? "default" : "outline"}
                  onClick={() => { setReferrerMode("patient"); setFormData({ ...formData, referrerExternalName: "", referrerExternalPhone: "" }); }}
                  data-testid="button-referrer-patient-mode"
                >
                  <User className="w-3.5 h-3.5 mr-1" /> Treated Patient
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={referrerMode === "other" ? "default" : "outline"}
                  onClick={() => { setReferrerMode("other"); setFormData({ ...formData, referrerPatientId: null, referrerLeadId: null, referrerId: null }); }}
                  data-testid="button-referrer-other-mode"
                >
                  <UserPlus className="w-3.5 h-3.5 mr-1" /> Others
                </Button>
              </div>

              {referrerMode === "patient" ? (
                <div className="space-y-2">
                  <Input
                    placeholder="Search by patient name or phone..."
                    value={patientSearch}
                    onChange={e => setPatientSearch(e.target.value)}
                    data-testid="input-referrer-search"
                  />
                  <div className="max-h-40 overflow-y-auto border rounded-md">
                    {filteredTreatedPatients.length === 0 ? (
                      <div className="p-3 text-center text-sm text-muted-foreground">
                        {treatedPatients.length === 0 ? "No treated patients found" : "No matches"}
                      </div>
                    ) : (
                      filteredTreatedPatients.map(p => {
                        const isSelected =
                          (p.patientId && formData.referrerPatientId === p.patientId) ||
                          (p.leadId && formData.referrerLeadId === p.leadId);
                        return (
                          <button
                            key={p.id}
                            type="button"
                            className={`w-full text-left px-3 py-2 text-sm border-b last:border-b-0 transition-colors ${isSelected ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted/50"}`}
                            onClick={() => setFormData({
                              ...formData,
                              referrerPatientId: p.patientId || null,
                              referrerLeadId: p.leadId || null,
                              referrerId: null,
                            })}
                            data-testid={`button-select-referrer-${p.id}`}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <span className="font-medium">{p.name}</span>
                                {p.phone && <span className="text-muted-foreground ml-2">{p.phone}</span>}
                              </div>
                              <Badge variant="outline" className="text-[10px] ml-2">{p.episodeStatus}</Badge>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                  {(formData.referrerPatientId || formData.referrerLeadId) && (
                    <div className="flex items-center justify-between bg-primary/5 rounded px-3 py-1.5">
                      <span className="text-sm text-primary font-medium">
                        Selected: {treatedPatients.find(p =>
                          (p.patientId && formData.referrerPatientId === p.patientId) ||
                          (p.leadId && formData.referrerLeadId === p.leadId)
                        )?.name || "—"}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs"
                        onClick={() => setFormData({ ...formData, referrerPatientId: null, referrerLeadId: null })}
                        data-testid="button-clear-referrer"
                      >
                        Clear
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3 bg-muted/30 rounded-lg p-3">
                  <div>
                    <Label>Referrer Name *</Label>
                    <Input
                      value={formData.referrerExternalName}
                      onChange={e => setFormData({ ...formData, referrerExternalName: e.target.value })}
                      placeholder="Full name of the referring person"
                      data-testid="input-referrer-external-name"
                    />
                  </div>
                  <div>
                    <Label>Referrer Mobile Number</Label>
                    <Input
                      value={formData.referrerExternalPhone}
                      onChange={e => setFormData({ ...formData, referrerExternalPhone: e.target.value })}
                      placeholder="+91..."
                      data-testid="input-referrer-external-phone"
                    />
                  </div>
                </div>
              )}
            </div>

            <div>
              <Label>Channel</Label>
              <Select value={formData.referralChannel} onValueChange={v => setFormData({ ...formData, referralChannel: v })}>
                <SelectTrigger data-testid="select-channel">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REFERRAL_CHANNELS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {editingReferral && (
              <div>
                <Label>Outcome</Label>
                <Select value={formData.outcome} onValueChange={v => setFormData({ ...formData, outcome: v })}>
                  <SelectTrigger data-testid="select-outcome">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REFERRAL_OUTCOMES.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label>Notes</Label>
              <Textarea
                value={formData.referralNotes}
                onChange={e => setFormData({ ...formData, referralNotes: e.target.value })}
                placeholder="Additional details..."
                rows={2}
                data-testid="input-referral-notes"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} data-testid="button-cancel">Cancel</Button>
            <Button
              onClick={handleSave}
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="button-save-referral"
            >
              {(createMutation.isPending || updateMutation.isPending) ? "Saving..." : editingReferral ? "Update" : "Record Referral"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
