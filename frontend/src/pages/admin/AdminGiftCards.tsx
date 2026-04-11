import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type GiftCardStatus } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type FilterMode = "all" | "pending" | "active" | "used" | "expired";

const AdminGiftCards = () => {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<FilterMode>("all");
  const [notes, setNotes] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["admin-gift-cards"],
    queryFn: api.giftCards.listAdmin,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, admin_note }: { id: string; status: GiftCardStatus; admin_note?: string }) =>
      api.giftCards.updateAdmin(id, { status, admin_note }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-gift-cards"] });
      queryClient.invalidateQueries({ queryKey: ["customers", "me"] });
      toast.success("Cheque cadeau mis a jour");
    },
    onError: (error: Error) => toast.error(error.message || "Impossible de mettre a jour"),
  });

  const cards = useMemo(() => {
    const items = [...(data || [])];
    if (filter === "all") return items;
    if (filter === "pending") return items.filter((item) => item.status === "pending_payment");
    return items.filter((item) => item.status === filter);
  }, [data, filter]);

  const getStatusLabel = (status: string) => {
    if (status === "pending_payment") return "En attente";
    if (status === "active") return "Active";
    if (status === "used") return "Utilisee";
    if (status === "expired") return "Expiree";
    if (status === "refused") return "Refusee";
    return status;
  };

  if (isLoading) return <p className="text-muted-foreground">Chargement...</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="font-display text-xl text-foreground">Cartes cadeaux numeriques</h3>
          <p className="text-sm text-muted-foreground mt-1">Validation manuelle apres reception du virement bancaire.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant={filter === "all" ? "default" : "outline"} className="rounded-full" onClick={() => setFilter("all")}>Tous</Button>
          <Button variant={filter === "pending" ? "default" : "outline"} className="rounded-full" onClick={() => setFilter("pending")}>En attente</Button>
          <Button variant={filter === "active" ? "default" : "outline"} className="rounded-full" onClick={() => setFilter("active")}>Actives</Button>
          <Button variant={filter === "used" ? "default" : "outline"} className="rounded-full" onClick={() => setFilter("used")}>Utilisees</Button>
          <Button variant={filter === "expired" ? "default" : "outline"} className="rounded-full" onClick={() => setFilter("expired")}>Expirees</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {cards.map((card) => (
          <div key={card.id} className="rounded-2xl border border-border/50 bg-card p-5 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium text-foreground">{card.code}</p>
                <p className="text-sm text-muted-foreground">{card.customer_name} - {card.customer_email}</p>
              </div>
              <span className="text-xs rounded-full px-3 py-1 border border-border/50 bg-muted/40">{getStatusLabel(card.status)}</span>
            </div>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>Montant: {card.amount.toFixed(2)} {card.currency}</p>
              <p>Reference virement: {card.payment_reference}</p>
              <p>Compte: {card.bank_name_snapshot} - {card.bank_account_snapshot}</p>
              {card.recipient_name && <p>Beneficiaire: {card.recipient_name}</p>}
              {card.recipient_email && <p>Email beneficiaire: {card.recipient_email}</p>}
              {card.expires_at && <p>Expiration: {new Date(card.expires_at).toLocaleDateString("fr-BE")}</p>}
              {card.used_at && <p>Utilisee le: {new Date(card.used_at).toLocaleDateString("fr-BE")}</p>}
            </div>
            <Input
              value={notes[card.id] ?? card.admin_note ?? ""}
              placeholder="Note admin (optionnel)"
              onChange={(e) => setNotes((current) => ({ ...current, [card.id]: e.target.value }))}
              className="rounded-lg bg-muted/40"
            />
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                className="rounded-full"
                disabled={updateStatus.isPending || card.status === "active" || card.status === "used" || card.status === "expired"}
                onClick={() => updateStatus.mutate({ id: card.id, status: "active", admin_note: notes[card.id] })}
              >
                Valider paiement
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="rounded-full"
                disabled={updateStatus.isPending || card.status === "used" || card.status === "expired"}
                onClick={() => updateStatus.mutate({ id: card.id, status: "refused", admin_note: notes[card.id] })}
              >
                Refuser
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="rounded-full"
                disabled={updateStatus.isPending || card.status !== "active"}
                onClick={() => updateStatus.mutate({ id: card.id, status: "used", admin_note: notes[card.id] })}
              >
                Marquer utilise
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="rounded-full"
                disabled={updateStatus.isPending || card.status === "pending_payment" || card.status === "expired"}
                onClick={() => updateStatus.mutate({ id: card.id, status: "pending_payment", admin_note: notes[card.id] })}
              >
                Remettre en attente
              </Button>
            </div>
          </div>
        ))}

        {cards.length === 0 && (
          <div className="rounded-2xl border border-border/50 bg-card p-5 text-sm text-muted-foreground">
            Aucun cheque cadeau pour ce filtre.
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminGiftCards;
