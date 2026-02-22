import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./use-auth";

export interface TenantBranding {
  id: number;
  name: string;
  subdomain: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  displayName: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  createdAt: string | null;
}

export function useTenantBranding() {
  const { isAuthenticated } = useAuth();

  const { data: tenant, isLoading, refetch } = useQuery<TenantBranding>({
    queryKey: ["/api/tenants/current"],
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
  });

  return {
    tenant,
    isLoading,
    refetch,
    displayName: tenant?.displayName || tenant?.name || "Hospital",
    logoUrl: tenant?.logoUrl || null,
    faviconUrl: tenant?.faviconUrl || null,
    primaryColor: tenant?.primaryColor || "#005b9f",
  };
}
