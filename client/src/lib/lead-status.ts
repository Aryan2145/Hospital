export const LEAD_STATUSES = [
  "Raw Lead Captured",
  "Contacted",
  "Qualified",
  "Appointment Booked",
  "Reminder Running",
  "Consultation Done",
  "Closed Won",
  "Closed Lost",
  "Unqualified",
  "Nurture",
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  "Raw Lead Captured": ["Contacted", "Qualified", "Unqualified", "Nurture", "Closed Lost"],
  "Contacted": ["Qualified", "Appointment Booked", "Unqualified", "Nurture", "Closed Lost"],
  "Qualified": ["Appointment Booked", "Contacted", "Reminder Running", "Nurture", "Closed Lost"],
  "Appointment Booked": ["Consultation Done", "Reminder Running", "Qualified", "Closed Lost"],
  "Reminder Running": ["Appointment Booked", "Contacted", "Qualified", "Closed Lost"],
  "Consultation Done": ["Closed Won", "Closed Lost", "Appointment Booked", "Nurture"],
  "Closed Won": [],
  "Closed Lost": ["Raw Lead Captured", "Nurture"],
  "Unqualified": ["Raw Lead Captured", "Contacted", "Nurture"],
  "Nurture": ["Contacted", "Qualified", "Appointment Booked", "Closed Lost"],
};

export function getValidTransitions(currentStatus: string): string[] {
  return ALLOWED_TRANSITIONS[currentStatus] || [];
}

export function getAllLeadStatuses(): string[] {
  return [...LEAD_STATUSES];
}

export function isValidTransition(from: string, to: string): boolean {
  return getValidTransitions(from).includes(to);
}

export function getStatusColor(status: string): string {
  switch (status) {
    case "Raw Lead Captured": return "bg-blue-100 text-blue-800 border-blue-200";
    case "Contacted": return "bg-amber-100 text-amber-800 border-amber-200";
    case "Qualified": return "bg-indigo-100 text-indigo-800 border-indigo-200";
    case "Appointment Booked": return "bg-purple-100 text-purple-800 border-purple-200";
    case "Reminder Running": return "bg-orange-100 text-orange-800 border-orange-200";
    case "Consultation Done": return "bg-green-100 text-green-800 border-green-200";
    case "Closed Won": return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "Closed Lost": return "bg-red-100 text-red-800 border-red-200";
    case "Unqualified": return "bg-gray-100 text-gray-800 border-gray-200";
    case "Nurture": return "bg-cyan-100 text-cyan-800 border-cyan-200";
    default: return "bg-muted text-muted-foreground border-border";
  }
}

export function getPriorityColor(priority: string | null | undefined): string {
  switch (priority) {
    case "High": return "bg-red-100 text-red-700 border-red-200";
    case "Medium": return "bg-amber-100 text-amber-700 border-amber-200";
    case "Low": return "bg-green-100 text-green-700 border-green-200";
    default: return "bg-muted text-muted-foreground border-border";
  }
}

const TERMINAL_STATUSES = ["Closed Won", "Closed Lost", "Unqualified"];
const ACTIVE_STAGES = ["Raw Lead Captured", "Contacted", "Qualified"];

export type LeadTemperature = "Hot" | "Warm" | "Cold";

export function getLeadTemperature(lead: { lastContactAt?: string | Date | null; updatedAt?: string | Date | null; createdAt?: string | Date | null; status: string }): LeadTemperature | null {
  if (TERMINAL_STATUSES.includes(lead.status)) return null;

  const now = new Date();
  const differenceInHours = (a: Date, b: Date) => Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60));

  const lastContact = lead.lastContactAt ? new Date(lead.lastContactAt) : null;
  const created = lead.createdAt ? new Date(lead.createdAt) : null;

  if (lastContact) {
    const hoursSinceContact = differenceInHours(now, lastContact);
    if (hoursSinceContact <= 24) return "Hot";
    if (hoursSinceContact <= 72) return "Warm";
    return "Cold";
  }

  if (ACTIVE_STAGES.includes(lead.status) && created) {
    const hoursSinceCreated = differenceInHours(now, created);
    if (hoursSinceCreated <= 48) return "Hot";
    if (hoursSinceCreated <= 120) return "Warm";
  }

  return "Cold";
}

export function getTemperatureColor(temp: LeadTemperature): string {
  switch (temp) {
    case "Hot": return "bg-red-100 text-red-700 border-red-200";
    case "Warm": return "bg-orange-100 text-orange-700 border-orange-200";
    case "Cold": return "bg-blue-100 text-blue-700 border-blue-200";
  }
}

export function getTemperatureIcon(temp: LeadTemperature): string {
  switch (temp) {
    case "Hot": return "Flame";
    case "Warm": return "Sun";
    case "Cold": return "Snowflake";
  }
}

export function getActivityIcon(type: string): string {
  switch (type) {
    case "call": return "Phone";
    case "note": return "StickyNote";
    case "status_change": return "ArrowRightLeft";
    case "appointment": return "Calendar";
    case "email": return "Mail";
    case "sms": return "MessageSquare";
    case "whatsapp": return "MessageCircle";
    case "task": return "CheckSquare";
    default: return "Activity";
  }
}
