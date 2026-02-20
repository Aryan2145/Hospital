import { Loader2 } from "lucide-react";

export function LoadingSpinner({ text = "Loading..." }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full w-full min-h-[200px] text-primary">
      <Loader2 className="w-10 h-10 animate-spin mb-4" />
      <p className="text-sm font-medium text-muted-foreground animate-pulse">{text}</p>
    </div>
  );
}
