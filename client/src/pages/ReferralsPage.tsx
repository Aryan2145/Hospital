import { useState } from "react";
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
    outcome: "Pending",
  });

  const { data: referralsList = [], isLoading } = useQuery<ReferralRecord[]>({
    queryKey: ["/api/referrals"],
  });

  const { data: stats } = useQuery<ReferralStats>({
    queryKey: ["/api/referrals/stats"],
  });

  const { data: referrersList = [] } = useQuery<Array<{ id: number; name: string; type: string; status: string }>>({
    queryKey: ["/api/masters/referrers"],
  });

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
    setFormData({ referredName: "", referredPhone: "", referredEmail: "", referralChannel: "Word of Mouth", referralNotes: "", referrerId: null, outcome: "Pending" });
    setDialogOpen(true);
  }

  function openEdit(ref: ReferralRecord) {
    setEditingReferral(ref);
    setFormData({
      referredName: ref.referredName,
      referredPhone: ref.referredPhone,
      referredEmail: ref.referredEmail || "",
      referralChannel: ref.referralChannel,
      referralNotes: ref.referralNotes || "",
      referrerId: ref.referrerId,
      outcome: ref.outcome,
    });
    setDialogOpen(true);
  }

  function handleSave() {
    if (!formData.referredName.trim() || !formData.referredPhone.trim()) {
      toast({ title: "Referred person's name and phone are required", variant: "destructive" });
      return;
    }
    if (editingReferral) {
      updateMutation.mutate({ id: editingReferral.id, data: formData });
    } else {
      createMutation.mutate(formData);
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

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Referred By (Referrer)</Label>
                <Select
                  value={formData.referrerId ? String(formData.referrerId) : "none"}
                  onValueChange={v => setFormData({ ...formData, referrerId: v === "none" ? null : Number(v) })}
                >
                  <SelectTrigger data-testid="select-referrer">
                    <SelectValue placeholder="Select referrer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No specific referrer</SelectItem>
                    {referrersList.filter(r => r.status === "Active").map(r => (
                      <SelectItem key={r.id} value={String(r.id)}>
                        {r.name} {r.type ? `(${r.type})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
