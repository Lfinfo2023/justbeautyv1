import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type BookingStatus, type BookingBalancePaymentResponse } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { CheckCircle, ChevronDown, Clock, Mail, Trash2, XCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { getBookingStatusLabel, getServiceLabel } from "@/lib/booking";

const statusColors: Record<BookingStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  confirmed: "bg-green-100 text-green-800 border-green-200",
  refused: "bg-red-100 text-red-800 border-red-200",
  cancelled: "bg-gray-100 text-gray-800 border-gray-200",
};

const AdminBookings = () => {
  const queryClient = useQueryClient();
  const [showArchived, setShowArchived] = useState(false);
  const [balancePaymentResult, setBalancePaymentResult] = useState<Record<string, BookingBalancePaymentResponse>>({});

  const { data: bookings, isLoading } = useQuery({
    queryKey: ["admin-bookings"],
    queryFn: api.bookings.listAdmin,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: BookingStatus }) => {
      await api.bookings.updateStatus(id, status);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-bookings"] });
      toast.success("Statut mis a jour");
    },
  });

  const updateDepositStatus = useMutation({
    mutationFn: async ({ id, deposit_status }: { id: string; deposit_status: "paid" | "awaiting_bank_transfer" | "pending" }) => {
      await api.bookings.updateDepositStatus(id, deposit_status);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-bookings"] });
      toast.success("Statut d'acompte mis a jour");
    },
  });

  const removeBooking = useMutation({
    mutationFn: async (id: string) => {
      await api.bookings.remove(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-bookings"] });
      toast.success("Rendez-vous supprime");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Impossible de supprimer le rendez-vous");
    },
  });
  const createBalancePayment = useMutation({
    mutationFn: async ({ id, sendEmail }: { id: string; sendEmail: boolean }) => api.bookings.createBalancePayment(id, sendEmail),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["admin-bookings"] });
      setBalancePaymentResult((current) => ({ ...current, [result.booking.id]: result }));
      toast.success(result.checkout_url ? "Paiement du solde genere" : "Solde deja regle");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Impossible de generer le paiement du solde");
    },
  });
  const sendReminder = useMutation({
    mutationFn: async (id: string) => api.bookings.sendReminder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-bookings"] });
      toast.success("Rappel envoye");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Impossible d'envoyer le rappel");
    },
  });

  const { activeBookings, archivedBookings } = useMemo(() => {
    const now = Date.now();
    const sorted = [...(bookings ?? [])].sort((a, b) => {
      const aTime = new Date(`${a.booking_date}T${a.booking_time}:00`).getTime();
      const bTime = new Date(`${b.booking_date}T${b.booking_time}:00`).getTime();
      return aTime - bTime;
    });

    const activeBookings = [];
    const archivedBookings = [];

    for (const booking of sorted) {
      const duration = booking.services?.duration_minutes ?? 90;
      const endTime = new Date(`${booking.booking_date}T${booking.booking_time}:00`).getTime() + duration * 60 * 1000;
      if (endTime < now) {
        archivedBookings.push(booking);
      } else {
        activeBookings.push(booking);
      }
    }

    return { activeBookings, archivedBookings: archivedBookings.reverse() };
  }, [bookings]);

  const getDepositLabel = (booking: NonNullable<typeof bookings>[number]) => {
    if (!booking.deposit_required) return "Aucun acompte";
    if (booking.deposit_status === "paid") return "Acompte paye";
    if (booking.deposit_status === "awaiting_bank_transfer") return "Virement en attente";
    if (booking.deposit_status === "pending") return "Paiement Mollie en attente";
    if (booking.deposit_status === "failed") return "Paiement echoue";
    if (booking.deposit_status === "expired") return "Paiement expire";
    if (booking.deposit_status === "cancelled") return "Paiement annule";
    return booking.deposit_status || "En attente";
  };
  const getBalanceDue = (booking: NonNullable<typeof bookings>[number]) => {
    if (booking.balance_payment_status === "paid") return 0;
    const servicePrice = Number(booking.services?.price ?? booking.service_price ?? 0);
    const paidDeposit = booking.deposit_status === "paid" ? Number(booking.deposit_amount || 0) : 0;
    return Math.max(0, Number((servicePrice - paidDeposit).toFixed(2)));
  };
  const getBalanceLabel = (booking: NonNullable<typeof bookings>[number]) => {
    const balanceDue = getBalanceDue(booking);
    if (balanceDue <= 0) return "Aucun solde";
    if (booking.balance_payment_status === "paid") return "Solde paye";
    if (booking.balance_payment_status === "open") return "Lien Mollie actif";
    if (booking.balance_payment_status === "expired") return "Lien de solde expire";
    if (booking.balance_payment_status === "failed") return "Paiement du solde echoue";
    if (booking.balance_payment_status === "cancelled") return "Paiement du solde annule";
    return `Solde restant: ${balanceDue.toFixed(2)} EUR`;
  };

  const renderBookingRows = (items: typeof bookings) => (
    <>
      {items?.map((booking) => (
        <TableRow key={booking.id}>
          <TableCell>
            <div>
              <p className="font-medium text-foreground">{booking.client_name}</p>
              <p className="text-xs text-muted-foreground">{booking.client_email}</p>
              {booking.client_phone && <p className="text-xs text-muted-foreground">{booking.client_phone}</p>}
            </div>
          </TableCell>
          <TableCell className="text-sm">{getServiceLabel(booking.services)}</TableCell>
          <TableCell className="text-sm">
            {format(new Date(booking.booking_date), "d MMM yyyy", { locale: fr })}
          </TableCell>
          <TableCell className="text-sm">{booking.booking_time?.slice(0, 5)}</TableCell>
          <TableCell>
            <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium border ${statusColors[booking.status]}`}>
              {getBookingStatusLabel(booking.status)}
            </span>
          </TableCell>
          <TableCell className="text-xs">
            <div className="space-y-1">
              <p>{getDepositLabel(booking)}</p>
              {booking.deposit_required && (
                <p className="text-muted-foreground">
                  {booking.deposit_amount?.toFixed(2)} EUR via {booking.deposit_method === "bank_transfer" ? "virement" : "Mollie"}
                </p>
              )}
              <p>{getBalanceLabel(booking)}</p>
              {booking.reminder_sent_at && (
                <p className="text-muted-foreground">Rappel envoye le {format(new Date(booking.reminder_sent_at), "d MMM yyyy HH:mm", { locale: fr })}</p>
              )}
              {balancePaymentResult[booking.id]?.checkout_url && (
                <div className="space-y-2">
                  <a href={balancePaymentResult[booking.id].checkout_url} target="_blank" rel="noreferrer" className="inline-block text-primary underline underline-offset-4">
                    Lien de paiement du solde
                  </a>
                  {balancePaymentResult[booking.id].qr_code_url && (
                    <img src={balancePaymentResult[booking.id].qr_code_url} alt="QR code de paiement Mollie" className="h-20 w-20 rounded-md border border-border/50 bg-white p-1" />
                  )}
                </div>
              )}
            </div>
          </TableCell>
          <TableCell>
            <div className="flex gap-1 flex-wrap">
              {booking.status === "pending" && (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                    onClick={() => updateStatus.mutate({ id: booking.id, status: "confirmed" })}
                    title="Confirmer"
                  >
                    <CheckCircle size={16} />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                    onClick={() => updateStatus.mutate({ id: booking.id, status: "refused" })}
                    title="Refuser"
                  >
                    <XCircle size={16} />
                  </Button>
                </>
              )}
              {booking.status === "confirmed" && (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-primary hover:text-primary hover:bg-primary/10"
                    onClick={() => sendReminder.mutate(booking.id)}
                    disabled={sendReminder.isPending}
                    title="Envoyer le rappel par email"
                  >
                    <Mail size={16} />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50"
                    onClick={() => updateStatus.mutate({ id: booking.id, status: "pending" })}
                    title="Remettre en attente"
                  >
                    <Clock size={16} />
                  </Button>
                </>
              )}
              {booking.deposit_required && booking.deposit_status !== "paid" && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                  onClick={() => updateDepositStatus.mutate({ id: booking.id, deposit_status: "paid" })}
                  title="Marquer l'acompte comme recu"
                >
                  Acompte recu
                </Button>
              )}
              {booking.deposit_required && getBalanceDue(booking) > 0 && (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2 text-violet-700 hover:text-violet-800 hover:bg-violet-50"
                    onClick={() => createBalancePayment.mutate({ id: booking.id, sendEmail: true })}
                    title="Envoyer le paiement du solde"
                  >
                    Envoyer solde
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2 text-violet-700 hover:text-violet-800 hover:bg-violet-50"
                    onClick={() => createBalancePayment.mutate({ id: booking.id, sendEmail: false })}
                    title="Generer un QR code de paiement Mollie"
                  >
                    QR solde
                  </Button>
                </>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={() => removeBooking.mutate(booking.id)}
                title="Supprimer"
              >
                <Trash2 size={16} />
              </Button>
            </div>
          </TableCell>
        </TableRow>
      ))}
    </>
  );

  const renderBookingCards = (items: typeof bookings) => (
    <div className="space-y-3 md:hidden">
      {items?.length === 0 && (
        <div className="rounded-xl border border-border/50 bg-card p-4 text-sm text-muted-foreground">
          Aucun rendez-vous a afficher
        </div>
      )}
      {items?.map((booking) => (
        <div key={booking.id} className="rounded-xl border border-border/50 bg-card p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium text-foreground">{booking.client_name}</p>
              <p className="text-xs text-muted-foreground">{booking.client_email}</p>
              {booking.client_phone && <p className="text-xs text-muted-foreground">{booking.client_phone}</p>}
            </div>
            <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium border ${statusColors[booking.status]}`}>
              {getBookingStatusLabel(booking.status)}
            </span>
          </div>

          <div className="text-sm text-muted-foreground space-y-1">
            <p>{getServiceLabel(booking.services)}</p>
            <p>{format(new Date(booking.booking_date), "d MMM yyyy", { locale: fr })} a {booking.booking_time?.slice(0, 5)}</p>
            <p>{getDepositLabel(booking)}</p>
            {booking.deposit_required && (
              <p>{booking.deposit_amount?.toFixed(2)} EUR via {booking.deposit_method === "bank_transfer" ? "virement" : "Mollie"}</p>
            )}
            <p>{getBalanceLabel(booking)}</p>
            {booking.reminder_sent_at && (
              <p>Rappel envoye le {format(new Date(booking.reminder_sent_at), "d MMM yyyy HH:mm", { locale: fr })}</p>
            )}
            {balancePaymentResult[booking.id]?.qr_code_url && (
              <div className="pt-2 space-y-2">
                <img src={balancePaymentResult[booking.id].qr_code_url} alt="QR code de paiement Mollie" className="h-32 w-32 rounded-lg border border-border/50 bg-white p-2" />
                {balancePaymentResult[booking.id].checkout_url && (
                  <a href={balancePaymentResult[booking.id].checkout_url} target="_blank" rel="noreferrer" className="text-xs text-primary underline underline-offset-4">
                    Ouvrir le lien de paiement
                  </a>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {booking.status === "pending" && (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-9 px-3 text-green-600 hover:text-green-700 hover:bg-green-50"
                  onClick={() => updateStatus.mutate({ id: booking.id, status: "confirmed" })}
                >
                  <CheckCircle size={16} />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-9 px-3 text-red-500 hover:text-red-600 hover:bg-red-50"
                  onClick={() => updateStatus.mutate({ id: booking.id, status: "refused" })}
                >
                  <XCircle size={16} />
                </Button>
              </>
            )}
            {booking.status === "confirmed" && (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-9 px-3 text-primary hover:text-primary hover:bg-primary/10"
                  onClick={() => sendReminder.mutate(booking.id)}
                  disabled={sendReminder.isPending}
                >
                  <Mail size={16} />
                  Rappel
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-9 px-3 text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50"
                  onClick={() => updateStatus.mutate({ id: booking.id, status: "pending" })}
                >
                  <Clock size={16} />
                </Button>
              </>
            )}
            {booking.deposit_required && booking.deposit_status !== "paid" && (
              <Button
                size="sm"
                variant="ghost"
                className="h-9 px-3 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                onClick={() => updateDepositStatus.mutate({ id: booking.id, deposit_status: "paid" })}
              >
                Acompte recu
              </Button>
            )}
            {booking.deposit_required && getBalanceDue(booking) > 0 && (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-9 px-3 text-violet-700 hover:text-violet-800 hover:bg-violet-50"
                  onClick={() => createBalancePayment.mutate({ id: booking.id, sendEmail: true })}
                >
                  Envoyer solde
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-9 px-3 text-violet-700 hover:text-violet-800 hover:bg-violet-50"
                  onClick={() => createBalancePayment.mutate({ id: booking.id, sendEmail: false })}
                >
                  QR solde
                </Button>
              </>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="h-9 px-3 text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={() => removeBooking.mutate(booking.id)}
            >
              <Trash2 size={16} />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );

  if (isLoading) return <p className="text-muted-foreground">Chargement...</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <h3 className="font-display text-xl text-foreground">Rendez-vous a venir</h3>
        <Badge variant="secondary" className="font-body">{activeBookings.length} actif(s)</Badge>
        <Badge variant="outline" className="font-body">{archivedBookings.length} archive(s)</Badge>
      </div>

      {renderBookingCards(activeBookings)}

      <div className="hidden md:block bg-card rounded-xl border border-border/50 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client</TableHead>
              <TableHead>Service</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Heure</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Acompte</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {renderBookingRows(activeBookings)}
            {activeBookings.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  Aucun rendez-vous a venir
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
        <button
          type="button"
          onClick={() => setShowArchived((current) => !current)}
          className="w-full flex items-center justify-between px-4 py-4 text-left"
        >
          <div>
            <p className="font-medium text-foreground">Archives des rendez-vous passes</p>
            <p className="text-sm text-muted-foreground">Masque les rendez-vous deja passes pour garder une liste admin plus legere.</p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="font-body">{archivedBookings.length}</Badge>
            <ChevronDown size={18} className={showArchived ? "rotate-180 transition-transform" : "transition-transform"} />
          </div>
        </button>

        {showArchived && (
          <>
            {renderBookingCards(archivedBookings)}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Service</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Heure</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Acompte</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {renderBookingRows(archivedBookings)}
                  {archivedBookings.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        Aucun rendez-vous archive
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AdminBookings;
