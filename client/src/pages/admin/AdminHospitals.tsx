import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Building2, Plus, Ban, CheckCircle, Globe, Phone, Mail, User,
  ExternalLink, Calendar, RefreshCw, FlaskConical, Download, Upload,
  ShieldCheck, Eye, EyeOff, AlertTriangle, FileCheck, Lock,
  Info, ChevronRight, CheckCircle2, CalendarClock, UserCog, UserPlus,
  Unlock, BadgeCheck, XCircle,
} from "lucide-react";

function fmtDate(val: string | null | undefined) {
  if (!val) return "—";
  const d = new Date(val);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

// ─── Passphrase strength checker ──────────────────────────────────────────────
function passphraseStrength(p: string): { score: number; label: string; color: string } {
  if (!p) return { score: 0, label: "", color: "" };
  let score = 0;
  if (p.length >= 12) score++;
  if (p.length >= 16) score++;
  if (/[A-Z]/.test(p)) score++;
  if (/[a-z]/.test(p)) score++;
  if (/[0-9]/.test(p)) score++;
  if (/[^A-Za-z0-9]/.test(p)) score++;
  if (score <= 2) return { score, label: "Weak", color: "bg-red-500" };
  if (score <= 4) return { score, label: "Fair", color: "bg-amber-500" };
  if (score === 5) return { score, label: "Good", color: "bg-blue-500" };
  return { score, label: "Strong", color: "bg-emerald-500" };
}

const PURPOSES = [
  { value: "BACKUP",            label: "Routine Backup" },
  { value: "MIGRATION",         label: "System Migration" },
  { value: "REGULATORY_AUDIT",  label: "Regulatory / Legal Audit" },
  { value: "DISASTER_RECOVERY", label: "Disaster Recovery" },
  { value: "OTHER",             label: "Other" },
];

// ─── Export Dialog ────────────────────────────────────────────────────────────
function ExportDialog({ tenant, onClose }: { tenant: any; onClose: () => void }) {
  const { toast } = useToast();
  const [step, setStep]             = useState<"options" | "passphrase" | "done">("options");
  const [purpose, setPurpose]       = useState("BACKUP");
  const [purposeNote, setPurposeNote] = useState("");
  const [includePhiData, setIncludePhiData] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [showPass, setShowPass]     = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [confirm, setConfirm]       = useState("");
  const [busy, setBusy]             = useState(false);

  const strength = passphraseStrength(passphrase);
  const mismatch = confirm.length > 0 && confirm !== passphrase;
  const canExport =
    passphrase.length >= 12 &&
    passphrase === confirm &&
    /[A-Z]/.test(passphrase) &&
    /[a-z]/.test(passphrase) &&
    /[0-9]/.test(passphrase) &&
    /[^A-Za-z0-9]/.test(passphrase);

  async function doExport() {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/export-tenant/${tenant.tenantId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ passphrase, includePhiData, purpose, purposeNote }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Export failed" }));
        throw new Error(err.message);
      }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      const ts   = new Date().toISOString().slice(0, 10);
      a.download = `hcrmx-${(tenant.displayName || tenant.name || "hospital").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${ts}.hcrmx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStep("done");
      toast({ title: "Export downloaded", description: "Keep this file and passphrase secure." });
    } catch (e: any) {
      toast({ title: "Export failed", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Compliance banner */}
      <div className="flex gap-2.5 bg-blue-50 border border-blue-200 rounded-lg p-3">
        <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div className="text-xs text-blue-800 space-y-0.5">
          <p className="font-semibold">DPDP Act 2023 · IT Act 2000 · CERT-In Guidelines</p>
          <p>Every export is audit-logged with your identity, timestamp, and stated purpose.
            The file is encrypted with AES-256-GCM + PBKDF2-SHA256 (120,000 iterations).
            You are responsible for securing this file and the passphrase.</p>
        </div>
      </div>

      {step === "options" && (
        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium">Export Purpose *</Label>
            <Select value={purpose} onValueChange={setPurpose}>
              <SelectTrigger className="mt-1" data-testid="select-export-purpose">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PURPOSES.map(p => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-slate-400 mt-1">
              Recorded in the audit trail per DPDP Act data processing obligations.
            </p>
          </div>

          {purpose === "OTHER" && (
            <div>
              <Label className="text-sm font-medium">Describe the purpose</Label>
              <Textarea
                value={purposeNote}
                onChange={e => setPurposeNote(e.target.value)}
                className="mt-1 text-sm"
                rows={2}
                placeholder="Briefly describe why you are exporting this data..."
                data-testid="input-purpose-note"
              />
            </div>
          )}

          {/* PHI toggle */}
          <div className={`rounded-lg border p-3 ${includePhiData ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-slate-50"}`}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                {includePhiData
                  ? <AlertTriangle className="w-4 h-4 text-amber-600" />
                  : <Lock className="w-4 h-4 text-slate-400" />}
                <span className="text-sm font-medium text-slate-800">
                  Include patient data (PHI)
                </span>
              </div>
              <Switch
                checked={includePhiData}
                onCheckedChange={setIncludePhiData}
                data-testid="switch-include-phi"
              />
            </div>
            {includePhiData ? (
              <p className="text-xs text-amber-700">
                <strong>Sensitive Personal Data will be included</strong> — names, phones, emails,
                clinical notes, and health history. This file is classified <em>Restricted</em>
                under DPDP Act 2023. Handle with strict confidentiality and destroy securely when
                no longer required.
              </p>
            ) : (
              <p className="text-xs text-slate-500">
                Only operational and master data (roles, stages, campaigns, users) is exported.
                No patient names, phones, clinical data, or health records. <strong>Recommended default.</strong>
              </p>
            )}
          </div>

          <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-600 space-y-1">
            <p className="font-medium text-slate-700">What's always excluded</p>
            <ul className="space-y-0.5 text-slate-500">
              <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-emerald-500" />Password hashes &amp; login credentials</li>
              <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-emerald-500" />SMTP &amp; API secrets</li>
              <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-emerald-500" />Session tokens &amp; authentication keys</li>
              <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-emerald-500" />Audit logs from other tenants</li>
            </ul>
          </div>

          <div className="flex gap-2 pt-1">
            <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
            <Button
              className="flex-1 bg-blue-700 hover:bg-blue-800"
              onClick={() => setStep("passphrase")}
              disabled={purpose === "OTHER" && !purposeNote.trim()}
              data-testid="button-export-next"
            >
              Continue <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {step === "passphrase" && (
        <div className="space-y-4">
          <div className="bg-slate-50 rounded-lg px-3 py-2 text-xs text-slate-600 flex items-center gap-2">
            <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            Choose a strong passphrase. The file cannot be opened without it — even by RGB support.
            Store it separately from the file.
          </div>

          <div>
            <Label className="text-sm font-medium">Encryption Passphrase *</Label>
            <div className="relative mt-1">
              <Input
                type={showPass ? "text" : "password"}
                value={passphrase}
                onChange={e => setPassphrase(e.target.value)}
                placeholder="Min 12 chars · uppercase · lowercase · number · symbol"
                className="pr-10"
                data-testid="input-export-passphrase"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                onClick={() => setShowPass(v => !v)}
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {passphrase && (
              <div className="flex items-center gap-2 mt-1.5">
                <div className="flex gap-0.5 flex-1">
                  {[1,2,3,4,5,6].map(i => (
                    <div key={i} className={`h-1 flex-1 rounded-full ${i <= strength.score ? strength.color : "bg-slate-200"}`} />
                  ))}
                </div>
                <span className={`text-[11px] font-medium ${strength.score <= 2 ? "text-red-600" : strength.score <= 4 ? "text-amber-600" : "text-emerald-600"}`}>
                  {strength.label}
                </span>
              </div>
            )}
          </div>

          <div>
            <Label className="text-sm font-medium">Confirm Passphrase *</Label>
            <div className="relative mt-1">
              <Input
                type={showConfirmPass ? "text" : "password"}
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Re-enter passphrase"
                className={`pr-10 ${mismatch ? "border-red-400" : ""}`}
                data-testid="input-export-confirm"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                onClick={() => setShowConfirmPass(v => !v)}
                tabIndex={-1}
              >
                {showConfirmPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {mismatch && <p className="text-xs text-red-500 mt-1">Passphrases do not match.</p>}
          </div>

          <div className="text-xs text-slate-500 space-y-0.5">
            <p className="font-medium text-slate-700">Requirements (CERT-In compliant)</p>
            {[
              [passphrase.length >= 12,         "At least 12 characters"],
              [/[A-Z]/.test(passphrase),         "One uppercase letter"],
              [/[a-z]/.test(passphrase),         "One lowercase letter"],
              [/[0-9]/.test(passphrase),         "One number"],
              [/[^A-Za-z0-9]/.test(passphrase),  "One special character"],
            ].map(([ok, label]) => (
              <div key={label as string} className="flex items-center gap-1.5">
                <CheckCircle2 className={`w-3 h-3 ${ok ? "text-emerald-500" : "text-slate-300"}`} />
                <span className={ok ? "text-emerald-700" : "text-slate-400"}>{label as string}</span>
              </div>
            ))}
          </div>

          <div className="flex gap-2 pt-1">
            <Button variant="outline" onClick={() => setStep("options")} className="flex-1">Back</Button>
            <Button
              className="flex-1 bg-blue-700 hover:bg-blue-800"
              onClick={doExport}
              disabled={!canExport || busy}
              data-testid="button-export-download"
            >
              {busy ? (
                <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Encrypting…</>
              ) : (
                <><Download className="w-4 h-4 mr-2" />Download Encrypted Export</>
              )}
            </Button>
          </div>
        </div>
      )}

      {step === "done" && (
        <div className="text-center py-4 space-y-3">
          <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
            <FileCheck className="w-6 h-6 text-emerald-600" />
          </div>
          <p className="font-semibold text-slate-800">Export downloaded successfully</p>
          <div className="text-xs text-slate-500 text-left bg-slate-50 rounded-lg p-3 space-y-1">
            <p className="font-medium text-slate-700">Important — your responsibilities</p>
            <p>• Store the <strong>.hcrmx file</strong> and its passphrase in separate, secure locations.</p>
            <p>• Do not email this file unencrypted or share it over unencrypted channels.</p>
            <p>• Destroy the file securely when retention period ends (per your data retention policy).</p>
            {includePhiData && <p className="text-amber-700">• This file contains patient PHI — handle as <strong>Restricted</strong> data per DPDP Act 2023.</p>}
          </div>
          <Button onClick={onClose} className="w-full">Done</Button>
        </div>
      )}
    </div>
  );
}

// ─── Import Dialog ────────────────────────────────────────────────────────────
function ImportDialog({ tenants, onClose }: { tenants: any[]; onClose: () => void }) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile]           = useState<File | null>(null);
  const [passphrase, setPassphrase] = useState("");
  const [showPass, setShowPass]   = useState(false);
  const [targetTenantId, setTargetTenantId] = useState("");
  const [preview, setPreview]     = useState<any | null>(null);
  const [step, setStep]           = useState<"upload" | "preview" | "applying" | "done">("upload");
  const [busy, setBusy]           = useState(false);

  async function doPreview() {
    if (!file || !passphrase) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("passphrase", passphrase);
      const res = await fetch("/api/admin/import-tenant/preview", {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      setPreview(json);
      setStep("preview");
    } catch (e: any) {
      toast({ title: "Preview failed", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  async function doApply() {
    if (!file || !passphrase || !targetTenantId) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("passphrase", passphrase);
      fd.append("targetTenantId", targetTenantId);
      const res = await fetch("/api/admin/import-tenant/apply", {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      setStep("done");
      toast({ title: "Import complete", description: json.message });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
    } catch (e: any) {
      toast({ title: "Import failed", description: e.message, variant: "destructive" });
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2.5 bg-amber-50 border border-amber-200 rounded-lg p-3">
        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-800">
          <p className="font-semibold">Master data restore only</p>
          <p>This tool imports operational data (roles, stages, users, master lists).
            Patient PHI is never imported automatically — it requires a separate controlled process.
            Existing master data for the target hospital will be overwritten.</p>
        </div>
      </div>

      {step === "upload" && (
        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium">HCRMX Export File</Label>
            <div
              className="mt-1 border-2 border-dashed border-slate-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
              onClick={() => fileRef.current?.click()}
              data-testid="dropzone-import-file"
            >
              <Upload className="w-6 h-6 text-slate-400 mx-auto mb-2" />
              {file
                ? <p className="text-sm text-slate-700 font-medium">{file.name}</p>
                : <p className="text-sm text-slate-500">Click to select a <code>.hcrmx</code> file</p>}
              <input
                ref={fileRef}
                type="file"
                accept=".hcrmx,application/json"
                className="hidden"
                onChange={e => setFile(e.target.files?.[0] || null)}
                data-testid="input-import-file"
              />
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium">Decryption Passphrase *</Label>
            <div className="relative mt-1">
              <Input
                type={showPass ? "text" : "password"}
                value={passphrase}
                onChange={e => setPassphrase(e.target.value)}
                placeholder="Passphrase used when the file was exported"
                className="pr-10"
                data-testid="input-import-passphrase"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                onClick={() => setShowPass(v => !v)}
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
            <Button
              className="flex-1 bg-blue-700 hover:bg-blue-800"
              disabled={!file || !passphrase || busy}
              onClick={doPreview}
              data-testid="button-import-preview"
            >
              {busy
                ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Decrypting…</>
                : <><Eye className="w-4 h-4 mr-2" />Decrypt &amp; Preview</>}
            </Button>
          </div>
        </div>
      )}

      {step === "preview" && preview && (
        <div className="space-y-4">
          <div className="bg-slate-50 rounded-lg p-3 space-y-2">
            <p className="text-sm font-semibold text-slate-800">File verified ✓</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600">
              <span className="text-slate-400">Source hospital</span>
              <span>{preview.meta?.tenantName}</span>
              <span className="text-slate-400">Exported</span>
              <span>{fmtDate(preview.meta?.exportedAt)}</span>
              <span className="text-slate-400">Purpose</span>
              <span>{preview.meta?.purpose}</span>
              <span className="text-slate-400">Records</span>
              <span>{preview.totalRecords?.toLocaleString()}</span>
              <span className="text-slate-400">PHI data</span>
              <span className={preview.includesPhiData ? "text-amber-600 font-medium" : "text-emerald-600"}>
                {preview.includesPhiData ? "Yes (not imported)" : "Not included"}
              </span>
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium">Restore into Hospital *</Label>
            <Select value={targetTenantId} onValueChange={setTargetTenantId}>
              <SelectTrigger className="mt-1" data-testid="select-import-target">
                <SelectValue placeholder="Select target hospital…" />
              </SelectTrigger>
              <SelectContent>
                {tenants.map((t: any) => (
                  <SelectItem key={t.tenantId} value={String(t.tenantId)}>
                    {t.displayName || t.tenantName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-red-500 mt-1">
              Warning: existing master data for the selected hospital will be overwritten.
            </p>
          </div>

          <div className="flex gap-2 pt-1">
            <Button variant="outline" onClick={() => setStep("upload")} className="flex-1">Back</Button>
            <Button
              className="flex-1 bg-blue-700 hover:bg-blue-800"
              disabled={!targetTenantId || busy}
              onClick={doApply}
              data-testid="button-import-apply"
            >
              {busy
                ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Importing…</>
                : <>Apply Import</>}
            </Button>
          </div>
        </div>
      )}

      {step === "done" && (
        <div className="text-center py-4 space-y-3">
          <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle className="w-6 h-6 text-emerald-600" />
          </div>
          <p className="font-semibold text-slate-800">Import completed successfully</p>
          <p className="text-xs text-slate-500">Master data has been restored. CRM users have been imported without passwords — they will need to reset their passwords on first login.</p>
          <Button onClick={onClose} className="w-full">Done</Button>
        </div>
      )}
    </div>
  );
}

// ─── Manage Admin Dialog ───────────────────────────────────────────────────────
function ManageAdminDialog({ tenant, onClose }: { tenant: any; onClose: () => void }) {
  const { toast } = useToast();
  const [tab, setTab] = useState<"list" | "create">("list");
  const [form, setForm] = useState({ name: "", phone: "", password: "" });
  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ phone: string; password: string } | null>(null);

  const { data: adminUsers = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ["/api/admin/tenants", tenant.tenantId, "admin-users"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/tenants/${tenant.tenantId}/admin-users`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
  });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/tenants/${tenant.tenantId}/create-admin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      setCreated({ phone: json.phone, password: form.password });
      refetch();
      toast({ title: json.message });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  async function handleUnlock(userId: number) {
    try {
      const res = await fetch(`/api/admin/tenants/${tenant.tenantId}/users/${userId}/unlock`, {
        method: "POST", credentials: "include",
      });
      if (!res.ok) throw new Error("Failed");
      refetch();
      toast({ title: "Account unlocked" });
    } catch {
      toast({ title: "Failed to unlock", variant: "destructive" });
    }
  }

  const isLocked = (u: any) => u.locked_until && new Date(u.locked_until) > new Date();

  return (
    <div className="space-y-4">
      {/* Tab switcher */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
        <button
          className={`flex-1 text-sm py-1.5 rounded-md font-medium transition-colors ${tab === "list" ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"}`}
          onClick={() => { setTab("list"); setCreated(null); }}
          data-testid="tab-admin-list"
        >
          Admin Users ({adminUsers.length})
        </button>
        <button
          className={`flex-1 text-sm py-1.5 rounded-md font-medium transition-colors ${tab === "create" ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"}`}
          onClick={() => { setTab("create"); setCreated(null); }}
          data-testid="tab-admin-create"
        >
          <UserPlus className="w-3.5 h-3.5 inline mr-1" />
          Create / Reset
        </button>
      </div>

      {/* List tab */}
      {tab === "list" && (
        <div>
          {isLoading ? (
            <div className="text-center py-6 text-slate-400 text-sm">Loading…</div>
          ) : adminUsers.length === 0 ? (
            <div className="text-center py-8 space-y-2">
              <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center mx-auto">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <p className="text-sm font-medium text-slate-700">No admin users yet</p>
              <p className="text-xs text-slate-400">Use the "Create / Reset" tab to add the first admin.</p>
              <Button size="sm" className="mt-2" onClick={() => setTab("create")} data-testid="button-goto-create">
                <UserPlus className="w-3.5 h-3.5 mr-1" /> Create First Admin
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {adminUsers.map((u: any) => (
                <div key={u.id} className={`rounded-lg border p-3 flex items-center gap-3 ${!u.is_active ? "opacity-50 bg-slate-50" : isLocked(u) ? "border-red-200 bg-red-50" : "border-slate-200 bg-white"}`} data-testid={`admin-user-row-${u.id}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${!u.is_active ? "bg-slate-200 text-slate-400" : isLocked(u) ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-700"}`}>
                    {u.name?.[0]?.toUpperCase() || "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-800 truncate">{u.name}</span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">{u.role_name}</Badge>
                      {!u.is_active && <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-slate-400">Inactive</Badge>}
                      {isLocked(u) && <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Locked</Badge>}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">{u.phone}</div>
                    {isLocked(u) && (
                      <div className="text-xs text-red-500 mt-0.5">{u.failed_login_attempts} failed attempts</div>
                    )}
                  </div>
                  {isLocked(u) && (
                    <Button size="sm" variant="outline" className="text-emerald-600 border-emerald-200 hover:bg-emerald-50 shrink-0" onClick={() => handleUnlock(u.id)} data-testid={`button-unlock-${u.id}`}>
                      <Unlock className="w-3.5 h-3.5 mr-1" /> Unlock
                    </Button>
                  )}
                  {u.is_active && !isLocked(u) && (
                    <BadgeCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create / Reset tab */}
      {tab === "create" && !created && (
        <form onSubmit={handleCreate} className="space-y-3">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
            Creates a new ADMIN user for <strong>{tenant.displayName || tenant.tenantName}</strong>. If the phone already exists in this tenant, the password and role will be reset.
          </div>
          <div>
            <Label className="text-sm">Full Name *</Label>
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Dr. Aryan Sharma" required className="mt-1" data-testid="input-admin-name" />
          </div>
          <div>
            <Label className="text-sm">Mobile Number *</Label>
            <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="10-digit mobile" required className="mt-1" data-testid="input-admin-phone" />
          </div>
          <div>
            <Label className="text-sm">Password *</Label>
            <div className="relative mt-1">
              <Input
                type={showPass ? "text" : "password"}
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="Min 6 characters"
                required
                minLength={6}
                className="pr-10"
                data-testid="input-admin-password"
              />
              <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" onClick={() => setShowPass(v => !v)}>
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="flex-1 bg-blue-700 hover:bg-blue-800" disabled={busy} data-testid="button-create-admin-submit">
              {busy ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Saving…</> : <><UserPlus className="w-4 h-4 mr-1" />Create Admin</>}
            </Button>
          </div>
        </form>
      )}

      {/* Success state */}
      {tab === "create" && created && (
        <div className="space-y-4">
          <div className="text-center py-2">
            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            </div>
            <p className="font-semibold text-slate-800">Admin user ready</p>
            <p className="text-xs text-slate-400 mt-1">Share these credentials securely.</p>
          </div>
          <div className="bg-slate-50 rounded-lg p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Phone</span>
              <span className="font-mono font-medium">{created.phone}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Password</span>
              <span className="font-mono font-medium">{created.password}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => { setCreated(null); setForm({ name: "", phone: "", password: "" }); }}>Create Another</Button>
            <Button className="flex-1" onClick={() => { setTab("list"); setCreated(null); }} data-testid="button-view-admin-list">View Users</Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function AdminHospitals() {
  const { toast } = useToast();
  const [showAdd, setShowAdd]         = useState(false);
  const [exportTenant, setExportTenant] = useState<any | null>(null);
  const [showImport, setShowImport]   = useState(false);
  const [manageAdminTenant, setManageAdminTenant] = useState<any | null>(null);
  const [form, setForm] = useState({
    name: "", displayName: "",
    contactPerson: "", contactEmail: "", contactPhone: "",
  });

  const { data: stats, isLoading } = useQuery<any>({ queryKey: ["/api/admin/stats"] });

  const createTenant = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/tenants", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tenants/all"] });
      setShowAdd(false);
      setForm({ name: "", displayName: "", contactPerson: "", contactEmail: "", contactPhone: "" });
      toast({ title: "Hospital added successfully" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const suspendTenant = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/admin/tenants/${id}/suspend`, { reason: "Manual suspension by admin" }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] }); toast({ title: "Hospital suspended" }); },
  });

  const activateTenant = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/admin/tenants/${id}/activate`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] }); toast({ title: "Hospital activated" }); },
  });

  const switchTenant = useMutation({
    mutationFn: async (tenantId: number) => {
      const res = await apiRequest("POST", "/api/auth/switch-tenant", { tenantId });
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: `Switched to ${data.tenant?.displayName || data.tenant?.name}` });
      window.location.href = "/";
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const resetDemo = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/seed-demo-tenant", {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "Demo data reset successfully", description: "1,050 leads, 368 episodes & 31 CRM users refreshed." });
    },
    onError: (err: any) => toast({ title: "Demo reset failed", description: err.message, variant: "destructive" }),
  });

  const reseedAppts = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/reseed-demo-appointments", {}),
    onSuccess: (data: any) => {
      toast({ title: "Appointments reseeded", description: data?.message || "290+ appointments created for today + next 10 days." });
    },
    onError: (err: any) => toast({ title: "Reseed failed", description: err.message, variant: "destructive" }),
  });

  if (isLoading) {
    return <AdminLayout><div className="h-full flex items-center justify-center"><LoadingSpinner /></div></AdminLayout>;
  }

  const tenantList = stats?.tenantStats || [];

  return (
    <AdminLayout>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900" data-testid="text-hospitals-title">Hospital Management</h1>
            <p className="text-slate-500 mt-1">Onboard and manage hospitals on the platform</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="text-blue-700 border-blue-200 hover:bg-blue-50"
              onClick={() => setShowImport(true)}
              data-testid="button-import-data"
            >
              <Upload className="w-4 h-4 mr-2" /> Import Data
            </Button>
            <Button
              className="bg-orange-600 hover:bg-orange-700"
              onClick={() => setShowAdd(true)}
              data-testid="button-add-hospital"
            >
              <Plus className="w-4 h-4 mr-2" /> Add Hospital
            </Button>
          </div>
        </div>

        {/* Hospital cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {tenantList.map((t: any) => (
            <Card key={t.tenantId} className="p-5 border border-slate-200 shadow-sm hover:shadow-md transition-shadow" data-testid={`card-hospital-${t.tenantId}`}>
              {t.subdomain === "rgb-demo" && (
                <div className="flex items-center gap-1.5 bg-violet-50 border border-violet-200 rounded-md px-2.5 py-1.5 mb-3">
                  <FlaskConical className="w-3.5 h-3.5 text-violet-600 shrink-0" />
                  <span className="text-xs font-semibold text-violet-700">Demo Hospital</span>
                  <span className="text-xs text-violet-500 ml-1">— for sales demos &amp; testing</span>
                </div>
              )}

              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${t.subdomain === "rgb-demo" ? "bg-violet-50" : "bg-blue-50"}`}>
                    <Building2 className={`w-5 h-5 ${t.subdomain === "rgb-demo" ? "text-violet-600" : "text-blue-600"}`} />
                  </div>
                  <div>
                    <button
                      className="font-semibold text-slate-900 hover:text-blue-600 hover:underline text-left cursor-pointer transition-colors leading-tight"
                      onClick={() => switchTenant.mutate(t.tenantId)}
                      disabled={switchTenant.isPending}
                      data-testid={`link-open-hospital-${t.tenantId}`}
                    >
                      {t.displayName || t.tenantName}
                    </button>
                  </div>
                </div>
                <Badge
                  variant={t.subscriptionStatus === "Active" ? "default" : "destructive"}
                  className={t.subscriptionStatus === "Active" ? "bg-emerald-100 text-emerald-700 border-emerald-200" : ""}
                >
                  {t.subscriptionStatus}
                </Badge>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-3" data-testid={`text-created-${t.tenantId}`}>
                <Calendar className="w-3 h-3 shrink-0" />
                <span>Onboarded {fmtDate(t.createdAt)}</span>
                {t.contactPerson && (
                  <>
                    <span className="text-slate-300">·</span>
                    <User className="w-3 h-3 shrink-0" />
                    <span className="truncate max-w-[120px]">{t.contactPerson}</span>
                  </>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-slate-50 rounded-md p-2 text-center">
                  <div className="text-lg font-bold text-slate-900" data-testid={`stat-users-${t.tenantId}`}>{t.users}</div>
                  <div className="text-[10px] text-slate-500 uppercase font-medium">Users</div>
                </div>
                <div className="bg-slate-50 rounded-md p-2 text-center">
                  <div className="text-lg font-bold text-slate-900" data-testid={`stat-leads-${t.tenantId}`}>{t.leads}</div>
                  <div className="text-[10px] text-slate-500 uppercase font-medium">Leads</div>
                </div>
                <div className="bg-slate-50 rounded-md p-2 text-center">
                  <div className="text-lg font-bold text-slate-900" data-testid={`stat-episodes-${t.tenantId}`}>{t.episodes}</div>
                  <div className="text-[10px] text-slate-500 uppercase font-medium">Episodes</div>
                </div>
              </div>

              {t.subdomain === "rgb-demo" && (
                <div className="mb-2">
                  <Button
                    variant="outline" size="sm"
                    className="w-full text-violet-700 border-violet-300 hover:bg-violet-50 font-medium"
                    onClick={() => {
                      if (window.confirm("Reset all demo data? This will wipe and re-seed 1,050 leads, 368 episodes, and 31 CRM users. Takes ~30 seconds.")) {
                        resetDemo.mutate();
                      }
                    }}
                    disabled={resetDemo.isPending || reseedAppts.isPending}
                    data-testid="button-reset-demo"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${resetDemo.isPending ? "animate-spin" : ""}`} />
                    {resetDemo.isPending ? "Resetting demo data…" : "Reset Demo Data"}
                  </Button>
                  <Button
                    variant="outline" size="sm"
                    className="w-full text-emerald-600 border-emerald-300 hover:bg-emerald-50 font-medium mt-1"
                    onClick={() => reseedAppts.mutate()}
                    disabled={reseedAppts.isPending || resetDemo.isPending}
                    data-testid="button-reseed-appointments"
                  >
                    <CalendarClock className={`w-3.5 h-3.5 mr-1.5 ${reseedAppts.isPending ? "animate-spin" : ""}`} />
                    {reseedAppts.isPending ? "Creating appointments…" : "Fix Today's Appointments"}
                  </Button>
                  <p className="text-[10px] text-violet-400 text-center mt-1">
                    <a href="/demo-login" target="_blank" rel="noopener noreferrer"
                       className="underline hover:text-violet-200 font-medium">
                      Open Demo Login →
                    </a>
                    {" "}· all passwords: <strong>HCRM@RGBTech</strong>
                  </p>
                </div>
              )}

              {/* Manage Admin — warning strip when no users */}
              {t.users === 0 && (
                <button
                  className="w-full mb-2 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 text-xs text-amber-800 hover:bg-amber-100 transition-colors text-left"
                  onClick={() => setManageAdminTenant(t)}
                  data-testid={`button-no-users-warning-${t.tenantId}`}
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span><strong>No admin user yet.</strong> Click to create the first admin.</span>
                </button>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline" size="sm"
                  className="flex-1 text-blue-600 border-blue-200 hover:bg-blue-50"
                  onClick={() => switchTenant.mutate(t.tenantId)}
                  disabled={switchTenant.isPending}
                  data-testid={`button-open-hospital-${t.tenantId}`}
                >
                  <ExternalLink className="w-3.5 h-3.5 mr-1" /> Open
                </Button>

                <Button
                  variant="outline" size="sm"
                  className="flex-1 text-slate-600 border-slate-200 hover:bg-slate-50"
                  onClick={() => setExportTenant(t)}
                  data-testid={`button-export-${t.tenantId}`}
                >
                  <Download className="w-3.5 h-3.5 mr-1" /> Export
                </Button>

                <Button
                  variant="outline" size="sm"
                  className={`flex-1 border ${t.users === 0 ? "text-amber-600 border-amber-300 hover:bg-amber-50" : "text-slate-600 border-slate-200 hover:bg-slate-50"}`}
                  onClick={() => setManageAdminTenant(t)}
                  data-testid={`button-manage-admin-${t.tenantId}`}
                >
                  <UserCog className="w-3.5 h-3.5 mr-1" /> Admin
                </Button>
              </div>

              <div className="flex gap-2 mt-2">
                {t.subscriptionStatus === "Active" ? (
                  <Button
                    variant="outline" size="sm"
                    className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
                    onClick={() => suspendTenant.mutate(t.tenantId)}
                    disabled={suspendTenant.isPending}
                    data-testid={`button-suspend-${t.tenantId}`}
                  >
                    <Ban className="w-3.5 h-3.5 mr-1" /> Suspend
                  </Button>
                ) : (
                  <Button
                    variant="outline" size="sm"
                    className="flex-1 text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                    onClick={() => activateTenant.mutate(t.tenantId)}
                    disabled={activateTenant.isPending}
                    data-testid={`button-activate-${t.tenantId}`}
                  >
                    <CheckCircle className="w-3.5 h-3.5 mr-1" /> Activate
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>

        {tenantList.length === 0 && (
          <div className="text-center py-16 text-slate-400">
            <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg">No hospitals onboarded yet</p>
            <p className="text-sm">Click "Add Hospital" to get started</p>
          </div>
        )}

        {/* Add Hospital Dialog */}
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Onboard New Hospital</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); createTenant.mutate(form); }} className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label>Hospital Name *</Label>
                  <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Apollo Hospital" required data-testid="input-hospital-name" />
                </div>
                <div>
                  <Label>Display Name</Label>
                  <Input value={form.displayName} onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))} placeholder="Short display name" data-testid="input-hospital-display" />
                </div>
                <div className="col-span-2 border-t pt-4">
                  <p className="text-sm font-medium text-slate-700 mb-3">Contact Person</p>
                </div>
                <div>
                  <Label>Name</Label>
                  <Input value={form.contactPerson} onChange={e => setForm(f => ({ ...f, contactPerson: e.target.value }))} placeholder="Contact person name" data-testid="input-contact-person" />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input value={form.contactPhone} onChange={e => setForm(f => ({ ...f, contactPhone: e.target.value }))} placeholder="+91 98765 43210" data-testid="input-contact-phone" />
                </div>
                <div className="col-span-2">
                  <Label>Email</Label>
                  <Input value={form.contactEmail} onChange={e => setForm(f => ({ ...f, contactEmail: e.target.value }))} placeholder="admin@hospital.com" type="email" data-testid="input-contact-email" />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
                <Button type="submit" className="bg-orange-600 hover:bg-orange-700" disabled={createTenant.isPending} data-testid="button-submit-hospital">
                  {createTenant.isPending ? "Adding..." : "Add Hospital"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Export Dialog */}
        <Dialog open={!!exportTenant} onOpenChange={v => { if (!v) setExportTenant(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Download className="w-4 h-4 text-blue-600" />
                Export — {exportTenant?.displayName || exportTenant?.tenantName}
              </DialogTitle>
            </DialogHeader>
            {exportTenant && (
              <ExportDialog tenant={exportTenant} onClose={() => setExportTenant(null)} />
            )}
          </DialogContent>
        </Dialog>

        {/* Import Dialog */}
        <Dialog open={showImport} onOpenChange={setShowImport}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Upload className="w-4 h-4 text-blue-600" />
                Import Hospital Data
              </DialogTitle>
            </DialogHeader>
            <ImportDialog tenants={tenantList} onClose={() => setShowImport(false)} />
          </DialogContent>
        </Dialog>

        {/* Manage Admin Dialog */}
        <Dialog open={!!manageAdminTenant} onOpenChange={v => { if (!v) setManageAdminTenant(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserCog className="w-4 h-4 text-blue-600" />
                Admin Users — {manageAdminTenant?.displayName || manageAdminTenant?.tenantName}
              </DialogTitle>
            </DialogHeader>
            {manageAdminTenant && (
              <ManageAdminDialog tenant={manageAdminTenant} onClose={() => setManageAdminTenant(null)} />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
