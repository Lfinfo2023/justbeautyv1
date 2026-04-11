import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useClientAuth } from "@/hooks/useClientAuth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import AnimatedSection from "@/components/AnimatedSection";
import { getBookingStatusLabel, getServiceLabel } from "@/lib/booking";
import { toast } from "sonner";

const Account = () => {
  const { customer, bookings, loyaltyTransactions, loading, signIn, signUp, signOut, deleteAccount } = useClientAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [registerForm, setRegisterForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    password: "",
    marketing_consent: false,
  });
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [error, setError] = useState("");
  const redirectTargetRaw = new URLSearchParams(location.search).get("redirect");
  const redirectTarget = redirectTargetRaw && redirectTargetRaw.startsWith("/") ? redirectTargetRaw : "/compte";

  if (loading) {
    return (
      <main className="pt-24">
        <section className="section-padding">
          <div className="container-narrow text-muted-foreground">Chargement...</div>
        </section>
      </main>
    );
  }

  if (customer) {
    return (
      <main className="pt-24">
        <section className="section-padding">
          <div className="container-narrow space-y-8">
            <AnimatedSection>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-sm tracking-[0.3em] uppercase text-muted-foreground mb-3">Mon compte</p>
                  <h1 className="font-display text-4xl text-foreground">
                    {customer.first_name} {customer.last_name}
                  </h1>
                  <p className="text-muted-foreground mt-2">{customer.email}</p>
                  {customer.deletion_scheduled_for && (
                    <p className="text-sm text-red-700 mt-2">
                      Suppression planifiee le {format(new Date(customer.deletion_scheduled_for), "d MMMM yyyy", { locale: fr })}.
                    </p>
                  )}
                </div>
                <Button variant="outline" className="rounded-full" onClick={() => signOut()}>
                  Se déconnecter
                </Button>
              </div>
            </AnimatedSection>

            <div className="grid grid-cols-1 lg:grid-cols-[320px,1fr] gap-6">
              <AnimatedSection>
                <div className="bg-card rounded-2xl border border-border/50 p-6 space-y-4">
                  <h2 className="font-display text-2xl text-foreground">Fidelite</h2>
                  <p className="text-5xl font-display text-foreground">{customer.loyalty_completed_visits}</p>
                  <p className="text-sm text-muted-foreground">passage(s) validé(s).</p>
                  <div className="rounded-xl bg-muted/40 p-4 space-y-2 text-sm">
                    <p className="font-medium text-foreground">
                      {customer.loyalty_available_discounts > 0
                        ? `${customer.loyalty_available_discounts} réduction(s) de ${customer.loyalty_discount_rate}% disponible(s)`
                        : `Réduction de ${customer.loyalty_discount_rate}% apres 10 passages`}
                    </p>
                    <p className="text-muted-foreground">
                      Progression actuelle : {customer.loyalty_progress_visits}/10 passages sur le cycle en cours.
                    </p>
                    <p className="text-muted-foreground">
                      Plus que {customer.loyalty_visits_until_discount} passage(s) avant la prochaine réduction.
                    </p>
                  </div>
                  <div className="space-y-3 pt-2">
                    {loyaltyTransactions.length === 0 && (
                      <p className="text-sm text-muted-foreground">Aucun passage valide pour le moment.</p>
                    )}
                    {loyaltyTransactions.map((transaction) => (
                      <div key={transaction.id} className="rounded-xl bg-muted/40 p-3 text-sm">
                        <p className="font-medium text-foreground">+{transaction.visits} passage</p>
                        <p className="text-muted-foreground">{transaction.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </AnimatedSection>

              <AnimatedSection delay={0.1}>
                <div className="bg-card rounded-2xl border border-border/50 p-6 space-y-6">
                  <h2 className="font-display text-2xl text-foreground mb-4">Mes rendez-vous</h2>
                  <div className="space-y-3">
                    {bookings.length === 0 && (
                      <p className="text-sm text-muted-foreground">Aucun rendez-vous rattaché à ce compte.</p>
                    )}
                    {bookings.map((booking) => (
                      <div key={booking.id} className="rounded-xl border border-border/50 bg-muted/30 p-4">
                        <p className="font-medium text-foreground">{getServiceLabel(booking.services)}</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(`${booking.booking_date}T12:00:00`), "EEEE d MMMM yyyy", { locale: fr })} a {booking.booking_time}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Statut: {getBookingStatusLabel(booking.status)}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-2xl border border-red-300 bg-red-50 p-5 space-y-3">
                    <h3 className="font-display text-xl text-red-800">Demande de suppression du compte</h3>
                    <p className="text-sm text-red-700">
                      Si vous demandez vous-même la suppression, un delai de 3 jours est lance avant l'effacement définitif du compte et des données associées.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-full border-red-400 text-red-700 hover:bg-red-100"
                      disabled={Boolean(customer.deletion_scheduled_for)}
                      onClick={async () => {
                        const confirmed = window.confirm("Une procedure de suppression sera lancee avec un delai de 3 jours. Voulez-vous continuer ?");
                        if (!confirmed) return;
                        const result = await deleteAccount();
                        if (result.error) {
                          toast.error(result.error.message || "Impossible de lancer la suppression du compte");
                          return;
                        }
                        toast.success("La suppression de votre compte a ete planifiee dans 3 jours");
                      }}
                    >
                      {customer.deletion_scheduled_for ? "Suppression deja planifiee" : "Demander la suppression de mon compte"}
                    </Button>
                  </div>
                </div>
              </AnimatedSection>
            </div>

          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="pt-24">
      <section className="section-padding">
        <div className="container-narrow max-w-xl">
          <AnimatedSection>
            <div className="text-center mb-10">
              <p className="text-sm tracking-[0.3em] uppercase text-muted-foreground mb-3">Mon compte</p>
              <h1 className="font-display text-4xl text-foreground">Connexion client</h1>
            </div>
          </AnimatedSection>

          <AnimatedSection delay={0.1}>
            <div className="bg-card rounded-2xl border border-border/50 p-8 space-y-6">
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  type="button"
                  variant={mode === "login" ? "default" : "outline"}
                  className="rounded-full w-full sm:w-auto"
                  onClick={() => setMode("login")}
                >
                  Connexion
                </Button>
                <Button
                  type="button"
                  variant={mode === "register" ? "default" : "outline"}
                  className="rounded-full w-full sm:w-auto"
                  onClick={() => setMode("register")}
                >
                  Créer un compte
                </Button>
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              {mode === "login" ? (
                <form
                  className="space-y-4"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    const result = await signIn(loginEmail, loginPassword);
                    if (result.error) {
                      setError(result.error.message || "");
                      return;
                    }
                    setError("");
                    navigate(redirectTarget, { replace: true });
                  }}
                >
                  <Input
                    type="email"
                    placeholder="Email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="rounded-lg bg-muted/50"
                  />
                  <Input
                    type="password"
                    placeholder="Mot de passe"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="rounded-lg bg-muted/50"
                  />
                  <Button type="submit" className="rounded-full w-full sm:w-auto">
                    Se connecter
                  </Button>
                </form>
              ) : (
                <form
                  className="space-y-4"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    if (!privacyAccepted) {
                      setError("Vous devez accepter la politique de confidentialite pour creer un compte.");
                      return;
                    }
                    const result = await signUp(registerForm);
                    if (result.error) {
                      setError(result.error.message || "");
                      return;
                    }
                    setError("");
                    navigate(redirectTarget, { replace: true });
                  }}
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      placeholder="Prenom"
                      value={registerForm.first_name}
                      onChange={(e) => setRegisterForm((current) => ({ ...current, first_name: e.target.value }))}
                      className="rounded-lg bg-muted/50"
                    />
                    <Input
                      placeholder="Nom"
                      value={registerForm.last_name}
                      onChange={(e) => setRegisterForm((current) => ({ ...current, last_name: e.target.value }))}
                      className="rounded-lg bg-muted/50"
                    />
                  </div>
                  <Input
                    type="email"
                    placeholder="Email"
                    value={registerForm.email}
                    onChange={(e) => setRegisterForm((current) => ({ ...current, email: e.target.value }))}
                    className="rounded-lg bg-muted/50"
                  />
                  <Input
                    type="tel"
                    placeholder="Telephone"
                    value={registerForm.phone}
                    onChange={(e) => setRegisterForm((current) => ({ ...current, phone: e.target.value }))}
                    className="rounded-lg bg-muted/50"
                  />
                  <Input
                    type="password"
                    placeholder="Mot de passe"
                    value={registerForm.password}
                    onChange={(e) => setRegisterForm((current) => ({ ...current, password: e.target.value }))}
                    className="rounded-lg bg-muted/50"
                  />
                  <label className="flex items-start gap-3 text-sm text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={registerForm.marketing_consent}
                      onChange={(e) =>
                        setRegisterForm((current) => ({ ...current, marketing_consent: e.target.checked }))
                      }
                      className="mt-1"
                    />
                    <span>J'accepte de recevoir des communications commerciales de Just Beauty.</span>
                  </label>
                  <label className="flex items-start gap-3 text-sm text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={privacyAccepted}
                      onChange={(e) => setPrivacyAccepted(e.target.checked)}
                      className="mt-1"
                    />
                    <span>
                      J'accepte la{" "}
                      <Link to="/politique-de-confidentialite" className="underline hover:text-foreground">
                        politique de confidentialite
                      </Link>
                      .
                    </span>
                  </label>
                  <Button type="submit" className="rounded-full w-full sm:w-auto">
                    Creer mon compte
                  </Button>
                </form>
              )}
            </div>
          </AnimatedSection>
        </div>
      </section>
    </main>
  );
};

export default Account;
