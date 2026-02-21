import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Sidebar } from "@/components/layout/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Plus, Pencil, Megaphone, Calendar, DollarSign, Loader2 } from "lucide-react";
import { format } from "date-fns";

interface Campaign {
  id: number;
  tenantId: number;
  name: string;
  platform: string | null;
  channel: string | null;
  budget: number | null;
  startDate: string | null;
  endDate: string | null;
  isActive: boolean | null;
}

export default function CampaignsPage() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [formName, setFormName] = useState("");
  const [formPlatform, setFormPlatform] = useState("");
  const [formChannel, setFormChannel] = useState("");
  const [formBudget, setFormBudget] = useState("");
  const [formStartDate, setFormStartDate] = useState("");
  const [formEndDate, setFormEndDate] = useState("");
  const [formIsActive, setFormIsActive] = useState("true");

  const { data: campaigns, isLoading } = useQuery<Campaign[]>({
    queryKey: ["/api/campaigns"],
  });

  const { data: channelsList } = useQuery<any[]>({
    queryKey: ["/api/masters/campaignChannels"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/campaigns", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      toast({ title: "Campaign created" });
      closeDialog();
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PATCH", `/api/campaigns/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      toast({ title: "Campaign updated" });
      closeDialog();
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const openCreate = () => {
    setEditing(null);
    setFormName("");
    setFormPlatform("");
    setFormChannel("");
    setFormBudget("");
    setFormStartDate("");
    setFormEndDate("");
    setFormIsActive("true");
    setDialogOpen(true);
  };

  const openEdit = (c: Campaign) => {
    setEditing(c);
    setFormName(c.name);
    setFormPlatform(c.platform || "");
    setFormChannel(c.channel || "");
    setFormBudget(c.budget != null ? String(c.budget) : "");
    setFormStartDate(c.startDate ? c.startDate.split("T")[0] : "");
    setFormEndDate(c.endDate ? c.endDate.split("T")[0] : "");
    setFormIsActive(c.isActive === false ? "false" : "true");
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditing(null);
  };

  const handleSubmit = () => {
    if (!formName.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    const data: any = {
      name: formName.trim(),
      isActive: formIsActive === "true",
    };
    if (formPlatform) data.platform = formPlatform;
    if (formChannel) data.channel = formChannel;
    if (formBudget) data.budget = Number(formBudget);
    if (formStartDate) data.startDate = formStartDate;
    if (formEndDate) data.endDate = formEndDate;

    if (editing) {
      updateMutation.mutate({ id: editing.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-foreground" data-testid="text-campaigns-title">Campaigns</h2>
              <p className="text-muted-foreground mt-1">Manage marketing campaigns and track performance.</p>
            </div>
            <Button onClick={openCreate} data-testid="button-create-campaign">
              <Plus className="w-4 h-4 mr-2" />
              New Campaign
            </Button>
          </div>

          {isLoading ? (
            <LoadingSpinner text="Loading campaigns..." />
          ) : !campaigns || campaigns.length === 0 ? (
            <Card className="p-12 text-center">
              <Megaphone className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No campaigns yet. Create your first campaign.</p>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {campaigns.map((c) => (
                <Card key={c.id} className="overflow-visible" data-testid={`card-campaign-${c.id}`}>
                  <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
                    <div className="space-y-1 min-w-0">
                      <CardTitle className="text-base truncate">{c.name}</CardTitle>
                      {c.platform && <p className="text-xs text-muted-foreground">{c.platform}</p>}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Badge variant={c.isActive !== false ? "default" : "secondary"}>
                        {c.isActive !== false ? "Active" : "Inactive"}
                      </Badge>
                      <Button size="icon" variant="ghost" onClick={() => openEdit(c)} data-testid={`button-edit-campaign-${c.id}`}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {c.channel && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Megaphone className="w-3.5 h-3.5" />
                        <span>{c.channel}</span>
                      </div>
                    )}
                    {c.budget != null && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <DollarSign className="w-3.5 h-3.5" />
                        <span>Budget: {c.budget.toLocaleString()}</span>
                      </div>
                    )}
                    {(c.startDate || c.endDate) && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>
                          {c.startDate ? format(new Date(c.startDate), "MMM dd, yyyy") : "—"}
                          {" to "}
                          {c.endDate ? format(new Date(c.endDate), "MMM dd, yyyy") : "Ongoing"}
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Campaign" : "New Campaign"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="text-xs font-medium text-muted-foreground">Name *</Label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Campaign name"
                  data-testid="input-campaign-name"
                />
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground">Platform</Label>
                <SearchableSelect
                  value={formPlatform}
                  onValueChange={setFormPlatform}
                  placeholder="Select platform"
                  data-testid="select-campaign-platform"
                  options={[
                    { value: "none", label: "None" },
                    { value: "Google Ads", label: "Google Ads" },
                    { value: "Facebook", label: "Facebook" },
                    { value: "Instagram", label: "Instagram" },
                    { value: "WhatsApp", label: "WhatsApp" },
                    { value: "YouTube", label: "YouTube" },
                    { value: "LinkedIn", label: "LinkedIn" },
                    { value: "Offline", label: "Offline" },
                    { value: "Other", label: "Other" },
                  ]}
                />
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground">Channel</Label>
                <SearchableSelect
                  value={formChannel}
                  onValueChange={setFormChannel}
                  placeholder="Select channel"
                  data-testid="select-campaign-channel"
                  options={[
                    { value: "none", label: "None" },
                    ...(channelsList?.filter((ch: any) => ch.status === "Active").map((ch: any) => ({
                      value: ch.name,
                      label: ch.name,
                    })) || []),
                  ]}
                />
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground">Budget</Label>
                <Input
                  type="number"
                  value={formBudget}
                  onChange={(e) => setFormBudget(e.target.value)}
                  placeholder="Campaign budget"
                  data-testid="input-campaign-budget"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Start Date</Label>
                  <Input
                    type="date"
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                    data-testid="input-campaign-start"
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">End Date</Label>
                  <Input
                    type="date"
                    value={formEndDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                    data-testid="input-campaign-end"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground">Status</Label>
                <SearchableSelect
                  value={formIsActive}
                  onValueChange={setFormIsActive}
                  data-testid="select-campaign-status"
                  options={[
                    { value: "true", label: "Active" },
                    { value: "false", label: "Inactive" },
                  ]}
                />
              </div>

              <Button
                onClick={handleSubmit}
                className="w-full"
                disabled={isPending || !formName.trim()}
                data-testid="button-save-campaign"
              >
                {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Megaphone className="w-4 h-4 mr-2" />}
                {editing ? "Update Campaign" : "Create Campaign"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
