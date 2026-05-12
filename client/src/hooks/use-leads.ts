import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { type InsertLead, type InsertActivity, type InsertTask, type CrmUser, type Episode } from "@shared/schema";

export function useLeads(status?: string, search?: string) {
  return useQuery({
    queryKey: [api.leads.list.path, status, search],
    queryFn: async () => {
      const url = status || search 
        ? `${api.leads.list.path}?${new URLSearchParams({ ...(status && { status }), ...(search && { search }) })}`
        : api.leads.list.path;
      
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch leads");
      return api.leads.list.responses[200].parse(await res.json());
    },
  });
}

export function useLead(id: number) {
  return useQuery({
    queryKey: [api.leads.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.leads.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch lead");
      return api.leads.get.responses[200].parse(await res.json());
    },
    enabled: !!id,
  });
}

export function useCreateLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (lead: InsertLead) => {
      const res = await fetch(api.leads.create.path, {
        method: api.leads.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lead),
        credentials: "include",
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 200 && (body as any).requiresAcknowledgement) {
        const err = new Error("Duplicate leads found — acknowledgement required") as any;
        err.requiresAcknowledgement = true;
        err.existingLeads = (body as any).existingLeads ?? [];
        throw err;
      }
      if (!res.ok) {
        throw new Error((body as any).message || "Failed to create lead");
      }
      return api.leads.create.responses[201].parse(body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.leads.list.path] });
    },
  });
}

export function useUpdateLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: number } & Partial<InsertLead>) => {
      const url = buildUrl(api.leads.update.path, { id });
      const res = await fetch(url, {
        method: api.leads.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update lead");
      return api.leads.update.responses[200].parse(await res.json());
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [api.leads.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.leads.get.path, variables.id] });
    },
  });
}

// Activities Hooks
export function useLeadActivities(leadId: number) {
  return useQuery({
    queryKey: [api.activities.list.path, leadId],
    queryFn: async () => {
      const url = buildUrl(api.activities.list.path, { leadId });
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch activities");
      return api.activities.list.responses[200].parse(await res.json());
    },
    enabled: !!leadId,
  });
}

export function useCreateActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ leadId, data }: { leadId: number, data: InsertActivity }) => {
      const url = buildUrl(api.activities.create.path, { leadId });
      const res = await fetch(url, {
        method: api.activities.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create activity");
      return api.activities.create.responses[201].parse(await res.json());
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [api.activities.list.path, variables.leadId] });
    },
  });
}

// Tasks Hooks
export function useTasks(leadId?: number) {
  const url = leadId ? `${api.tasks.list.path}?leadId=${leadId}` : api.tasks.list.path;
  return useQuery<any[]>({
    queryKey: [api.tasks.list.path, leadId],
    queryFn: async () => {
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch tasks");
      return await res.json();
    },
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (task: InsertTask) => {
      const res = await fetch(api.tasks.create.path, {
        method: api.tasks.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(task),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create task");
      return api.tasks.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.tasks.list.path] });
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: number } & Partial<InsertTask>) => {
      const url = buildUrl(api.tasks.update.path, { id });
      const res = await fetch(url, {
        method: api.tasks.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update task");
      return api.tasks.update.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.tasks.list.path] });
    },
  });
}

export function useHandoverAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ leadId, action, rejectionReason }: { leadId: number; action: "accept" | "reject"; rejectionReason?: string }) => {
      const res = await fetch(`/api/leads/${leadId}/handover`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, rejectionReason }),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to process handover");
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [api.leads.get.path, variables.leadId] });
      queryClient.invalidateQueries({ queryKey: [api.leads.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.activities.list.path, variables.leadId] });
    },
  });
}

export function useAssignLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ leadId, assignToCrmUserId, handoverReason }: { leadId: number; assignToCrmUserId: number; handoverReason?: string }) => {
      const res = await fetch(`/api/leads/${leadId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignToCrmUserId, handoverReason }),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to assign lead");
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [api.leads.get.path, variables.leadId] });
      queryClient.invalidateQueries({ queryKey: [api.leads.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.activities.list.path, variables.leadId] });
    },
  });
}

export function useActiveCrmUsers() {
  return useQuery<CrmUser[]>({
    queryKey: ["/api/crm-users/active"],
    queryFn: async () => {
      const res = await fetch("/api/crm-users/active", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch CRM users");
      return res.json();
    },
  });
}

export function useDoctors() {
  return useQuery<any[]>({
    queryKey: ["/api/doctors-list"],
    queryFn: async () => {
      const res = await fetch("/api/doctors-list", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch doctors");
      return res.json();
    },
  });
}

export interface IndividualSlot {
  startTime: string; endTime: string;
  windowStart: string; windowEnd: string;
  isBooked: boolean; patientName: string | null;
  availableCount: number;
}
export interface DoctorAvailability {
  available: boolean;
  reason?: string;
  dayOfWeek?: string;
  slots: Array<{ startTime: string; endTime: string; maxPatients: number; booked: number; availableCount: number }>;
  individualSlots?: IndividualSlot[];
  windows?: Array<{ startTime: string; endTime: string; maxPatients: number; slotDuration: number }>;
}
export function useDoctorAvailability(doctorId: number | null, date: string | null, branchId?: number | null) {
  return useQuery<DoctorAvailability>({
    queryKey: ["/api/doctors", doctorId, "availability", date, branchId ?? null],
    queryFn: async () => {
      const params = new URLSearchParams({ date: date! });
      if (branchId) params.set("branchId", String(branchId));
      const res = await fetch(`/api/doctors/${doctorId}/availability?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch availability");
      return res.json();
    },
    enabled: !!doctorId && !!date,
  });
}

export function useAppointments(filters?: Record<string, string>) {
  const params = filters ? "?" + new URLSearchParams(filters).toString() : "";
  return useQuery<any[]>({
    queryKey: ["/api/appointments", filters],
    queryFn: async () => {
      const res = await fetch(`/api/appointments${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch appointments");
      return res.json();
    },
  });
}

export function useMasterData(tableName: string) {
  return useQuery<any[]>({
    queryKey: ["/api/masters", tableName],
    queryFn: async () => {
      const res = await fetch(`/api/masters/${tableName}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });
}

export function useNextActionTypes() {
  return useQuery<any[]>({
    queryKey: ["/api/masters/nextActionTypes"],
    queryFn: async () => {
      const res = await fetch("/api/masters/nextActionTypes", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch next action types");
      return res.json();
    },
  });
}

export function useLeadStatuses() {
  return useQuery<any[]>({
    queryKey: ["/api/masters/leadStatuses"],
    queryFn: async () => {
      const res = await fetch("/api/masters/leadStatuses", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch lead statuses");
      return res.json();
    },
  });
}

export function useCreateAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to book appointment");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/appointments-enriched"] });
      queryClient.invalidateQueries({ queryKey: [api.leads.list.path] });
      queryClient.invalidateQueries({ queryKey: ["/api/doctors"] });
    },
  });
}

export function useAppointmentAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, action, data }: { id: number; action: string; data?: any }) => {
      const res = await fetch(`/api/appointments/${id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data || {}),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || `Failed to ${action} appointment`);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/appointments-enriched"] });
      queryClient.invalidateQueries({ queryKey: [api.leads.list.path] });
    },
  });
}

export function useEpisodes(leadId?: number) {
  return useQuery<Episode[]>({
    queryKey: ["/api/episodes", leadId],
    queryFn: async () => {
      const url = leadId ? `/api/episodes?leadId=${leadId}` : "/api/episodes";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch episodes");
      return res.json();
    },
    enabled: leadId !== undefined,
  });
}

export function useCreateEpisode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/episodes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to create episode");
      }
      return res.json();
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/episodes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/episodes", vars.leadId] });
      queryClient.invalidateQueries({ queryKey: [api.leads.list.path] });
    },
  });
}

export function useUpdateEpisode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const res = await fetch(`/api/episodes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        // Preserve structured error fields so callers can distinguish typed errors
        interface EpisodeUpdateError extends Error {
          status: number;
          code?: string;
          preopClearanceRequired: boolean;
          assessmentReadinessStatus: string | null;
        }
        const errorObj: EpisodeUpdateError = Object.assign(
          new Error(err.message || "Failed to update episode"),
          {
            status: res.status,
            code: err.code as string | undefined,
            preopClearanceRequired: err.preopClearanceRequired ?? false,
            assessmentReadinessStatus: err.assessmentReadinessStatus ?? null,
          }
        );
        throw errorObj;
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/episodes"] });
    },
  });
}

export function useQuickAddMaster() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ tableName, name }: { tableName: string; name: string }) => {
      const res = await fetch(`/api/masters/${tableName}/quick-add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to add item");
      }
      return res.json();
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: [`/api/masters/${vars.tableName}`] });
    },
  });
}
