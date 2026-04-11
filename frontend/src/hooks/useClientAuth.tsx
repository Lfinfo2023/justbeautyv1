import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, customerAuthStorage, type Booking, type CustomerUser, type GiftCard, type GiftCardPaymentDetails, type LoyaltyTransaction } from "@/lib/api";

interface ClientAuthContextType {
  customer: CustomerUser | null;
  bookings: Booking[];
  loyaltyTransactions: LoyaltyTransaction[];
  giftCards: GiftCard[];
  giftCardPaymentDetails: GiftCardPaymentDetails | null;
  loading: boolean;
  signUp: (payload: { first_name: string; last_name: string; email: string; phone: string; password: string; marketing_consent: boolean }) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<{ error: Error | null }>;
  createGiftCard: (payload: { amount: number; recipient_name?: string; recipient_email?: string; message?: string; theme_style?: "fun_party" | "fun_pop" | "glam_chic" | "glam_luxe" }) => Promise<{ error: Error | null }>;
  refresh: () => Promise<void>;
}

const ClientAuthContext = createContext<ClientAuthContextType>({
  customer: null,
  bookings: [],
  loyaltyTransactions: [],
  giftCards: [],
  giftCardPaymentDetails: null,
  loading: true,
  signUp: async () => ({ error: null }),
  signIn: async () => ({ error: null }),
  signOut: async () => {},
  deleteAccount: async () => ({ error: null }),
  createGiftCard: async () => ({ error: null }),
  refresh: async () => {},
});

export const ClientAuthProvider = ({ children }: { children: ReactNode }) => {
  const [customer, setCustomer] = useState<CustomerUser | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loyaltyTransactions, setLoyaltyTransactions] = useState<LoyaltyTransaction[]>([]);
  const [giftCards, setGiftCards] = useState<GiftCard[]>([]);
  const [giftCardPaymentDetails, setGiftCardPaymentDetails] = useState<GiftCardPaymentDetails | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async () => {
    const result = await api.customerAuth.me();
    setCustomer(result.user);
    setBookings(result.bookings);
    setLoyaltyTransactions(result.loyaltyTransactions);
    setGiftCards(result.giftCards || []);
    setGiftCardPaymentDetails(result.giftCardPaymentDetails || null);
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
        setGiftCards([]);
        setGiftCardPaymentDetails(null);
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
    setGiftCards([]);
    setGiftCardPaymentDetails(null);
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

  const createGiftCard = async (payload: { amount: number; recipient_name?: string; recipient_email?: string; message?: string; theme_style?: "fun_party" | "fun_pop" | "glam_chic" | "glam_luxe" }) => {
    try {
      await api.customerAuth.createGiftCard(payload);
      await loadProfile();
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  return (
    <ClientAuthContext.Provider value={{
      customer,
      bookings,
      loyaltyTransactions,
      giftCards,
      giftCardPaymentDetails,
      loading,
      signUp,
      signIn,
      signOut,
      deleteAccount,
      createGiftCard,
      refresh: loadProfile,
    }}
    >
      {children}
    </ClientAuthContext.Provider>
  );
};

export const useClientAuth = () => useContext(ClientAuthContext);
