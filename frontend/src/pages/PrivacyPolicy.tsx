import AnimatedSection from "@/components/AnimatedSection";
import { useSiteContent } from "@/hooks/useSiteContent";

const PrivacyPolicy = () => {
  const { contentMap } = useSiteContent();

  return (
    <main className="pt-24">
      <section className="section-padding">
        <div className="container-narrow max-w-4xl space-y-8">
          <AnimatedSection>
            <div>
              <p className="text-sm tracking-[0.3em] uppercase text-muted-foreground mb-3">Information légale</p>
              <h1 className="font-display text-4xl text-foreground">Politique de confidentialité</h1>
            </div>
          </AnimatedSection>

          <AnimatedSection delay={0.1}>
            <div className="bg-card rounded-2xl border border-border/50 p-8 space-y-6 leading-relaxed text-muted-foreground">
              <p>
                Cette politique explique comment {contentMap.business_name || "Just Beauty by Justine"} traite les données personnelles
                collectées via le formulaire de contact, la prise de rendez-vous et l'espace client, conformément au RGPD et aux obligations
                d'information applicables en Belgique.
              </p>
              <div>
                <h2 className="font-display text-2xl text-foreground mb-2">Responsable du traitement</h2>
                <p>{contentMap.legal_entity_name || "À renseigner"}</p>
                <p>{contentMap.registered_address || contentMap.address || "À renseigner"}</p>
                <p>Email de contact vie privée : {contentMap.privacy_contact_email || contentMap.legal_contact_email || contentMap.email || "À renseigner"}</p>
              </div>
              <div>
                <h2 className="font-display text-2xl text-foreground mb-2">Données traitées</h2>
                <p>Identité, coordonnées, informations de rendez-vous, historique client, passages fidélité validés et échanges via les formulaires du site.</p>
              </div>
              <div>
                <h2 className="font-display text-2xl text-foreground mb-2">Finalités et bases juridiques</h2>
                <p>Gestion des rendez-vous, création et administration des comptes clients, suivi du programme fidélité, réponse aux demandes, respect des obligations légales et, si vous y consentez, envoi de communications commerciales.</p>
              </div>
              <div>
                <h2 className="font-display text-2xl text-foreground mb-2">Destinataires</h2>
                <p>Les données sont accessibles à l'équipe de {contentMap.business_name || "Just Beauty by Justine"} et, si nécessaire, à ses prestataires techniques d'hébergement, messagerie et agenda, dans la limite de leurs missions.</p>
              </div>
              <div>
                <h2 className="font-display text-2xl text-foreground mb-2">Durée de conservation</h2>
                <p>Les données de contact et de rendez-vous sont conservées pendant la durée nécessaire à la relation client, puis pendant la période utile à la défense des droits et au respect des obligations comptables ou administratives applicables.</p>
              </div>
              <div>
                <h2 className="font-display text-2xl text-foreground mb-2">Vos droits</h2>
                <p>Vous pouvez demander l'accès, la rectification, l'effacement, la limitation, l'opposition ou la portabilité de vos données, lorsque ces droits sont applicables. Vous pouvez aussi retirer votre consentement marketing à tout moment.</p>
              </div>
              <div>
                <h2 className="font-display text-2xl text-foreground mb-2">Réclamation</h2>
                <p>Si vous estimez que vos droits ne sont pas respectés, vous pouvez contacter l'Autorité de protection des données en Belgique.</p>
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>
    </main>
  );
};

export default PrivacyPolicy;
