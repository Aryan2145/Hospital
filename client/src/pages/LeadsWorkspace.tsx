import { AppLayout } from "@/components/layout/AppLayout";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";
import { useLeads, useCreateLead } from "@/hooks/use-leads";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Search, Filter, FileUp } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertLeadSchema, InsertLead } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";

export default function LeadsWorkspace() {
  const [search, setSearch] = useState("");
  const { data: leads, isLoading } = useLeads(undefined, search);
  const [open, setOpen] = useState(false);
  const [, navigate] = useLocation();

  return (
    <AppLayout className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Background Accent */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-b from-muted to-transparent opacity-50 rounded-bl-full pointer-events-none z-0" />

        <div className="p-4 md:p-6 border-b border-border bg-white/80 backdrop-blur-sm z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">Leads Workspace</h1>
              <p className="text-xs md:text-sm text-muted-foreground">Manage patient inquiries and track status.</p>
            </div>
            
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative w-full md:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search patients..." 
                  className="pl-9" 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Button variant="outline" size="icon" className="shrink-0">
                <Filter className="w-4 h-4" />
              </Button>

              <Button variant="outline" size="sm" className="shrink-0" onClick={() => navigate("/lead-import")} data-testid="button-bulk-import">
                <FileUp className="w-4 h-4 md:mr-2" />
                <span className="hidden md:inline">Bulk Import</span>
              </Button>
              
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="shrink-0 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20">
                    <Plus className="w-4 h-4 md:mr-2" />
                    <span className="hidden md:inline">New Lead</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Add New Lead</DialogTitle>
                  </DialogHeader>
                  <CreateLeadForm onSuccess={() => setOpen(false)} />
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>

        <div className="flex-1 p-3 md:p-6 overflow-hidden z-10">
          {isLoading ? (
            <LoadingSpinner text="Loading leads..." />
          ) : leads ? (
            <KanbanBoard leads={leads} />
          ) : (
             <div className="flex items-center justify-center h-full text-muted-foreground">
                Failed to load leads.
             </div>
          )}
        </div>
    </AppLayout>
  );
}

function useMasterData(tableName: string) {
  return useQuery<any[]>({
    queryKey: ["/api/masters", tableName],
    queryFn: async () => {
      const res = await fetch(`/api/masters/${tableName}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });
}

function CreateLeadForm({ onSuccess }: { onSuccess: () => void }) {
  const createLead = useCreateLead();

  const { data: branches = [] } = useMasterData("branches");
  const { data: leadSourceCategories = [] } = useMasterData("lead_source_categories");
  const { data: leadSources = [] } = useMasterData("lead_sources");
  const { data: treatmentDepartments = [] } = useMasterData("treatment_departments");
  const { data: treatmentSubDepartments = [] } = useMasterData("treatment_sub_departments");
  const { data: consultationTypes = [] } = useMasterData("consultation_types");
  const { data: doctors = [] } = useMasterData("doctors");
  const { data: referrers = [] } = useMasterData("referrers");
  const { data: campaigns = [] } = useQuery<any[]>({
    queryKey: ["/api/masters", "campaigns"],
    queryFn: async () => {
      const res = await fetch("/api/masters/campaigns", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });
  const { data: crmUsers = [] } = useQuery<any[]>({
    queryKey: ["/api/crm-users/active"],
    queryFn: async () => {
      const res = await fetch("/api/crm-users/active", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const form = useForm<InsertLead>({
    resolver: zodResolver(insertLeadSchema),
    defaultValues: {
      name: "",
      phoneE164: "",
      email: "",
      status: "Raw Lead Captured",
      tenantId: 1,
      priority: "Normal",
      notes: "",
    },
  });

  const selectedSourceCategoryId = form.watch("leadSourceCategoryId");
  const selectedTreatmentDeptId = form.watch("treatmentDepartmentId");

  const filteredSources = selectedSourceCategoryId
    ? leadSources.filter((s: any) => s.categoryId === selectedSourceCategoryId)
    : leadSources;

  const filteredSubDepts = selectedTreatmentDeptId
    ? treatmentSubDepartments.filter((s: any) => s.treatmentDepartmentId === selectedTreatmentDeptId)
    : treatmentSubDepartments;

  function onSubmit(data: InsertLead) {
    createLead.mutate(data, {
      onSuccess: () => onSuccess(),
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Patient Name *</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Ramesh Modi" {...field} data-testid="input-lead-name" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="phoneE164"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone Number *</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. 9876543210" {...field} data-testid="input-lead-phone" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. patient@email.com" {...field} value={field.value || ""} data-testid="input-lead-email" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="branchId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Branch</FormLabel>
                <FormControl>
                  <SearchableSelect
                    value={field.value ? String(field.value) : ""}
                    onValueChange={(v) => field.onChange(v ? Number(v) : null)}
                    options={branches.map((b: any) => ({ value: String(b.id), label: b.name }))}
                    placeholder="Select branch"
                    data-testid="select-lead-branch"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="leadSourceCategoryId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Lead Source Category</FormLabel>
                <FormControl>
                  <SearchableSelect
                    value={field.value ? String(field.value) : ""}
                    onValueChange={(v) => {
                      field.onChange(v ? Number(v) : null);
                      form.setValue("leadSourceId", null as any);
                    }}
                    options={leadSourceCategories.map((c: any) => ({ value: String(c.id), label: c.name }))}
                    placeholder="Select category"
                    data-testid="select-lead-source-cat"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="leadSourceId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Lead Source</FormLabel>
                <FormControl>
                  <SearchableSelect
                    value={field.value ? String(field.value) : ""}
                    onValueChange={(v) => field.onChange(v ? Number(v) : null)}
                    options={filteredSources.map((s: any) => ({ value: String(s.id), label: s.name }))}
                    placeholder="Select source"
                    data-testid="select-lead-source"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="treatmentDepartmentId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Treatment Department</FormLabel>
                <FormControl>
                  <SearchableSelect
                    value={field.value ? String(field.value) : ""}
                    onValueChange={(v) => {
                      field.onChange(v ? Number(v) : null);
                      form.setValue("treatmentSubDepartmentId", null as any);
                    }}
                    options={treatmentDepartments.map((d: any) => ({ value: String(d.id), label: d.name }))}
                    placeholder="Select department"
                    data-testid="select-lead-treatment-dept"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="treatmentSubDepartmentId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Sub-Department</FormLabel>
                <FormControl>
                  <SearchableSelect
                    value={field.value ? String(field.value) : ""}
                    onValueChange={(v) => field.onChange(v ? Number(v) : null)}
                    options={filteredSubDepts.map((s: any) => ({ value: String(s.id), label: s.name }))}
                    placeholder="Select sub-department"
                    data-testid="select-lead-sub-dept"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="doctorId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Doctor</FormLabel>
                <FormControl>
                  <SearchableSelect
                    value={field.value ? String(field.value) : ""}
                    onValueChange={(v) => field.onChange(v ? Number(v) : null)}
                    options={doctors.map((d: any) => ({ value: String(d.id), label: d.name }))}
                    placeholder="Select doctor"
                    data-testid="select-lead-doctor"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="consultationTypeId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Consultation Type</FormLabel>
                <FormControl>
                  <SearchableSelect
                    value={field.value ? String(field.value) : ""}
                    onValueChange={(v) => field.onChange(v ? Number(v) : null)}
                    options={consultationTypes.map((c: any) => ({ value: String(c.id), label: c.name }))}
                    placeholder="Select type"
                    data-testid="select-lead-consult-type"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="campaignId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Campaign</FormLabel>
                <FormControl>
                  <SearchableSelect
                    value={field.value ? String(field.value) : ""}
                    onValueChange={(v) => field.onChange(v ? Number(v) : null)}
                    options={campaigns.map((c: any) => ({ value: String(c.id), label: c.name }))}
                    placeholder="Select campaign"
                    data-testid="select-lead-campaign"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="priority"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Priority</FormLabel>
                <FormControl>
                  <SearchableSelect
                    value={field.value || "Normal"}
                    onValueChange={(v) => field.onChange(v)}
                    options={[
                      { value: "Low", label: "Low" },
                      { value: "Normal", label: "Normal" },
                      { value: "High", label: "High" },
                      { value: "Urgent", label: "Urgent" },
                    ]}
                    placeholder="Select priority"
                    data-testid="select-lead-priority"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="assignedCrmUserId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Assign To</FormLabel>
                <FormControl>
                  <SearchableSelect
                    value={field.value ? String(field.value) : ""}
                    onValueChange={(v) => field.onChange(v ? Number(v) : null)}
                    options={crmUsers.map((u: any) => ({ value: String(u.id), label: `${u.name} (${u.code})` }))}
                    placeholder="Select counsellor"
                    data-testid="select-lead-assign"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="referrerId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Referrer</FormLabel>
                <FormControl>
                  <SearchableSelect
                    value={field.value ? String(field.value) : ""}
                    onValueChange={(v) => field.onChange(v ? Number(v) : null)}
                    options={referrers.map((r: any) => ({ value: String(r.id), label: r.name }))}
                    placeholder="Select referrer"
                    data-testid="select-lead-referrer"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Any additional notes about this lead..."
                  rows={3}
                  {...field}
                  value={field.value || ""}
                  data-testid="input-lead-notes"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={createLead.isPending} data-testid="button-create-lead">
          {createLead.isPending ? "Creating..." : "Create Lead"}
        </Button>
      </form>
    </Form>
  );
}
