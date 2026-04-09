import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, ExternalLink, Trash2, Pencil, Image, Film, FileText,
  Globe, ClipboardList, Link2, Video,
} from "lucide-react";

type ResourceLink = {
  id: number;
  tenantId: number;
  entityType: string;
  entityId: number;
  linkType: string;
  label: string | null;
  url: string;
  createdAt: string | null;
};

const LINK_TYPES = [
  { value: "Poster", label: "Poster", icon: Image },
  { value: "Reel", label: "Reel", icon: Film },
  { value: "Video", label: "Video", icon: Video },
  { value: "Landing Page", label: "Landing Page", icon: Globe },
  { value: "Registration Form", label: "Registration Form", icon: ClipboardList },
  { value: "Creative", label: "Creative / Design", icon: FileText },
  { value: "Other", label: "Other", icon: Link2 },
];

function getLinkIcon(linkType: string) {
  const found = LINK_TYPES.find(t => t.value === linkType);
  const Icon = found?.icon || Link2;
  return <Icon className="h-4 w-4" />;
}

function getLinkColor(linkType: string) {
  switch (linkType) {
    case "Poster": return "bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-950/30 dark:text-pink-300";
    case "Reel": return "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-300";
    case "Video": return "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300";
    case "Landing Page": return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300";
    case "Registration Form": return "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-300";
    case "Creative": return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300";
    default: return "bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-950/30 dark:text-gray-300";
  }
}

interface ResourceLinksSectionProps {
  entityType: "campaign" | "event";
  entityId: number;
  compact?: boolean;
}

export function ResourceLinksSection({ entityType, entityId, compact }: ResourceLinksSectionProps) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ResourceLink | null>(null);
  const [formLinkType, setFormLinkType] = useState("Poster");
  const [formLabel, setFormLabel] = useState("");
  const [formUrl, setFormUrl] = useState("");

  const { data: links = [], isLoading } = useQuery<ResourceLink[]>({
    queryKey: ["/api/resource-links", entityType, entityId],
    queryFn: async () => {
      const res = await fetch(`/api/resource-links/${entityType}/${entityId}`, { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    enabled: !!entityId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/resource-links", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/resource-links", entityType, entityId] });
      toast({ title: "Resource link added" });
      closeDialog();
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PATCH", `/api/resource-links/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/resource-links", entityType, entityId] });
      toast({ title: "Resource link updated" });
      closeDialog();
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/resource-links/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/resource-links", entityType, entityId] });
      toast({ title: "Resource link removed" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  function openAdd() {
    setEditing(null);
    setFormLinkType("Poster");
    setFormLabel("");
    setFormUrl("");
    setDialogOpen(true);
  }

  function openEdit(link: ResourceLink) {
    setEditing(link);
    setFormLinkType(link.linkType);
    setFormLabel(link.label || "");
    setFormUrl(link.url);
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditing(null);
  }

  function handleSave() {
    if (!formUrl.trim()) {
      toast({ title: "URL is required", variant: "destructive" });
      return;
    }
    if (editing) {
      updateMutation.mutate({ id: editing.id, data: { linkType: formLinkType, label: formLabel || null, url: formUrl } });
    } else {
      createMutation.mutate({ entityType, entityId, linkType: formLinkType, label: formLabel || null, url: formUrl });
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div data-testid={`resource-links-${entityType}-${entityId}`}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          <Link2 className="h-3.5 w-3.5" />
          Resource Links
          {links.length > 0 && <Badge variant="secondary" className="text-[10px] ml-1">{links.length}</Badge>}
        </p>
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={openAdd} data-testid={`button-add-link-${entityType}-${entityId}`}>
          <Plus className="h-3 w-3 mr-1" />
          Add
        </Button>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading...</p>
      ) : links.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">No resource links added yet.</p>
      ) : (
        <div className={compact ? "flex flex-wrap gap-1.5" : "space-y-1.5"}>
          {links.map((link) => (
            compact ? (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${getLinkColor(link.linkType)} hover:opacity-80 transition-opacity`}
                data-testid={`link-chip-${link.id}`}
              >
                {getLinkIcon(link.linkType)}
                <span>{link.label || link.linkType}</span>
                <ExternalLink className="h-3 w-3 opacity-60" />
              </a>
            ) : (
              <div
                key={link.id}
                className="flex items-center gap-2 group rounded-lg border px-3 py-2 hover:bg-muted/30 transition-colors"
                data-testid={`link-row-${link.id}`}
              >
                <div className={`flex items-center justify-center w-7 h-7 rounded-md ${getLinkColor(link.linkType)}`}>
                  {getLinkIcon(link.linkType)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium truncate">{link.label || link.linkType}</span>
                    <Badge variant="outline" className="text-[10px]">{link.linkType}</Badge>
                  </div>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline truncate block max-w-md"
                    data-testid={`link-url-${link.id}`}
                  >
                    {link.url}
                  </a>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { try { const u = new URL(link.url); if (u.protocol === "https:" || u.protocol === "http:") window.open(link.url, "_blank", "noopener,noreferrer"); } catch {} }} data-testid={`button-open-link-${link.id}`}>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(link)} data-testid={`button-edit-link-${link.id}`}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => { if (confirm("Remove this resource link?")) deleteMutation.mutate(link.id); }}
                    data-testid={`button-delete-link-${link.id}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="max-w-md" aria-describedby="resource-link-dialog-desc">
          <DialogHeader>
            <DialogTitle data-testid="text-link-dialog-title">
              {editing ? "Edit Resource Link" : "Add Resource Link"}
            </DialogTitle>
            <p id="resource-link-dialog-desc" className="text-sm text-muted-foreground">
              Add a Google Drive or external URL for campaign/event creatives
            </p>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Link Type</Label>
              <Select value={formLinkType} onValueChange={setFormLinkType}>
                <SelectTrigger data-testid="select-link-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LINK_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Label (optional)</Label>
              <Input
                value={formLabel}
                onChange={(e) => setFormLabel(e.target.value)}
                placeholder="e.g. Main Campaign Poster v2"
                data-testid="input-link-label"
              />
            </div>
            <div>
              <Label>URL *</Label>
              <Input
                value={formUrl}
                onChange={(e) => setFormUrl(e.target.value)}
                placeholder="https://drive.google.com/file/d/..."
                data-testid="input-link-url"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} data-testid="button-cancel-link">Cancel</Button>
            <Button onClick={handleSave} disabled={isPending} data-testid="button-save-link">
              {isPending ? "Saving..." : editing ? "Update" : "Add Link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
