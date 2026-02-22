import { AppLayout } from "@/components/layout/AppLayout";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";
import { useLeads, useCreateLead } from "@/hooks/use-leads";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Filter, FileUp } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertLeadSchema, InsertLead } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useState } from "react";
import { useLocation } from "wouter";

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
                <DialogContent>
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

function CreateLeadForm({ onSuccess }: { onSuccess: () => void }) {
  const createLead = useCreateLead();
  const form = useForm<InsertLead>({
    resolver: zodResolver(insertLeadSchema),
    defaultValues: {
      name: "",
      phoneE164: "",
      email: "",
      status: "Raw Lead Captured",
      tenantId: 1, // Mock
    },
  });

  function onSubmit(data: InsertLead) {
    createLead.mutate(data, {
      onSuccess: () => onSuccess(),
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Patient Name</FormLabel>
              <FormControl>
                <Input placeholder="John Doe" {...field} />
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
              <FormLabel>Phone Number</FormLabel>
              <FormControl>
                <Input placeholder="+1234567890" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email (Optional)</FormLabel>
              <FormControl>
                <Input placeholder="john@example.com" {...field} value={field.value || ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={createLead.isPending}>
          {createLead.isPending ? "Creating..." : "Create Lead"}
        </Button>
      </form>
    </Form>
  );
}
