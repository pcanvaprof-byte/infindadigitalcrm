import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Building2 } from "lucide-react";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { listMyOrganizations, setActiveOrganization, type Organization } from "@/lib/org/api";
import { toast } from "sonner";

export function OrgSwitcher() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: orgs = [] } = useQuery<Organization[]>({
    queryKey: ["my-organizations"],
    queryFn: listMyOrganizations,
    staleTime: 60_000,
  });

  const active = orgs.find((o) => o.is_active) ?? orgs[0];

  const switchMut = useMutation({
    mutationFn: (id: string) => setActiveOrganization(id),
    onSuccess: async () => {
      toast.success("Organização ativa atualizada");
      await qc.invalidateQueries();
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : "Falha ao trocar organização");
    },
  });

  if (!orgs.length) return null;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className="flex min-h-[40px] items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium transition-colors hover:bg-accent"
          aria-label="Trocar organização"
        >
          <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="max-w-[140px] truncate">{active?.name ?? "Organização"}</span>
          <ChevronsUpDown className="h-3 w-3 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-xs uppercase tracking-wider text-muted-foreground">
          Suas organizações
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {orgs.map((o) => (
          <DropdownMenuItem
            key={o.id}
            disabled={o.is_active || switchMut.isPending}
            onClick={() => switchMut.mutate(o.id)}
            className="flex items-center justify-between gap-2"
          >
            <div className="flex flex-col">
              <span className="text-sm">{o.name}</span>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {o.role}
              </span>
            </div>
            {o.is_active && <Check className="h-4 w-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}