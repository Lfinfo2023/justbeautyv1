import { Phone, Mail, MapPin, Car, Clock, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import AnimatedSection from "@/components/AnimatedSection";
import { useSiteContent } from "@/hooks/useSiteContent";
import { useState } from "react";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";

const Contact = () => {
  const [form, setForm] = useState({ name: "", email: "", phone: "", message: "" });
  const { contentMap } = useSiteContent();
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(contentMap.address || "Pres de Bastogne, Belgique")}`;

  const submit = useMutation({
    mutationFn: async () => api.contact.create(form),
    onSuccess: () => {
      toast.success("Message envoyé ! Nous vous répondrons rapidement.");
      setForm({ name: "", email: "", phone: "", message: "" });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Impossible d'envoyer le message");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submit.mutate();
  };

  return (
    <main className="pt-24">
      <section className="section-padding">
        <div className="container-narrow">
          <AnimatedSection>
            <div className="text-center mb-16">
              <p className="text-sm tracking-[0.3em] uppercase text-muted-foreground mb-3">Nous contacter</p>
              <h1 className="font-display text-4xl md:text-6xl text-foreground">
                <span className="italic text-gradient-rose">Contact</span>
              </h1>
            </div>
          </AnimatedSection>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <AnimatedSection>
              <div className="space-y-8">
                <div>
                  <h2 className="font-display text-2xl font-semibold text-foreground mb-6">Informations</h2>
                  <div className="space-y-5">
                    {[
                      { icon: Phone, label: contentMap.phone || "+32 XXX XX XX XX", sub: "Du lundi au samedi" },
                      { icon: Mail, label: contentMap.email || "contact@justbeauty.be", sub: "Réponse sous 24h" },
                      { icon: MapPin, label: contentMap.address || "Pres de Bastogne, Belgique", sub: "Province du Luxembourg" },
                      { icon: Car, label: "Parking facile à proximité", sub: "Accès pratique" },
                      { icon: Clock, label: "Lundi au samedi : 15h-18h30", sub: "Vérifiez ces horaires si nécessaire" },
                    ].map((item, i) => (
                      <div key={i} className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-full bg-primary/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <item.icon size={18} className="text-rose-gold" />
                        </div>
                        <div>
                          <p className="font-body font-medium text-foreground">{item.label}</p>
                          <p className="text-muted-foreground text-sm">{item.sub}</p>
                        </div>
                      </div>
                    ))}
                    <a href={mapsUrl} target="_blank" rel="noreferrer" className="inline-flex text-sm text-rose-gold hover:text-foreground transition-colors">
                      Ouvrir l'adresse dans Google Maps
                    </a>
                  </div>
                </div>
              </div>
            </AnimatedSection>

            <AnimatedSection delay={0.2}>
              <div className="bg-card rounded-2xl p-8 border border-border/50 shadow-sm">
                <h2 className="font-display text-2xl font-semibold text-foreground mb-6">Envoyez-nous un message</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <Input placeholder="Votre nom" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="rounded-lg bg-muted/50 border-border focus:border-primary" />
                  <Input type="email" placeholder="Votre email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required className="rounded-lg bg-muted/50 border-border focus:border-primary" />
                  <Input type="tel" placeholder="Votre téléphone (optionnel)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="rounded-lg bg-muted/50 border-border focus:border-primary" />
                  <Textarea placeholder="Votre message..." value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} required rows={5} className="rounded-lg bg-muted/50 border-border focus:border-primary resize-none" />
                  <Button type="submit" disabled={submit.isPending} className="w-full bg-primary text-primary-foreground hover:bg-rose-gold hover:text-card rounded-full font-body tracking-wide py-6 transition-all duration-300">
                    <Send size={16} className="mr-2" /> {submit.isPending ? "Envoi..." : "Envoyer"}
                  </Button>
                </form>
              </div>
            </AnimatedSection>
          </div>
        </div>
      </section>
    </main>
  );
};

export default Contact;
