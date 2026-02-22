import { useEffect } from "react";
import { useTenantBranding } from "@/hooks/use-tenant-branding";

export function DynamicFavicon() {
  const { tenant, faviconUrl } = useTenantBranding();

  useEffect(() => {
    if (tenant && faviconUrl) {
      let link = document.querySelector("link[rel='icon']") as HTMLLinkElement;
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
      }
      link.href = faviconUrl;
      link.type = faviconUrl.startsWith("data:image/svg") ? "image/svg+xml" : "image/png";
    }
  }, [tenant, faviconUrl]);

  useEffect(() => {
    if (tenant?.displayName) {
      document.title = `${tenant.displayName} - Hospital CRM`;
    } else if (tenant?.name) {
      document.title = `${tenant.name} - Hospital CRM`;
    }
  }, [tenant]);

  return null;
}
