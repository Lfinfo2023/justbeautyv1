import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import BrandWordmark from "@/components/BrandWordmark";

const AdminSecurity = ({ forced = false, embedded = false }: { forced?: boolean; embedded?: boolean }) => {
  const navigate = useNavigate();
  const { changePassword, signOut } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword.length < 10) {
      toast.error("Le nouveau mot de passe doit contenir au moins 10 caracteres");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("La confirmation ne correspond pas");
      return;
    }

    setLoading(true);
    const { error } = await changePassword(currentPassword, newPassword);
    setLoading(false);

    if (error) {
      toast.error(error.message || "Impossible de changer le mot de passe");
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    await signOut();
    toast.success("Mot de passe mis a jour. Reconnecte-toi avec le nouveau mot de passe.");
    navigate("/admin/login", { replace: true });
  };

  const content = (
    <div className={embedded ? "space-y-6" : "mx-auto w-full max-w-xl"}>
        <div className="flex items-center gap-3 mb-6">
          <img src="/logo.jpg" alt="Just Beauty" className="w-14 h-14 rounded-full object-cover border border-border/60 shadow-sm" />
          <div>
            <BrandWordmark titleClassName="text-lg" subtitleClassName="text-[0.5rem] tracking-[0.28em]" />
            <h1 className="font-display text-2xl text-foreground">Securite administrateur</h1>
            <p className="text-sm text-muted-foreground">
              {forced
                ? "Le mot de passe issu du .env est encore utilise. Change-le avant de continuer."
                : "Mets a jour facilement le mot de passe administrateur."}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-card rounded-2xl border border-border/50 p-8 space-y-4 shadow-sm">
          <Input
            type="password"
            placeholder="Mot de passe actuel"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            className="rounded-lg bg-muted/50"
          />
          <Input
            type="password"
            placeholder="Nouveau mot de passe"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            className="rounded-lg bg-muted/50"
          />
          <Input
            type="password"
            placeholder="Confirmer le nouveau mot de passe"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            className="rounded-lg bg-muted/50"
          />
          <div className="flex items-center gap-3 pt-2">
            <Button type="submit" disabled={loading} className="rounded-full bg-primary text-primary-foreground hover:bg-rose-gold hover:text-card">
              {loading ? "Mise a jour..." : "Changer le mot de passe"}
            </Button>
            <ShieldCheck size={18} className="text-rose-gold" />
          </div>
        </form>
      </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <div className="min-h-screen bg-background px-6 py-10">
      <div className="mx-auto w-full max-w-xl">
        {content}
      </div>
    </div>
  );
};

export default AdminSecurity;
