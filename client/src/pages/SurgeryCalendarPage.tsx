import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  User,
  Stethoscope,
  Building2,
  CalendarClock,
} from "lucide-react";
import { fmtDate, fmtTime } from "@/lib/date-utils";
import {
  addDays,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  format,
  isSameDay,
  isWithinInterval,
  addWeeks,
  addMonths,
  subWeeks,
  subMonths,
} from "date-fns";

export default function SurgeryCalendarPage() {
  const [, navigate] = useLocation();
  const [viewMode, setViewMode] = useState<"week" | "month">("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [branchFilter, setBranchFilter] = useState("");
  const [doctorFilter, setDoctorFilter] = useState("");
  const [deptFilter, setDeptFilter] = useState("");

  const { data: surgeries = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/surgery-calendar", branchFilter, doctorFilter, deptFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (branchFilter) params.set("branchId", branchFilter);
      if (doctorFilter) params.set("doctorId", doctorFilter);
      if (deptFilter) params.set("departmentId", deptFilter);
      const res = await fetch(`/api/surgery-calendar?${params}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: branches = [] } = useQuery<any[]>({
    queryKey: ["/api/branches"],
    queryFn: async () => {
      const res = await fetch("/api/branches", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: doctors = [] } = useQuery<any[]>({
    queryKey: ["/api/doctors-list"],
    queryFn: async () => {
      const res = await fetch("/api/doctors-list", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: departments = [] } = useQuery<any[]>({
    queryKey: ["/api/treatment-departments"],
    queryFn: async () => {
      const res = await fetch("/api/masters/treatmentDepartments", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const rangeStart = viewMode === "week"
    ? startOfWeek(currentDate, { weekStartsOn: 1 })
    : startOfMonth(currentDate);
  const rangeEnd = viewMode === "week"
    ? endOfWeek(currentDate, { weekStartsOn: 1 })
    : endOfMonth(currentDate);

  const days = useMemo(() => {
    const result = [];
    let d = rangeStart;
    while (d <= rangeEnd) {
      result.push(d);
      d = addDays(d, 1);
    }
    return result;
  }, [rangeStart.toISOString(), rangeEnd.toISOString()]);

  const surgeriesByDay = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const s of surgeries) {
      const key = format(new Date(s.surgery_date), "yyyy-MM-dd");
      if (!map[key]) map[key] = [];
      map[key].push(s);
    }
    return map;
  }, [surgeries]);

  const navigatePrev = () => {
    setCurrentDate(viewMode === "week" ? subWeeks(currentDate, 1) : subMonths(currentDate, 1));
  };
  const navigateNext = () => {
    setCurrentDate(viewMode === "week" ? addWeeks(currentDate, 1) : addMonths(currentDate, 1));
  };
  const goToToday = () => setCurrentDate(new Date());

  if (isLoading) return <AppLayout><LoadingSpinner /></AppLayout>;

  return (
    <AppLayout>
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2" data-testid="text-surgery-calendar-title">
                <CalendarDays className="w-6 h-6 text-primary" />
                Surgery Schedule
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5">Upcoming scheduled surgeries</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs" data-testid="badge-surgery-count">
                {surgeries.length} scheduled
              </Badge>
            </div>
          </div>

          <Card className="p-3" data-testid="card-surgery-filters">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="w-48">
                <label className="text-xs text-muted-foreground mb-1 block">Branch</label>
                <SearchableSelect
                  value={branchFilter}
                  onValueChange={setBranchFilter}
                  options={[{ value: "", label: "All Branches" }, ...branches.map((b: any) => ({ value: String(b.id), label: b.name }))]}
                  placeholder="All Branches"
                  triggerClassName="text-xs h-8"
                  data-testid="select-filter-branch"
                />
              </div>
              <div className="w-48">
                <label className="text-xs text-muted-foreground mb-1 block">Doctor</label>
                <SearchableSelect
                  value={doctorFilter}
                  onValueChange={setDoctorFilter}
                  options={[{ value: "", label: "All Doctors" }, ...doctors.map((d: any) => ({ value: String(d.id), label: d.name }))]}
                  placeholder="All Doctors"
                  triggerClassName="text-xs h-8"
                  data-testid="select-filter-doctor"
                />
              </div>
              <div className="w-48">
                <label className="text-xs text-muted-foreground mb-1 block">Department</label>
                <SearchableSelect
                  value={deptFilter}
                  onValueChange={setDeptFilter}
                  options={[{ value: "", label: "All Departments" }, ...departments.map((d: any) => ({ value: String(d.id), label: d.name }))]}
                  placeholder="All Departments"
                  triggerClassName="text-xs h-8"
                  data-testid="select-filter-department"
                />
              </div>
              <div className="flex gap-1.5 ml-auto items-center">
                <Button variant="outline" size="sm" onClick={goToToday} className="text-xs h-8" data-testid="button-today">Today</Button>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={navigatePrev} data-testid="button-prev">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm font-medium min-w-[140px] text-center" data-testid="text-calendar-range">
                  {viewMode === "week"
                    ? `${format(rangeStart, "dd MMM")} – ${format(rangeEnd, "dd MMM yyyy")}`
                    : format(currentDate, "MMMM yyyy")}
                </span>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={navigateNext} data-testid="button-next">
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <div className="flex border rounded-md overflow-hidden ml-2">
                  <Button
                    variant={viewMode === "week" ? "default" : "ghost"}
                    size="sm"
                    className="text-xs h-8 rounded-none"
                    onClick={() => setViewMode("week")}
                    data-testid="button-view-week"
                  >Week</Button>
                  <Button
                    variant={viewMode === "month" ? "default" : "ghost"}
                    size="sm"
                    className="text-xs h-8 rounded-none"
                    onClick={() => setViewMode("month")}
                    data-testid="button-view-month"
                  >Month</Button>
                </div>
              </div>
            </div>
          </Card>

          {viewMode === "week" ? (
            <div className="space-y-2">
              {days.map((day) => {
                const key = format(day, "yyyy-MM-dd");
                const daySurgeries = surgeriesByDay[key] || [];
                const isToday = isSameDay(day, new Date());
                return (
                  <div key={key} data-testid={`day-row-${key}`}>
                    <div className={`flex items-center gap-2 py-2 px-3 rounded-t-md ${isToday ? "bg-primary/10 border border-primary/30" : "bg-muted/50"}`}>
                      <span className={`text-sm font-semibold ${isToday ? "text-primary" : "text-foreground"}`}>
                        {format(day, "EEEE, dd MMM yyyy")}
                      </span>
                      {daySurgeries.length > 0 && (
                        <Badge variant={isToday ? "default" : "secondary"} className="text-[10px]">
                          {daySurgeries.length} {daySurgeries.length === 1 ? "surgery" : "surgeries"}
                        </Badge>
                      )}
                    </div>
                    {daySurgeries.length > 0 ? (
                      <div className="space-y-1.5 p-2 border border-t-0 rounded-b-md">
                        {daySurgeries.sort((a: any, b: any) => new Date(a.surgery_date).getTime() - new Date(b.surgery_date).getTime()).map((s: any) => (
                          <SurgeryCard key={s.id} surgery={s} onClick={() => navigate(`/episodes/${s.id}`)} />
                        ))}
                      </div>
                    ) : (
                      <div className="p-3 border border-t-0 rounded-b-md text-xs text-muted-foreground text-center">
                        No surgeries scheduled
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-1">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-2">{d}</div>
              ))}
              {(() => {
                const firstDay = startOfMonth(currentDate);
                const dayOfWeek = (firstDay.getDay() + 6) % 7;
                const paddingDays = Array.from({ length: dayOfWeek }, (_, i) => null);
                return [...paddingDays, ...days].map((day, idx) => {
                  if (!day) return <div key={`pad-${idx}`} className="min-h-[80px] bg-muted/20 rounded" />;
                  const key = format(day, "yyyy-MM-dd");
                  const daySurgeries = surgeriesByDay[key] || [];
                  const isToday = isSameDay(day, new Date());
                  return (
                    <div
                      key={key}
                      className={`min-h-[80px] p-1.5 rounded border ${isToday ? "border-primary bg-primary/5" : "border-border"}`}
                      data-testid={`month-cell-${key}`}
                    >
                      <span className={`text-xs font-medium ${isToday ? "text-primary" : "text-foreground"}`}>
                        {format(day, "d")}
                      </span>
                      <div className="space-y-0.5 mt-1">
                        {daySurgeries.slice(0, 3).map((s: any) => (
                          <div
                            key={s.id}
                            className="text-[10px] bg-violet-100 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300 rounded px-1 py-0.5 truncate cursor-pointer hover:bg-violet-200 transition-colors"
                            onClick={() => navigate(`/episodes/${s.id}`)}
                            title={`${s.patient_name} — ${fmtTime(s.surgery_date)}`}
                            data-testid={`surgery-entry-${s.id}`}
                          >
                            {fmtTime(s.surgery_date)} {s.patient_name}
                          </div>
                        ))}
                        {daySurgeries.length > 3 && (
                          <span className="text-[10px] text-muted-foreground">+{daySurgeries.length - 3} more</span>
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          )}

          {surgeries.length === 0 && (
            <Card className="p-8 text-center" data-testid="card-no-surgeries">
              <CalendarClock className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <h3 className="text-lg font-semibold text-foreground">No Upcoming Surgeries</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Surgeries will appear here when episodes are moved to "Surgery Scheduled" status with a date.
              </p>
            </Card>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

function SurgeryCard({ surgery, onClick }: { surgery: any; onClick: () => void }) {
  return (
    <div
      className="flex items-center gap-3 p-3 rounded-md border bg-card hover:bg-muted/50 cursor-pointer transition-colors"
      onClick={onClick}
      data-testid={`surgery-card-${surgery.id}`}
    >
      <div className="w-16 text-center shrink-0">
        <div className="text-xs font-medium text-violet-600">
          <Clock className="w-3 h-3 inline mr-0.5" />
          {fmtTime(surgery.surgery_date)}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate" data-testid={`text-patient-${surgery.id}`}>
          {surgery.patient_name || "Unknown Patient"}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          {surgery.episode_name}
        </p>
      </div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
        {surgery.surgery_doctor_name && (
          <span className="flex items-center gap-1">
            <Stethoscope className="w-3 h-3" />
            {surgery.surgery_doctor_name}
          </span>
        )}
        {!surgery.surgery_doctor_name && surgery.doctor_name && (
          <span className="flex items-center gap-1">
            <Stethoscope className="w-3 h-3" />
            {surgery.doctor_name}
          </span>
        )}
        {surgery.department_name && (
          <span className="flex items-center gap-1">
            <Building2 className="w-3 h-3" />
            {surgery.department_name}
          </span>
        )}
        {surgery.branch_name && (
          <Badge variant="outline" className="text-[10px]">{surgery.branch_name}</Badge>
        )}
      </div>
    </div>
  );
}
