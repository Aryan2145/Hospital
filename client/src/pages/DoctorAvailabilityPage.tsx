import { AppLayout } from "@/components/layout/AppLayout";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useDoctors } from "@/hooks/use-leads";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, addMonths, subMonths, isSameMonth, isToday } from "date-fns";
import { fmtDate, fmtMonthYear } from "@/lib/date-utils";
import { useState, useMemo } from "react";
import { Calendar, ChevronLeft, ChevronRight, Stethoscope, AlertTriangle, Info, Building, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface LeaveRecord {
  id: number;
  doctorId: number;
  doctorName: string;
  leaveDate: string;
  leaveEndDate: string | null;
  reason: string | null;
  status: string;
}

interface OpdSlot {
  id: number;
  doctorId: number;
  doctorName: string;
  branchId: number | null;
  branchName: string;
  departmentName: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  maxPatients: number;
  slotDuration: number;
}

const DAY_ORDER: Record<string, number> = {
  Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6, Sunday: 7,
};

const DAY_COLORS: Record<string, string> = {
  Monday: "bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800",
  Tuesday: "bg-violet-50 border-violet-200 dark:bg-violet-950/20 dark:border-violet-800",
  Wednesday: "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800",
  Thursday: "bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800",
  Friday: "bg-sky-50 border-sky-200 dark:bg-sky-950/20 dark:border-sky-800",
  Saturday: "bg-orange-50 border-orange-200 dark:bg-orange-950/20 dark:border-orange-800",
  Sunday: "bg-rose-50 border-rose-200 dark:bg-rose-950/20 dark:border-rose-800",
};

function useDoctorLeaves(doctorId?: string) {
  const url = doctorId && doctorId !== "all"
    ? `/api/doctor-leaves?doctorId=${doctorId}`
    : "/api/doctor-leaves";
  return useQuery<LeaveRecord[]>({ queryKey: [url] });
}

function useOpdSchedule() {
  return useQuery<OpdSlot[]>({
    queryKey: ["/api/opd-schedule"],
    queryFn: async () => {
      const res = await fetch("/api/opd-schedule", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch OPD schedule");
      return res.json();
    },
  });
}

function useBranches() {
  return useQuery<any[]>({
    queryKey: ["/api/masters", "branches"],
    queryFn: async () => {
      const res = await fetch("/api/masters/branches", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch branches");
      return res.json();
    },
  });
}

export default function DoctorAvailabilityPage() {
  const { data: doctorsList } = useDoctors();
  const [selectedDoctor, setSelectedDoctor] = useState("all");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const { data: leaves, isLoading: leavesLoading } = useDoctorLeaves(selectedDoctor);

  const [scheduleDoctor, setScheduleDoctor] = useState("all");
  const [scheduleBranch, setScheduleBranch] = useState("all");
  const { data: opdSlots = [], isLoading: slotsLoading } = useOpdSchedule();
  const { data: branches = [] } = useBranches();

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const leaveDateMap = useMemo(() => {
    const map = new Map<string, LeaveRecord[]>();
    if (!leaves) return map;
    leaves.forEach((leave) => {
      const start = new Date(leave.leaveDate);
      const end = leave.leaveEndDate ? new Date(leave.leaveEndDate) : start;
      const days = eachDayOfInterval({ start, end });
      days.forEach((day) => {
        const key = format(day, "yyyy-MM-dd");
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(leave);
      });
    });
    return map;
  }, [leaves]);

  const upcomingLeaves = useMemo(() => {
    if (!leaves) return [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return leaves
      .filter((l) => {
        const end = l.leaveEndDate ? new Date(l.leaveEndDate) : new Date(l.leaveDate);
        return end >= today;
      })
      .sort((a, b) => new Date(a.leaveDate).getTime() - new Date(b.leaveDate).getTime())
      .slice(0, 10);
  }, [leaves]);

  const activeDoctors = doctorsList?.filter((d: any) => d.status === "Active") || [];

  const filteredSlots = useMemo(() => {
    return opdSlots
      .filter((s) => scheduleDoctor === "all" || String(s.doctorId) === scheduleDoctor)
      .filter((s) => scheduleBranch === "all" || String(s.branchId) === scheduleBranch)
      .sort((a, b) => (DAY_ORDER[a.dayOfWeek] ?? 8) - (DAY_ORDER[b.dayOfWeek] ?? 8) || a.startTime.localeCompare(b.startTime));
  }, [opdSlots, scheduleDoctor, scheduleBranch]);

  const slotsByDay = useMemo(() => {
    const map = new Map<string, OpdSlot[]>();
    for (const slot of filteredSlots) {
      if (!map.has(slot.dayOfWeek)) map.set(slot.dayOfWeek, []);
      map.get(slot.dayOfWeek)!.push(slot);
    }
    return map;
  }, [filteredSlots]);

  const orderedDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].filter(
    (d) => slotsByDay.has(d)
  );

  const activeBranches = branches.filter((b: any) => b.status === "Active" && (b.approvalStatus === "Approved" || !b.approvalStatus));

  function slotCount(s: OpdSlot) {
    const dur = s.slotDuration || 15;
    const windowMins = (() => {
      const [sh, sm] = s.startTime.split(":").map(Number);
      const [eh, em] = s.endTime.split(":").map(Number);
      return (eh * 60 + em) - (sh * 60 + sm);
    })();
    return Math.floor(windowMins / dur) || s.maxPatients;
  }

  return (
    <AppLayout>
      <div className="p-4 max-w-7xl mx-auto space-y-4" data-testid="doctor-availability-page">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-semibold" data-testid="text-page-title">Doctor Availability</h1>
        </div>

        <Tabs defaultValue="schedule">
          <TabsList data-testid="tabs-availability">
            <TabsTrigger value="schedule" data-testid="tab-opd-schedule">OPD Schedule</TabsTrigger>
            <TabsTrigger value="leaves" data-testid="tab-leaves-calendar">Leaves Calendar</TabsTrigger>
          </TabsList>

          {/* ── OPD SCHEDULE TAB ── */}
          <TabsContent value="schedule" className="space-y-4 mt-4">
            <div className="flex flex-wrap gap-3 items-center" data-testid="schedule-filters">
              <div className="w-56" data-testid="container-schedule-doctor-filter">
                <SearchableSelect
                  value={scheduleDoctor}
                  onValueChange={setScheduleDoctor}
                  options={[
                    { value: "all", label: "All Doctors" },
                    ...activeDoctors.map((d: any) => ({ value: String(d.id), label: d.name })),
                  ]}
                  placeholder="Filter by doctor..."
                  data-testid="select-schedule-doctor"
                />
              </div>
              <div className="w-52" data-testid="container-schedule-branch-filter">
                <SearchableSelect
                  value={scheduleBranch}
                  onValueChange={setScheduleBranch}
                  options={[
                    { value: "all", label: "All Locations" },
                    ...activeBranches.map((b: any) => ({ value: String(b.id), label: b.name })),
                  ]}
                  placeholder="Filter by location..."
                  data-testid="select-schedule-branch"
                />
              </div>
              {(scheduleDoctor !== "all" || scheduleBranch !== "all") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setScheduleDoctor("all"); setScheduleBranch("all"); }}
                  data-testid="button-clear-schedule-filters"
                >
                  Clear filters
                </Button>
              )}
              <div className="ml-auto text-xs text-muted-foreground" data-testid="text-slot-count">
                {filteredSlots.length} schedule window{filteredSlots.length !== 1 ? "s" : ""}
              </div>
            </div>

            {slotsLoading ? (
              <div className="flex justify-center py-16"><LoadingSpinner /></div>
            ) : filteredSlots.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground" data-testid="card-no-schedule">
                <Stethoscope className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No OPD schedules found for the selected filters.</p>
                <p className="text-xs mt-1">Add OPD Timings in Masters → Doctor Masters → OPD Timings.</p>
              </Card>
            ) : (
              <div className="space-y-4">
                {orderedDays.map((day) => {
                  const slots = slotsByDay.get(day) || [];
                  return (
                    <div key={day} data-testid={`section-day-${day.toLowerCase()}`}>
                      <div className={cn("rounded-lg border overflow-hidden", DAY_COLORS[day])}>
                        <div className="px-4 py-2 flex items-center justify-between">
                          <h3 className="font-semibold text-sm" data-testid={`text-day-label-${day}`}>{day}</h3>
                          <Badge variant="secondary" className="text-[10px]" data-testid={`badge-slot-count-${day}`}>
                            {slots.length} window{slots.length !== 1 ? "s" : ""}
                          </Badge>
                        </div>
                        <div className="bg-background">
                          <Table>
                            <TableHeader>
                              <TableRow className="border-b border-border/50">
                                <TableHead className="text-xs py-2">Doctor</TableHead>
                                <TableHead className="text-xs py-2">Location</TableHead>
                                <TableHead className="text-xs py-2">Time</TableHead>
                                <TableHead className="text-xs py-2 text-center">Slot Duration</TableHead>
                                <TableHead className="text-xs py-2 text-center">Max Slots</TableHead>
                                {slots.some(s => s.departmentName) && (
                                  <TableHead className="text-xs py-2">Department</TableHead>
                                )}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {slots.map((slot) => (
                                <TableRow key={slot.id} className="border-b border-border/30 hover:bg-muted/30" data-testid={`row-slot-${slot.id}`}>
                                  <TableCell className="py-2.5">
                                    <div className="flex items-center gap-1.5">
                                      <Stethoscope className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                                      <span className="text-sm font-medium" data-testid={`text-doctor-name-${slot.id}`}>{slot.doctorName}</span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="py-2.5">
                                    <div className="flex items-center gap-1.5">
                                      <Building className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                                      <span className="text-sm" data-testid={`text-branch-name-${slot.id}`}>{slot.branchName}</span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="py-2.5">
                                    <div className="flex items-center gap-1.5">
                                      <Clock className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                                      <span className="text-sm font-mono" data-testid={`text-time-${slot.id}`}>
                                        {slot.startTime} – {slot.endTime}
                                      </span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="py-2.5 text-center">
                                    <Badge variant="outline" className="text-xs" data-testid={`badge-slot-duration-${slot.id}`}>
                                      {slot.slotDuration} min
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="py-2.5 text-center">
                                    <Badge variant="secondary" className="text-xs font-medium" data-testid={`badge-max-patients-${slot.id}`}>
                                      {slotCount(slot)} slots
                                    </Badge>
                                  </TableCell>
                                  {slots.some(s => s.departmentName) && (
                                    <TableCell className="py-2.5 text-sm text-muted-foreground" data-testid={`text-dept-${slot.id}`}>
                                      {slot.departmentName || "—"}
                                    </TableCell>
                                  )}
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ── LEAVES CALENDAR TAB ── */}
          <TabsContent value="leaves" className="mt-4">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <div className="w-64" data-testid="container-doctor-filter">
                <SearchableSelect
                  value={selectedDoctor}
                  onValueChange={setSelectedDoctor}
                  options={[
                    { value: "all", label: "All Doctors" },
                    ...activeDoctors.map((d: any) => ({ value: String(d.id), label: d.name })),
                  ]}
                  placeholder="Select doctor..."
                  data-testid="select-doctor-filter"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <Card className="p-4" data-testid="card-calendar">
                  <div className="flex items-center justify-between mb-4">
                    <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} data-testid="button-prev-month">
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <h2 className="text-base font-semibold" data-testid="text-current-month">
                      {fmtMonthYear(currentMonth)}
                    </h2>
                    <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} data-testid="button-next-month">
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>

                  {leavesLoading ? (
                    <div className="flex justify-center py-12"><LoadingSpinner /></div>
                  ) : (
                    <div className="grid grid-cols-7 gap-px bg-muted rounded-lg overflow-hidden" data-testid="calendar-grid">
                      {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                        <div key={day} className="bg-muted/50 py-2 text-center text-xs font-medium text-muted-foreground" data-testid={`calendar-header-${day.toLowerCase()}`}>
                          {day}
                        </div>
                      ))}
                      {calendarDays.map((day) => {
                        const key = format(day, "yyyy-MM-dd");
                        const dayLeaves = leaveDateMap.get(key) || [];
                        const hasLeave = dayLeaves.length > 0;
                        const inCurrentMonth = isSameMonth(day, currentMonth);
                        const todayFlag = isToday(day);
                        const isSunday = day.getDay() === 0;

                        return (
                          <div
                            key={key}
                            className={cn(
                              "min-h-[80px] p-1.5 bg-background transition-colors relative",
                              !inCurrentMonth && "opacity-40",
                              todayFlag && "ring-2 ring-primary ring-inset",
                              hasLeave && inCurrentMonth && "bg-destructive/5",
                              isSunday && !hasLeave && inCurrentMonth && "bg-muted/30"
                            )}
                            data-testid={`calendar-day-${key}`}
                          >
                            <div className={cn(
                              "text-xs font-medium mb-1",
                              todayFlag && "text-primary font-bold",
                              isSunday && "text-muted-foreground",
                              hasLeave && "text-destructive"
                            )}>
                              {format(day, "d")}
                            </div>
                            {hasLeave && inCurrentMonth && (
                              <div className="space-y-0.5">
                                {dayLeaves.slice(0, 3).map((leave, i) => (
                                  <div
                                    key={`${leave.id}-${i}`}
                                    className="text-[9px] leading-tight bg-destructive/10 text-destructive rounded px-1 py-0.5 truncate"
                                    title={`${leave.doctorName}${leave.reason ? ` - ${leave.reason}` : ""}`}
                                    data-testid={`leave-badge-${leave.id}-${key}`}
                                  >
                                    <span className="font-medium">{leave.doctorName.replace(/^Dr\.?\s*/i, "").split(" ")[0]}</span>
                                  </div>
                                ))}
                                {dayLeaves.length > 3 && (
                                  <div className="text-[8px] text-destructive/70 font-medium px-1" data-testid={`text-more-leaves-${key}`}>
                                    +{dayLeaves.length - 3} more
                                  </div>
                                )}
                              </div>
                            )}
                            {isSunday && !hasLeave && inCurrentMonth && (
                              <div className="text-[8px] text-muted-foreground font-medium" data-testid={`text-sunday-${key}`}>Holiday</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground" data-testid="calendar-legend">
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded bg-destructive/10 border border-destructive/20" />
                      <span>Doctor on leave</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded bg-muted border border-border" />
                      <span>Sunday</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded ring-2 ring-primary" />
                      <span>Today</span>
                    </div>
                  </div>
                </Card>
              </div>

              <div className="space-y-4">
                <Card className="p-4" data-testid="card-upcoming-leaves">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-destructive" />
                    Upcoming Leaves
                  </h3>
                  {leavesLoading ? (
                    <LoadingSpinner />
                  ) : upcomingLeaves.length === 0 ? (
                    <div className="text-xs text-muted-foreground text-center py-4" data-testid="text-no-leaves">
                      No upcoming leaves found
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {upcomingLeaves.map((leave) => {
                        const startDate = new Date(leave.leaveDate);
                        const endDate = leave.leaveEndDate ? new Date(leave.leaveEndDate) : startDate;
                        const isMultiDay = leave.leaveEndDate && format(startDate, "yyyy-MM-dd") !== format(endDate, "yyyy-MM-dd");

                        return (
                          <div
                            key={leave.id}
                            className="rounded-lg border p-2.5 text-xs bg-destructive/5 border-destructive/10"
                            data-testid={`upcoming-leave-${leave.id}`}
                          >
                            <div className="flex items-center gap-1.5 mb-1">
                              <Stethoscope className="w-3 h-3 text-primary flex-shrink-0" />
                              <span className="font-medium truncate" data-testid={`text-doctor-name-${leave.id}`}>{leave.doctorName}</span>
                            </div>
                            <div className="text-muted-foreground ml-4" data-testid={`text-leave-dates-${leave.id}`}>
                              {fmtDate(startDate)}
                              {isMultiDay && ` → ${fmtDate(endDate)}`}
                            </div>
                            {leave.reason && (
                              <div className="text-muted-foreground ml-4 mt-0.5 italic truncate" data-testid={`text-leave-reason-${leave.id}`}>
                                {leave.reason}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>

                <Card className="p-4" data-testid="card-quick-stats">
                  <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                    <Info className="w-4 h-4 text-primary" />
                    Quick Stats
                  </h3>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Active Doctors</span>
                      <Badge variant="outline" className="text-[10px] h-5" data-testid="text-active-doctors-count">{activeDoctors.length}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Leaves This Month</span>
                      <Badge variant="outline" className="text-[10px] h-5 text-destructive border-destructive/20" data-testid="text-leaves-this-month">
                        {leaves?.filter((l) => {
                          const start = new Date(l.leaveDate);
                          const end = l.leaveEndDate ? new Date(l.leaveEndDate) : start;
                          return (start >= monthStart && start <= monthEnd) || (end >= monthStart && end <= monthEnd) ||
                                 (start <= monthStart && end >= monthEnd);
                        }).length || 0}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Schedule Windows</span>
                      <Badge variant="outline" className="text-[10px] h-5" data-testid="text-total-schedule-windows">{opdSlots.length}</Badge>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
