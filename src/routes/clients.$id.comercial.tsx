import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getCommercialPlan,
  listPlanTemplates,
  upsertCommercialPlan,
} from "@/modules/lifecycle/api";

export const Route = createFileRoute("/clients/$id/comercial")({
  ssr: false,
  component: ComercialPage,
});

function ComercialPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const planQ = useQuery({ queryKey: ["lc-plan", id], queryFn: () => getCommercialPlan(id) });
  const tplQ = useQuery({ queryKey: ["lc-tpl"], queryFn: listPlanTemplates });

  const [form, setForm] = useState({
    plano_code: "",
    investimento_gestao: "",
    investimento_trafego: "",
    objetivo: "",
    entregas: "",
    validade_dias: 7,
  });

  useEffect(() => {
    if (planQ.data) {
      setForm({
        plano_code: planQ.data.plano_code ?? "",
        investimento_gestao: planQ.data.investimento_gestao?.toString() ?? "",
        investimento_trafego: planQ.data.investimento_trafego?.toString() ?? "",
        objetivo: planQ.data.objetivo ?? "",
        entregas: (planQ.data.entregas ?? []).join("\n"),
        validade_dias: planQ.data.validade_dias ?? 7,
      });
    }
  }, [planQ.data]);

  const saveM = useMutation({
    mutationFn: () =>
      upsertCommercialPlan({
        client_id: id,
        plano_code: form.plano_code || null,
        investimento_gestao: form.investimento_gestao ? Number(form.investimento_gestao) : null,
        investimento_trafego: form.investimento_trafego ? Number(form.investimento_trafego) : null,
        objetivo: form.objetivo || null,
        entregas: form.entregas
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        validade_dias: Number(form.validade_dias),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lc-plan", id] });
      toast.success("Plano comercial salvo");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="space-y-3 p-4">
      <p className="text-sm font-semibold">Plano Comercial</p>
      <p className="text-xs text-muted-foreground">
        Mini-proposta interna preenchida na Reunião Inicial. Vira base da Proposta oficial.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs">Plano</label>
          <Select value={form.plano_code} onValueChange={(v) => setForm({ ...form, plano_code: v })}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {(tplQ.data ?? []).map((t) => (
                <SelectItem key={t.code} value={t.code}>
                  {t.name} — R$ {t.mensalidade}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs">Validade (dias)</label>
          <Input
            type="number"
            value={form.validade_dias}
            onChange={(e) => setForm({ ...form, validade_dias: Number(e.target.value) })}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs">Investimento Gestão (R$)</label>
          <Input
            type="number"
            value={form.investimento_gestao}
            onChange={(e) => setForm({ ...form, investimento_gestao: e.target.value })}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs">Investimento Tráfego (R$)</label>
          <Input
            type="number"
            value={form.investimento_trafego}
            onChange={(e) => setForm({ ...form, investimento_trafego: e.target.value })}
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs">Objetivo</label>
        <Input
          value={form.objetivo}
          onChange={(e) => setForm({ ...form, objetivo: e.target.value })}
          placeholder="Ex.: Leads via WhatsApp"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs">Entregas (uma por linha)</label>
        <Textarea
          rows={5}
          value={form.entregas}
          onChange={(e) => setForm({ ...form, entregas: e.target.value })}
          placeholder={"2 campanhas\nRelatório quinzenal\nSuporte WhatsApp"}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button disabled={saveM.isPending} onClick={() => saveM.mutate()}>
          Salvar plano
        </Button>
      </div>
    </Card>
  );
}