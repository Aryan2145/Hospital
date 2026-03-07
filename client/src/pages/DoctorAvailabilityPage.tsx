import { AppLayout } from "@/components/layout/AppLayout";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useDoctors } from "@/hooks/use-leads";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, addMonths, subMonths, isSameMonth, isToday } from "date-fns";
import { fmtDate, fmtMonthYear } from "@/lib/date-utils";
import { useState, useMemo } from "react";
import { Calendar, ChevronLeft, ChevronRight, Stethoscope, AlertTriangle, Info } from "lucide-react";
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

function useDoctorLeaves(doctorId?: string) {
  const url = doctorId && doctorId !== "all"
    ? `/api/doctor-leaves?doctorId=${doctorId}`
    : "/api/doctor-leaves";
  return useQuery<LeaveRecord[]>({
    queryKey: [url],
  });
}

export default function DoctorAvailabilityPage() {
  const { data: doctorsList } = useDoctors();
  const [selectedDoctor, setSelectedDoctor] = useState("all");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const { data: leaves, isLoading: leavesLoading } = useDoctorLeaves(selectedDoctor);

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

  return (
    <AppLayout>
      <div className="p-4 max-w-6xl mx-auto space-y-4" data-testid="doctor-availability-page">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            <h1 className="text-lg font-semibold" data-testid="text-page-title">Doctor Availability Calendar</h1>
          </div>
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
                <div className="flex justify-center py-12">
                  <LoadingSpinner />
                </div>
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
                    const isPast = endDate < new Date();

                    return (
                      <div
                        key={leave.id}
                        className={cn(
                          "rounded-lg border p-2.5 text-xs",
                          isPast ? "opacity-50" : "bg-destructive/5 border-destructive/10"
                        )}
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
                  <span className="text-muted-foreground">Total Leave Records</span>
                  <Badge variant="outline" className="text-[10px] h-5" data-testid="text-total-leaves">{leaves?.length || 0}</Badge>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
