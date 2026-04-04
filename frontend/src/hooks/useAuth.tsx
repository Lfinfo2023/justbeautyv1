import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { api, authStorage, type AdminUser } from "@/lib/api";

interface AuthContextType {
  user: AdminUser | null;
  session: { token: string } | null;
  isAdmin: boolean;
  mustChangePassword: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  isAdmin: false,
  mustChangePassword: false,
  loading: true,
  signIn: async () => ({ error: null }),
  changePassword: async () => ({ error: null }),
  signOut: async () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [session, setSession] = useState<{ token: string } | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = authStorage.getToken();
    if (!token) {
      setLoading(false);
      return;
    }

    setSession({ token });
    api.auth.me()
      .then((result) => {
        setUser(result.user);
        setIsAdmin(result.isAdmin);
        setMustChangePassword(result.mustChangePassword);
      })
      .catch(() => {
        authStorage.clearToken();
        setSession(null);
        setUser(null);
        setIsAdmin(false);
        setMustChangePassword(false);
      })
      .finally(() => setLoading(false));
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const result = await api.auth.login(email, password);
      authStorage.setToken(result.token);
      setSession({ token: result.token });
      setUser(result.user);
      setIsAdmin(result.isAdmin);
      setMustChangePassword(result.mustChangePassword);
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    try {
      const result = await api.auth.changePassword(currentPassword, newPassword);
      setMustChangePassword(result.mustChangePassword);
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    try {
      await api.auth.logout();
    } catch {
      // Ignore logout failures and clear local state anyway.
    }
    authStorage.clearToken();
    setSession(null);
    setUser(null);
    setIsAdmin(false);
    setMustChangePassword(false);
  };

  return (
    <AuthContext.Provider value={{ user, session, isAdmin, mustChangePassword, loading, signIn, changePassword, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
