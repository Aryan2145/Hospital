export const LEAD_STATUSES = [
  "Raw Lead Captured",
  "Contacted",
  "Qualified",
  "Appointment Booked",
  "Reminder Running",
  "Consultation Done",
  "Unqualified",
  "Nurture",
  "Closed Won",
  "Closed Lost",
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const EPISODE_STATUSES = [
  "Consultation In Progress",
  "Consultation Done",
  "Treatment Planning",
  "Surgery Scheduled",
  "Pre-op Assessment",
  "Surgery Done",
  "In Treatment",
  "Discharge / Billing Clearance",
  "Post Care",
  "Follow Up",
  "Completed",
  "Discontinued",
] as const;

export type EpisodeStatus = (typeof EPISODE_STATUSES)[number];

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  "Raw Lead Captured": ["Contacted", "Qualified", "Unqualified", "Nurture", "Closed Lost"],
  "Contacted": ["Qualified", "Appointment Booked", "Unqualified", "Nurture", "Closed Lost"],
  "Qualified": ["Appointment Booked", "Contacted", "Reminder Running", "Nurture", "Closed Lost"],
  "Appointment Booked": ["Reminder Running", "Consultation Done", "Qualified", "Closed Lost"],
  "Reminder Running": ["Appointment Booked", "Consultation Done", "Contacted", "Qualified", "Closed Lost"],
  "Consultation Done": ["Closed Won", "Closed Lost"],
  "Closed Won": [],
  "Closed Lost": ["Raw Lead Captured", "Nurture"],
  "Unqualified": ["Raw Lead Captured", "Contacted", "Nurture"],
  "Nurture": ["Contacted", "Qualified", "Appointment Booked", "Closed Lost"],
};

const EPISODE_TRANSITIONS: Record<string, string[]> = {
  "Consultation In Progress": ["Consultation Done", "Discontinued"],
  "Consultation Done": ["Treatment Planning", "Surgery Scheduled", "In Treatment", "Discontinued"],
  "Treatment Planning": ["Surgery Scheduled", "In Treatment", "Discontinued"],
  "Surgery Scheduled": ["Pre-op Assessment", "Discontinued"],
  "Pre-op Assessment": ["Surgery Done", "Discontinued"],
  "Surgery Done": ["In Treatment", "Discharge / Billing Clearance", "Post Care", "Follow Up", "Completed"],
  "In Treatment": ["Discharge / Billing Clearance", "Post Care", "Follow Up", "Completed", "Discontinued"],
  "Discharge / Billing Clearance": ["Post Care", "Follow Up", "Completed"],
  "Post Care": ["Follow Up", "Completed"],
  "Follow Up": ["Post Care", "Completed", "Discontinued"],
  "Completed": [],
  "Discontinued": ["Consultation In Progress"],
};

export function getValidTransitions(currentStatus: string): string[] {
  return ALLOWED_TRANSITIONS[currentStatus] || [];
}

export function getValidEpisodeTransitions(currentStatus: string): string[] {
  return EPISODE_TRANSITIONS[currentStatus] || [];
}

export function getAllLeadStatuses(): string[] {
  return [...LEAD_STATUSES];
}

export function getAllEpisodeStatuses(): string[] {
  return [...EPISODE_STATUSES];
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
    case "Consultation In Progress": return "bg-amber-100 text-amber-800 border-amber-200";
    case "Consultation Done": return "bg-green-100 text-green-800 border-green-200";
    case "Treatment Planning": return "bg-teal-100 text-teal-800 border-teal-200";
    case "Surgery Scheduled": return "bg-violet-100 text-violet-800 border-violet-200";
    case "Pre-op Assessment": return "bg-amber-100 text-amber-800 border-amber-200";
    case "Surgery Done": return "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200";
    case "In Treatment": return "bg-orange-100 text-orange-800 border-orange-200";
    case "Discharge / Billing Clearance": return "bg-rose-100 text-rose-800 border-rose-200";
    case "Post Care": return "bg-sky-100 text-sky-800 border-sky-200";
    case "Follow Up": return "bg-lime-100 text-lime-800 border-lime-200";
    case "Closed Won": return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "Closed Lost": return "bg-red-100 text-red-800 border-red-200";
    case "Completed": return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "Discontinued": return "bg-red-100 text-red-800 border-red-200";
    case "Unqualified": return "bg-gray-100 text-gray-800 border-gray-200";
    case "Nurture": return "bg-cyan-100 text-cyan-800 border-cyan-200";
    default: return "bg-muted text-muted-foreground border-border";
  }
}

export function getPriorityColor(priority: string | null | undefined): string {
  switch (priority) {
    case "High": return "bg-red-100 text-red-700 border-red-200";
    case "Urgent": return "bg-rose-100 text-rose-700 border-rose-200";
    case "Medium": return "bg-amber-100 text-amber-700 border-amber-200";
    case "Low": return "bg-green-100 text-green-700 border-green-200";
    default: return "bg-muted text-muted-foreground border-border";
  }
}

const LEAD_TERMINAL_STATUSES = ["Closed Won", "Closed Lost", "Unqualified"];
const ACTIVE_STAGES = ["Raw Lead Captured", "Contacted", "Qualified"];

export type LeadTemperature = "Very Hot" | "Hot" | "Warm++" | "Warm+" | "Warm" | "Cold" | "Dormant";

export function getLeadTemperature(lead: { lastContactAt?: string | Date | null; updatedAt?: string | Date | null; createdAt?: string | Date | null; status: string }): LeadTemperature | null {
  if (LEAD_TERMINAL_STATUSES.includes(lead.status)) return null;

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

export function getTemperatureColor(temp: string | null | undefined): string {
  switch (temp) {
    case "Very Hot": return "bg-rose-100 text-rose-700 border-rose-200";
    case "Hot": return "bg-red-100 text-red-700 border-red-200";
    case "Warm++": return "bg-orange-100 text-orange-700 border-orange-200";
    case "Warm+": return "bg-amber-100 text-amber-700 border-amber-200";
    case "Warm": return "bg-yellow-100 text-yellow-700 border-yellow-200";
    case "Cold": return "bg-blue-100 text-blue-700 border-blue-200";
    case "Dormant": return "bg-gray-100 text-gray-500 border-gray-200";
    default: return "bg-muted text-muted-foreground border-border";
  }
}

export function getTemperatureIcon(temp: string | null | undefined): string {
  switch (temp) {
    case "Very Hot": return "Flame";
    case "Hot": return "Flame";
    case "Warm++": return "Sun";
    case "Warm+": return "Sun";
    case "Warm": return "Sun";
    case "Cold": return "Snowflake";
    case "Dormant": return "Moon";
    default: return "Thermometer";
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
