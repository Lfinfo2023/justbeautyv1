import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { LogOut, Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useClientAuth } from "@/hooks/useClientAuth";
import { Button } from "@/components/ui/button";
import BrandWordmark from "@/components/BrandWordmark";

const links = [
  { to: "/", label: "Accueil" },
  { to: "/a-propos", label: "À propos" },
  { to: "/services", label: "Services" },
  { to: "/galerie", label: "Galerie" },
  { to: "/contact", label: "Contact" },
  { to: "/rendez-vous", label: "Rendez-vous" },
  { to: "/cheques-cadeaux", label: "Cheques cadeaux" },
];

const Navbar = () => {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const { customer, signOut } = useClientAuth();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/50">
      <div className="container-narrow flex items-center justify-between px-6 py-4">
        <Link to="/" className="font-display text-2xl font-semibold tracking-wide text-foreground">
          <span className="flex items-center gap-3">
            <img src="/logo.jpg" alt="Just Beauty" className="h-11 w-11 rounded-full object-cover border border-border/60 shadow-sm" />
            <BrandWordmark titleClassName="text-[1.1rem] md:text-[1.24rem]" subtitleClassName="text-[0.46rem] md:text-[0.54rem] tracking-[0.32em]" />
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={`font-body text-sm tracking-wide transition-colors duration-300 hover:text-rose-gold ${
                location.pathname === l.to ? "text-rose-gold font-semibold" : "text-muted-foreground"
              }`}
            >
              {l.label}
            </Link>
          ))}
          <Link
            to="/compte"
            className={`font-body text-sm tracking-wide transition-colors duration-300 hover:text-rose-gold ${
              location.pathname === "/compte" ? "text-rose-gold font-semibold" : "text-muted-foreground"
            }`}
          >
            {customer ? "Mon compte" : "Connexion"}
          </Link>
          {customer && (
            <Button type="button" variant="ghost" size="sm" onClick={() => signOut()} className="rounded-full gap-2 text-muted-foreground hover:text-foreground">
              <LogOut size={16} />
              Deconnexion
            </Button>
          )}
        </div>

        <button onClick={() => setOpen(!open)} className="md:hidden text-foreground">
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-background border-b border-border"
          >
            <div className="flex flex-col gap-2 py-4 px-4">
              {links.map((l) => (
                <Link
                  key={l.to}
                  to={l.to}
                  onClick={() => setOpen(false)}
                  className={`font-body text-base transition-colors rounded-xl px-4 py-3 ${
                    location.pathname === l.to ? "text-rose-gold font-semibold" : "text-muted-foreground"
                  }`}
                >
                  {l.label}
                </Link>
              ))}
              <Link
                to="/compte"
                onClick={() => setOpen(false)}
                className={`font-body text-base transition-colors rounded-xl px-4 py-3 ${
                  location.pathname === "/compte" ? "text-rose-gold font-semibold" : "text-muted-foreground"
                }`}
              >
                {customer ? "Mon compte" : "Connexion"}
              </Link>
              {customer && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={async () => {
                    await signOut();
                    setOpen(false);
                  }}
                  className="rounded-full gap-2 w-full justify-center"
                >
                  <LogOut size={16} />
                  Deconnexion
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;
