import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { type InsertLead, type InsertActivity, type InsertTask, type CrmUser } from "@shared/schema";

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
      if (!res.ok) throw new Error("Failed to create lead");
      return api.leads.create.responses[201].parse(await res.json());
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
  return useQuery({
    queryKey: [api.tasks.list.path, leadId],
    queryFn: async () => {
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch tasks");
      return api.tasks.list.responses[200].parse(await res.json());
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

export function useDoctorAvailability(doctorId: number | null, date: string | null) {
  return useQuery<{ available: boolean; reason?: string; dayOfWeek?: string; slots: Array<{ startTime: string; endTime: string; maxPatients: number; booked: number; availableCount: number }> }>({
    queryKey: ["/api/doctors", doctorId, "availability", date],
    queryFn: async () => {
      const res = await fetch(`/api/doctors/${doctorId}/availability?date=${date}`, { credentials: "include" });
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

export function useNextActionTypes() {
  return useQuery<any[]>({
    queryKey: ["/api/masters/next_action_types"],
    queryFn: async () => {
      const res = await fetch("/api/masters/next_action_types", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch next action types");
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
