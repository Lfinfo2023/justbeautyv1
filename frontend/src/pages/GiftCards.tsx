import { useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { jsPDF } from "jspdf";
import { toast } from "sonner";
import { useClientAuth } from "@/hooks/useClientAuth";
import { type GiftCard } from "@/lib/api";
import AnimatedSection from "@/components/AnimatedSection";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type GiftTheme = "fun_party" | "fun_pop" | "glam_chic" | "glam_luxe";

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
      subtext: "text-amber-100/95",
      overlay: "linear-gradient(165deg, rgba(68,34,10,0.30) 0%, rgba(32,16,8,0.52) 100%)",
    };
  }
  if (theme === "fun_pop") {
    return {
      image: "/assets/gift/fun-pop2.png",
      text: "text-fuchsia-50",
      subtext: "text-fuchsia-100/95",
      overlay: "linear-gradient(165deg, rgba(56,10,66,0.28) 0%, rgba(24,8,40,0.50) 100%)",
    };
  }
  if (theme === "glam_luxe") {
    return {
      image: "/assets/gift/glam-luxe2.png",
      text: "text-stone-50",
      subtext: "text-stone-100/95",
      overlay: "linear-gradient(165deg, rgba(18,14,18,0.34) 0%, rgba(10,8,12,0.62) 100%)",
    };
  }
  return {
    image: "/assets/gift/glam-chic2.png",
    text: "text-rose-50",
    subtext: "text-rose-100/95",
    overlay: "linear-gradient(165deg, rgba(42,24,22,0.30) 0%, rgba(20,10,10,0.56) 100%)",
  };
};

const getPdfThemeColors = (theme: GiftTheme) => {
  if (theme === "fun_party") {
    return {
      primary: [122, 47, 0] as const,
      secondary: [70, 30, 20] as const,
      accent: [47, 25, 95] as const,
      shadow: [25, 14, 10] as const,
    };
  }
  if (theme === "fun_pop") {
    return {
      primary: [106, 0, 168] as const,
      secondary: [75, 25, 90] as const,
      accent: [31, 63, 178] as const,
      shadow: [18, 10, 35] as const,
    };
  }
  if (theme === "glam_luxe") {
    return {
      primary: [240, 222, 192] as const,
      secondary: [226, 209, 176] as const,
      accent: [250, 240, 220] as const,
      shadow: [20, 14, 10] as const,
    };
  }
  return {
    primary: [80, 42, 35] as const,
    secondary: [96, 55, 48] as const,
    accent: [66, 36, 32] as const,
    shadow: [18, 10, 10] as const,
  };
};

const GiftCardVisual = ({
  theme,
  recipientName,
  amount,
  message,
  amountSuffix = "EUR",
  showThemeBadge = true,
}: {
  theme: GiftTheme;
  recipientName: string;
  amount: number;
  message: string;
  amountSuffix?: string;
  showThemeBadge?: boolean;
}) => {
  const style = getThemePresentation(theme);
  const safeMessage = message.trim();

  return (
    <div className="group relative aspect-[3/2] w-full overflow-hidden rounded-2xl border border-border/50 shadow-md transition-all duration-300 hover:shadow-xl hover:shadow-primary/20 hover:ring-2 hover:ring-primary/35">
      <img
        src={style.image}
        alt={`Theme ${getThemeLabel(theme)}`}
        className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:brightness-110"
      />
      <div className="absolute inset-0" style={{ background: style.overlay }} />
      <div className={`relative z-10 flex h-full flex-col justify-between p-5 md:p-6 ${style.text}`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] tracking-[0.25em] uppercase opacity-90">Just Beauty</p>
            <p className="text-[11px] tracking-[0.2em] uppercase opacity-80 mt-1">Cheque cadeau</p>
          </div>
          {showThemeBadge && (
            <span className="rounded-full border border-white/45 bg-black/25 px-3 py-1 text-[11px] tracking-wide">
              {getThemeLabel(theme)}
            </span>
          )}
        </div>

        <div className="text-center">
          <p className={`text-2xl md:text-3xl font-semibold italic ${style.subtext} font-serif`}>
  Pour {recipientName}
</p>
          <p className="font-display text-4xl md:text-5xl leading-none drop-shadow-sm mt-1">
            {amount.toFixed(2)} {amountSuffix}
          </p>
          {safeMessage && (
            <p className={`mt-2 text-base md:text-lg ${style.subtext}`} style={{ fontFamily: "'Brush Script MT', 'Lucida Handwriting', cursive" }}>
              "{safeMessage.length > 170 ? `${safeMessage.slice(0, 170)}...` : safeMessage}"
            </p>
          )}
        </div>

        <div className="flex items-end justify-between gap-3 text-xs opacity-95">
          <span>Code genere apres validation</span>
          <span>Validite: 1 an</span>
        </div>
      </div>
    </div>
  );
};

const GiftCards = () => {
  const { customer, giftCards, giftCardPaymentDetails, loading, createGiftCard } = useClientAuth();
  const [giftCardForm, setGiftCardForm] = useState({
    amount: "",
    recipient_name: "",
    recipient_email: "",
    message: "",
    theme_style: "glam_chic" as GiftTheme,
  });

  const getGiftCardStatusLabel = (status: string) => {
    if (status === "pending_payment") return "En attente de validation";
    if (status === "active") return "Active";
    if (status === "used") return "Utilisee";
    if (status === "expired") return "Expiree";
    if (status === "refused") return "Refusee";
    return status;
  };

  const previewName = (
    giftCardForm.recipient_name
    || `${customer?.first_name || ""} ${customer?.last_name || ""}`
  ).trim() || "Cliente";
  const previewAmount = Number(giftCardForm.amount || 0);
  const previewMessage = giftCardForm.message.trim();

  const loadImageAsDataUrl = async (url: string) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Impossible de charger l'image du theme"));
      image.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth || 1800;
    canvas.height = image.naturalHeight || 1200;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Impossible de preparer le rendu PDF");
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  };

  const downloadGiftCardPdf = async (card: GiftCard) => {
    try {
      const recipientName = (card.recipient_name || `${customer?.first_name || ""} ${customer?.last_name || ""}`).trim() || "Cliente";
      const imageUrl = getThemePresentation(card.theme_style).image;
      const imageData = await loadImageAsDataUrl(imageUrl);
      const colors = getPdfThemeColors(card.theme_style);

      const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 28;
      const cardWidth = pageWidth - (margin * 2);
      const cardHeight = pageHeight - (margin * 2);

      pdf.addImage(imageData, "PNG", margin, margin, cardWidth, cardHeight);

      const centerX = pageWidth / 2;
      const topY = margin + 84;
      const amountTopY = margin + 130;
      const messageY = margin + 168;
      const amountBottomY = pageHeight - margin - 52;

      // Shadow pass for contrast on any background.
      pdf.setTextColor(colors.shadow[0], colors.shadow[1], colors.shadow[2]);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(24);
      pdf.text(recipientName, centerX + 1.2, topY + 1.2, { align: "center" });

      pdf.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
      pdf.text(recipientName, centerX, topY, { align: "center" });

      pdf.setFont("times", "bold");
      pdf.setFontSize(38);
      pdf.setTextColor(colors.shadow[0], colors.shadow[1], colors.shadow[2]);
      pdf.text(`${card.amount.toFixed(2)} ${card.currency}`, centerX + 1.4, amountTopY + 1.4, { align: "center" });
      pdf.setTextColor(colors.accent[0], colors.accent[1], colors.accent[2]);
      pdf.text(`${card.amount.toFixed(2)} ${card.currency}`, centerX, amountTopY, { align: "center" });

      if (card.message?.trim()) {
        pdf.setFont("times", "italic");
        pdf.setFontSize(20);
        const message = `"${card.message.trim()}"`;
        pdf.setTextColor(colors.shadow[0], colors.shadow[1], colors.shadow[2]);
        pdf.text(message, centerX + 1, messageY + 1, { align: "center", maxWidth: cardWidth - 120 });
        pdf.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
        pdf.text(message, centerX, messageY, { align: "center", maxWidth: cardWidth - 120 });
      }

      pdf.setFont("times", "bold");
      pdf.setFontSize(28);
      pdf.setTextColor(colors.shadow[0], colors.shadow[1], colors.shadow[2]);
      pdf.text(`${card.amount.toFixed(2)} ${card.currency}`, centerX + 1.2, amountBottomY + 1.2, { align: "center" });
      pdf.setTextColor(colors.accent[0], colors.accent[1], colors.accent[2]);
      pdf.text(`${card.amount.toFixed(2)} ${card.currency}`, centerX, amountBottomY, { align: "center" });

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(11);
      pdf.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
      pdf.text(`Code: ${card.code}`, margin + 16, pageHeight - margin - 14);
      pdf.text("Validite: 1 an", pageWidth - margin - 16, pageHeight - margin - 14, { align: "right" });

      pdf.save(`cheque-cadeau-${card.code}.pdf`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible de telecharger le PDF");
    }
  };

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
                  setGiftCardForm((current) => ({ ...current, amount: "", recipient_name: "", recipient_email: "", message: "" }));
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
                  onChange={(e) => setGiftCardForm((current) => ({ ...current, theme_style: e.target.value as GiftTheme }))}
                  className="h-10 rounded-lg bg-muted/50 border border-input px-3 text-sm"
                >
                  <option value="glam_chic">Chic</option>
                  <option value="glam_luxe">Luxe</option>
                  <option value="fun_party">Party</option>
                  <option value="fun_pop">Pop</option>
                </select>
                <div className="md:col-span-2">
                  <Button type="submit" className="rounded-full">Creer un cheque cadeau</Button>
                </div>
              </form>

              <div className="rounded-xl border border-border/50 p-4 space-y-3">
                <p className="font-medium text-foreground">Apercu du cheque</p>
                <GiftCardVisual
                  theme={giftCardForm.theme_style}
                  recipientName={previewName}
                  amount={previewAmount}
                  message={previewMessage}
                />
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
            <div className="bg-card rounded-2xl border border-border/50 p-6 space-y-4">
              <h2 className="font-display text-2xl text-foreground">Mes cheques cadeaux</h2>
              {giftCards.length === 0 && (
                <p className="text-sm text-muted-foreground">Aucun cheque cadeau pour le moment.</p>
              )}
              {giftCards.map((card) => {
                const recipientName = (card.recipient_name || `${customer.first_name || ""} ${customer.last_name || ""}`).trim() || "Cliente";
                return (
                  <div key={card.id} className="rounded-xl border border-border/50 bg-muted/30 p-4 space-y-3">
                    <GiftCardVisual
                      theme={card.theme_style}
                      recipientName={recipientName}
                      amount={card.amount}
                      amountSuffix={card.currency}
                      message={card.message || ""}
                    />
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p><strong className="text-foreground">Code:</strong> {card.code}</p>
                      <p><strong className="text-foreground">Reference virement:</strong> {card.payment_reference}</p>
                      <p><strong className="text-foreground">Statut:</strong> {getGiftCardStatusLabel(card.status)}</p>
                      {card.expires_at && (
                        <p>
                          <strong className="text-foreground">Expire le:</strong> {format(new Date(card.expires_at), "d MMMM yyyy", { locale: fr })}
                        </p>
                      )}
                      {card.used_at && (
                        <p>
                          <strong className="text-foreground">Utilise le:</strong> {format(new Date(card.used_at), "d MMMM yyyy", { locale: fr })}
                        </p>
                      )}
                      {card.admin_note && <p><strong className="text-foreground">Note admin:</strong> {card.admin_note}</p>}
                    </div>
                   {card.status === "active" && (
                      <Button type="button" variant="outline" className="rounded-full" onClick={() => downloadGiftCardPdf(card)}>
                        Telecharger en PDF
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </AnimatedSection>
        </div>
      </section>
    </main>
  );
};

export default GiftCards;
