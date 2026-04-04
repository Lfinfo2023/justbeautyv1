import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarSync, CheckCircle2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getServiceLabel } from "@/lib/booking";
import { Calendar } from "@/components/ui/calendar";

const AdminCalendar = () => {
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const { data: bookings, isLoading: bookingsLoading } = useQuery({
    queryKey: ["admin-bookings"],
    queryFn: api.bookings.listAdmin,
  });

  const { data: caldavStatus, isLoading: statusLoading } = useQuery({
    queryKey: ["admin-caldav-status"],
    queryFn: api.bookings.caldavStatus,
  });

  const syncCalendar = useMutation({
    mutationFn: async () => api.bookings.syncCalendar(),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["admin-caldav-status"] });

      if (!result.enabled) {
        toast.error("CalDAV n'est pas configure cote serveur");
        return;
      }
      if (result.errors.length) {
        toast.error(`Synchro partielle: ${result.synced} rendez-vous, ${result.cleaned} nettoyage(s), ${result.errors.length} erreur(s)`);
        return;
      }
      toast.success(`Calendrier synchronise: ${result.synced} rendez-vous, ${result.cleaned} nettoyage(s)`);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Impossible de synchroniser le calendrier");
    },
  });

  const confirmedUpcoming = useMemo(() => {
    const now = Date.now();
    return [...(bookings ?? [])]
      .filter((booking) => booking.status === "confirmed")
      .filter((booking) => {
        const duration = booking.services?.duration_minutes ?? 90;
        const endTime = new Date(`${booking.booking_date}T${booking.booking_time}:00`).getTime() + duration * 60 * 1000;
        return endTime >= now;
      })
      .sort((a, b) => new Date(`${a.booking_date}T${a.booking_time}:00`).getTime() - new Date(`${b.booking_date}T${b.booking_time}:00`).getTime());
  }, [bookings]);

  const bookingsByDate = useMemo(() => {
    const map = new Map<string, typeof confirmedUpcoming>();
    confirmedUpcoming.forEach((booking) => {
      const key = booking.booking_date;
      const current = map.get(key) || [];
      current.push(booking);
      map.set(key, current);
    });
    return map;
  }, [confirmedUpcoming]);

  const selectedKey = format(selectedDate, "yyyy-MM-dd");
  const selectedBookings = bookingsByDate.get(selectedKey) || [];
  const highlightedDates = useMemo(
    () => Array.from(bookingsByDate.keys()).map((key) => new Date(`${key}T12:00:00`)),
    [bookingsByDate],
  );

  if (bookingsLoading || statusLoading) {
    return <p className="text-muted-foreground">Chargement...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <h3 className="font-display text-xl text-foreground">Calendrier CalDAV</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Cet onglet sert au suivi et a la synchronisation des rendez-vous confirmes vers votre agenda CalDAV.
          </p>
        </div>
        <Button type="button" variant="outline" className="rounded-full gap-2 w-full sm:w-auto" onClick={() => syncCalendar.mutate()} disabled={syncCalendar.isPending}>
          <RefreshCw size={16} className={syncCalendar.isPending ? "animate-spin" : ""} />
          {syncCalendar.isPending ? "Synchronisation..." : "Synchroniser CalDAV"}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card rounded-2xl border border-border/50 p-5">
          <p className="text-sm text-muted-foreground">Configuration</p>
          <p className="mt-2 font-display text-2xl text-foreground">{caldavStatus?.enabled ? "Active" : "Inactive"}</p>
        </div>
        <div className="bg-card rounded-2xl border border-border/50 p-5">
          <p className="text-sm text-muted-foreground">Rendez-vous confirmes</p>
          <p className="mt-2 font-display text-2xl text-foreground">{caldavStatus?.confirmed_bookings ?? 0}</p>
        </div>
        <div className="bg-card rounded-2xl border border-border/50 p-5">
          <p className="text-sm text-muted-foreground">Evenements synchronises</p>
          <p className="mt-2 font-display text-2xl text-foreground">{caldavStatus?.synced_events ?? 0}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[320px,1fr] gap-6">
        <div className="bg-card rounded-2xl border border-border/50 p-4 overflow-x-auto">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(date) => date && setSelectedDate(date)}
            modifiers={{ hasBooking: highlightedDates }}
            modifiersClassNames={{ hasBooking: "bg-primary/15 text-foreground font-semibold rounded-md" }}
            className="min-w-[280px] p-0 pointer-events-auto"
          />
        </div>

        <div className="bg-card rounded-2xl border border-border/50 p-6 space-y-4">
          <div className="flex items-center gap-3">
            <CalendarSync size={18} className="text-rose-gold" />
            <div>
              <h4 className="font-medium text-foreground">Calendrier des rendez-vous confirmes</h4>
              <p className="text-sm text-muted-foreground">
                {format(selectedDate, "EEEE d MMMM yyyy", { locale: fr })} • {selectedBookings.length} rendez-vous
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {selectedBookings.length === 0 && (
              <p className="text-sm text-muted-foreground">Aucun rendez-vous confirme sur ce jour.</p>
            )}

            {selectedBookings.map((booking) => (
              <div key={booking.id} className="rounded-xl border border-border/50 bg-muted/20 p-4">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div>
                    <p className="font-medium text-foreground">{booking.client_name}</p>
                    <p className="text-sm text-muted-foreground">{getServiceLabel(booking.services)}</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(`${booking.booking_date}T12:00:00`), "EEEE d MMMM yyyy", { locale: fr })} a {booking.booking_time.slice(0, 5)}
                    </p>
                  </div>
                  <Badge variant="secondary" className="w-fit gap-1">
                    <CheckCircle2 size={12} />
                    Confirme
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-card rounded-2xl border border-border/50 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <CalendarSync size={18} className="text-rose-gold" />
          <div>
            <h4 className="font-medium text-foreground">Prochains rendez-vous confirmes</h4>
            <p className="text-sm text-muted-foreground">
              Liste utile pour verifier rapidement ce qui doit apparaitre dans l'agenda connecte.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {confirmedUpcoming.length === 0 && (
            <p className="text-sm text-muted-foreground">Aucun rendez-vous confirme a synchroniser pour le moment.</p>
          )}

          {confirmedUpcoming.map((booking) => (
            <div key={booking.id} className="rounded-xl border border-border/50 bg-muted/20 p-4">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div>
                  <p className="font-medium text-foreground">{booking.client_name}</p>
                  <p className="text-sm text-muted-foreground">{getServiceLabel(booking.services)}</p>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(`${booking.booking_date}T12:00:00`), "EEEE d MMMM yyyy", { locale: fr })} a {booking.booking_time.slice(0, 5)}
                  </p>
                </div>
                <Badge variant="secondary" className="w-fit gap-1">
                  <CheckCircle2 size={12} />
                  Confirme
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminCalendar;
