import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import type { Prospect } from "@/lib/prospects-api";

const onlyDigits = (s: string) => s.replace(/\D+/g, "");

function normalize(s: string) {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function formatCnpj(c: string) {
  const d = onlyDigits(c);
  if (d.length !== 14) return c;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

function formatPhone(p: string) {
  const d = onlyDigits(p);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return p;
}

export function ProspectPicker({
  prospects,
  value,
  onChange,
  disabled,
  placeholder = "Buscar por nome, CNPJ ou telefone…",
  emptyLabel = "Nenhum prospect encontrado",
}: {
  prospects: Prospect[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  placeholder?: string;
  emptyLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = useMemo(
    () => prospects.find((p) => p.id === value) ?? null,
    [prospects, value],
  );

  const filtered = useMemo(() => {
    const q = normalize(query);
    const qDigits = onlyDigits(query);
    if (!q && !qDigits) return prospects.slice(0, 200);
    return prospects.filter((p) => {
      const haystack = [
        normalize(p.company ?? ""),
        normalize(p.owner ?? ""),
        normalize(p.email ?? ""),
        normalize(p.segment ?? ""),
      ].join(" ");
      if (q && haystack.includes(q)) return true;
      if (qDigits) {
        const digitHaystack = [
          onlyDigits(p.cnpj ?? ""),
          onlyDigits(p.phone ?? ""),
          onlyDigits(p.whatsapp ?? ""),
        ].join(" ");
        if (digitHaystack.includes(qDigits)) return true;
      }
      return false;
    });
  }, [prospects, query]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="mt-1 h-9 w-full justify-between font-normal"
        >
          <span className="flex min-w-0 items-center gap-2 truncate">
            <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">
              {selected
                ? `${selected.company}${selected.cnpj ? ` · ${formatCnpj(selected.cnpj)}` : ""}`
                : placeholder}
            </span>
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] min-w-[320px] p-0"
      >
        <Command shouldFilter={false}>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Nome da empresa, CNPJ ou telefone…"
          />
          <CommandList>
            <CommandEmpty>{emptyLabel}</CommandEmpty>
            <CommandGroup>
              {filtered.slice(0, 100).map((p) => {
                const phone = p.whatsapp || p.phone;
                return (
                  <CommandItem
                    key={p.id}
                    value={p.id}
                    onSelect={() => {
                      onChange(p.id);
                      setOpen(false);
                      setQuery("");
                    }}
                    className="flex items-start gap-2"
                  >
                    <Check
                      className={`mt-0.5 h-4 w-4 shrink-0 ${
                        value === p.id ? "opacity-100" : "opacity-0"
                      }`}
                    />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-medium">{p.company}</span>
                      <span className="truncate text-[11px] text-muted-foreground">
                        {[p.cnpj && formatCnpj(p.cnpj), phone && formatPhone(phone), p.email]
                          .filter(Boolean)
                          .join(" · ") || (p.owner ?? "—")}
                      </span>
                    </div>
                  </CommandItem>
                );
              })}
              {filtered.length > 100 && (
                <div className="px-3 py-2 text-[11px] text-muted-foreground">
                  Mostrando 100 de {filtered.length}. Refine a busca.
                </div>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}