import * as React from "react";
import { createPortal } from "react-dom";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

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
  const [position, setPosition] = React.useState({ top: 0, left: 0, width: 0 });
  const inputRef = React.useRef<HTMLInputElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  const selectedOption = options.find((o) => o.value === value);

  const filtered = React.useMemo(() => {
    if (!search.trim()) return options;
    const term = search.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(term));
  }, [options, search]);

  const updatePosition = React.useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    }
  }, []);

  React.useEffect(() => {
    if (open) {
      updatePosition();
      requestAnimationFrame(() => {
        setTimeout(() => inputRef.current?.focus(), 30);
      });
    } else {
      setSearch("");
    }
  }, [open, updatePosition]);

  React.useEffect(() => {
    if (!open) return;
    function handleScroll() {
      updatePosition();
    }
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [open, updatePosition]);

  const handleSelect = React.useCallback((optionValue: string) => {
    onValueChange(optionValue);
    setOpen(false);
    setSearch("");
  }, [onValueChange]);

  const dropdownContent = open
    ? createPortal(
        <>
          <div
            style={{ position: "fixed", inset: 0, zIndex: 99998 }}
            onClick={() => setOpen(false)}
          />
          <div
            className={cn(
              "fixed rounded-md border bg-popover text-popover-foreground shadow-md",
              className
            )}
            style={{
              zIndex: 99999,
              top: position.top,
              left: position.left,
              width: position.width,
            }}
          >
            <div className="flex flex-col">
              <div className="flex items-center border-b px-3">
                <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                <input
                  ref={inputRef}
                  className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder={searchPlaceholder}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      e.stopPropagation();
                      setOpen(false);
                    }
                  }}
                  data-testid={dataTestId ? `${dataTestId}-search` : undefined}
                />
              </div>
              <div className="max-h-[200px] overflow-y-auto p-1">
                {filtered.length === 0 ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    No results found.
                  </div>
                ) : (
                  filtered.map((option) => (
                    <div
                      key={option.value}
                      className={cn(
                        "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                        value === option.value && "bg-accent text-accent-foreground"
                      )}
                      onClick={(e) => {
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
                          "mr-2 h-4 w-4",
                          value === option.value ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <span className="truncate">{option.label}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </>,
        document.body
      )
    : null;

  return (
    <>
      <Button
        ref={triggerRef}
        variant="outline"
        role="combobox"
        type="button"
        aria-expanded={open}
        disabled={disabled}
        className={cn(
          "w-full justify-between font-normal h-9",
          !selectedOption && "text-muted-foreground",
          triggerClassName
        )}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(!open);
        }}
        data-testid={dataTestId}
      >
        <span className="truncate">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
      {dropdownContent}
    </>
  );
}
