import { useQuery } from "@tanstack/react-query";
import { api, type Service } from "@/lib/api";
import { Flower2, Sparkles, Scissors, Hand } from "lucide-react";
import AnimatedSection from "@/components/AnimatedSection";

const iconMap: Record<string, any> = {
  Massage: Hand,
  "Soins du visage": Sparkles,
  "Épilation": Scissors,
  Maquillage: Sparkles,
  Pédicure: Flower2,
  Manucure: Flower2,
};

const manicureOptionNames = new Set([
  "ongle casse",
  "french / baby boomer",
  "effet sirène / chrome",
  "nail arts",
  "strass / bijoux",
]);

const isManicureOption = (service: Service) => (
  service.category === "Manucure"
  && (
    String(service.price_label || "").includes("*")
    || manicureOptionNames.has(String(service.name || "").toLowerCase())
  )
);

const renderServiceRow = (service: Service, { option = false } = {}) => (
  <div
    key={service.id}
    className={`px-8 py-4 flex items-center justify-between transition-colors ${option ? "bg-muted/15 hover:bg-muted/25" : "hover:bg-muted/30"}`}
  >
    <div>
      <p className="font-body text-foreground font-medium">{service.name}</p>
      <p className="text-muted-foreground text-sm">
        {option ? "Option ou supplément" : `${service.duration_minutes} min`}
      </p>
    </div>
    <span className="font-display text-xl font-semibold text-rose-gold">{service.price_label || `${service.price} EUR`}</span>
  </div>
);

const Services = () => {
  const { data: services } = useQuery({
    queryKey: ["services"],
    queryFn: api.services.listPublic,
  });

  const categories = services?.reduce((acc, service) => {
    if (!acc[service.category]) acc[service.category] = [];
    acc[service.category].push(service);
    return acc;
  }, {} as Record<string, Service[]>) ?? {};

  return (
    <main className="pt-24">
      <section className="section-padding">
        <div className="container-narrow">
          <AnimatedSection>
            <div className="text-center mb-16">
              <p className="text-sm tracking-[0.3em] uppercase text-muted-foreground mb-3">Nos prestations</p>
              <h1 className="font-display text-4xl md:text-6xl text-foreground">
                Nos <span className="italic text-gradient-rose">Services</span>
              </h1>
            </div>
          </AnimatedSection>

          {Object.keys(categories).length === 0 && (
            <p className="text-center text-muted-foreground">Les services seront bientôt disponibles.</p>
          )}

          <div className="space-y-16">
            {Object.entries(categories).map(([category, items], index) => {
              const Icon = iconMap[category] || Sparkles;
              const primaryItems = category === "Manucure" ? items.filter((service) => !isManicureOption(service)) : items;
              const optionItems = category === "Manucure" ? items.filter(isManicureOption) : [];

              return (
                <AnimatedSection key={category} delay={index * 0.1}>
                  <div className="bg-card rounded-2xl border border-border/50 overflow-hidden shadow-sm">
                    <div className="bg-primary/20 px-8 py-5 flex items-center gap-3">
                      <Icon size={22} className="text-rose-gold" />
                      <h2 className="font-display text-2xl font-semibold text-foreground">{category}</h2>
                    </div>

                    <div className="divide-y divide-border/50">
                      {primaryItems.map((service) => renderServiceRow(service))}

                      {optionItems.length > 0 && (
                        <div className="bg-muted/5">
                          <div className="px-8 py-4 border-y border-border/50 bg-muted/20">
                            <p className="font-display text-lg text-foreground">Options et suppléments</p>
                            <p className="text-sm text-muted-foreground mt-1">
                              Ces ajouts complètent une prestation manucure principale.
                            </p>
                          </div>
                          <div className="divide-y divide-border/50">
                            {optionItems.map((service) => renderServiceRow(service, { option: true }))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </AnimatedSection>
              );
            })}
          </div>

          <AnimatedSection delay={0.2}>
            <div className="mt-8 rounded-2xl border border-border/50 bg-muted/30 p-6 text-sm text-muted-foreground">
              <p>En manucure, les prestations principales sont séparées des options et suppléments pour rendre la carte plus lisible.</p>
              <p className="mt-2">Les durées affichées sont indicatives et peuvent varier selon le soin choisi et le résultat souhaité.</p>
            </div>
          </AnimatedSection>
        </div>
      </section>
    </main>
  );
};

export default Services;
