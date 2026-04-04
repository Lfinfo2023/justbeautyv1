import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useState, useEffect } from "react";

const contentKeys = [
  { key: "hero_slogan", label: "Slogan hero", type: "text" },
  { key: "hero_subtitle", label: "Sous-titre hero", type: "textarea" },
  { key: "about_text", label: "Texte a propos", type: "textarea" },
  { key: "phone", label: "Telephone", type: "text" },
  { key: "email", label: "Email", type: "text" },
  { key: "address", label: "Adresse", type: "text" },
  { key: "business_name", label: "Nom commercial", type: "text" },
  { key: "legal_entity_name", label: "Raison sociale / exploitant legal", type: "text" },
  { key: "company_number", label: "Numero BCE", type: "text" },
  { key: "vat_number", label: "Numero TVA", type: "text" },
  { key: "registered_address", label: "Adresse legale", type: "text" },
  { key: "legal_contact_email", label: "Email legal", type: "text" },
  { key: "privacy_contact_email", label: "Email vie privee", type: "text" },
  { key: "hosting_provider", label: "Hebergeur", type: "text" },
  { key: "hosting_address", label: "Adresse hebergeur", type: "text" },
];

const AdminContent = () => {
  const queryClient = useQueryClient();
  const [values, setValues] = useState<Record<string, string>>({});

  const { data: content, isLoading } = useQuery({
    queryKey: ["admin-content"],
    queryFn: api.content.listAdmin,
  });

  useEffect(() => {
    if (content) {
      const map: Record<string, string> = {};
      content.forEach((item) => {
        map[item.key] = item.value;
      });
      setValues(map);
    }
  }, [content]);

  const save = useMutation({
    mutationFn: async () => api.content.save(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-content"] });
      queryClient.invalidateQueries({ queryKey: ["site-content"] });
      toast.success("Contenu sauvegarde");
    },
    onError: () => toast.error("Erreur lors de la sauvegarde"),
  });

  if (isLoading) return <p className="text-muted-foreground">Chargement...</p>;

  return (
    <div className="space-y-6 max-w-2xl">
      <h3 className="font-display text-xl text-foreground">Gestion du contenu</h3>

      <div className="bg-card rounded-xl border border-border/50 p-6 space-y-5">
        {contentKeys.map(({ key, label, type }) => (
          <div key={key}>
            <label className="text-sm text-muted-foreground mb-1 block">{label}</label>
            {type === "textarea" ? (
              <Textarea
                value={values[key] || ""}
                onChange={(e) => setValues({ ...values, [key]: e.target.value })}
                className="rounded-lg bg-muted/50"
                rows={3}
              />
            ) : (
              <Input
                value={values[key] || ""}
                onChange={(e) => setValues({ ...values, [key]: e.target.value })}
                className="rounded-lg bg-muted/50"
              />
            )}
          </div>
        ))}
        <Button
          onClick={() => save.mutate()}
          className="bg-primary text-primary-foreground hover:bg-rose-gold hover:text-card rounded-full font-body tracking-wide"
        >
          Enregistrer les modifications
        </Button>
      </div>
    </div>
  );
};

export default AdminContent;
