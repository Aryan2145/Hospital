import { useState, useRef, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useTenantBranding } from "@/hooks/use-tenant-branding";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Loader2, Upload, Image, Palette, Building2, Trash2 } from "lucide-react";

export default function BrandingSettings() {
  const { toast } = useToast();
  const { tenant, isLoading: tenantLoading, refetch } = useTenantBranding();
  const [displayName, setDisplayName] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#005b9f");
  const [secondaryColor, setSecondaryColor] = useState("#f0f7fc");
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (tenant) {
      setDisplayName(tenant.displayName || tenant.name || "");
      setPrimaryColor(tenant.primaryColor || "#005b9f");
      setSecondaryColor(tenant.secondaryColor || "#f0f7fc");
    }
  }, [tenant]);

  const handleSaveBranding = async () => {
    setSaving(true);
    try {
      await apiRequest("PATCH", "/api/tenants/branding", { displayName, primaryColor, secondaryColor });
      await queryClient.invalidateQueries({ queryKey: ["/api/tenants/current"] });
      await refetch();
      toast({ title: "Branding Updated", description: "Your branding settings have been saved." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to save branding", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async (file: File, type: "logo" | "favicon") => {
    const setUploading = type === "logo" ? setUploadingLogo : setUploadingFavicon;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/tenants/branding/logo?type=${type}`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Upload failed");
      }
      await queryClient.invalidateQueries({ queryKey: ["/api/tenants/current"] });
      await refetch();
      toast({ title: "Uploaded", description: `${type === "logo" ? "Logo" : "Favicon"} has been updated.` });
    } catch (err: any) {
      toast({ title: "Upload Failed", description: err.message || "Failed to upload", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  if (tenantLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground" data-testid="text-branding-title">Tenant Branding</h1>
          <p className="text-muted-foreground mt-1">Customize the appearance of your hospital's CRM. Changes will be visible to all users in your organization.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Hospital Identity
            </CardTitle>
            <CardDescription>Set the display name that appears in the sidebar and browser tab for your hospital</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="displayName">Hospital Display Name</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. VIROC Super Speciality Hospital"
                data-testid="input-display-name"
              />
              <p className="text-xs text-muted-foreground">This appears in the sidebar header and browser tab when your staff is logged in</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Image className="w-5 h-5" />
              Logo & Favicon
            </CardTitle>
            <CardDescription>Upload your hospital logo and favicon (tab icon). Recommended: PNG or SVG format.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <Label>Hospital Logo</Label>
                <p className="text-xs text-muted-foreground">Appears in the sidebar. Recommended size: 200x60px</p>
                <div className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center gap-3 bg-muted/30 min-h-[120px]">
                  {tenant?.logoUrl ? (
                    <img src={tenant.logoUrl} alt="Logo" className="max-h-16 max-w-full object-contain" data-testid="img-current-logo" />
                  ) : (
                    <div className="text-muted-foreground text-sm text-center">No logo uploaded</div>
                  )}
                </div>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  ref={logoInputRef}
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], "logo")}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={uploadingLogo}
                  data-testid="button-upload-logo"
                >
                  {uploadingLogo ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                  {tenant?.logoUrl ? "Replace Logo" : "Upload Logo"}
                </Button>
              </div>

              <div className="space-y-3">
                <Label>Favicon (Tab Icon)</Label>
                <p className="text-xs text-muted-foreground">Appears in the browser tab. Recommended: 32x32px PNG or ICO</p>
                <div className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center gap-3 bg-muted/30 min-h-[120px]">
                  {tenant?.faviconUrl ? (
                    <img src={tenant.faviconUrl} alt="Favicon" className="w-8 h-8 object-contain" data-testid="img-current-favicon" />
                  ) : (
                    <div className="text-muted-foreground text-sm text-center">No favicon uploaded</div>
                  )}
                </div>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/x-icon,image/webp"
                  ref={faviconInputRef}
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], "favicon")}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => faviconInputRef.current?.click()}
                  disabled={uploadingFavicon}
                  data-testid="button-upload-favicon"
                >
                  {uploadingFavicon ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                  {tenant?.faviconUrl ? "Replace Favicon" : "Upload Favicon"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="w-5 h-5" />
              Colors
            </CardTitle>
            <CardDescription>Customize the primary and secondary colors for your hospital (optional - for future use)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="primaryColor">Primary Color</Label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    id="primaryColor"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-10 h-10 rounded border cursor-pointer"
                    data-testid="input-primary-color"
                  />
                  <Input
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="flex-1"
                    placeholder="#005b9f"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="secondaryColor">Secondary Color</Label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    id="secondaryColor"
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    className="w-10 h-10 rounded border cursor-pointer"
                    data-testid="input-secondary-color"
                  />
                  <Input
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    className="flex-1"
                    placeholder="#f0f7fc"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button
            onClick={handleSaveBranding}
            disabled={saving}
            className="min-w-[140px]"
            data-testid="button-save-branding"
          >
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Save Changes
          </Button>
        </div>

        <Card className="bg-muted/30 border-dashed">
          <CardContent className="pt-6">
            <h3 className="text-sm font-semibold mb-2">Preview</h3>
            <div className="bg-card rounded-lg border p-4 flex items-center gap-3">
              {tenant?.faviconUrl && (
                <img src={tenant.faviconUrl} alt="Favicon" className="w-5 h-5 object-contain" />
              )}
              <div className="flex items-center gap-2">
                {tenant?.logoUrl ? (
                  <img src={tenant.logoUrl} alt="Logo" className="h-8 object-contain" />
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                    <Building2 className="w-4 h-4 text-white" />
                  </div>
                )}
                <div>
                  <p className="font-bold text-sm" style={{ color: primaryColor }}>{displayName || "Hospital Name"}</p>
                  <p className="text-xs text-muted-foreground">Hospital CRM</p>
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">This is how your branding will appear in the sidebar and browser tab</p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
