import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api, customerAuthStorage, type BookingPaymentStatusResponse, type DepositMethod } from "@/lib/api";
import { CalendarIcon, Clock, Check, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import AnimatedSection from "@/components/AnimatedSection";
import { useClientAuth } from "@/hooks/useClientAuth";
import { getServiceLabel, isManicureOptionService } from "@/lib/booking";

const DEFAULT_TIME_SLOTS = ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30", "18:00", "18:30", "19:00", "19:30"];

const Booking = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState(1);
  const [category, setCategory] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>([]);
  const [date, setDate] = useState<Date>();
  const [time, setTime] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [bookingMode, setBookingMode] = useState<"guest" | "login" | "register">("guest");
  const [password, setPassword] = useState("");
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [depositMethod, setDepositMethod] = useState<DepositMethod>("mollie");
  const [confirmed, setConfirmed] = useState(false);
  const [authError, setAuthError] = useState("");
  const [paymentIssueError, setPaymentIssueError] = useState("");
  const [confirmationDetails, setConfirmationDetails] = useState<{
    clientName: string;
    serviceLabel: string;
    bookingDate: string;
    bookingTime: string;
    depositRequired: boolean;
    depositAmount: number;
  } | null>(null);
  const [paymentIssueReport, setPaymentIssueReport] = useState<Record<string, unknown> | null>(null);
  const { customer, refresh, signIn } = useClientAuth();
  const paymentReturn = searchParams.get("payment") === "return";
  const paymentBookingId = searchParams.get("booking") || "";

  const { data: services } = useQuery({
    queryKey: ["services"],
    queryFn: api.services.listPublic,
  });

  const { data: availability } = useQuery({
    queryKey: ["availability"],
    queryFn: api.availability.listPublic,
  });

  const { data: paymentSettings } = useQuery({
    queryKey: ["payment-settings", customer?.id || "guest"],
    queryFn: api.paymentSettings.getPublic,
  });
  const paymentStatusQuery = useQuery({
    queryKey: ["booking-payment-status", paymentBookingId],
    queryFn: () => api.bookings.getPaymentStatus(paymentBookingId),
    enabled: paymentReturn && Boolean(paymentBookingId),
    refetchInterval: ({ state }) => (state.data?.payment_status === "open" ? 5000 : false),
  });
  const selectedDateKey = date ? format(date, "yyyy-MM-dd") : "";
  const availableSlotsQuery = useQuery({
    queryKey: ["availability-slots", selectedDateKey, serviceId],
    queryFn: () => api.availability.listPublicSlots(selectedDateKey, serviceId),
    enabled: Boolean(selectedDateKey && serviceId),
  });

  const categories = useMemo(
    () => Array.from(new Set((services ?? []).map((service) => service.category))),
    [services],
  );

  const servicesForCategory = useMemo(
    () => (services ?? []).filter((service) => service.category === category),
    [services, category],
  );
  const primaryServicesForCategory = useMemo(
    () => servicesForCategory.filter((service) => !isManicureOptionService(service)),
    [servicesForCategory],
  );
  const optionServicesForCategory = useMemo(
    () => servicesForCategory.filter((service) => isManicureOptionService(service)),
    [servicesForCategory],
  );

  const availabilityMap = useMemo(
    () => new Map((availability?.days ?? []).map((item) => [item.date, item.status])),
    [availability],
  );

  const weeklyScheduleMap = useMemo(
    () => new Map((availability?.weeklySchedule ?? []).map((item) => [item.weekday, item])),
    [availability],
  );

  const slotAvailabilityMap = useMemo(
    () => new Map((availability?.slots ?? []).map((item) => [`${item.date}::${item.time}`, item.status])),
    [availability],
  );

  const timeSlots = availability?.timeSlots?.length ? availability.timeSlots : DEFAULT_TIME_SLOTS;
  const selectedService = services?.find((service) => service.id === serviceId);
  const selectedOptions = useMemo(
    () => optionServicesForCategory.filter((service) => selectedOptionIds.includes(service.id)),
    [optionServicesForCategory, selectedOptionIds],
  );
  const totalDisplayedPrice = useMemo(
    () => Number((Number(selectedService?.price || 0) + selectedOptions.reduce((sum, option) => sum + Number(option.price || 0), 0)).toFixed(2)),
    [selectedService, selectedOptions],
  );

  const depositPreview = useMemo(() => {
    if (!selectedService || !paymentSettings?.enabled) {
      return { required: false, amount: 0, trusted: false };
    }
    const trusted = Boolean(paymentSettings.trusted_customer || customer?.trusted_no_deposit);
    const required = selectedService.price > paymentSettings.deposit_threshold && !trusted;
    const amount = required ? Number((selectedService.price * (paymentSettings.deposit_rate / 100)).toFixed(2)) : 0;
    return { required, amount, trusted };
  }, [selectedService, paymentSettings, customer]);

  useEffect(() => {
    if (paymentSettings?.mollie_enabled) {
      setDepositMethod("mollie");
    }
  }, [paymentSettings?.mollie_enabled]);

  const toMinutes = (slot: string) => {
    const [hours, minutes] = slot.split(":").map(Number);
    return hours * 60 + minutes;
  };

  const isSlotAvailable = (dateKey: string, slot: string) => {
    const override = slotAvailabilityMap.get(`${dateKey}::${slot}`);
    if (override === "closed") return false;

    const dayOverride = availabilityMap.get(dateKey);
    if (dayOverride === "closed") return false;

    const duration = selectedService?.duration_minutes ?? 0;
    const slotEnd = toMinutes(slot) + duration;

    if (override === "open" || dayOverride === "open") return true;

    const weekday = new Date(`${dateKey}T12:00:00`).getDay();
    const weeklyDay = weeklyScheduleMap.get(weekday);
    if (!weeklyDay?.is_open) return false;

    return weeklyDay.ranges.some((range) => {
      const start = toMinutes(range.start_time);
      const end = toMinutes(range.end_time);
      return toMinutes(slot) >= start && slotEnd <= end;
    });
  };

  const hasAvailableSlot = (dateKey: string) => timeSlots.some((slot) => isSlotAvailable(dateKey, slot));

  const isDateDisabled = (day: Date) => {
    const normalized = new Date(day);
    normalized.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (normalized <= today) return true;

    const key = format(day, "yyyy-MM-dd");
    return !hasAvailableSlot(key);
  };

  const availableTimeSlots = useMemo(() => {
    if (!date || !serviceId) return [];
    return availableSlotsQuery.data?.slots ?? [];
  }, [date, serviceId, availableSlotsQuery.data]);

  useEffect(() => {
    if (!date || !time) return;
    if (!availableTimeSlots.includes(time)) {
      setTime("");
    }
  }, [date, time, availableTimeSlots]);

  useEffect(() => {
    if (!customer) return;
    setName(`${customer.first_name} ${customer.last_name}`.trim());
    setEmail(customer.email);
    setPhone(customer.phone);
    setBookingMode("guest");
    setPassword("");
    setLoginPassword("");
    setAuthError("");
  }, [customer]);

  const submit = useMutation({
    mutationFn: async () => {
      setPaymentIssueReport(null);
      setPaymentIssueError("");
      const result = await api.bookings.create({
        service_id: serviceId,
        booking_date: format(date!, "yyyy-MM-dd"),
        booking_time: time,
        client_name: name,
        client_email: email,
        client_phone: phone,
        notes: selectedOptions.length ? `Options manucure: ${selectedOptions.map((option) => option.name).join(", ")}` : "",
        deposit_method: depositPreview.required ? depositMethod : "none",
        ...(bookingMode === "register" && !customer ? {
          create_account: true,
          password,
          marketing_consent: marketingConsent,
          first_name: name.trim().split(" ").slice(0, 1).join(" "),
          last_name: name.trim().split(" ").slice(1).join(" "),
        } : {}),
      });

      if (result.customer_token) {
        customerAuthStorage.setToken(result.customer_token);
        await refresh();
      }

      return result;
    },
    onSuccess: (result) => {
      setPaymentIssueReport(null);
      setPaymentIssueError("");
      if (result.payment_required && result.deposit_method === "mollie" && result.deposit_checkout_url) {
        window.location.href = result.deposit_checkout_url;
        return;
      }

      setConfirmationDetails({
        clientName: name,
        serviceLabel: getServiceLabel(selectedService),
        bookingDate: date ? format(date, "EEEE d MMMM yyyy", { locale: fr }) : "",
        bookingTime: time,
        depositRequired: Boolean(result.deposit_required),
        depositAmount: result.deposit_amount || 0,
      });
      setConfirmed(true);
      toast.success("Demande de rendez-vous envoyee");
    },
    onError: (error) => {
      const message = error.message || "Erreur lors de l'envoi";
      if (message.toLowerCase().includes("mollie") || message.toLowerCase().includes("webhook")) {
        setPaymentIssueError(message);
        setPaymentIssueReport({
          timestamp: new Date().toISOString(),
          current_url: window.location.href,
          user_agent: window.navigator.userAgent,
          client: {
            name,
            email,
            phone,
          },
          booking: {
            service_id: serviceId,
            service_label: getServiceLabel(selectedService),
            selected_options: selectedOptions.map((option) => option.name),
            booking_date: date ? format(date, "yyyy-MM-dd") : "",
            booking_time: time,
            booking_mode: bookingMode,
          },
          payment: {
            deposit_required: depositPreview.required,
            deposit_amount: depositPreview.amount,
            deposit_method: depositMethod,
            payment_settings: paymentSettings,
          },
          error_message: message,
        });
        return;
      }
      toast.error(message);
    },
  });

  const reportPaymentIssue = useMutation({
    mutationFn: async () =>
      api.support.reportPaymentIssue({
        client_name: name || paymentStatusQuery.data?.booking.client_name || "",
        client_email: email || paymentStatusQuery.data?.booking.client_email || "",
        client_phone: phone || paymentStatusQuery.data?.booking.client_phone || "",
        service_label: getServiceLabel(selectedService) || (paymentStatusQuery.data ? `${paymentStatusQuery.data.service.category} - ${paymentStatusQuery.data.service.name}` : ""),
        booking_slot: date
          ? `${format(date, "yyyy-MM-dd")} ${time}`
          : paymentStatusQuery.data
            ? `${paymentStatusQuery.data.booking.booking_date} ${paymentStatusQuery.data.booking.booking_time}`
            : "",
        deposit_method: "mollie",
        error_message: paymentIssueError,
        logs: paymentIssueReport || {},
      }),
    onSuccess: () => {
      toast.success("Le probleme a ete signale pour analyse");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Impossible d'envoyer le signalement");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submit.mutate();
  };

  const handleExistingAccountLogin = async () => {
    setAuthError("");
    const result = await signIn(loginEmail, loginPassword);
    if (result.error) {
      setAuthError(result.error.message || "Connexion impossible");
      return;
    }
    toast.success("Compte connecte pour cette réservation");
  };

  const toggleOption = (optionId: string) => {
    setSelectedOptionIds((current) => current.includes(optionId)
      ? current.filter((id) => id !== optionId)
      : [...current, optionId]);
  };

  const retryPayment = useMutation({
    mutationFn: async () => api.bookings.retryPayment(paymentBookingId),
    onSuccess: (result) => {
      if (result.booking.deposit_checkout_url) {
        window.location.href = result.booking.deposit_checkout_url;
        return;
      }
      toast.error("Impossible de relancer le paiement.");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Impossible de relancer le paiement");
    },
  });

  const cancelPayment = useMutation({
    mutationFn: async () => api.bookings.cancelPayment(paymentBookingId),
    onSuccess: () => {
      toast.success("La demande de paiement a ete annulee");
      navigate("/rendez-vous", { replace: true });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Impossible d'annuler");
    },
  });

  const renderSuccessCard = (details: {
    clientName: string;
    serviceLabel: string;
    bookingDate: string;
    bookingTime: string;
    depositRequired: boolean;
    depositAmount: number;
  }) => (
    <main className="pt-24">
      <section className="section-padding">
        <div className="container-narrow max-w-lg text-center">
          <AnimatedSection>
            <div className="bg-card rounded-2xl p-12 border border-border/50 shadow-sm">
              <div className="w-20 h-20 rounded-full bg-primary/30 flex items-center justify-center mx-auto mb-6">
                <Check size={36} className="text-rose-gold" />
              </div>
              <h1 className="font-display text-3xl text-foreground mb-4">Demande envoyee</h1>
              <p className="text-muted-foreground leading-relaxed mb-2">
                Merci <strong>{details.clientName}</strong>. Votre demande a bien ete recue.
              </p>
              <div className="bg-muted/50 rounded-xl p-4 my-6 text-sm space-y-1">
                <p className="text-foreground font-medium">{details.serviceLabel}</p>
                <p className="text-muted-foreground">{details.bookingDate} a {details.bookingTime}</p>
                {details.depositRequired && (
                  <p className="text-muted-foreground">
                    Acompte valide de {details.depositAmount.toFixed(2)} EUR via Mollie.
                  </p>
                )}
              </div>
              <p className="text-muted-foreground text-sm">
                Un email vient d'etre envoye et Justine vous confirmera votre rendez-vous tres vite.
              </p>
            </div>
          </AnimatedSection>
        </div>
      </section>
    </main>
  );

  const renderPaymentReturn = (payload?: BookingPaymentStatusResponse) => {
    if (!paymentBookingId) {
      return (
        <main className="pt-24">
          <section className="section-padding">
            <div className="container-narrow max-w-lg text-center">
              <AnimatedSection>
                <div className="bg-card rounded-2xl p-10 border border-border/50 shadow-sm space-y-4">
                  <AlertCircle className="mx-auto text-rose-gold" size={36} />
                  <h1 className="font-display text-3xl text-foreground">Retour de paiement incomplet</h1>
                  <p className="text-muted-foreground">Aucune réservation en attente de paiement n'a ete trouvée.</p>
                  <Button asChild className="rounded-full">
                    <Link to="/rendez-vous">Revenir a la réservation</Link>
                  </Button>
                </div>
              </AnimatedSection>
            </div>
          </section>
        </main>
      );
    }

    if (paymentStatusQuery.isPending) {
      return (
        <main className="pt-24">
          <section className="section-padding">
            <div className="container-narrow max-w-lg text-center">
              <AnimatedSection>
                <div className="bg-card rounded-2xl p-10 border border-border/50 shadow-sm space-y-4">
                  <Loader2 className="mx-auto animate-spin text-rose-gold" size={36} />
                  <h1 className="font-display text-3xl text-foreground">Verification du paiement</h1>
                  <p className="text-muted-foreground">Nous verifions l'etat de votre acompte Mollie.</p>
                </div>
              </AnimatedSection>
            </div>
          </section>
        </main>
      );
    }

    if (paymentStatusQuery.isError || !payload) {
      return (
        <main className="pt-24">
          <section className="section-padding">
            <div className="container-narrow max-w-lg text-center">
              <AnimatedSection>
                <div className="bg-card rounded-2xl p-10 border border-border/50 shadow-sm space-y-4">
                  <AlertCircle className="mx-auto text-rose-gold" size={36} />
                  <h1 className="font-display text-3xl text-foreground">Paiement introuvable</h1>
                  <p className="text-muted-foreground">Nous n'avons pas pu recuperer l'etat de ce paiement.</p>
                  <Button asChild className="rounded-full">
                    <Link to="/rendez-vous">Revenir a la réservation</Link>
                  </Button>
                </div>
              </AnimatedSection>
            </div>
          </section>
        </main>
      );
    }

    if (payload.payment_status === "paid") {
      return renderSuccessCard({
        clientName: payload.booking.client_name,
        serviceLabel: `${payload.service.category} - ${payload.service.name}`,
        bookingDate: format(new Date(`${payload.booking.booking_date}T12:00:00`), "EEEE d MMMM yyyy", { locale: fr }),
        bookingTime: payload.booking.booking_time,
        depositRequired: true,
        depositAmount: payload.booking.deposit_amount || 0,
      });
    }

    const isOpen = payload.payment_status === "open" || payload.payment_status === "pending";
    const isRecoverable = ["failed", "cancelled", "expired"].includes(payload.payment_status);

    return (
      <main className="pt-24">
        <section className="section-padding">
          <div className="container-narrow max-w-lg text-center">
            <AnimatedSection>
              <div className="bg-card rounded-2xl p-10 border border-border/50 shadow-sm space-y-5">
                <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto">
                  {isOpen ? <Loader2 className="animate-spin text-rose-gold" size={28} /> : <AlertCircle className="text-rose-gold" size={28} />}
                </div>
                <h1 className="font-display text-3xl text-foreground">
                  {isOpen ? "Paiement en attente" : payload.payment_status === "expired" ? "Paiement expire" : payload.payment_status === "cancelled" ? "Paiement annule" : "Paiement echoue"}
                </h1>
                <div className="bg-muted/50 rounded-xl p-4 text-sm space-y-1">
                  <p className="text-foreground font-medium">{payload.service.category} - {payload.service.name}</p>
                  <p className="text-muted-foreground">{payload.booking.booking_date} a {payload.booking.booking_time}</p>
                  <p className="text-muted-foreground">Acompte: {(payload.booking.deposit_amount || 0).toFixed(2)} EUR</p>
                </div>
                <p className="text-muted-foreground">
                  {isOpen
                    ? "Le paiement Mollie est encore ouvert. Nous reverifions automatiquement toutes les 5 secondes, notamment pour un virement choisi directement dans Mollie."
                    : "La réservation n'est pas encore validée. Vous pouvez relancer le paiement ou annuler cette demande."}
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  {isOpen && payload.booking.deposit_checkout_url && (
                    <Button className="rounded-full" onClick={() => { window.location.href = payload.booking.deposit_checkout_url || ""; }}>
                      Retourner vers Mollie
                    </Button>
                  )}
                  {isRecoverable && payload.can_retry && (
                    <Button className="rounded-full" onClick={() => retryPayment.mutate()} disabled={retryPayment.isPending}>
                      {retryPayment.isPending ? "Redirection..." : "Reessayer le paiement"}
                    </Button>
                  )}
                  {!isOpen && payload.can_cancel && (
                    <Button variant="outline" className="rounded-full" onClick={() => cancelPayment.mutate()} disabled={cancelPayment.isPending}>
                      {cancelPayment.isPending ? "Annulation..." : "Annuler la demande"}
                    </Button>
                  )}
                </div>
              </div>
            </AnimatedSection>
          </div>
        </section>
      </main>
    );
  };

  if (confirmed && confirmationDetails) {
    return renderSuccessCard(confirmationDetails);
  }

  if (paymentReturn) {
    return renderPaymentReturn(paymentStatusQuery.data);
  }

  return (
    <main className="pt-24">
      <section className="section-padding">
        <div className="container-narrow max-w-2xl">
          <AnimatedSection>
            <div className="text-center mb-12">
              <p className="text-sm tracking-[0.3em] uppercase text-muted-foreground mb-3">Réservation</p>
              <h1 className="font-display text-4xl md:text-5xl text-foreground">
                Prendre <span className="italic text-gradient-rose">rendez-vous</span>
              </h1>
            </div>
          </AnimatedSection>

          <AnimatedSection delay={0.1}>
            <div className="flex items-center justify-center gap-1 sm:gap-2 mb-10">
              {[1, 2, 3].map((s) => (
                <div key={s} className="flex items-center gap-2">
                  <div className={cn("w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-sm font-body font-semibold transition-colors", step >= s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                    {s}
                  </div>
                  {s < 3 && <div className={cn("w-6 sm:w-12 h-0.5", step > s ? "bg-primary" : "bg-muted")} />}
                </div>
              ))}
            </div>
          </AnimatedSection>

          <form onSubmit={handleSubmit}>
            <AnimatedSection>
              <div className="bg-card rounded-2xl p-8 border border-border/50 shadow-sm">
                {step === 1 && (
                  <div className="space-y-6">
                    <h2 className="font-display text-xl text-foreground mb-4">Choisissez votre catégorie puis votre soin</h2>

                    <div>
                      <label className="text-sm text-muted-foreground mb-2 block">Catégorie</label>
                      <Select
                        value={category}
                        onValueChange={(value) => {
                          setCategory(value);
                          setServiceId("");
                          setSelectedOptionIds([]);
                        }}
                      >
                        <SelectTrigger className="rounded-lg bg-muted/50">
                          <SelectValue placeholder="Sélectionnez une catégorie" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((item) => (
                            <SelectItem key={item} value={item}>{item}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="text-sm text-muted-foreground mb-2 block">Service</label>
                      <Select value={serviceId} onValueChange={setServiceId} disabled={!category}>
                        <SelectTrigger className="rounded-lg bg-muted/50">
                          <SelectValue placeholder={category ? "Sélectionnez un service" : "Choisissez d'abord une catégorie"} />
                        </SelectTrigger>
                        <SelectContent>
                          {primaryServicesForCategory.map((service) => (
                            <SelectItem key={service.id} value={service.id}>
                              {service.name} - {service.price_label || `${service.price} EUR`} - {service.duration_minutes} min
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {selectedService && (
                      <div className="rounded-xl bg-muted/40 p-4 text-sm space-y-2">
                        <p className="font-medium text-foreground">{getServiceLabel(selectedService)}</p>
                        <p className="text-muted-foreground">{selectedService.description || "Soin realise dans une ambiance douce et cocooning."}</p>
                        <p className="text-muted-foreground">{selectedService.price_label || `${selectedService.price} EUR`} - {selectedService.duration_minutes} min</p>
                        {depositPreview.required && (
                          <p className="text-foreground">
                            Acompte demande: {depositPreview.amount.toFixed(2)} EUR ({paymentSettings?.deposit_rate}%)
                          </p>
                        )}
                        {!depositPreview.required && paymentSettings?.enabled && depositPreview.trusted && (
                          <p className="text-foreground">Votre compte client de confiance est dispensé d'acompte.</p>
                        )}
                      </div>
                    )}

                    {category === "Manucure" && optionServicesForCategory.length > 0 && (
                      <div className="rounded-xl border border-border/50 bg-muted/20 p-4 space-y-4">
                        <div>
                          <p className="font-medium text-foreground">Options et suppléments</p>
                          <p className="text-sm text-muted-foreground">
                            Choisissez d'abord une prestation manucure principale, puis ajoutez si besoin des options.
                          </p>
                        </div>
                        <div className="grid gap-3">
                          {optionServicesForCategory.map((option) => {
                            const checked = selectedOptionIds.includes(option.id);
                            return (
                              <label
                                key={option.id}
                                className={`flex items-start justify-between gap-4 rounded-xl border p-3 transition-colors ${checked ? "border-primary bg-primary/10" : "border-border/50 bg-background"}`}
                              >
                                <span className="flex items-start gap-3">
                                  <input
                                    type="checkbox"
                                    className="mt-1"
                                    checked={checked}
                                    onChange={() => toggleOption(option.id)}
                                    disabled={!serviceId}
                                  />
                                  <span>
                                    <span className="block font-medium text-foreground">{option.name}</span>
                                    <span className="block text-sm text-muted-foreground">Ajout manucure</span>
                                  </span>
                                </span>
                                <span className="font-display text-base font-semibold text-rose-gold">{option.price_label || `${option.price} EUR`}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className="flex justify-end">
                      <Button type="button" onClick={() => { setDate(undefined); setTime(""); setStep(2); }} disabled={!serviceId} className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-rose-gold hover:text-card rounded-full px-8 font-body tracking-wide transition-all duration-300">
                        Suivant
                      </Button>
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-6">
                    <h2 className="font-display text-xl text-foreground mb-4">Date et heure</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="text-sm text-muted-foreground mb-2 block">Date</label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className={cn("w-full justify-start text-left font-normal rounded-lg bg-muted/50", !date && "text-muted-foreground")}>
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {date ? format(date, "d MMMM yyyy", { locale: fr }) : "Choisir une date"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={date} onSelect={setDate} disabled={isDateDisabled} initialFocus className="p-3 pointer-events-auto" />
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div>
                        <label className="text-sm text-muted-foreground mb-2 block">Heure</label>
                        <Select value={time} onValueChange={setTime}>
                          <SelectTrigger className="rounded-lg bg-muted/50">
                            <Clock className="mr-2 h-4 w-4" />
                            <SelectValue placeholder="Choisir une heure" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableSlotsQuery.isLoading && (
                              <SelectItem value="__loading_slots" disabled>Chargement des creneaux...</SelectItem>
                            )}
                            {availableSlotsQuery.isError && (
                              <SelectItem value="__slots_error" disabled>Impossible de charger les creneaux</SelectItem>
                            )}
                            {!availableSlotsQuery.isLoading && !availableSlotsQuery.isError && availableTimeSlots.length === 0 && (
                              <SelectItem value="__no_slots" disabled>Aucun creneau disponible</SelectItem>
                            )}
                            {!availableSlotsQuery.isLoading && !availableSlotsQuery.isError && availableTimeSlots.map((slot) => (
                              <SelectItem key={slot} value={slot}>{slot}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="flex flex-col-reverse sm:flex-row justify-between gap-3">
                      <Button type="button" variant="ghost" onClick={() => setStep(1)} className="rounded-full font-body w-full sm:w-auto">Retour</Button>
                      <Button type="button" onClick={() => setStep(3)} disabled={!date || !time || availableTimeSlots.length === 0} className="bg-primary text-primary-foreground hover:bg-rose-gold hover:text-card rounded-full px-8 font-body tracking-wide transition-all duration-300 w-full sm:w-auto">
                        Suivant
                      </Button>
                    </div>
                  </div>
                )}

                {step === 3 && (
                  <div className="space-y-6">
                    <h2 className="font-display text-xl text-foreground mb-4">Vos coordonnees</h2>

                    {!customer && (
                      <div className="rounded-xl border border-border/50 bg-muted/30 p-4 space-y-4">
                        <p className="font-medium text-foreground">Choisissez votre mode de reservation</p>
                        <div className="flex flex-col sm:flex-row gap-3">
                          <Button type="button" variant={bookingMode === "guest" ? "default" : "outline"} className="rounded-full" onClick={() => setBookingMode("guest")}>
                            Continuer en invite
                          </Button>
                          <Button type="button" variant={bookingMode === "login" ? "default" : "outline"} className="rounded-full" onClick={() => setBookingMode("login")}>
                            Se connecter
                          </Button>
                          <Button type="button" variant={bookingMode === "register" ? "default" : "outline"} className="rounded-full" onClick={() => setBookingMode("register")}>
                            Creer un compte
                          </Button>
                        </div>

                        {bookingMode === "login" && (
                          <div className="rounded-xl bg-background/80 border border-border/50 p-4 space-y-3">
                            <p className="text-sm font-medium text-foreground">Connexion a un compte existant</p>
                            <Input type="email" placeholder="Votre email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} className="rounded-lg bg-muted/50" />
                            <Input type="password" placeholder="Votre mot de passe" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} className="rounded-lg bg-muted/50" />
                            {authError && <p className="text-sm text-destructive">{authError}</p>}
                            <Button type="button" className="rounded-full w-full sm:w-auto" onClick={handleExistingAccountLogin}>
                              Se connecter et utiliser mon compte
                            </Button>
                          </div>
                        )}

                        {bookingMode === "register" && (
                          <div className="text-xs text-muted-foreground space-y-2">
                            <p>Le compte permet de retrouver vos rendez-vous et de suivre vos passages pour obtenir 10% de reduction apres 10 visites validees.</p>
                            <label className="flex items-start gap-3 text-sm text-muted-foreground">
                              <input type="checkbox" checked={marketingConsent} onChange={(e) => setMarketingConsent(e.target.checked)} className="mt-1" />
                              <span>J'accepte de recevoir des communications de Just Beauty. Ce consentement reste facultatif.</span>
                            </label>
                            <label className="flex items-start gap-3 text-sm text-muted-foreground">
                              <input type="checkbox" checked={privacyAccepted} onChange={(e) => setPrivacyAccepted(e.target.checked)} className="mt-1" />
                              <span>J'accepte la <Link to="/politique-de-confidentialite" className="underline hover:text-foreground">politique de confidentialite</Link>.</span>
                            </label>
                          </div>
                        )}
                      </div>
                    )}

                    {customer && (
                      <div className="rounded-xl border border-border/50 bg-muted/30 p-4 text-sm space-y-1">
                        <p className="font-medium text-foreground">Reservation rattachee a votre compte</p>
                        <p className="text-muted-foreground">{customer.email} - {customer.loyalty_completed_visits} passage(s) valides</p>
                        {customer.trusted_no_deposit && <p className="text-foreground">Compte client de confiance: pas d'acompte demande.</p>}
                      </div>
                    )}

                    <Input placeholder="Votre nom complet" value={name} onChange={(e) => setName(e.target.value)} required className="rounded-lg bg-muted/50" />
                    <Input type="email" placeholder="Votre email" value={email} onChange={(e) => setEmail(e.target.value)} required className="rounded-lg bg-muted/50" />
                    <Input type="tel" placeholder="Votre telephone" value={phone} onChange={(e) => setPhone(e.target.value)} required className="rounded-lg bg-muted/50" />

                    {bookingMode === "register" && !customer && (
                      <Input type="password" placeholder="Choisissez un mot de passe" value={password} onChange={(e) => setPassword(e.target.value)} required className="rounded-lg bg-muted/50" />
                    )}

                    {depositPreview.required && (
                      <div className="rounded-xl border border-border/50 bg-muted/30 p-4 space-y-4 text-sm">
                        <div>
                          <p className="font-medium text-foreground">Acompte obligatoire</p>
                          <p className="text-muted-foreground">
                            Ce soin depasse {paymentSettings?.deposit_threshold} EUR. Un acompte de {depositPreview.amount.toFixed(2)} EUR est demande.
                          </p>
                        </div>

                        <div className="flex flex-col gap-3">
                          <div className="flex items-start gap-3 rounded-xl border border-border/50 bg-background p-3">
                            <span>
                              <span className="block font-medium text-foreground">Paiement en ligne avec Mollie</span>
                              <span className="block text-muted-foreground">Vous serez redirigee vers la page de paiement securisee. La reservation sera enregistree seulement apres reception d'un paiement Mollie reussi.</span>
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="bg-muted/50 rounded-xl p-4 text-sm space-y-1">
                      <p className="font-medium text-foreground">Recapitulatif</p>
                      <p className="text-muted-foreground">{getServiceLabel(selectedService)}</p>
                      {selectedOptions.length > 0 && (
                        <p className="text-muted-foreground">Options: {selectedOptions.map((option) => option.name).join(", ")}</p>
                      )}
                      <p className="text-muted-foreground">{selectedService ? (selectedService.price_label || `${selectedService.price} EUR`) : ""} {selectedService ? `- ${selectedService.duration_minutes} min` : ""}</p>
                      {selectedOptions.length > 0 && (
                        <p className="text-muted-foreground">Total indicatif avec options: {totalDisplayedPrice.toFixed(2)} EUR</p>
                      )}
                      <p className="text-muted-foreground">{date && format(date, "EEEE d MMMM yyyy", { locale: fr })} a {time}</p>
                      {depositPreview.required && (
                        <p className="text-foreground">Acompte a regler: {depositPreview.amount.toFixed(2)} EUR</p>
                      )}
                    </div>

                    <div className="flex flex-col-reverse sm:flex-row justify-between gap-3">
                      <Button type="button" variant="ghost" onClick={() => setStep(2)} className="rounded-full font-body w-full sm:w-auto">Retour</Button>
                      <Button
                        type="submit"
                        disabled={
                          !name
                          || !email
                          || !phone
                          || (bookingMode === "register" && !customer && password.length < 10)
                          || (bookingMode === "register" && !customer && !privacyAccepted)
                          || submit.isPending
                        }
                        className="bg-primary text-primary-foreground hover:bg-rose-gold hover:text-card rounded-full px-8 font-body tracking-wide transition-all duration-300 w-full sm:w-auto"
                      >
                        {submit.isPending ? "Envoi..." : depositPreview.required && depositMethod === "mollie" ? "Continuer vers le paiement" : "Confirmer"}
                      </Button>
                    </div>
                    {paymentIssueReport && (
                      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm space-y-3">
                        <p className="font-medium text-foreground">Un probleme de paiement a ete detecte</p>
                        <p className="text-muted-foreground">
                          Vous pouvez envoyer un rapport complet de debogage a l'equipe technique pour analyse.
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          className="rounded-full"
                          onClick={() => reportPaymentIssue.mutate()}
                          disabled={reportPaymentIssue.isPending}
                        >
                          {reportPaymentIssue.isPending ? "Envoi du signalement..." : "Signaler le probleme"}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </AnimatedSection>
          </form>
        </div>
      </section>
    </main>
  );
};

export default Booking;
