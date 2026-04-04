import AnimatedSection from "@/components/AnimatedSection";
import { useSiteContent } from "@/hooks/useSiteContent";

const LegalNotice = () => {
  const { contentMap } = useSiteContent();

  return (
    <main className="pt-24">
      <section className="section-padding">
        <div className="container-narrow max-w-4xl space-y-8">
          <AnimatedSection>
            <div>
              <p className="text-sm tracking-[0.3em] uppercase text-muted-foreground mb-3">Information légale</p>
              <h1 className="font-display text-4xl text-foreground">Mentions légales</h1>
            </div>
          </AnimatedSection>

          <AnimatedSection delay={0.1}>
            <div className="bg-card rounded-2xl border border-border/50 p-8 space-y-5 leading-relaxed text-muted-foreground">
              <div>
                <h2 className="font-display text-2xl text-foreground mb-2">Editeur du site</h2>
                <p>Nom commercial : {contentMap.business_name || "Just Beauty by Justine"}</p>
                <p>Dénomination / responsable : {contentMap.legal_entity_name || "À renseigner"}</p>
                <p>Adresse : {contentMap.registered_address || contentMap.address || "À renseigner"}</p>
                <p>Email : {contentMap.legal_contact_email || contentMap.email || "À renseigner"}</p>
                <p>Téléphone : {contentMap.phone || "À renseigner"}</p>
                <p>Numéro d'entreprise BCE : {contentMap.company_number || "À renseigner"}</p>
                <p>Numéro de TVA : {contentMap.vat_number || "À renseigner"}</p>
              </div>
              <div>
                <h2 className="font-display text-2xl text-foreground mb-2">Hébergement</h2>
                <p>{contentMap.hosting_provider || "À renseigner"}</p>
                <p>{contentMap.hosting_address || "À renseigner"}</p>
              </div>
              <div>
                <h2 className="font-display text-2xl text-foreground mb-2">Activité en ligne</h2>
                <p>Le site présente les services de l'institut, permet des demandes de rendez-vous et la création facultative d'un compte client avec suivi du programme fidélité.</p>
              </div>
              <div>
                <h2 className="font-display text-2xl text-foreground mb-2">Propriété intellectuelle</h2>
                <p>Sauf mention contraire, les textes, images, éléments graphiques et signes distinctifs publiés sur ce site sont protégés et ne peuvent être réutilisés sans autorisation préalable.</p>
              </div>
              <div>
                <h2 className="font-display text-2xl text-foreground mb-2">Contact</h2>
                <p>Pour toute question concernant le site ou ses contenus, vous pouvez écrire à {contentMap.legal_contact_email || contentMap.email || "À renseigner"}.</p>
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>
    </main>
  );
};

export default LegalNotice;
