import { Link } from "react-router-dom";
import { Sparkles, Heart, Flower2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import AnimatedSection from "@/components/AnimatedSection";
import { useSiteContent } from "@/hooks/useSiteContent";
import heroImg from "@/assets/hero.png";
import galleryInterior from "@/assets/Salon.jpg";

const Index = () => {
  const { contentMap } = useSiteContent();

  return (
    <main>
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0">
          <img src={heroImg} alt="Institut de beauté Just Beauty by Justine" className="w-full h-full object-cover" width={1920} height={1080} />
          <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/40 to-background" />
        </div>
        <div className="relative z-10 text-center px-6 max-w-3xl">
          <AnimatedSection>
            <p className="font-body text-sm tracking-[0.3em] uppercase text-muted-foreground mb-4">Institut de beauté près de Bastogne</p>
            <h1 className="font-display text-5xl md:text-7xl font-light text-foreground leading-tight mb-6">
              {contentMap.hero_slogan || "Prenez soin de vous"}<br />
              <span className="text-gradient-rose font-semibold italic">tout simplement.</span>
            </h1>
            <p className="text-muted-foreground font-body text-lg mb-10 max-w-xl mx-auto leading-relaxed">
              {contentMap.hero_subtitle || "Bienvenue chez Just Beauty by Justine, institut de beaute pres de Bastogne. Massages, soins du visage, epilation, manucure et pedicure sur rendez-vous."}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link to="/rendez-vous">
                <Button size="lg" className="bg-primary text-primary-foreground hover:bg-rose-gold hover:text-card font-body tracking-wide px-10 py-6 text-base rounded-full transition-all duration-300 shadow-lg shadow-primary/20">
                  Prendre rendez-vous
                </Button>
              </Link>
              <Link to="/cheques-cadeaux">
                <Button size="lg" variant="outline" className="font-body tracking-wide px-10 py-6 text-base rounded-full border-primary text-foreground bg-card/70 hover:bg-primary/20">
                  Commander un cheque cadeau
                </Button>
              </Link>
            </div>
          </AnimatedSection>
        </div>
      </section>

      <section className="section-padding bg-cream">
        <div className="container-narrow">
          <AnimatedSection>
            <h2 className="font-display text-3xl md:text-5xl text-center text-foreground mb-16">
              Vos soins beauté et bien-être <span className="italic text-gradient-rose">au même endroit</span>
            </h2>
          </AnimatedSection>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: Sparkles, title: "Soins experts", desc: "Des soins du visage et du corps réalisés avec exigence pour révéler l'éclat naturel de votre peau." },
              { icon: Heart, title: "Massages bien-être", desc: "Massages relaxants et rituels cocooning pour relacher les tensions et retrouver un vrai moment de calme." },
              { icon: Flower2, title: "Mains, pieds et épilation", desc: "Manucure, pédicure et épilation dans un cadre doux pour prendre soin de vous en toute sérénité." },
            ].map((item, i) => (
              <AnimatedSection key={i} delay={i * 0.15}>
                <div className="bg-card rounded-2xl p-8 text-center shadow-sm hover:shadow-md transition-shadow duration-300 border border-border/50">
                  <div className="w-14 h-14 rounded-full bg-primary/30 flex items-center justify-center mx-auto mb-5">
                    <item.icon size={24} className="text-rose-gold" />
                  </div>
                  <h3 className="font-display text-xl font-semibold text-foreground mb-3">{item.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{item.desc}</p>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      <section className="section-padding">
        <div className="container-narrow grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <AnimatedSection>
            <img src={galleryInterior} alt="Interieur de l'institut Just Beauty" className="rounded-2xl shadow-lg w-full" loading="lazy" width={800} height={800} />
          </AnimatedSection>
          <AnimatedSection delay={0.2}>
            <p className="text-sm tracking-[0.2em] uppercase text-muted-foreground mb-3">A propos</p>
            <h2 className="font-display text-3xl md:text-4xl text-foreground mb-6">
              Votre bulle de <span className="italic text-gradient-rose">douceur</span>
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-6">
              {contentMap.about_text || "Situe pres de Bastogne, Just Beauty by Justine est un institut de beaute chaleureux et accueillant. Vous y retrouvez massages, soins du visage, epilation, manucure et pedicure dans une ambiance elegante et apaisante. Parking facile a proximite."}
            </p>
            <Link to="/services">
              <Button variant="outline" className="rounded-full border-primary text-primary-foreground bg-primary/50 hover:bg-primary font-body tracking-wide px-8">
                Découvrir nos soins
              </Button>
            </Link>
          </AnimatedSection>
        </div>
      </section>

      <section className="section-padding bg-primary/20">
        <div className="container-narrow text-center">
          <AnimatedSection>
            <h2 className="font-display text-3xl md:text-4xl text-foreground mb-6">
              Prête à vous faire <span className="italic">chouchouter</span> ?
            </h2>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto">
              Réservez votre soin en quelques clics et retrouvez un institut de beauté pensé pour votre confort, près de Bastogne.
            </p>
            <Link to="/rendez-vous">
              <Button size="lg" className="bg-primary text-primary-foreground hover:bg-rose-gold hover:text-card font-body tracking-wide px-10 py-6 text-base rounded-full transition-all duration-300 shadow-lg shadow-primary/20">
                Réserver maintenant
              </Button>
            </Link>
          </AnimatedSection>
        </div>
      </section>
    </main>
  );
};

export default Index;
