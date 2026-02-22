import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Building2, Plus, Globe, Palette } from "lucide-react";

export default function TenantManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: "", subdomain: "", displayName: "", primaryColor: "#005b9f", secondaryColor: "#f0f7fc" });

  const { data: tenantsList, isLoading } = useQuery({
    queryKey: ["/api/tenants/all"],
    queryFn: async () => {
      const res = await fetch("/api/tenants/all", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch tenants");
      return res.json();
    },
  });

  const createTenant = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await fetch("/api/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to create hospital");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenants/all"] });
      toast({ title: "Hospital created successfully" });
      setDialogOpen(false);
      setForm({ name: "", subdomain: "", displayName: "", primaryColor: "#005b9f", secondaryColor: "#f0f7fc" });
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  return (
    <AppLayout>
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-foreground" data-testid="text-tenant-title">Hospital / Tenant Management</h1>
            <p className="text-sm text-muted-foreground">Onboard and manage hospital tenants on the platform</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-hospital">
                <Plus className="w-4 h-4 mr-2" />
                Add Hospital
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Onboard New Hospital</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div>
                  <label className="text-sm font-medium">Hospital Name *</label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. City General Hospital"
                    data-testid="input-hospital-name"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Subdomain *</label>
                  <Input
                    value={form.subdomain}
                    onChange={(e) => setForm({ ...form, subdomain: e.target.value })}
                    placeholder="e.g. city-general"
                    data-testid="input-hospital-subdomain"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Used for URL: {form.subdomain || "example"}.myprosys.com</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Display Name</label>
                  <Input
                    value={form.displayName}
                    onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                    placeholder="e.g. City General CRM"
                    data-testid="input-hospital-display-name"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium">Primary Color</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={form.primaryColor} onChange={(e) => setForm({ ...form, primaryColor: e.target.value })} className="w-8 h-8 rounded cursor-pointer" />
                      <Input value={form.primaryColor} onChange={(e) => setForm({ ...form, primaryColor: e.target.value })} className="text-xs" data-testid="input-primary-color" />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Secondary Color</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={form.secondaryColor} onChange={(e) => setForm({ ...form, secondaryColor: e.target.value })} className="w-8 h-8 rounded cursor-pointer" />
                      <Input value={form.secondaryColor} onChange={(e) => setForm({ ...form, secondaryColor: e.target.value })} className="text-xs" data-testid="input-secondary-color" />
                    </div>
                  </div>
                </div>
                <Button
                  className="w-full"
                  onClick={() => createTenant.mutate(form)}
                  disabled={!form.name || !form.subdomain || createTenant.isPending}
                  data-testid="button-create-hospital"
                >
                  {createTenant.isPending ? "Creating..." : "Create Hospital"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading hospitals...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tenantsList?.map((tenant: any) => (
              <Card key={tenant.id} className="p-4" data-testid={`card-tenant-${tenant.id}`}>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white shrink-0" style={{ backgroundColor: tenant.primaryColor || "#005b9f" }}>
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground truncate">{tenant.name}</h3>
                    <p className="text-xs text-muted-foreground">{tenant.displayName || tenant.name}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline" className="text-[10px] flex items-center gap-1">
                        <Globe className="w-2.5 h-2.5" />
                        {tenant.subdomain}
                      </Badge>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded-full border" style={{ backgroundColor: tenant.primaryColor || "#005b9f" }} />
                        <div className="w-3 h-3 rounded-full border" style={{ backgroundColor: tenant.secondaryColor || "#f0f7fc" }} />
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">ID: {tenant.id}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
