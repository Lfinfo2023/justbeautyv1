import { Link } from "react-router-dom";
import { HeartHandshake, Sparkles, Flower2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import AnimatedSection from "@/components/AnimatedSection";
import { useSiteContent } from "@/hooks/useSiteContent";
import jujuImg from "@/assets/juju.jpg";

const About = () => {
  const { contentMap } = useSiteContent();

  return (
    <main className="pt-24">
      <section className="relative overflow-hidden bg-gradient-to-b from-primary/10 via-background to-background">
        <div className="absolute inset-0 opacity-40">
          <div className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-64 w-64 rounded-full bg-rose-gold/20 blur-3xl" />
        </div>
        <div className="container-narrow relative section-padding">
          <AnimatedSection>
            <div className="text-center max-w-3xl mx-auto">
              <p className="text-sm tracking-[0.3em] uppercase text-muted-foreground mb-4">À propos</p>
              <h1 className="font-display text-4xl md:text-6xl text-foreground leading-tight">
                Rencontrez <span className="italic text-gradient-rose">Justine</span>
              </h1>
              <p className="text-muted-foreground text-lg leading-relaxed mt-6">
                Une approche douce, précise et sincère pour faire de chaque rendez-vous un vrai moment pour vous.
              </p>
            </div>
          </AnimatedSection>
        </div>
      </section>

      <section className="section-padding">
        <div className="container-narrow grid grid-cols-1 lg:grid-cols-[1.05fr,0.95fr] gap-10 items-center">
          <AnimatedSection>
            <div className="relative">
              <div className="absolute inset-0 translate-x-4 translate-y-4 rounded-[2rem] bg-primary/15" />
              <img
                src={jujuImg}
                alt="Justine, fondatrice de Just Beauty"
                className="relative w-full rounded-[2rem] object-cover shadow-xl border border-border/60"
                loading="lazy"
              />
            </div>
          </AnimatedSection>

          <AnimatedSection delay={0.12}>
            <div className="bg-card/80 backdrop-blur rounded-[2rem] border border-border/50 p-8 md:p-10 shadow-sm">
              <p className="text-sm tracking-[0.25em] uppercase text-muted-foreground mb-3">Just Beauty by Justine</p>
              <h2 className="font-display text-3xl md:text-4xl text-foreground mb-6">
                La beauté dans une ambiance <span className="italic text-gradient-rose">cocooning</span>
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-5">
                {contentMap.about_text || "Situé près de Bastogne, Just Beauty by Justine est un institut chaleureux et accueillant pensé pour votre confort, votre détente et votre mise en valeur."}
              </p>
              <p className="text-muted-foreground leading-relaxed">
                Justine prend le temps d'écouter vos envies, de vous conseiller avec justesse et de proposer des soins adaptés, dans un cadre féminin, calme et soigné.
              </p>
            </div>
          </AnimatedSection>
        </div>
      </section>

      <section className="section-padding bg-cream">
        <div className="container-narrow">
          <AnimatedSection>
            <div className="text-center mb-14">
              <p className="text-sm tracking-[0.25em] uppercase text-muted-foreground mb-3">L'expérience</p>
              <h2 className="font-display text-3xl md:text-5xl text-foreground">
                Ce qui fait l'esprit <span className="italic text-gradient-rose">Just Beauty</span>
              </h2>
            </div>
          </AnimatedSection>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: HeartHandshake,
                title: "Accueil sincère",
                description: "Une relation simple, attentive et humaine pour que vous vous sentiez à l'aise dès les premières minutes.",
              },
              {
                icon: Sparkles,
                title: "Soins sur mesure",
                description: "Chaque prestation est réalisée avec exigence et adaptée à votre peau, vos attentes et votre rythme.",
              },
              {
                icon: Flower2,
                title: "Atmosphère apaisante",
                description: "Des textures douces, une énergie calme et un cadre pensé pour ralentir et profiter du moment.",
              },
            ].map((item, index) => (
              <AnimatedSection key={item.title} delay={index * 0.12}>
                <div className="h-full rounded-[1.75rem] border border-border/50 bg-background/80 p-8 shadow-sm">
                  <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-primary/20">
                    <item.icon size={24} className="text-rose-gold" />
                  </div>
                  <h3 className="font-display text-2xl text-foreground mb-3">{item.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{item.description}</p>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      <section className="section-padding">
        <div className="container-narrow">
          <AnimatedSection>
            <div className="rounded-[2rem] border border-border/50 bg-primary/10 px-8 py-12 text-center shadow-sm">
              <p className="text-sm tracking-[0.25em] uppercase text-muted-foreground mb-3">Prendre rendez-vous</p>
              <h2 className="font-display text-3xl md:text-4xl text-foreground mb-4">
                Envie d'un moment rien qu'à vous ?
              </h2>
              <p className="mx-auto max-w-2xl text-muted-foreground leading-relaxed mb-8">
                Choisissez votre catégorie, votre soin puis un créneau disponible. Justine reviendra vers vous rapidement pour confirmer votre rendez-vous.
              </p>
              <Link to="/rendez-vous">
                <Button size="lg" className="rounded-full bg-primary px-10 py-6 text-base tracking-wide text-primary-foreground hover:bg-rose-gold hover:text-card">
                  Réserver un soin
                </Button>
              </Link>
            </div>
          </AnimatedSection>
        </div>
      </section>
    </main>
  );
};

export default About;
