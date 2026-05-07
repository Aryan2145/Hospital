import * as React from "react";
import { Search, X, User } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PatientSearchResult {
  id: number;
  name: string;
  phoneE164: string | null;
  email: string | null;
}

interface PatientSearchSelectProps {
  value: number | null;
  onSelect: (patient: PatientSearchResult | null) => void;
  placeholder?: string;
  className?: string;
  "data-testid"?: string;
}

export function PatientSearchSelect({
  value,
  onSelect,
  placeholder = "Search patient by name or phone...",
  className,
  "data-testid": dataTestId,
}: PatientSearchSelectProps) {
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<PatientSearchResult[]>([]);
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [selectedLabel, setSelectedLabel] = React.useState<string>("");
  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    if (!value) {
      setSelectedLabel("");
      setQuery("");
    }
  }, [value]);

  const runSearch = React.useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/leads/search?q=${encodeURIComponent(q)}`, { credentials: "include" });
      if (res.ok) {
        const data: PatientSearchResult[] = await res.json();
        setResults(data);
        setOpen(true);
      }
    } catch {}
    setLoading(false);
  }, []);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value;
    setQuery(q);
    if (value) {
      onSelect(null);
      setSelectedLabel("");
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(q), 300);
  }

  function handleSelect(patient: PatientSearchResult) {
    onSelect(patient);
    setSelectedLabel(patient.name);
    setQuery("");
    setOpen(false);
    setResults([]);
  }

  function handleClear() {
    onSelect(null);
    setSelectedLabel("");
    setQuery("");
    setResults([]);
    setOpen(false);
    inputRef.current?.focus();
  }

  React.useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {value && selectedLabel ? (
        <div className="flex items-center gap-2 h-9 px-3 rounded-md border border-input bg-background text-sm">
          <User className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="flex-1 truncate font-medium text-primary">{selectedLabel}</span>
          <button
            type="button"
            onClick={handleClear}
            className="ml-1 rounded hover:bg-muted p-0.5"
            data-testid={dataTestId ? `${dataTestId}-clear` : undefined}
          >
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInputChange}
            onFocus={() => { if (results.length > 0) setOpen(true); }}
            placeholder={loading ? "Searching..." : placeholder}
            className="flex h-9 w-full rounded-md border border-input bg-background pl-8 pr-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            data-testid={dataTestId}
          />
        </div>
      )}

      {open && results.length > 0 && (
        <div className="absolute z-[99999] left-0 top-full mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-lg">
          <div className="max-h-[220px] overflow-y-auto p-1">
            {results.map((patient) => (
              <button
                key={patient.id}
                type="button"
                className="w-full text-left flex items-start gap-2 px-2 py-2 rounded-sm text-sm hover:bg-accent hover:text-accent-foreground"
                onClick={() => handleSelect(patient)}
                data-testid={dataTestId ? `${dataTestId}-option-${patient.id}` : undefined}
              >
                <User className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <div className="font-medium truncate">{patient.name}</div>
                  {(patient.phoneE164 || patient.email) && (
                    <div className="text-xs text-muted-foreground truncate">
                      {patient.phoneE164}{patient.phoneE164 && patient.email ? " · " : ""}{patient.email}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {open && !loading && results.length === 0 && query.length >= 2 && (
        <div className="absolute z-[99999] left-0 top-full mt-1 w-full rounded-md border bg-popover shadow-lg">
          <div className="py-4 text-center text-sm text-muted-foreground">No patients found</div>
        </div>
      )}
    </div>
  );
}
