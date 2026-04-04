import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { ClientAuthProvider } from "@/hooks/useClientAuth";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ScrollToTop from "@/components/ScrollToTop";
import Index from "./pages/Index";
import About from "./pages/About";
import Services from "./pages/Services";
import Gallery from "./pages/Gallery";
import Contact from "./pages/Contact";
import Booking from "./pages/Booking";
import NotFound from "./pages/NotFound";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminSecurity from "./pages/admin/AdminSecurity";
import Account from "./pages/Account";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import LegalNotice from "./pages/LegalNotice";

const queryClient = new QueryClient();

const ProtectedAdmin = () => {
  const { isAdmin, loading, user, mustChangePassword } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Chargement...</div>;
  if (!user) return <Navigate to="/admin/login" replace />;
  if (mustChangePassword) return <Navigate to="/admin/password" replace />;
  if (!isAdmin) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Acces refuse</div>;
  return <AdminDashboard />;
};

const AppRoutes = () => {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/" element={<><Navbar /><Index /><Footer /></>} />
      <Route path="/a-propos" element={<><Navbar /><About /><Footer /></>} />
      <Route path="/services" element={<><Navbar /><Services /><Footer /></>} />
      <Route path="/galerie" element={<><Navbar /><Gallery /><Footer /></>} />
      <Route path="/contact" element={<><Navbar /><Contact /><Footer /></>} />
      <Route path="/rendez-vous" element={<><Navbar /><Booking /><Footer /></>} />
      <Route path="/compte" element={<><Navbar /><Account /><Footer /></>} />
      <Route path="/politique-de-confidentialite" element={<><Navbar /><PrivacyPolicy /><Footer /></>} />
      <Route path="/mentions-legales" element={<><Navbar /><LegalNotice /><Footer /></>} />
      <Route path="/admin/login" element={user ? <Navigate to="/admin" replace /> : <AdminLogin />} />
      <Route path="/admin/password" element={user ? <AdminSecurity forced /> : <Navigate to="/admin/login" replace />} />
      <Route path="/admin" element={<ProtectedAdmin />} />
      <Route path="*" element={<><Navbar /><NotFound /><Footer /></>} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <BrowserRouter>
        <ScrollToTop />
        <AuthProvider>
          <ClientAuthProvider>
            <AppRoutes />
          </ClientAuthProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
