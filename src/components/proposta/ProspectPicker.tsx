import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { Prospect } from "@/lib/mock-prospects";

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
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(
    () => prospects.find((p) => p.id === value) ?? null,
    [prospects, value],
  );

  // When a prospect is already selected and input is empty, prefill the input
  useEffect(() => {
    if (selected && !query) {
      setQuery(selected.company ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  // close on outside click
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const filtered = useMemo(() => {
    const raw = query.trim();
    if (!raw) return prospects.slice(0, 200);

    // tokens: split on whitespace; each token must match somewhere (AND)
    const tokens = raw.split(/\s+/).filter(Boolean);

    const scored = prospects
      .map((p) => {
        const text = normalize(
          [p.company, p.owner, p.email, p.segment].filter(Boolean).join(" "),
        );
        const digits = [p.cnpj, p.phone, p.whatsapp]
          .map((v) => onlyDigits(v ?? ""))
          .join(" ");
        const company = normalize(p.company ?? "");

        let score = 0;
        for (const t of tokens) {
          const nt = normalize(t);
          const dt = onlyDigits(t);
          const textHit = nt && text.includes(nt);
          const digitHit = dt && digits.includes(dt);
          if (!textHit && !digitHit) return null; // AND match
          if (nt && company.startsWith(nt)) score += 10;
          else if (textHit) score += 3;
          if (digitHit) score += 5;
        }
        return { p, score };
      })
      .filter((x): x is { p: typeof prospects[number]; score: number } => x !== null)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.p);

    return scored;
  }, [prospects, query]);

  useEffect(() => {
    setHighlight(0);
  }, [query]);

  function pick(p: Prospect) {
    onChange(p.id);
    setQuery(p.company ?? "");
    setOpen(false);
  }

  return (
    <div ref={wrapRef} className="relative mt-1">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          disabled={disabled}
          placeholder={placeholder}
          autoComplete="off"
          className="h-9 pl-8 pr-8"
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            if (value) onChange(""); // typing invalidates current selection
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setHighlight((h) => Math.min(h + 1, filtered.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlight((h) => Math.max(h - 1, 0));
            } else if (e.key === "Enter") {
              if (open && filtered[highlight]) {
                e.preventDefault();
                pick(filtered[highlight]);
              }
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
        />
        {query && (
          <button
            type="button"
            aria-label="Limpar"
            onClick={() => {
              setQuery("");
              onChange("");
              setOpen(true);
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute z-50 mt-1 max-h-72 w-full overflow-auto rounded-md border bg-popover p-1 shadow-md">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">{emptyLabel}</div>
          ) : (
            <>
              {filtered.slice(0, 100).map((p, i) => {
                const phone = p.whatsapp || p.phone;
                const active = i === highlight;
                const isSel = value === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onMouseEnter={() => setHighlight(i)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      pick(p);
                    }}
                    className={`flex w-full items-start gap-2 rounded px-2 py-1.5 text-left ${
                      active ? "bg-accent text-accent-foreground" : ""
                    }`}
                  >
                    <Check
                      className={`mt-0.5 h-4 w-4 shrink-0 ${isSel ? "opacity-100" : "opacity-0"}`}
                    />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-medium">{p.company}</span>
                      <span className="truncate text-[11px] text-muted-foreground">
                        {[p.cnpj && formatCnpj(p.cnpj), phone && formatPhone(phone), p.email]
                          .filter(Boolean)
                          .join(" · ") || (p.owner ?? "—")}
                      </span>
                    </div>
                  </button>
                );
              })}
              {filtered.length > 100 && (
                <div className="px-3 py-2 text-[11px] text-muted-foreground">
                  Mostrando 100 de {filtered.length}. Refine a busca.
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}