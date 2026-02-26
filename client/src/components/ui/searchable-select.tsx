import * as React from "react";
import { Check, ChevronsUpDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SearchableSelectOption {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  className?: string;
  triggerClassName?: string;
  disabled?: boolean;
  "data-testid"?: string;
}

const globalCloseCallbacks = new Set<() => void>();

export function SearchableSelect({
  value,
  onValueChange,
  options,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  className,
  triggerClassName,
  disabled = false,
  "data-testid": dataTestId,
}: SearchableSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const containerRef = React.useRef<HTMLDivElement>(null);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const closeRef = React.useRef(() => {
    setOpen(false);
    setSearch("");
  });

  const selectedOption = options.find((o) => o.value === value);

  const filtered = React.useMemo(() => {
    if (!search.trim()) return options;
    const term = search.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(term));
  }, [options, search]);

  const showSearch = options.length > 6;

  const openDropdown = React.useCallback(() => {
    globalCloseCallbacks.forEach((cb) => cb());
    globalCloseCallbacks.clear();
    globalCloseCallbacks.add(closeRef.current);
    setOpen(true);
    setSearch("");
  }, []);

  const closeDropdown = React.useCallback(() => {
    setOpen(false);
    setSearch("");
    globalCloseCallbacks.delete(closeRef.current);
  }, []);

  const handleSelect = React.useCallback((optValue: string) => {
    onValueChange(optValue);
    closeDropdown();
  }, [onValueChange, closeDropdown]);

  React.useEffect(() => {
    const ref = closeRef.current;
    return () => {
      globalCloseCallbacks.delete(ref);
    };
  }, []);

  React.useEffect(() => {
    if (!open) return;

    if (showSearch) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (containerRef.current && !containerRef.current.contains(target)) {
        closeDropdown();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeDropdown();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, closeDropdown, showSearch]);

  React.useEffect(() => {
    if (!open || !dropdownRef.current || !containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const spaceBelow = viewportHeight - containerRect.bottom;
    const dropdown = dropdownRef.current;

    if (spaceBelow < 220) {
      dropdown.style.bottom = "100%";
      dropdown.style.top = "auto";
      dropdown.style.marginBottom = "4px";
      dropdown.style.marginTop = "0";
    } else {
      dropdown.style.top = "100%";
      dropdown.style.bottom = "auto";
      dropdown.style.marginTop = "4px";
      dropdown.style.marginBottom = "0";
    }
  }, [open]);

  return (
    <div ref={containerRef} className="relative" data-searchable-select>
      <button
        type="button"
        disabled={disabled}
        className={cn(
          "flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
          "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          !selectedOption && "text-muted-foreground",
          triggerClassName
        )}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (open) {
            closeDropdown();
          } else {
            openDropdown();
          }
        }}
        data-testid={dataTestId}
      >
        <span className="truncate text-left flex-1">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </button>

      {open && (
        <div
          ref={dropdownRef}
          className={cn(
            "absolute left-0 z-[99999] w-full rounded-md border bg-popover text-popover-foreground shadow-lg",
            className
          )}
        >
          {showSearch && (
            <div className="flex items-center border-b px-3">
              <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
              <input
                ref={searchInputRef}
                type="text"
                className="flex h-9 w-full bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground"
                placeholder={searchPlaceholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                data-testid={dataTestId ? `${dataTestId}-search` : undefined}
              />
              {search && (
                <button
                  type="button"
                  className="ml-1 p-0.5 rounded hover:bg-muted"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSearch("");
                    searchInputRef.current?.focus();
                  }}
                >
                  <X className="h-3 w-3 opacity-50" />
                </button>
              )}
            </div>
          )}
          <div className="max-h-[200px] overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <div className="py-4 text-center text-sm text-muted-foreground">
                No results found.
              </div>
            ) : (
              filtered.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={cn(
                    "relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none",
                    "hover:bg-accent hover:text-accent-foreground",
                    value === option.value && "bg-accent/50 text-accent-foreground font-medium"
                  )}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleSelect(option.value);
                  }}
                  data-testid={
                    dataTestId
                      ? `${dataTestId}-option-${option.value}`
                      : undefined
                  }
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4 flex-shrink-0",
                      value === option.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="truncate">{option.label}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
