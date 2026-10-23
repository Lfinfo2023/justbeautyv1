import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarCheck, CalendarDays, ChevronDown, Clock3, Lock, RotateCcw, Save, Unlock } from "lucide-react";
import { api, type WeeklyScheduleDay } from "@/lib/api";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

const toKey = (date: Date) => format(date, "yyyy-MM-dd");
const DEFAULT_TIME_SLOTS = ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30", "18:00", "18:30", "19:00", "19:30"];
const RANGE_END_OPTIONS = ["09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30", "18:00", "18:30", "19:00", "19:30", "20:00"];
const WEEKDAY_LABELS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

const defaultWeeklySchedule = (): WeeklyScheduleDay[] =>
  WEEKDAY_LABELS.map((label, weekday) => ({
    weekday,
    key: label.toLowerCase(),
    is_open: weekday !== 0,
    updated_at: new Date().toISOString(),
    ranges: weekday === 0 ? [] : [{ start_time: "15:00", end_time: "18:30" }],
  }));

const AdminAvailabilitySettings = () => {
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [baseScheduleExpanded, setBaseScheduleExpanded] = useState(false);
  const [weeklySchedule, setWeeklySchedule] = useState<WeeklyScheduleDay[]>(defaultWeeklySchedule);
  const [rangeStart, setRangeStart] = useState("15:00");
  const [rangeEnd, setRangeEnd] = useState("20:00");
  const [rangeMode, setRangeMode] = useState<"open_only" | "close_only">("open_only");

  const { data: overrides } = useQuery({
    queryKey: ["admin-availability"],
    queryFn: api.availability.listAdmin,
  });
  const { data: googleCalendarStatus } = useQuery({
    queryKey: ["google-calendar-status"],
    queryFn: api.bookings.googleCalendarStatus,
  });

  useEffect(() => {
    if (overrides?.weeklySchedule?.length) {
      setWeeklySchedule(overrides.weeklySchedule);
    }
  }, [overrides]);

  const dayOverrideMap = useMemo(
    () => new Map((overrides?.days ?? []).map((item) => [item.date, item.status])),
    [overrides],
  );

  const slotOverrideMap = useMemo(
    () => new Map((overrides?.slots ?? []).map((item) => [`${item.date}::${item.time}`, item.status])),
    [overrides],
  );

  const selectedKey = toKey(selectedDate);
  const selectedOverride = dayOverrideMap.get(selectedKey);
  const selectedWeekdaySchedule = weeklySchedule.find((item) => item.weekday === selectedDate.getDay());
  const defaultStatus = selectedWeekdaySchedule?.is_open && (selectedWeekdaySchedule.ranges?.length ?? 0) > 0
    ? "Ouvert selon l'horaire de base"
    : "Fermé selon l'horaire de base";
  const effectiveStatus = selectedOverride === "open"
    ? "Ouvert explicitement"
    : selectedOverride === "closed"
      ? "Fermé explicitement"
      : defaultStatus;
  const timeSlots = overrides?.timeSlots?.length ? overrides.timeSlots : DEFAULT_TIME_SLOTS;
  const slotState = (time: string) => slotOverrideMap.get(`${selectedKey}::${time}`);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-availability"] });
    queryClient.invalidateQueries({ queryKey: ["availability"] });
  };

  const openDate = useMutation({
    mutationFn: async () => api.availability.setStatus(selectedKey, "open"),
    onSuccess: () => {
      refresh();
      toast.success("Date ouverte");
    },
  });

  const closeDate = useMutation({
    mutationFn: async () => api.availability.setStatus(selectedKey, "closed"),
    onSuccess: () => {
      refresh();
      toast.success("Date fermée");
    },
  });

  const resetDate = useMutation({
    mutationFn: async () => api.availability.reset(selectedKey),
    onSuccess: () => {
      refresh();
      toast.success("Règle supprimée");
    },
  });

  const setSlotState = useMutation({
    mutationFn: async ({ time, status }: { time: string; status: "open" | "closed" }) =>
      api.availability.setSlotStatus(selectedKey, time, status),
    onSuccess: (_, variables) => {
      refresh();
      toast.success(`Créneau ${variables.time} mis à jour`);
    },
  });

  const resetSlotState = useMutation({
    mutationFn: async (time: string) => api.availability.resetSlot(selectedKey, time),
    onSuccess: (_, time) => {
      refresh();
      toast.success(`Règle supprimée pour ${time}`);
    },
  });

  const saveWeeklySchedule = useMutation({
    mutationFn: async () => api.availability.saveWeeklySchedule(weeklySchedule),
    onSuccess: (data) => {
      setWeeklySchedule(data);
      refresh();
      toast.success("Horaire de base enregistré");
    },
    onError: (error: Error) => toast.error(error.message || "Impossible d'enregistrer l'horaire"),
  });

  const applyRange = useMutation({
    mutationFn: async () => api.availability.applyRange({
      date: selectedKey,
      start_time: rangeStart,
      end_time: rangeEnd,
      mode: rangeMode,
    }),
    onSuccess: () => {
      refresh();
      toast.success(rangeMode === "open_only" ? "Plage ouverte uniquement sur cette date" : "Plage fermée sur cette date");
    },
    onError: (error: Error) => toast.error(error.message || "Impossible d'appliquer la plage"),
  });

  const updateDay = (weekday: number, updater: (day: WeeklyScheduleDay) => WeeklyScheduleDay) => {
    setWeeklySchedule((current) => current.map((day) => (day.weekday === weekday ? updater(day) : day)));
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-display text-xl text-foreground">Horaires d'ouverture</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Gérez l'horaire hebdomadaire, les exceptions par date et les créneaux précis.
        </p>
      </div>

      <div className="bg-card rounded-2xl border border-border/50 p-6 space-y-2">
        <div className="flex items-center gap-3">
          <CalendarCheck size={20} className="text-rose-gold" />
          <div>
            <h4 className="font-medium text-foreground">Google Calendar</h4>
            <p className="text-sm text-muted-foreground">
              {googleCalendarStatus?.oauth_connected
                ? "Connecté : toute journée contenant un événement Google est automatiquement fermée aux réservations."
                : googleCalendarStatus?.oauth_configured
                  ? "OAuth est prêt. Ouvrez l’onglet Calendrier puis cliquez sur « Connecter Google Calendar »."
                  : `OAuth incomplet : ajoutez ${googleCalendarStatus?.oauth_missing?.join(", ") || "les identifiants OAuth"} dans le fichier .env du serveur.`}
            </p>
          </div>
        </div>
        {googleCalendarStatus?.enabled && googleCalendarStatus.fail_closed && (
          <p className="text-xs text-muted-foreground">Par sécurité, les réservations sont aussi bloquées si Google Calendar est momentanément inaccessible.</p>
        )}
      </div>

      <div className="bg-card rounded-2xl border border-border/50 p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h4 className="font-medium text-foreground">Horaire de base</h4>
            <p className="text-sm text-muted-foreground">
              Cet horaire sert de défaut pour les disponibilités publiques.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setBaseScheduleExpanded((current) => !current)}
              className="rounded-full gap-2"
            >
              <ChevronDown size={16} className={baseScheduleExpanded ? "rotate-180 transition-transform" : "transition-transform"} />
              {baseScheduleExpanded ? "Masquer" : "Afficher"}
            </Button>
            <Button onClick={() => saveWeeklySchedule.mutate()} disabled={saveWeeklySchedule.isPending || !baseScheduleExpanded} className="rounded-full gap-2 bg-primary text-primary-foreground">
              <Save size={16} /> {saveWeeklySchedule.isPending ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </div>
        </div>

        {baseScheduleExpanded && (
          <div className="space-y-4">
            {weeklySchedule.map((day) => (
              <div key={day.weekday} className="rounded-xl border border-border/50 bg-muted/20 p-4 space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-foreground">{WEEKDAY_LABELS[day.weekday]}</p>
                    <p className="text-xs text-muted-foreground">
                      {day.is_open ? `${day.ranges.length} plage(s) définie(s)` : "Fermé par défaut"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">Ouvert</span>
                    <Switch
                      checked={day.is_open}
                      onCheckedChange={(checked) => updateDay(day.weekday, (current) => ({ ...current, is_open: checked }))}
                    />
                  </div>
                </div>

                {day.is_open && (
                  <div className="space-y-3">
                    {day.ranges.map((range, index) => (
                      <div key={`${day.weekday}-${index}`} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3 items-center">
                        <Select
                          value={range.start_time}
                          onValueChange={(value) =>
                            updateDay(day.weekday, (current) => ({
                              ...current,
                              ranges: current.ranges.map((item, itemIndex) => itemIndex === index ? { ...item, start_time: value } : item),
                            }))
                          }
                        >
                          <SelectTrigger className="bg-background">
                            <SelectValue placeholder="Début" />
                          </SelectTrigger>
                          <SelectContent>
                            {timeSlots.map((time) => <SelectItem key={time} value={time}>{time}</SelectItem>)}
                          </SelectContent>
                        </Select>

                        <Select
                          value={range.end_time}
                          onValueChange={(value) =>
                            updateDay(day.weekday, (current) => ({
                              ...current,
                              ranges: current.ranges.map((item, itemIndex) => itemIndex === index ? { ...item, end_time: value } : item),
                            }))
                          }
                        >
                          <SelectTrigger className="bg-background">
                            <SelectValue placeholder="Fin" />
                          </SelectTrigger>
                          <SelectContent>
                            {RANGE_END_OPTIONS.map((time) => <SelectItem key={time} value={time}>{time}</SelectItem>)}
                          </SelectContent>
                        </Select>

                        <Button
                          variant="outline"
                          onClick={() =>
                            updateDay(day.weekday, (current) => ({
                              ...current,
                              ranges: current.ranges.filter((_, itemIndex) => itemIndex !== index),
                            }))
                          }
                        >
                          Supprimer
                        </Button>
                      </div>
                    ))}

                    <Button
                      variant="secondary"
                      onClick={() =>
                        updateDay(day.weekday, (current) => ({
                          ...current,
                          ranges: [...current.ranges, { start_time: "15:00", end_time: "18:30" }],
                        }))
                      }
                    >
                      Ajouter une plage
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[320px,1fr] gap-6">
        <div className="bg-card rounded-2xl border border-border/50 p-4 overflow-x-auto">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(date) => date && setSelectedDate(date)}
            className="min-w-[280px] p-0 pointer-events-auto"
          />
        </div>

        <div className="space-y-4">
          <div className="bg-card rounded-2xl border border-border/50 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <CalendarDays size={20} className="text-rose-gold" />
              <div>
                <p className="font-medium text-foreground">{format(selectedDate, "EEEE d MMMM yyyy", { locale: fr })}</p>
                <p className="text-sm text-muted-foreground">{effectiveStatus}</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3">
              <Button onClick={() => openDate.mutate()} className="rounded-full gap-2 bg-primary text-primary-foreground">
                <Unlock size={16} /> Ouvrir la journée
              </Button>
              <Button onClick={() => closeDate.mutate()} variant="secondary" className="rounded-full gap-2">
                <Lock size={16} /> Fermer la journée
              </Button>
              <Button onClick={() => resetDate.mutate()} variant="outline" className="rounded-full gap-2">
                <RotateCcw size={16} /> Revenir au défaut
              </Button>
            </div>
          </div>

          <div className="bg-card rounded-2xl border border-border/50 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <Clock3 size={18} className="text-rose-gold" />
              <div>
                <h4 className="font-medium text-foreground">Appliquer une plage</h4>
                <p className="text-sm text-muted-foreground">
                  "Ouvrir uniquement" ferme d'abord la date puis rouvre seulement la plage choisie.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Select value={rangeStart} onValueChange={setRangeStart}>
                <SelectTrigger><SelectValue placeholder="Début" /></SelectTrigger>
                <SelectContent>
                  {timeSlots.map((time) => <SelectItem key={time} value={time}>{time}</SelectItem>)}
                </SelectContent>
              </Select>

              <Select value={rangeEnd} onValueChange={setRangeEnd}>
                <SelectTrigger><SelectValue placeholder="Fin" /></SelectTrigger>
                <SelectContent>
                  {RANGE_END_OPTIONS.map((time) => <SelectItem key={time} value={time}>{time}</SelectItem>)}
                </SelectContent>
              </Select>

              <Select value={rangeMode} onValueChange={(value: "open_only" | "close_only") => setRangeMode(value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="open_only">Ouvrir uniquement</SelectItem>
                  <SelectItem value="close_only">Fermer cette plage</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button onClick={() => applyRange.mutate()} disabled={applyRange.isPending} className="rounded-full bg-primary text-primary-foreground">
              {applyRange.isPending ? "Application..." : "Appliquer la plage"}
            </Button>
          </div>

          <div className="bg-card rounded-2xl border border-border/50 p-6">
            <div className="flex items-center gap-3 mb-4">
              <Clock3 size={18} className="text-rose-gold" />
              <div>
                <h4 className="font-medium text-foreground">Créneaux horaires</h4>
                <p className="text-sm text-muted-foreground">
                  Ouvre ou ferme seulement certaines heures sur cette date.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {timeSlots.map((time) => {
                const status = slotState(time);
                const label = status === "open" ? "Ouvert explicitement" : status === "closed" ? "Fermé explicitement" : "Suit la règle du jour";

                return (
                  <div key={time} className="rounded-xl border border-border/50 bg-muted/30 p-4 space-y-3">
                    <div>
                      <p className="font-medium text-foreground">{time}</p>
                      <p className="text-xs text-muted-foreground">{label}</p>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2">
                      <Button size="sm" onClick={() => setSlotState.mutate({ time, status: "open" })} className="rounded-full gap-2 bg-primary text-primary-foreground">
                        <Unlock size={14} /> Ouvrir
                      </Button>
                      <Button size="sm" onClick={() => setSlotState.mutate({ time, status: "closed" })} variant="secondary" className="rounded-full gap-2">
                        <Lock size={14} /> Fermer
                      </Button>
                      <Button size="sm" onClick={() => resetSlotState.mutate(time)} variant="outline" className="rounded-full gap-2">
                        <RotateCcw size={14} /> Défaut
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminAvailabilitySettings;
