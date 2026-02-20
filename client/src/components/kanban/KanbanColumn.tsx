import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Lead } from "@shared/schema";
import { KanbanCard } from "./KanbanCard";
import { cn } from "@/lib/utils";

interface KanbanColumnProps {
  id: string;
  title: string;
  color: string;
  count: number;
  leads: Lead[];
}

export function KanbanColumn({ id, title, color, count, leads }: KanbanColumnProps) {
  const { setNodeRef } = useDroppable({ id });

  return (
    <div className="flex flex-col w-80 shrink-0">
      <div className="flex items-center justify-between mb-4 px-1">
        <div className="flex items-center gap-2">
          <div className={cn("w-3 h-3 rounded-full", color.split(" ")[0].replace("bg-", "bg-opacity-100 bg-"))} />
          <h3 className="font-semibold text-foreground text-sm tracking-tight">{title}</h3>
        </div>
        <span className="bg-secondary text-secondary-foreground text-xs font-bold px-2.5 py-1 rounded-full border border-secondary-foreground/10">
          {count}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className="flex-1 bg-secondary/30 rounded-xl p-2 border border-dashed border-border/50 min-h-[150px]"
      >
        <SortableContext items={leads.map((l) => l.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-3">
            {leads.map((lead) => (
              <KanbanCard key={lead.id} lead={lead} />
            ))}
          </div>
        </SortableContext>
      </div>
    </div>
  );
}
