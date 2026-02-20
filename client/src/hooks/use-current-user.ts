import { useQuery } from "@tanstack/react-query";

export interface CrmUserProfile {
  id: number;
  tenantId: number;
  userId: string | null;
  code: string;
  name: string;
  email: string | null;
  phone: string | null;
  branchId: number | null;
  departmentId: number | null;
  designationId: number | null;
  systemRoleId: number | null;
  accessScopeType: string;
  phiAccessLevel: string;
  isActive: boolean;
  roleName: string | null;
  roleCode: string | null;
}

export interface MeResponse {
  status: "active" | "unregistered";
  crmUser?: CrmUserProfile;
  authUserId?: string;
  authEmail?: string;
}

export function useCurrentUser() {
  const { data, isLoading, error } = useQuery<MeResponse>({
    queryKey: ["/api/me"],
    retry: false,
    staleTime: 1000 * 60 * 5,
  });

  const isRegistered = data?.status === "active";
  const crmUser = data?.crmUser ?? null;
  const roleCode = crmUser?.roleCode ?? null;

  const canViewPage = (page: string): boolean => {
    if (!isRegistered || !roleCode) return false;

    switch (roleCode) {
      case "ADMIN":
        return true;
      case "MANAGER":
        return ["dashboard", "leads", "appointments", "campaigns", "transactions", "connectors", "team", "testing"].includes(page);
      case "AGENT":
      case "COUNSELLOR":
        return ["dashboard", "leads", "appointments", "transactions", "testing"].includes(page);
      default:
        return false;
    }
  };

  const isAdmin = roleCode === "ADMIN";
  const isManager = roleCode === "MANAGER";

  return {
    meData: data,
    isLoading,
    error,
    isRegistered,
    crmUser,
    roleCode,
    roleName: crmUser?.roleName ?? null,
    isAdmin,
    isManager,
    canViewPage,
  };
}
