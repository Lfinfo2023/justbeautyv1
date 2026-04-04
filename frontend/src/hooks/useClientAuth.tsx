import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, customerAuthStorage, type Booking, type CustomerUser, type LoyaltyTransaction } from "@/lib/api";

interface ClientAuthContextType {
  customer: CustomerUser | null;
  bookings: Booking[];
  loyaltyTransactions: LoyaltyTransaction[];
  loading: boolean;
  signUp: (payload: { first_name: string; last_name: string; email: string; phone: string; password: string; marketing_consent: boolean }) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<{ error: Error | null }>;
  refresh: () => Promise<void>;
}

const ClientAuthContext = createContext<ClientAuthContextType>({
  customer: null,
  bookings: [],
  loyaltyTransactions: [],
  loading: true,
  signUp: async () => ({ error: null }),
  signIn: async () => ({ error: null }),
  signOut: async () => {},
  deleteAccount: async () => ({ error: null }),
  refresh: async () => {},
});

export const ClientAuthProvider = ({ children }: { children: ReactNode }) => {
  const [customer, setCustomer] = useState<CustomerUser | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loyaltyTransactions, setLoyaltyTransactions] = useState<LoyaltyTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProfile = async () => {
    const result = await api.customerAuth.me();
    setCustomer(result.user);
    setBookings(result.bookings);
    setLoyaltyTransactions(result.loyaltyTransactions);
  };

  useEffect(() => {
    const token = customerAuthStorage.getToken();
    if (!token) {
      setLoading(false);
      return;
    }

    loadProfile()
      .catch(() => {
        customerAuthStorage.clearToken();
        setCustomer(null);
        setBookings([]);
        setLoyaltyTransactions([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const signUp = async (payload: { first_name: string; last_name: string; email: string; phone: string; password: string; marketing_consent: boolean }) => {
    try {
      const result = await api.customerAuth.register(payload);
      customerAuthStorage.setToken(result.token);
      setCustomer(result.user);
      await loadProfile();
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const result = await api.customerAuth.login(email, password);
      customerAuthStorage.setToken(result.token);
      setCustomer(result.user);
      await loadProfile();
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    try {
      await api.customerAuth.logout();
    } catch {
      // Ignore logout errors.
    }
    customerAuthStorage.clearToken();
    setCustomer(null);
    setBookings([]);
    setLoyaltyTransactions([]);
  };

  const deleteAccount = async () => {
    try {
      const response = await api.customerAuth.deleteAccount();
      if (response.customer) {
        setCustomer(response.customer);
      } else {
        await loadProfile();
      }
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  return (
    <ClientAuthContext.Provider value={{ customer, bookings, loyaltyTransactions, loading, signUp, signIn, signOut, deleteAccount, refresh: loadProfile }}>
      {children}
    </ClientAuthContext.Provider>
  );
};

export const useClientAuth = () => useContext(ClientAuthContext);
