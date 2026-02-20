import { Lead } from "@shared/schema";
import { X, Phone, Mail, Calendar, Clock, CheckCircle2, AlertCircle, Send, StickyNote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { useCreateActivity, useLeadActivities } from "@/hooks/use-leads";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertActivitySchema } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface LeadDetailViewProps {
  lead: Lead;
  onClose: () => void;
}

export function LeadDetailView({ lead, onClose }: LeadDetailViewProps) {
  return (
    <div className="flex h-full bg-background">
      {/* Left Panel: Profile */}
      <div className="w-1/3 border-r border-border p-6 bg-secondary/30">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-xl font-bold text-primary">Patient Profile</h2>
          <Button variant="ghost" size="icon" onClick={onClose} className="md:hidden">
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="flex flex-col items-center mb-8">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center text-3xl font-bold text-white shadow-xl mb-4">
            {lead.name.charAt(0).toUpperCase()}
          </div>
          <h3 className="text-2xl font-bold text-foreground text-center">{lead.name}</h3>
          <span className="mt-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wider">
            {lead.status}
          </span>
        </div>

        <div className="space-y-6">
          <div className="p-4 bg-white rounded-xl shadow-sm border border-border">
            <div className="flex items-center gap-3 text-sm mb-3">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                <Phone className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Phone Number</p>
                <p className="font-semibold">{lead.phoneE164}</p>
              </div>
            </div>
            <Button className="w-full mt-2" size="sm">
              <Phone className="w-4 h-4 mr-2" />
              Call Now
            </Button>
          </div>

          <div className="space-y-4">
             <div className="flex items-center gap-3">
               <Mail className="w-4 h-4 text-muted-foreground" />
               <span className="text-sm font-medium">{lead.email || "No email provided"}</span>
             </div>
             <div className="flex items-center gap-3">
               <Calendar className="w-4 h-4 text-muted-foreground" />
               <span className="text-sm font-medium">Created: {lead.createdAt ? format(new Date(lead.createdAt), "PPP") : "-"}</span>
             </div>
             <div className="flex items-center gap-3">
               <AlertCircle className="w-4 h-4 text-orange-500" />
               <span className="text-sm font-medium text-orange-600">SLA: 2 hours remaining</span>
             </div>
          </div>
        </div>
      </div>

      {/* Middle Panel: Timeline */}
      <div className="flex-1 border-r border-border bg-white flex flex-col">
        <div className="p-6 border-b border-border">
          <h3 className="font-bold text-lg">Activity Timeline</h3>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <ActivityFeed leadId={lead.id} />
        </div>
        <div className="p-4 bg-secondary/20 border-t border-border">
          <ActivityInput leadId={lead.id} />
        </div>
      </div>
      
      {/* Right Panel: Actions */}
      <div className="w-1/4 p-6 bg-slate-50">
        <h3 className="font-bold text-lg mb-6">Next Actions</h3>
        
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-border shadow-sm">
            <h4 className="text-sm font-bold mb-2 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              Task
            </h4>
            <p className="text-sm text-muted-foreground mb-4">Follow up on consultation booking.</p>
            <Button variant="outline" size="sm" className="w-full">Mark Complete</Button>
          </div>

          <Button variant="default" className="w-full justify-start bg-primary text-white hover:bg-primary/90">
            <Calendar className="w-4 h-4 mr-2" />
            Book Appointment
          </Button>
          
           <Button variant="outline" className="w-full justify-start">
            <StickyNote className="w-4 h-4 mr-2" />
            Add Note
          </Button>
        </div>
      </div>

      <div className="absolute top-4 right-4 md:hidden">
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
}

function ActivityFeed({ leadId }: { leadId: number }) {
  const { data: activities, isLoading } = useLeadActivities(leadId);

  if (isLoading) return <div className="text-center py-10 text-muted-foreground">Loading history...</div>;
  if (!activities?.length) return <div className="text-center py-10 text-muted-foreground">No activity yet.</div>;

  return (
    <div className="space-y-6">
      {activities.map((activity) => (
        <div key={activity.id} className="flex gap-4">
          <div className="flex flex-col items-center">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 z-10">
               {activity.type === 'call' ? <Phone className="w-4 h-4" /> : <StickyNote className="w-4 h-4" />}
            </div>
            <div className="w-0.5 h-full bg-border -mt-2 -mb-4" />
          </div>
          <div className="flex-1 pb-6">
            <div className="bg-secondary/30 p-4 rounded-xl rounded-tl-none border border-border/50">
              <div className="flex justify-between items-start mb-1">
                <span className="text-xs font-bold uppercase text-primary/70">{activity.type}</span>
                <span className="text-xs text-muted-foreground">
                  {activity.createdAt && format(new Date(activity.createdAt), "MMM d, h:mm a")}
                </span>
              </div>
              <p className="text-sm text-foreground">{activity.description}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ActivityInput({ leadId }: { leadId: number }) {
  const createActivity = useCreateActivity();
  const [text, setText] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    createActivity.mutate({
      leadId,
      data: {
        leadId,
        type: "note",
        description: text,
        tenantId: 1, // Mock
        createdBy: "user", // Mock - would be real user ID
      }
    });
    setText("");
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Input 
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Log a note or call..."
        className="flex-1"
      />
      <Button type="submit" disabled={createActivity.isPending} size="icon">
        <Send className="w-4 h-4" />
      </Button>
    </form>
  );
}
