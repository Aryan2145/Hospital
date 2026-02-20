export const LEAD_STATUSES = [
  "Raw Lead Captured",
  "Contacted",
  "Qualified",
  "Appointment Booked",
  "Consultation Done",
  "Closed Won",
  "Closed Lost",
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  "Raw Lead Captured": ["Contacted", "Closed Lost"],
  "Contacted": ["Qualified", "Closed Lost"],
  "Qualified": ["Appointment Booked", "Contacted", "Closed Lost"],
  "Appointment Booked": ["Consultation Done", "Qualified", "Closed Lost"],
  "Consultation Done": ["Closed Won", "Closed Lost", "Appointment Booked"],
  "Closed Won": [],
  "Closed Lost": ["Raw Lead Captured"],
};

export function getValidTransitions(currentStatus: string): string[] {
  return ALLOWED_TRANSITIONS[currentStatus] || [];
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
    case "Consultation Done": return "bg-green-100 text-green-800 border-green-200";
    case "Closed Won": return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "Closed Lost": return "bg-red-100 text-red-800 border-red-200";
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
