import { Sidebar } from "@/components/layout/Sidebar";
import { useLeads } from "@/hooks/use-leads";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, TrendingUp, CalendarCheck, AlertCircle } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, CartesianGrid } from "recharts";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

export default function Dashboard() {
  const { data: leads, isLoading } = useLeads();

  if (isLoading) return <LoadingSpinner />;

  // Mock Data Calculation
  const totalLeads = leads?.length || 0;
  const newLeads = leads?.filter(l => l.status === "Raw Lead Captured").length || 0;
  const qualified = leads?.filter(l => l.status === "Qualified").length || 0;
  const closed = leads?.filter(l => l.status === "Closed Won").length || 0;

  const chartData = [
    { name: 'New', count: newLeads, color: '#3b82f6' },
    { name: 'Qualified', count: qualified, color: '#8b5cf6' },
    { name: 'Closed', count: closed, color: '#10b981' },
  ];

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-7xl mx-auto space-y-8">
          <div>
             <h2 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h2>
             <p className="text-muted-foreground mt-1">Overview of hospital performance and lead pipeline.</p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <StatCard 
              title="Total Leads" 
              value={totalLeads} 
              icon={Users} 
              trend="+12% from last month" 
              trendColor="text-green-600"
            />
            <StatCard 
              title="Conversion Rate" 
              value={`${totalLeads ? Math.round((closed / totalLeads) * 100) : 0}%`} 
              icon={TrendingUp} 
              trend="+2% from last month" 
              trendColor="text-green-600"
            />
            <StatCard 
              title="Appointments" 
              value="24" 
              icon={CalendarCheck} 
              trend="8 scheduled today" 
              trendColor="text-blue-600"
            />
            <StatCard 
              title="Pending Tasks" 
              value="12" 
              icon={AlertCircle} 
              trend="3 overdue" 
              trendColor="text-red-600"
            />
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card className="shadow-sm border-border">
              <CardHeader>
                <CardTitle>Lead Pipeline</CardTitle>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.3} />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={80} tick={{fontSize: 12}} />
                    <Tooltip cursor={{fill: 'transparent'}} />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={32}>
                       {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-border bg-gradient-to-br from-primary to-blue-900 text-white border-none">
              <CardHeader>
                <CardTitle className="text-white">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                 <button className="w-full bg-white/10 hover:bg-white/20 p-4 rounded-xl text-left transition-colors flex items-center justify-between group">
                    <div>
                       <h4 className="font-bold">Add New Lead</h4>
                       <p className="text-sm text-blue-100">Capture a new patient inquiry manually</p>
                    </div>
                    <Users className="w-6 h-6 opacity-50 group-hover:opacity-100 transition-opacity" />
                 </button>
                 <button className="w-full bg-white/10 hover:bg-white/20 p-4 rounded-xl text-left transition-colors flex items-center justify-between group">
                    <div>
                       <h4 className="font-bold">View Today's Appointments</h4>
                       <p className="text-sm text-blue-100">Check schedule for Dr. Shah</p>
                    </div>
                    <CalendarCheck className="w-6 h-6 opacity-50 group-hover:opacity-100 transition-opacity" />
                 </button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, trend, trendColor }: any) {
  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow duration-200">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-foreground">{value}</div>
        <p className={`text-xs ${trendColor} font-medium mt-1`}>{trend}</p>
      </CardContent>
    </Card>
  );
}
