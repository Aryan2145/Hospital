import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Lead } from "@shared/schema";
import { format } from "date-fns";
import { Clock, Phone, User as UserIcon } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { LeadDetailView } from "../leads/LeadDetailView";
import { useState } from "react";

interface KanbanCardProps {
  lead: Lead;
}

export function KanbanCard({ lead }: KanbanCardProps) {
  const [open, setOpen] = useState(false);
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lead.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="opacity-50 bg-background border-2 border-primary border-dashed rounded-xl h-32"
      />
    );
  }

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        onClick={() => setOpen(true)}
        className="
          group bg-card p-4 rounded-xl border border-border shadow-sm 
          hover:shadow-md hover:border-primary/30 hover:-translate-y-0.5
          transition-all duration-200 cursor-grab active:cursor-grabbing
          relative overflow-hidden
        "
      >
        <div className="absolute top-0 left-0 w-1 h-full bg-primary/20 group-hover:bg-accent transition-colors duration-300" />
        
        <div className="pl-2">
          <div className="flex justify-between items-start mb-2">
            <h4 className="font-semibold text-foreground text-sm line-clamp-1">{lead.name}</h4>
            <span className="text-[10px] font-mono text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
              #{lead.id}
            </span>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Phone className="w-3 h-3" />
              <span>{lead.phoneE164}</span>
            </div>
            
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="w-3 h-3 text-accent" />
              <span>{lead.createdAt ? format(new Date(lead.createdAt), "MMM d, h:mm a") : "Just now"}</span>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <div className="flex -space-x-2">
               {/* Avatar placeholder */}
               <div className="w-6 h-6 rounded-full bg-slate-200 border border-white flex items-center justify-center text-[10px] font-bold text-slate-500">
                  <UserIcon className="w-3 h-3" />
               </div>
            </div>
            
            {/* SLA Badge - Mock logic for now */}
            <div className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200">
              On Track
            </div>
          </div>
        </div>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="sm:max-w-4xl p-0 w-full overflow-hidden">
          <LeadDetailView lead={lead} onClose={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </>
  );
}
