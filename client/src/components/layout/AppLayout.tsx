import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Sidebar } from "./Sidebar";
import { useIsMobile } from "@/hooks/use-mobile";

export function AppLayout({ children, className }: { children: React.ReactNode; className?: string }) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  if (isMobile) {
    return (
      <div className="flex flex-col h-screen bg-background">
        <header className="flex items-center gap-2 px-4 py-2 border-b border-border bg-card shrink-0 z-30">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0" data-testid="button-mobile-menu">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-64">
              <div onClick={() => setOpen(false)}>
                <Sidebar />
              </div>
            </SheetContent>
          </Sheet>
          <div className="flex items-center gap-2">
            <span className="font-bold text-lg tracking-tight" style={{ color: 'hsl(208, 79%, 28%)' }}>VIROC</span>
            <span className="text-xs text-muted-foreground font-medium">CRM</span>
          </div>
        </header>
        <main className={className || "flex-1 overflow-auto"}>
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className={className || "flex-1 overflow-auto"}>
        {children}
      </main>
    </div>
  );
}
