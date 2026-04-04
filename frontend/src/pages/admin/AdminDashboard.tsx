import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { CalendarDays, Scissors, Image, FileText, LogOut, Menu, ArrowLeft, Settings, Users } from "lucide-react";
import AdminBookings from "./AdminBookings";
import AdminServices from "./AdminServices";
import AdminGallery from "./AdminGallery";
import AdminContent from "./AdminContent";
import AdminCalendar from "./AdminCalendar";
import AdminSettings from "./AdminSettings";
import AdminCustomers from "./AdminCustomers";
import BrandWordmark from "@/components/BrandWordmark";

const tabs = [
  { id: "bookings", label: "Rendez-vous", icon: CalendarDays },
  { id: "calendar", label: "Calendrier", icon: CalendarDays },
  { id: "services", label: "Services", icon: Scissors },
  { id: "customers", label: "Clients", icon: Users },
  { id: "gallery", label: "Galerie", icon: Image },
  { id: "content", label: "Contenu", icon: FileText },
  { id: "settings", label: "Parametres", icon: Settings },
] as const;

type TabId = typeof tabs[number]["id"];

const AdminDashboard = () => {
  const { signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>("bookings");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background flex">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-foreground/40 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`fixed md:static z-50 inset-y-0 left-0 w-64 bg-card border-r border-border/50 flex flex-col transition-transform duration-300 ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}>
        <div className="p-6 border-b border-border/50">
          <BrandWordmark titleClassName="text-xl" subtitleClassName="text-[0.52rem] tracking-[0.3em]" />
          <p className="text-muted-foreground text-xs mt-1">Panneau d'administration</p>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-body transition-colors ${activeTab === tab.id ? "bg-primary/30 text-foreground font-medium" : "text-muted-foreground hover:bg-muted/50"}`}
            >
              <tab.icon size={18} />
              {tab.label}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-border/50">
          <Button variant="ghost" onClick={signOut} className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground">
            <LogOut size={18} />
            Deconnexion
          </Button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-h-screen">
        <header className="h-14 border-b border-border/50 flex items-center px-4 md:px-6 bg-card">
          <button className="md:hidden mr-3" onClick={() => setSidebarOpen(true)}>
            <Menu size={22} />
          </button>
          <h2 className="font-display text-lg text-foreground">
            {tabs.find((tab) => tab.id === activeTab)?.label}
          </h2>
          <div className="ml-auto">
            <Button asChild variant="outline" size="sm" className="rounded-full gap-2">
              <Link to="/">
                <ArrowLeft size={16} />
                Retour au site
              </Link>
            </Button>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6 overflow-auto">
          {activeTab === "bookings" && <AdminBookings />}
          {activeTab === "calendar" && <AdminCalendar />}
          {activeTab === "services" && <AdminServices />}
          {activeTab === "customers" && <AdminCustomers />}
          {activeTab === "gallery" && <AdminGallery />}
          {activeTab === "content" && <AdminContent />}
          {activeTab === "settings" && <AdminSettings />}
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;
