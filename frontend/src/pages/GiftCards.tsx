import { useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { useClientAuth } from "@/hooks/useClientAuth";
import AnimatedSection from "@/components/AnimatedSection";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const GiftCards = () => {
  const { customer, giftCards, giftCardPaymentDetails, loading, createGiftCard } = useClientAuth();
  const [giftCardForm, setGiftCardForm] = useState({
    amount: "",
    recipient_name: "",
    recipient_email: "",
    message: "",
    theme_style: "glam_chic" as "fun_party" | "fun_pop" | "glam_chic" | "glam_luxe",
  });

  const getGiftCardStatusLabel = (status: string) => {
    if (status === "pending_payment") return "En attente de validation";
    if (status === "active") return "Active";
    if (status === "used") return "Utilisee";
    if (status === "expired") return "Expiree";
    if (status === "refused") return "Refusee";
    return status;
  };
  const getThemeLabel = (theme: string) => {
    if (theme === "fun_party") return "Drole - Party";
    if (theme === "fun_pop") return "Drole - Pop";
    if (theme === "glam_luxe") return "Glamour - Luxe";
    return "Glamour - Chic";
  };
  const getThemePresentation = (theme: string) => {
    if (theme === "fun_party") {
      return {
        image: "/assets/gift/fun-party2.png",
        text: "text-amber-50",
        subtext: "text-amber-100/90",
        overlay: "linear-gradient(165deg, rgba(68,34,10,0.38) 0%, rgba(32,16,8,0.62) 100%)",
      };
    }
    if (theme === "fun_pop") {
      return {
        image: "/assets/gift/fun-pop2.png",
        text: "text-fuchsia-50",
        subtext: "text-fuchsia-100/90",
        overlay: "linear-gradient(165deg, rgba(56,10,66,0.34) 0%, rgba(24,8,40,0.60) 100%)",
      };
    }
    if (theme === "glam_luxe") {
      return {
        image: "/assets/gift/glam-luxe2.png",
        text: "text-stone-50",
        subtext: "text-stone-100/90",
        overlay: "linear-gradient(165deg, rgba(18,14,18,0.44) 0%, rgba(10,8,12,0.74) 100%)",
      };
    }
    return {
      image: "/assets/gift/glam-chic2.png",
      text: "text-rose-50",
      subtext: "text-rose-100/90",
      overlay: "linear-gradient(165deg, rgba(42,24,22,0.36) 0%, rgba(20,10,10,0.68) 100%)",
    };
  };
  const previewName = (
    giftCardForm.recipient_name
    || `${customer?.first_name || ""} ${customer?.last_name || ""}`
  ).trim() || "Cliente";
  const previewTheme = getThemePresentation(giftCardForm.theme_style);
  const previewAmount = Number(giftCardForm.amount || 0);
  const previewMessage = giftCardForm.message.trim();

  if (loading) {
    return (
      <main className="pt-24">
        <section className="section-padding">
          <div className="container-narrow text-muted-foreground">Chargement...</div>
        </section>
      </main>
    );
  }

  if (!customer) {
    return (
      <main className="pt-24">
        <section className="section-padding">
          <div className="container-narrow max-w-2xl">
            <AnimatedSection>
              <div className="bg-card rounded-2xl border border-border/50 p-8 space-y-4">
                <p className="text-sm tracking-[0.3em] uppercase text-muted-foreground">Cheques cadeaux</p>
                <h1 className="font-display text-4xl text-foreground">Commander un cheque cadeau</h1>
                <p className="text-muted-foreground">
                  La commande de cheque cadeau necessite un profil client connecte. Le paiement se fait par virement et la validation est manuelle.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button asChild className="rounded-full">
                    <Link to="/compte?redirect=%2Fcheques-cadeaux">Se connecter / creer un compte</Link>
                  </Button>
                  <Button asChild variant="outline" className="rounded-full">
                    <Link to="/rendez-vous">Prendre rendez-vous</Link>
                  </Button>
                </div>
              </div>
            </AnimatedSection>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="pt-24">
      <section className="section-padding">
        <div className="container-narrow space-y-8">
          <AnimatedSection>
            <div>
              <p className="text-sm tracking-[0.3em] uppercase text-muted-foreground mb-3">Cheques cadeaux</p>
              <h1 className="font-display text-4xl text-foreground">Commander et suivre mes cheques cadeaux</h1>
            </div>
          </AnimatedSection>

          <AnimatedSection delay={0.1}>
            <div className="bg-card rounded-2xl border border-border/50 p-6 space-y-6">
              <div className="rounded-xl bg-muted/30 p-4 text-sm text-muted-foreground space-y-1">
                <p>Les cheques cadeaux sont lies a votre compte client.</p>
                <p>Paiement par virement uniquement. Validation manuelle par l'administration.</p>
                <p>Validite: 1 an apres validation.</p>
              </div>

              <form
                className="grid grid-cols-1 md:grid-cols-2 gap-4"
                onSubmit={async (event) => {
                  event.preventDefault();
                  const amount = Number(giftCardForm.amount || 0);
                  if (!Number.isFinite(amount) || amount <= 0) {
                    toast.error("Montant invalide");
                    return;
                  }
                    const result = await createGiftCard({
                      amount,
                      recipient_name: giftCardForm.recipient_name,
                      recipient_email: giftCardForm.recipient_email,
                      message: giftCardForm.message,
                      theme_style: giftCardForm.theme_style,
                    });
                  if (result.error) {
                    toast.error(result.error.message || "Impossible de creer le cheque cadeau");
                    return;
                  }
                  toast.success("Cheque cadeau cree. Effectuez le virement pour validation.");
                  setGiftCardForm({ amount: "", recipient_name: "", recipient_email: "", message: "", theme_style: giftCardForm.theme_style });
                }}
              >
                <Input
                  type="number"
                  min={1}
                  step={0.01}
                  placeholder="Montant EUR"
                  value={giftCardForm.amount}
                  onChange={(e) => setGiftCardForm((current) => ({ ...current, amount: e.target.value }))}
                  className="rounded-lg bg-muted/50"
                />
                <Input
                  placeholder="Beneficiaire (optionnel)"
                  value={giftCardForm.recipient_name}
                  onChange={(e) => setGiftCardForm((current) => ({ ...current, recipient_name: e.target.value }))}
                  className="rounded-lg bg-muted/50"
                />
                <Input
                  type="email"
                  placeholder="Email beneficiaire (optionnel)"
                  value={giftCardForm.recipient_email}
                  onChange={(e) => setGiftCardForm((current) => ({ ...current, recipient_email: e.target.value }))}
                  className="rounded-lg bg-muted/50"
                />
                <Input
                  placeholder="Message (optionnel)"
                  value={giftCardForm.message}
                  onChange={(e) => setGiftCardForm((current) => ({ ...current, message: e.target.value }))}
                  className="rounded-lg bg-muted/50"
                />
                <select
                  value={giftCardForm.theme_style}
                  onChange={(e) => setGiftCardForm((current) => ({ ...current, theme_style: e.target.value as "fun_party" | "fun_pop" | "glam_chic" | "glam_luxe" }))}
                  className="h-10 rounded-lg bg-muted/50 border border-input px-3 text-sm"
                >
                  <option value="glam_chic">Glamour - Chic</option>
                  <option value="glam_luxe">Glamour - Luxe</option>
                  <option value="fun_party">Drole - Party</option>
                  <option value="fun_pop">Drole - Pop</option>
                </select>
                <div className="md:col-span-2">
                  <Button type="submit" className="rounded-full">Creer un cheque cadeau</Button>
                </div>
              </form>

              <div className="rounded-xl border border-border/50 p-4 space-y-3">
                <p className="font-medium text-foreground">Apercu du cheque</p>
                <div className="relative aspect-[3/2] w-full overflow-hidden rounded-2xl border border-border/50 shadow-md">
                  <img
                    src={previewTheme.image}
                    alt={`Theme ${getThemeLabel(giftCardForm.theme_style)}`}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                  <div className="absolute inset-0" style={{ background: previewTheme.overlay }} />
                  <div className={`relative z-10 flex h-full flex-col justify-between p-5 md:p-6 ${previewTheme.text}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] tracking-[0.25em] uppercase opacity-90">Just Beauty</p>
                        <p className="text-[11px] tracking-[0.2em] uppercase opacity-80 mt-1">Cheque cadeau</p>
                      </div>
                      <span className="rounded-full border border-white/35 bg-black/20 px-3 py-1 text-[11px] tracking-wide">
                        {getThemeLabel(giftCardForm.theme_style)}
                      </span>
                    </div>

                    <div>
                      <p className="font-display text-4xl md:text-5xl leading-none drop-shadow-sm">
                        {previewAmount.toFixed(2)} EUR
                      </p>
                      <p className={`mt-3 text-sm md:text-base ${previewTheme.subtext}`}>
                        Pour <span className="font-semibold">{previewName}</span>
                      </p>
                      {previewMessage && (
                        <p className={`mt-2 text-sm md:text-[15px] leading-relaxed ${previewTheme.subtext}`}>
                          "{previewMessage.length > 180 ? `${previewMessage.slice(0, 180)}...` : previewMessage}"
                        </p>
                      )}
                    </div>

                    <div className="flex items-end justify-between gap-3 text-xs opacity-90">
                      <span>Code genere apres validation</span>
                      <span>Validite: 1 an</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-border/50 p-4 text-sm space-y-1">
                <p className="font-medium text-foreground">Informations de virement</p>
                <p className="text-muted-foreground">Banque: {giftCardPaymentDetails?.bank_name || "A configurer"}</p>
                <p className="text-muted-foreground">Compte: {giftCardPaymentDetails?.bank_account || "A configurer dans Contenu"}</p>
                <p className="text-muted-foreground">{giftCardPaymentDetails?.instructions || ""}</p>
              </div>
            </div>
          </AnimatedSection>

          <AnimatedSection delay={0.15}>
            <div className="bg-card rounded-2xl border border-border/50 p-6 space-y-3">
              <h2 className="font-display text-2xl text-foreground">Mes cheques cadeaux</h2>
              {giftCards.length === 0 && (
                <p className="text-sm text-muted-foreground">Aucun cheque cadeau pour le moment.</p>
              )}
              {giftCards.map((card) => (
                <div key={card.id} className="rounded-xl border border-border/50 bg-muted/30 p-4 space-y-1">
                  <p className="font-medium text-foreground">
                    {card.code} - {card.amount.toFixed(2)} {card.currency}
                  </p>
                  <p className="text-sm text-muted-foreground">Reference virement: {card.payment_reference}</p>
                  <p className="text-sm text-muted-foreground">Theme: {getThemeLabel(card.theme_style)}</p>
                  <p className="text-sm text-muted-foreground">Statut: {getGiftCardStatusLabel(card.status)}</p>
                  {card.expires_at && (
                    <p className="text-xs text-muted-foreground">
                      Expire le {format(new Date(card.expires_at), "d MMMM yyyy", { locale: fr })}
                    </p>
                  )}
                  {card.used_at && (
                    <p className="text-xs text-muted-foreground">
                      Utilise le {format(new Date(card.used_at), "d MMMM yyyy", { locale: fr })}
                    </p>
                  )}
                  {card.admin_note && <p className="text-xs text-muted-foreground">Note admin: {card.admin_note}</p>}
                </div>
              ))}
            </div>
          </AnimatedSection>
        </div>
      </section>
    </main>
  );
};

export default GiftCards;
