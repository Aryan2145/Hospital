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
  systemRoleId: number | null;
  accessScopeType: string;
  phiAccessLevel: string;
  isActive: boolean;
  roleName: string | null;
  roleCode: string | null;
}

export interface MeResponse {
  status: "active" | "unregistered";
  tenantSubscriptionStatus?: string;
  crmUser?: CrmUserProfile;
  authUserId?: string;
  authEmail?: string;
}

export interface ModulePermissions {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
}

export interface MyPermissionsResponse {
  roleCode: string;
  permissions: Record<string, ModulePermissions>;
}

export function useMyPermissions() {
  return useQuery<MyPermissionsResponse>({
    queryKey: ["/api/my-permissions"],
    retry: false,
    staleTime: 1000 * 60 * 5,
  });
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

    // Support pages are visible to all registered users
    if (page === "support") return true;

    // SYS_ADMIN sees everything
    if (roleCode === "SYS_ADMIN") return true;

    switch (roleCode) {
      case "ADMIN":
        return [
          "dashboard", "leads", "episodes", "appointments", "campaigns",
          "transactions", "team", "masters", "connectors", "branding",
          "email-settings", "whatsapp-settings", "settings", "quotation",
          "insurance", "reports", "access-control",
        ].includes(page);

      case "MANAGER":
        return [
          "dashboard", "leads", "episodes", "appointments", "campaigns",
          "transactions", "team", "quotation", "insurance", "reports",
        ].includes(page);

      case "COUNSELLOR":
        return [
          "dashboard", "leads", "episodes", "appointments",
          "transactions", "quotation", "insurance", "reports",
        ].includes(page);

      case "PATIENT_COORDINATOR":
        return [
          "dashboard", "leads", "episodes", "appointments",
          "transactions", "reports",
        ].includes(page);

      case "TELECALLER":
        return [
          "dashboard", "leads", "appointments",
        ].includes(page);

      case "RECEPTIONIST":
        return [
          "dashboard", "leads", "appointments",
        ].includes(page);

      case "BILLING":
        return [
          "dashboard", "episodes", "transactions", "quotation", "reports",
        ].includes(page);

      case "INSURANCE_DESK":
        return [
          "dashboard", "episodes", "insurance", "quotation",
        ].includes(page);

      case "DOCTOR":
        return [
          "dashboard", "episodes", "appointments", "reports",
        ].includes(page);

      case "MEDICAL_ASSISTANT":
        return [
          "dashboard", "episodes", "appointments", "reports",
        ].includes(page);

      case "MIS_VIEWER":
        return [
          "dashboard", "campaigns", "reports",
        ].includes(page);

      case "MARKETING":
        return [
          "dashboard", "campaigns", "reports",
        ].includes(page);

      default:
        return false;
    }
  };

  const isSysAdmin = roleCode === "SYS_ADMIN";
  const isAdmin = roleCode === "ADMIN" || roleCode === "SYS_ADMIN";
  const isManager = roleCode === "MANAGER";
  const isClinical = roleCode === "DOCTOR" || roleCode === "MEDICAL_ASSISTANT";
  const isBilling = roleCode === "BILLING";
  const isInsurance = roleCode === "INSURANCE_DESK";
  const isMisViewer = roleCode === "MIS_VIEWER";
  const tenantSuspended = data?.tenantSubscriptionStatus === "Suspended";

  // Role-specific home page — where the user lands after login
  const getDefaultHomePage = (): string => {
    switch (roleCode) {
      case "DOCTOR":
      case "MEDICAL_ASSISTANT":
      case "RECEPTIONIST":
        return "/appointments";
      case "TELECALLER":
        return "/leads";
      case "BILLING":
      case "INSURANCE_DESK":
        return "/transactions";
      case "MIS_VIEWER":
        return "/dashboard";
      case "MARKETING":
        return "/campaigns";
      default:
        return "/";
    }
  };

  // Tab names: clinical, financial, insurance, family
  const canViewEpisodeTab = (tab: string): boolean => {
    if (!roleCode) return false;
    // Full access roles
    if (["SYS_ADMIN", "ADMIN", "MANAGER", "COUNSELLOR"].includes(roleCode)) return true;

    switch (roleCode) {
      case "PATIENT_COORDINATOR":
        // Can see clinical and family but NOT financial or insurance
        return ["clinical", "family"].includes(tab);
      case "BILLING":
        // Billing focuses on financial tab + basic clinical
        return ["clinical", "financial"].includes(tab);
      case "INSURANCE_DESK":
        // Insurance desk sees insurance + limited financial (read-only quotation)
        return ["clinical", "financial", "insurance"].includes(tab);
      case "DOCTOR":
      case "MEDICAL_ASSISTANT":
        // Clinical staff see clinical + family, not financial/insurance
        return ["clinical", "family"].includes(tab);
      case "TELECALLER":
      case "RECEPTIONIST":
        // Very limited — only the clinical overview
        return tab === "clinical";
      case "MIS_VIEWER":
      case "MARKETING":
        return false;
      default:
        return false;
    }
  };

  return {
    meData: data,
    isLoading,
    error,
    isRegistered,
    crmUser,
    roleCode,
    roleName: crmUser?.roleName ?? null,
    isSysAdmin,
    isAdmin,
    isManager,
    isClinical,
    isBilling,
    isInsurance,
    isMisViewer,
    tenantSuspended,
    canViewPage,
    canViewEpisodeTab,
    getDefaultHomePage,
  };
}
