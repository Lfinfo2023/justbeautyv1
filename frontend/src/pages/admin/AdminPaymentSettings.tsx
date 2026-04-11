import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";

const AdminPaymentSettings = () => {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [values, setValues] = useState({
    enabled: false,
    deposit_rate: 10,
    deposit_threshold: 20,
    allow_bank_transfer: true,
    bank_account: "",
    bank_name: "Just Beauty",
    bank_reference_prefix: "ACOMPTE",
    mollie_mode: "test" as "test" | "live",
    mollie_test_api_key: "",
    mollie_live_api_key: "",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["admin-payment-settings"],
    queryFn: api.paymentSettings.getAdmin,
  });

  useEffect(() => {
    if (!data) return;
    setValues({
      enabled: data.enabled,
      deposit_rate: data.deposit_rate,
      deposit_threshold: data.deposit_threshold,
      allow_bank_transfer: data.allow_bank_transfer,
      bank_account: data.bank_account,
      bank_name: data.bank_name,
      bank_reference_prefix: data.bank_reference_prefix || "ACOMPTE",
      mollie_mode: data.mollie_mode || "test",
      mollie_test_api_key: data.mollie_test_api_key || "",
      mollie_live_api_key: data.mollie_live_api_key || "",
    });
  }, [data]);

  const save = useMutation({
    mutationFn: async () => api.paymentSettings.saveAdmin(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-payment-settings"] });
      queryClient.invalidateQueries({ queryKey: ["payment-settings"] });
      toast.success("Parametres de paiement enregistres");
    },
    onError: (error: Error) => toast.error(error.message || "Impossible d'enregistrer les parametres"),
  });

  const testMollie = useMutation({
    mutationFn: async () => api.paymentSettings.testMollie({
      mollie_mode: values.mollie_mode,
      mollie_test_api_key: values.mollie_test_api_key,
      mollie_live_api_key: values.mollie_live_api_key,
    }),
    onSuccess: (result) => {
      if (result.enabled_methods_count === 0 && result.all_methods_count > 0) {
        toast.warning(`Connexion Mollie ${result.mode} validee, mais aucune methode n'est active (${result.all_methods_count} disponible(s) au total). Active les moyens de paiement dans Mollie.`);
        return;
      }
      toast.success(`Connexion Mollie ${result.mode} validee (${result.enabled_methods_count} methode(s) active(s))`);
    },
    onError: (error: Error) => toast.error(error.message || "Echec du test Mollie"),
  });

  if (isLoading) return <p className="text-muted-foreground">Chargement...</p>;

  return (
    <div className="bg-card rounded-2xl border border-border/50 p-6 space-y-6">
      <div>
        <h3 className="font-display text-xl text-foreground">Acomptes et paiements</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Active l'acompte de 10% pour les soins au-dessus de 20 EUR et laisse le choix entre Mollie et virement.
        </p>
      </div>

      <Collapsible open={expanded} onOpenChange={setExpanded} className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-foreground">Module de paiement</p>
          <CollapsibleTrigger asChild>
            <Button type="button" variant="outline" className="rounded-full">
              {expanded ? "Masquer" : "Afficher"}
              <ChevronDown className={`ml-2 h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
            </Button>
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent className="space-y-6">
          <div className="rounded-xl border border-border/50 bg-muted/20 p-4 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-medium text-foreground">Module d'acompte</p>
                <p className="text-sm text-muted-foreground">
                  Les clients de confiance ne sont jamais bloques par cette regle.
                </p>
              </div>
              <Switch
                checked={values.enabled}
                onCheckedChange={(checked) => setValues((current) => ({ ...current, enabled: checked }))}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Pourcentage d'acompte</label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={values.deposit_rate}
                  onChange={(e) => setValues((current) => ({ ...current, deposit_rate: Number(e.target.value || 0) }))}
                  className="rounded-lg bg-background"
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Seuil minimum du soin</label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={values.deposit_threshold}
                  onChange={(e) => setValues((current) => ({ ...current, deposit_threshold: Number(e.target.value || 0) }))}
                  className="rounded-lg bg-background"
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border/50 bg-muted/20 p-4 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-medium text-foreground">Paiement Mollie</p>
                <p className="text-sm text-muted-foreground">
                  {data?.mollie_api_configured ? "La cle du mode selectionne est disponible pour les paiements." : "La cle du mode selectionne est absente."}
                </p>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full border ${data?.mollie_api_configured ? "bg-green-100 text-green-700 border-green-200" : "bg-yellow-100 text-yellow-700 border-yellow-200"}`}>
                {data?.mollie_api_configured ? "Configure" : "A configurer"}
              </span>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4 rounded-xl border border-border/50 bg-background p-3">
                <div>
                  <p className="font-medium text-foreground">Mode Mollie</p>
                  <p className="text-sm text-muted-foreground">
                    Bascule facilement entre l'API de test et l'API live.
                  </p>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className={values.mollie_mode === "test" ? "text-foreground font-medium" : "text-muted-foreground"}>Test</span>
                  <Switch
                    checked={values.mollie_mode === "live"}
                    onCheckedChange={(checked) => setValues((current) => ({ ...current, mollie_mode: checked ? "live" : "test" }))}
                  />
                  <span className={values.mollie_mode === "live" ? "text-foreground font-medium" : "text-muted-foreground"}>Live</span>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Cle API Mollie test</label>
                  <Input
                    type="password"
                    value={values.mollie_test_api_key}
                    onChange={(e) => setValues((current) => ({ ...current, mollie_test_api_key: e.target.value }))}
                    className="rounded-lg bg-background"
                    placeholder="test_xxx"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {data?.mollie_test_api_configured ? "Cle test enregistree." : "Aucune cle test enregistree."}
                  </p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Cle API Mollie live</label>
                  <Input
                    type="password"
                    value={values.mollie_live_api_key}
                    onChange={(e) => setValues((current) => ({ ...current, mollie_live_api_key: e.target.value }))}
                    className="rounded-lg bg-background"
                    placeholder="live_xxx"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {data?.mollie_live_api_configured ? "Cle live enregistree." : "Aucune cle live enregistree."}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  Mode actuellement utilise pour les paiements: <span className="font-medium text-foreground">{values.mollie_mode === "live" ? "Live" : "Test"}</span>
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button type="button" variant="outline" className="rounded-full" onClick={() => testMollie.mutate()} disabled={testMollie.isPending}>
                  {testMollie.isPending ? "Test..." : `Tester Mollie (${values.mollie_mode})`}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Le webhook Mollie doit pointer vers une URL publique en HTTPS accessible depuis Internet. Une adresse locale ou privee comme `10.x.x.x`, `192.168.x.x`, `localhost` ou `127.0.0.1` sera refusee par Mollie.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border/50 bg-muted/20 p-4 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-medium text-foreground">Virement bancaire</p>
                <p className="text-sm text-muted-foreground">Option alternative proposee au client pour regler l'acompte.</p>
              </div>
              <Switch
                checked={values.allow_bank_transfer}
                onCheckedChange={(checked) => setValues((current) => ({ ...current, allow_bank_transfer: checked }))}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Numero de compte / IBAN</label>
                <Input
                  value={values.bank_account}
                  onChange={(e) => setValues((current) => ({ ...current, bank_account: e.target.value }))}
                  className="rounded-lg bg-background"
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Titulaire du compte</label>
                <Input
                  value={values.bank_name}
                  onChange={(e) => setValues((current) => ({ ...current, bank_name: e.target.value }))}
                  className="rounded-lg bg-background"
                />
              </div>
            </div>

            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Prefixe de communication</label>
              <Input
                value={values.bank_reference_prefix}
                onChange={(e) => setValues((current) => ({ ...current, bank_reference_prefix: e.target.value }))}
                className="rounded-lg bg-background max-w-xs"
              />
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      <Button
        onClick={() => save.mutate()}
        disabled={save.isPending}
        className="bg-primary text-primary-foreground hover:bg-rose-gold hover:text-card rounded-full font-body tracking-wide"
      >
        {save.isPending ? "Enregistrement..." : "Enregistrer les parametres"}
      </Button>
    </div>
  );
};

export default AdminPaymentSettings;
