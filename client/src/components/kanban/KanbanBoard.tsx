import { useState, useMemo } from "react";
import { DndContext, DragOverlay, useSensor, useSensors, PointerSensor, DragStartEvent, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove } from "@dnd-kit/sortable";
import { KanbanColumn } from "./KanbanColumn";
import { KanbanCard } from "./KanbanCard";
import { Lead } from "@shared/schema";
import { useUpdateLead } from "@/hooks/use-leads";
import { createPortal } from "react-dom";
import { isValidTransition } from "@/lib/lead-status";
import { useToast } from "@/hooks/use-toast";

interface KanbanBoardProps {
  leads: Lead[];
}

const COLUMNS = [
  { id: "Raw Lead Captured", title: "New Lead", color: "bg-blue-100 text-blue-800" },
  { id: "Contacted", title: "Contacted", color: "bg-amber-100 text-amber-800" },
  { id: "Qualified", title: "Qualified", color: "bg-indigo-100 text-indigo-800" },
  { id: "Appointment Booked", title: "Appt Booked", color: "bg-purple-100 text-purple-800" },
  { id: "Consultation Done", title: "Consultation", color: "bg-green-100 text-green-800" },
  { id: "Closed Won", title: "Closed Won", color: "bg-emerald-100 text-emerald-800" },
  { id: "Closed Lost", title: "Closed Lost", color: "bg-red-100 text-red-800" },
];

export function KanbanBoard({ leads }: KanbanBoardProps) {
  const updateLead = useUpdateLead();
  const { toast } = useToast();
  const [activeId, setActiveId] = useState<string | number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const leadsByStatus = useMemo(() => {
    const map: Record<string, Lead[]> = {};
    COLUMNS.forEach((col) => {
      map[col.id] = leads.filter((lead) => lead.status === col.id);
    });
    return map;
  }, [leads]);

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    
    if (!over) { setActiveId(null); return; }

    const activeLeadId = Number(active.id);
    const activeLead = leads.find(l => l.id === activeLeadId);
    if (!activeLead) { setActiveId(null); return; }

    let targetStatus: string | null = null;

    const column = COLUMNS.find(col => col.id === over.id);
    if (column) {
      targetStatus = column.id;
    } else {
      const overLead = leads.find(l => l.id === Number(over.id));
      if (overLead) targetStatus = overLead.status;
    }

    if (targetStatus && targetStatus !== activeLead.status) {
      if (!isValidTransition(activeLead.status, targetStatus)) {
        toast({ title: "Invalid status change", description: `Cannot move from "${activeLead.status}" to "${targetStatus}"`, variant: "destructive" });
      } else {
        updateLead.mutate({ id: activeLeadId, status: targetStatus });
      }
    }

    setActiveId(null);
  }

  const activeLead = activeId ? leads.find((l) => l.id === Number(activeId)) : null;

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex h-full gap-6 overflow-x-auto pb-4 kanban-scroll px-1">
        {COLUMNS.map((col) => (
          <KanbanColumn
            key={col.id}
            id={col.id}
            title={col.title}
            color={col.color}
            count={leadsByStatus[col.id]?.length || 0}
            leads={leadsByStatus[col.id] || []}
          />
        ))}
      </div>

      {createPortal(
        <DragOverlay>
          {activeLead && (
            <div className="rotate-3 cursor-grabbing">
              <KanbanCard lead={activeLead} />
            </div>
          )}
        </DragOverlay>,
        document.body
      )}
    </DndContext>
  );
}
