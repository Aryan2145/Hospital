import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  UserCheck, Plus, Search, Phone, Mail, Pencil, Trash2,
  MessageSquare, Users, ChevronRight, X,
} from "lucide-react";

const RELATIONSHIP_OPTIONS = [
  "Self", "Spouse", "Parent", "Child", "Sibling", "Guardian",
  "Friend", "Colleague", "Caregiver", "Power of Attorney", "Other"
];

const GENDER_OPTIONS = ["Male", "Female", "Other", "Prefer not to say"];

const EMPTY_FORM = {
  name: "", phoneE164: "", whatsappNumber: "", email: "",
  gender: "", relationship: "", notes: "", status: "Active",
};

export default function ContactDirectoryPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editingPerson, setEditingPerson] = useState<any>(null);
  const [formData, setFormData] = useState({ ...EMPTY_FORM });
  const [selectedPerson, setSelectedPerson] = useState<any>(null);

  const { data: persons = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/contact-persons", search],
    queryFn: async () => {
      const url = search ? `/api/contact-persons?search=${encodeURIComponent(search)}` : "/api/contact-persons";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/contact-persons", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contact-persons"] });
      toast({ title: "Contact person created" });
      setShowAdd(false);
      setFormData({ ...EMPTY_FORM });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PATCH", `/api/contact-persons/${editingPerson.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contact-persons"] });
      toast({ title: "Contact person updated" });
      setEditingPerson(null);
      setFormData({ ...EMPTY_FORM });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/contact-persons/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contact-persons"] });
      toast({ title: "Contact person deleted" });
      if (selectedPerson?.id === deleteMutation.variables) setSelectedPerson(null);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const startEdit = (person: any) => {
    setEditingPerson(person);
    setFormData({
      name: person.name || "",
      phoneE164: person.phoneE164 || "",
      whatsappNumber: person.whatsappNumber || "",
      email: person.email || "",
      gender: person.gender || "",
      relationship: person.relationship || "",
      notes: person.notes || "",
      status: person.status || "Active",
    });
    setShowAdd(true);
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    const payload = {
      name: formData.name,
      phoneE164: formData.phoneE164 || null,
      whatsappNumber: formData.whatsappNumber || null,
      email: formData.email || null,
      gender: formData.gender || null,
      relationship: formData.relationship || null,
      notes: formData.notes || null,
      status: formData.status,
    };
    if (editingPerson) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  const cancelForm = () => {
    setShowAdd(false);
    setEditingPerson(null);
    setFormData({ ...EMPTY_FORM });
  };

  const filtered = persons.filter(p => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.name?.toLowerCase().includes(q) ||
      p.phoneE164?.includes(q) ||
      p.email?.toLowerCase().includes(q)
    );
  });

  return (
    <AppLayout>
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-background">
          <div className="flex items-center gap-3">
            <UserCheck className="w-5 h-5 text-primary" />
            <div>
              <h1 className="text-lg font-semibold text-foreground">Contact Directory</h1>
              <p className="text-xs text-muted-foreground">Manage contact persons linked to leads and patients</p>
            </div>
          </div>
          <Button onClick={() => { setEditingPerson(null); setFormData({ ...EMPTY_FORM }); setShowAdd(true); }}
            className="gap-2" data-testid="button-new-contact-person">
            <Plus className="w-4 h-4" /> New Contact Person
          </Button>
        </div>

        <div className="flex flex-1 min-h-0">
          <div className="w-80 border-r border-border flex flex-col">
            <div className="p-3 border-b border-border">
              <div className="relative">
                <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search by name, phone, email..."
                  className="pl-8 h-8 text-sm"
                  data-testid="input-contact-search"
                />
                {search && (
                  <button onClick={() => setSearch("")} className="absolute right-2 top-2 text-muted-foreground hover:text-foreground">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1.5">{filtered.length} contact{filtered.length !== 1 ? "s" : ""}</p>
            </div>

            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="p-4 text-sm text-muted-foreground">Loading...</div>
              ) : filtered.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground text-center">
                  <UserCheck className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  {search ? "No contacts found" : "No contact persons yet"}
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {filtered.map((p: any) => (
                    <button
                      key={p.id}
                      className={`w-full text-left px-3 py-2.5 hover:bg-accent/50 transition-colors ${selectedPerson?.id === p.id ? "bg-primary/10 border-l-2 border-primary" : ""}`}
                      onClick={() => setSelectedPerson(p)}
                      data-testid={`item-contact-person-${p.id}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-foreground truncate">{p.name}</span>
                        {p.status !== "Active" && (
                          <Badge variant="outline" className="text-[9px] ml-1 shrink-0">{p.status}</Badge>
                        )}
                      </div>
                      {p.phoneE164 && (
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Phone className="w-2.5 h-2.5" /> {p.phoneE164}
                        </p>
                      )}
                      {p.relationship && (
                        <Badge variant="outline" className="text-[9px] mt-1">{p.relationship}</Badge>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {showAdd ? (
              <Card className="max-w-lg p-5">
                <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-primary" />
                  {editingPerson ? "Edit Contact Person" : "New Contact Person"}
                </h2>
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Full Name *</Label>
                    <Input value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                      placeholder="Full name" className="mt-1" data-testid="input-cp-form-name" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Phone</Label>
                      <Input value={formData.phoneE164} onChange={e => setFormData(p => ({ ...p, phoneE164: e.target.value }))}
                        placeholder="+91..." className="mt-1" data-testid="input-cp-form-phone" />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">WhatsApp</Label>
                      <Input value={formData.whatsappNumber} onChange={e => setFormData(p => ({ ...p, whatsappNumber: e.target.value }))}
                        placeholder="+91..." className="mt-1" data-testid="input-cp-form-whatsapp" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Email</Label>
                    <Input value={formData.email} onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
                      placeholder="email@example.com" type="email" className="mt-1" data-testid="input-cp-form-email" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Gender</Label>
                      <Select value={formData.gender} onValueChange={v => setFormData(p => ({ ...p, gender: v }))}>
                        <SelectTrigger className="mt-1" data-testid="select-cp-form-gender">
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                          {GENDER_OPTIONS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Relationship</Label>
                      <Select value={formData.relationship} onValueChange={v => setFormData(p => ({ ...p, relationship: v }))}>
                        <SelectTrigger className="mt-1" data-testid="select-cp-form-relationship">
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                          {RELATIONSHIP_OPTIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Notes</Label>
                    <Textarea value={formData.notes} onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))}
                      placeholder="Optional notes about this contact person" className="mt-1 min-h-[70px]"
                      data-testid="textarea-cp-form-notes" />
                  </div>
                  {editingPerson && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Status</Label>
                      <Select value={formData.status} onValueChange={v => setFormData(p => ({ ...p, status: v }))}>
                        <SelectTrigger className="mt-1" data-testid="select-cp-form-status">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Active">Active</SelectItem>
                          <SelectItem value="Inactive">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="flex gap-2 pt-1">
                    <Button onClick={handleSubmit} className="flex-1"
                      disabled={createMutation.isPending || updateMutation.isPending}
                      data-testid="button-save-cp-form">
                      {editingPerson ? "Save Changes" : "Create Contact Person"}
                    </Button>
                    <Button variant="outline" onClick={cancelForm} data-testid="button-cancel-cp-form">
                      Cancel
                    </Button>
                  </div>
                </div>
              </Card>
            ) : selectedPerson ? (
              <ContactPersonDetail
                person={selectedPerson}
                onEdit={() => startEdit(selectedPerson)}
                onDelete={() => {
                  if (confirm(`Delete ${selectedPerson.name}?`)) {
                    deleteMutation.mutate(selectedPerson.id);
                  }
                }}
                deleting={deleteMutation.isPending}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center py-20">
                <UserCheck className="w-12 h-12 text-muted-foreground/30 mb-3" />
                <h3 className="text-sm font-medium text-muted-foreground">Select a contact person to view details</h3>
                <p className="text-xs text-muted-foreground mt-1">or create a new one</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function ContactPersonDetail({ person, onEdit, onDelete, deleting }: {
  person: any;
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  const { data: linkedLeads = [] } = useQuery<any[]>({
    queryKey: ["/api/contact-persons", person.id, "leads"],
    queryFn: async () => {
      const res = await fetch(`/api/contact-persons/${person.id}/leads`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const infoRow = (label: string, value: any, icon?: any) => {
    if (!value) return null;
    const Icon = icon;
    return (
      <div className="flex flex-col">
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
        <span className="text-sm text-foreground flex items-center gap-1.5">
          {Icon && <Icon className="w-3.5 h-3.5 text-muted-foreground" />}
          {value}
        </span>
      </div>
    );
  };

  return (
    <div className="max-w-2xl">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">{person.name}</h2>
          {person.relationship && (
            <Badge variant="outline" className="mt-1">{person.relationship}</Badge>
          )}
          {person.status !== "Active" && (
            <Badge variant="outline" className="mt-1 ml-1 text-muted-foreground">{person.status}</Badge>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onEdit} className="gap-2" data-testid="button-edit-person-detail">
            <Pencil className="w-3.5 h-3.5" /> Edit
          </Button>
          <Button variant="outline" size="sm" onClick={onDelete} disabled={deleting}
            className="gap-2 text-destructive border-destructive/30 hover:bg-destructive/10"
            data-testid="button-delete-person-detail">
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </Button>
        </div>
      </div>

      <Card className="p-4 mb-4">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Contact Details</h3>
        <div className="grid grid-cols-2 gap-3">
          {infoRow("Phone", person.phoneE164, Phone)}
          {infoRow("WhatsApp", person.whatsappNumber, MessageSquare)}
          {infoRow("Email", person.email, Mail)}
          {infoRow("Gender", person.gender)}
        </div>
        {person.notes && (
          <div className="mt-3 pt-3 border-t border-border">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Notes</span>
            <p className="text-sm text-foreground mt-0.5">{person.notes}</p>
          </div>
        )}
      </Card>

      {linkedLeads.length > 0 && (
        <Card className="p-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
            <Users className="w-3.5 h-3.5" /> Linked Leads ({linkedLeads.length})
          </h3>
          <div className="space-y-2">
            {linkedLeads.map((link: any) => (
              <div key={link.id} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                <div>
                  <p className="text-sm font-medium text-foreground">{link.leadName || `Lead #${link.leadId}`}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {link.relationship && <Badge variant="outline" className="text-[9px]">{link.relationship}</Badge>}
                    {link.isPrimary && <Badge className="text-[9px] bg-primary/10 text-primary border-primary/20">Primary</Badge>}
                    {link.isEmergencyContact && <Badge className="text-[9px] bg-red-50 text-red-700 border-red-200">Emergency</Badge>}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
