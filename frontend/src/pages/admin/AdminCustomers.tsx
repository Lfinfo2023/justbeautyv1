import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type FilterMode = "all" | "inactive" | "top";

const AdminCustomers = () => {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<FilterMode>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-customers"],
    queryFn: api.customers.listAdmin,
  });

  const updateTrust = useMutation({
    mutationFn: async ({ id, trusted }: { id: string; trusted: boolean }) => api.customers.updateTrust(id, trusted),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-customers"] });
      queryClient.invalidateQueries({ queryKey: ["customers", "me"] });
      toast.success("Statut client de confiance mis a jour");
    },
    onError: (error: Error) => toast.error(error.message || "Impossible de mettre a jour le client"),
  });
  const requestDeletion = useMutation({
    mutationFn: async (id: string) => api.customers.requestDeletion(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-customers"] });
      toast.success("Suppression planifiee et cliente notifiee");
    },
    onError: (error: Error) => toast.error(error.message || "Impossible de planifier la suppression"),
  });
  const cancelDeletion = useMutation({
    mutationFn: async (id: string) => api.customers.cancelDeletionRequest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-customers"] });
      toast.success("Procedure de suppression annulee");
    },
    onError: (error: Error) => toast.error(error.message || "Impossible d'annuler la procedure"),
  });
  const deleteNow = useMutation({
    mutationFn: async (id: string) => api.customers.deleteNow(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-customers"] });
      toast.success("Compte client supprime immediatement");
    },
    onError: (error: Error) => toast.error(error.message || "Impossible de supprimer immediatement le compte"),
  });

  const customers = useMemo(() => {
    const items = [...(data ?? [])];
    items.sort((a, b) => b.confirmed_bookings - a.confirmed_bookings || a.first_name.localeCompare(b.first_name));

    if (filter === "inactive") {
      return items.filter((item) => item.is_inactive);
    }
    if (filter === "top") {
      return items.filter((item) => item.confirmed_bookings >= 3);
    }
    return items;
  }, [data, filter]);

  if (isLoading) return <p className="text-muted-foreground">Chargement...</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="font-display text-xl text-foreground">Comptes clients</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Suivi de l'activite client et exemption d'acompte pour les clientes de confiance.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant={filter === "all" ? "default" : "outline"} className="rounded-full" onClick={() => setFilter("all")}>
            Tous
          </Button>
          <Button type="button" variant={filter === "inactive" ? "default" : "outline"} className="rounded-full" onClick={() => setFilter("inactive")}>
            Ne viennent plus
          </Button>
          <Button type="button" variant={filter === "top" ? "default" : "outline"} className="rounded-full" onClick={() => setFilter("top")}>
            Plus actives
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {customers.map((customer) => (
          <div key={customer.id} className="bg-card rounded-2xl border border-border/50 p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="font-medium text-foreground">
                  {customer.first_name} {customer.last_name}
                </h4>
                <p className="text-sm text-muted-foreground">{customer.email}</p>
                {customer.phone && <p className="text-sm text-muted-foreground">{customer.phone}</p>}
              </div>
              <div className="flex flex-wrap gap-2 justify-end">
                {customer.is_inactive && <Badge variant="outline">Inactive</Badge>}
                {customer.trusted_no_deposit && <Badge className="bg-green-100 text-green-700 border-green-200">Client de confiance</Badge>}
                {customer.deletion_scheduled_for && <Badge className="bg-red-100 text-red-700 border-red-200">Suppression planifiee</Badge>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-muted/30 p-3">
                <p className="text-muted-foreground">Reservations</p>
                <p className="font-medium text-foreground">{customer.total_bookings}</p>
              </div>
              <div className="rounded-xl bg-muted/30 p-3">
                <p className="text-muted-foreground">Confirmees</p>
                <p className="font-medium text-foreground">{customer.confirmed_bookings}</p>
              </div>
            </div>

            <div className="text-sm text-muted-foreground space-y-1">
              <p>
                Dernier passage:{" "}
                {customer.last_confirmed_booking_at
                  ? formatDistanceToNow(new Date(customer.last_confirmed_booking_at), { addSuffix: true, locale: fr })
                  : "aucun"}
              </p>
              <p>
                Derniere reservation:{" "}
                {customer.last_booking_at
                  ? formatDistanceToNow(new Date(customer.last_booking_at), { addSuffix: true, locale: fr })
                  : "aucune"}
              </p>
              {customer.deletion_scheduled_for && (
                <p className="text-red-700">
                  Suppression automatique prevue le {new Date(customer.deletion_scheduled_for).toLocaleDateString("fr-BE")}.
                </p>
              )}
              {!customer.deletion_scheduled_for && (
                <p className="text-xs text-muted-foreground">
                  Demande admin: suppression automatique dans 30 jours. Suppression immediate possible uniquement depuis l'admin.
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant={customer.trusted_no_deposit ? "outline" : "default"}
                className="rounded-full"
                onClick={() => updateTrust.mutate({ id: customer.id, trusted: !customer.trusted_no_deposit })}
                disabled={updateTrust.isPending}
              >
                {customer.trusted_no_deposit ? "Retirer le statut de confiance" : "Activer client de confiance"}
              </Button>
              {customer.deletion_scheduled_for ? (
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full border-red-300 text-red-700 hover:bg-red-50"
                  onClick={() => cancelDeletion.mutate(customer.id)}
                  disabled={cancelDeletion.isPending}
                >
                  Annuler la suppression
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full border-red-300 text-red-700 hover:bg-red-50"
                  onClick={() => requestDeletion.mutate(customer.id)}
                  disabled={requestDeletion.isPending}
                >
                  Demander la suppression
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                className="rounded-full border-red-500 bg-red-50 text-red-700 hover:bg-red-100"
                disabled={deleteNow.isPending}
                onClick={() => {
                  const confirmed = window.confirm(`Attention: cette action supprime immediatement le compte de ${customer.first_name} ${customer.last_name}, ses rendez-vous, sa fidelite et ses sessions. Continuer ?`);
                  if (!confirmed) return;
                  const doubleConfirmed = window.confirm("Derniere confirmation admin: suppression immediate definitive. Valider ?");
                  if (!doubleConfirmed) return;
                  deleteNow.mutate(customer.id);
                }}
              >
                Supprimer immediatement
              </Button>
            </div>
          </div>
        ))}

        {customers.length === 0 && (
          <div className="bg-card rounded-2xl border border-border/50 p-5 text-sm text-muted-foreground">
            Aucun client pour ce filtre.
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminCustomers;
