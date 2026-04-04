import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import BrandWordmark from "@/components/BrandWordmark";

const AdminLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) {
      toast.error("Email ou mot de passe incorrect");
    } else {
      navigate("/admin");
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm">
        <div className="bg-card rounded-2xl p-8 border border-border/50 shadow-sm">
          <div className="text-center mb-8">
            <img src="/logo.jpg" alt="Just Beauty" className="w-16 h-16 rounded-full object-cover border border-border/60 shadow-sm mx-auto mb-4" />
            <div className="flex justify-center mb-4">
              <BrandWordmark titleClassName="text-2xl" subtitleClassName="text-[0.58rem] tracking-[0.3em]" />
            </div>
            <h1 className="font-display text-2xl text-foreground">Administration</h1>
            <p className="text-muted-foreground text-sm mt-1">Connexion à l'espace admin</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="rounded-lg bg-muted/50"
            />
            <Input
              type="password"
              placeholder="Mot de passe"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="rounded-lg bg-muted/50"
            />
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-primary-foreground hover:bg-rose-gold hover:text-card rounded-full font-body tracking-wide transition-all duration-300"
            >
              {loading ? "Connexion..." : "Se connecter"}
            </Button>
            <Button asChild variant="ghost" className="w-full rounded-full">
              <Link to="/">Retour au site</Link>
            </Button>
          </form>
        </div>
      </div>
    </main>
  );
};

export default AdminLogin;
