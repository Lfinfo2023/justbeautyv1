import { Link } from "react-router-dom";
import { Heart, Phone, Mail, MapPin } from "lucide-react";
import { useSiteContent } from "@/hooks/useSiteContent";
import BrandWordmark from "@/components/BrandWordmark";

const Footer = () => {
  const { contentMap } = useSiteContent();

  return (
    <footer className="bg-muted/50 border-t border-border">
      <div className="container-narrow section-padding">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <img src="/logo.jpg" alt="Just Beauty" className="h-12 w-12 rounded-full object-cover border border-border/60 shadow-sm" />
              <BrandWordmark titleClassName="text-2xl" subtitleClassName="text-[0.6rem] tracking-[0.3em]" />
            </div>
            <p className="text-muted-foreground text-sm leading-relaxed">
              by Justine - Votre institut de beauté près de Bastogne. Prenez soin de vous, tout simplement.
            </p>
          </div>
          <div>
            <h4 className="font-display text-lg font-semibold text-foreground mb-4">Navigation</h4>
            <div className="flex flex-col gap-2">
              {[
                { to: "/", label: "Accueil" },
                { to: "/a-propos", label: "À propos" },
                { to: "/services", label: "Services" },
                { to: "/galerie", label: "Galerie" },
                { to: "/contact", label: "Contact" },
                { to: "/rendez-vous", label: "Rendez-vous" },
                { to: "/compte", label: "Mon compte" },
                { to: "/politique-de-confidentialite", label: "Politique de confidentialité" },
                { to: "/mentions-legales", label: "Mentions légales" },
              ].map((link) => (
                <Link key={link.to} to={link.to} className="text-muted-foreground text-sm hover:text-rose-gold transition-colors">
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
          <div>
            <h4 className="font-display text-lg font-semibold text-foreground mb-4">Contact</h4>
            <div className="flex flex-col gap-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-2"><Phone size={14} /> {contentMap.phone || "+32 XXX XX XX XX"}</span>
              <span className="flex items-center gap-2"><Mail size={14} /> {contentMap.email || "contact@justbeauty.be"}</span>
              <span className="flex items-center gap-2"><MapPin size={14} /> {contentMap.address || "Pres de Bastogne, Belgique"}</span>
            </div>
          </div>
        </div>
        <div className="border-t border-border mt-12 pt-6 text-center">
          <p className="text-muted-foreground text-xs flex items-center justify-center gap-1">
            Copyright 2026 Just Beauty by Justine - Fait avec <Heart size={12} className="text-rose-gold" />
          </p>
          <div className="mt-3">
            <Link to="/admin" className="text-[10px] uppercase tracking-[0.35em] text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors">
              admin
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
