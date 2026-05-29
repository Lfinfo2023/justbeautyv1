const API_BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
const AUTH_STORAGE_KEY = "justbeauty_admin_token";
const CUSTOMER_AUTH_STORAGE_KEY = "justbeauty_customer_token";

export type BookingStatus = "pending" | "confirmed" | "refused" | "cancelled";
export type DepositMethod = "none" | "mollie" | "bank_transfer";
export type DepositStatus = "not_required" | "pending" | "open" | "awaiting_bank_transfer" | "paid" | "failed" | "expired" | "cancelled";

export interface AdminUser {
  id: string;
  email: string;
  name: string;
}

export interface Service {
  id: string;
  category: string;
  name: string;
  description: string;
  price: number;
  price_label?: string;
  duration_minutes: number;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Booking {
  id: string;
  service_id: string;
  customer_id?: string | null;
  client_name: string;
  client_email: string;
  client_phone: string;
  booking_date: string;
  booking_time: string;
  status: BookingStatus;
  notes: string;
  deposit_required?: boolean;
  deposit_amount?: number;
  deposit_method?: DepositMethod;
  deposit_status?: DepositStatus;
  deposit_reference?: string;
  deposit_checkout_url?: string;
  deposit_payment_id?: string;
  deposit_paid_at?: string;
  balance_payment_id?: string;
  balance_payment_status?: "not_requested" | DepositStatus;
  balance_checkout_url?: string;
  balance_paid_at?: string;
  reminder_sent_at?: string;
  service_price?: number;
  created_at: string;
  updated_at: string;
  services?: {
    name: string;
    category: string;
    duration_minutes?: number;
    price?: number;
  } | null;
  payment_required?: boolean;
}

export interface BookingBalancePaymentResponse {
  booking: Booking;
  checkout_url: string;
  qr_code_url: string;
  amount: number;
}

export interface BookingPaymentStatusResponse {
  booking: Booking;
  service: {
    id: string;
    name: string;
    category: string;
    description: string;
    duration_minutes: number;
    price: number;
  };
  payment_status: DepositStatus;
  can_retry: boolean;
  can_cancel: boolean;
}

export interface CustomerUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  marketing_consent: boolean;
  trusted_no_deposit: boolean;
  deletion_requested_at: string;
  deletion_scheduled_for: string;
  deletion_requested_by: string;
  loyalty_points: number;
  loyalty_completed_visits: number;
  loyalty_progress_visits: number;
  loyalty_visits_until_discount: number;
  loyalty_available_discounts: number;
  loyalty_discount_rate: number;
  loyalty_next_discount_at: number;
  created_at: string;
  updated_at: string;
}

export interface LoyaltyTransaction {
  id: string;
  booking_id?: string | null;
  visits: number;
  type: string;
  description: string;
  created_at: string;
}

export interface LoyaltySummary {
  completed_visits: number;
  progress_visits: number;
  visits_until_discount: number;
  available_discounts: number;
  discount_rate: number;
  next_discount_at: number;
}

export type GiftCardStatus = "pending_payment" | "active" | "refused" | "used" | "expired";

export interface GiftCard {
  id: string;
  customer_id: string;
  code: string;
  amount: number;
  currency: string;
  recipient_name: string;
  recipient_email: string;
  message: string;
  theme_style: "fun_party" | "fun_pop" | "glam_chic" | "glam_luxe";
  payment_method: "bank_transfer";
  payment_reference: string;
  bank_account_snapshot: string;
  bank_name_snapshot: string;
  status: GiftCardStatus;
  admin_note: string;
  created_at: string;
  updated_at: string;
  validated_at: string;
  expires_at: string;
  used_at: string;
}

export interface GiftCardPaymentDetails {
  bank_account: string;
  bank_name: string;
  instructions: string;
}

export interface CustomerDashboardResponse {
  user: CustomerUser;
  bookings: Booking[];
  loyaltyTransactions: LoyaltyTransaction[];
  giftCards: GiftCard[];
  giftCardPaymentDetails: GiftCardPaymentDetails;
}

export interface CalDavStatus {
  enabled: boolean;
  synced_events: number;
  confirmed_bookings: number;
}

export interface PaymentSettings {
  enabled: boolean;
  deposit_rate: number;
  deposit_threshold: number;
  allow_bank_transfer: boolean;
  bank_account: string;
  bank_name: string;
  bank_reference_prefix?: string;
  mollie_mode: "test" | "live";
  mollie_enabled: boolean;
  mollie_api_configured?: boolean;
  mollie_api_key?: string;
  mollie_test_api_configured?: boolean;
  mollie_live_api_configured?: boolean;
  mollie_test_api_key?: string;
  mollie_live_api_key?: string;
  trusted_customer?: boolean;
}

export interface AdminCustomer {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  marketing_consent: boolean;
  trusted_no_deposit: boolean;
  deletion_requested_at: string;
  deletion_scheduled_for: string;
  deletion_requested_by: string;
  created_at: string;
  updated_at: string;
  total_bookings: number;
  confirmed_bookings: number;
  pending_bookings: number;
  last_booking_at: string;
  last_confirmed_booking_at: string;
  is_inactive: boolean;
}

export interface GalleryImage {
  id: string;
  url: string;
  alt_text: string;
  sort_order: number;
  created_at: string;
}

export interface ProtectionAsset {
  id: string;
  gallery_image_id: string;
  original_sha256: string;
  displayed_sha256: string;
  phash64: string;
  watermark_text: string;
  watermark_applied: number;
  created_at: string;
  image_url: string;
  image_alt_text: string;
}

export interface ProtectionEvent {
  id: string;
  asset_id?: string | null;
  gallery_image_id?: string | null;
  event_type: string;
  source_url: string;
  reporter: string;
  notes: string;
  evidence_json?: string;
  evidence?: Record<string, unknown>;
  created_at: string;
}

export interface ProtectionConfig {
  enabled: boolean;
  block_hotlink: boolean;
  allowed_hosts: string[];
  watermark_text: string;
  watermark_opacity: number;
  report_email: string;
}

export interface ProtectionVerifyResponse {
  matched: boolean;
  exact_matches: ProtectionAsset[];
  near_matches: Array<ProtectionAsset & { phash_distance: number }>;
  candidate: {
    sha256: string;
    phash64: string;
  };
}

export interface SiteContentItem {
  id: string;
  key: string;
  value: string;
  updated_at: string;
  fingerprint_tag?: string;
}

export interface AvailabilityOverride {
  date: string;
  status: "open" | "closed";
  updated_at: string;
}

export interface AvailabilitySlotOverride {
  date: string;
  time: string;
  status: "open" | "closed";
  updated_at: string;
}

export interface AvailabilityResponse {
  weeklySchedule?: WeeklyScheduleDay[];
  days: AvailabilityOverride[];
  slots: AvailabilitySlotOverride[];
  timeSlots: string[];
}

export interface AvailabilitySlotsResponse {
  date: string;
  service_id: string;
  slots: string[];
  has_available: boolean;
}

export interface WeeklyScheduleRange {
  start_time: string;
  end_time: string;
  updated_at?: string;
}

export interface WeeklyScheduleDay {
  weekday: number;
  key: string;
  is_open: boolean;
  updated_at: string;
  ranges: WeeklyScheduleRange[];
}

interface RequestOptions extends RequestInit {
  auth?: boolean;
  customerAuth?: boolean;
}

const getToken = () => localStorage.getItem(AUTH_STORAGE_KEY);
const getCustomerToken = () => localStorage.getItem(CUSTOMER_AUTH_STORAGE_KEY);

export const authStorage = {
  getToken,
  setToken: (token: string) => localStorage.setItem(AUTH_STORAGE_KEY, token),
  clearToken: () => localStorage.removeItem(AUTH_STORAGE_KEY),
};

export const customerAuthStorage = {
  getToken: getCustomerToken,
  setToken: (token: string) => localStorage.setItem(CUSTOMER_AUTH_STORAGE_KEY, token),
  clearToken: () => localStorage.removeItem(CUSTOMER_AUTH_STORAGE_KEY),
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (options.auth) {
    const token = getToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }
  if (options.customerAuth) {
    const token = getCustomerToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  if (!response.ok) {
    let message = "Request failed";
    try {
      const payload = await response.json();
      message = payload.error || message;
    } catch {
      // Ignore malformed error bodies.
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export const api = {
  auth: {
    login: (email: string, password: string) =>
      request<{ token: string; user: AdminUser; isAdmin: boolean; mustChangePassword: boolean }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }),
    me: () => request<{ user: AdminUser; isAdmin: boolean; mustChangePassword: boolean }>("/api/auth/me", { auth: true }),
    logout: () => request<void>("/api/auth/logout", { method: "POST", auth: true }),
    changePassword: (currentPassword: string, newPassword: string) =>
      request<{ ok: true; mustChangePassword: boolean }>("/api/auth/change-password", {
        method: "POST",
        auth: true,
        body: JSON.stringify({ currentPassword, newPassword }),
      }),
  },
  customerAuth: {
    register: (payload: { first_name: string; last_name: string; email: string; phone: string; password: string; marketing_consent: boolean }) =>
      request<{ token: string; user: CustomerUser }>("/api/customers/register", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    login: (email: string, password: string) =>
      request<{ token: string; user: CustomerUser }>("/api/customers/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }),
    me: () => request<CustomerDashboardResponse>("/api/customers/me", { customerAuth: true }),
    deleteAccount: () => request<{ ok: true; customer?: CustomerUser }>("/api/customers/delete", { method: "POST", customerAuth: true }),
    logout: () => request<void>("/api/customers/logout", { method: "POST", customerAuth: true }),
    createGiftCard: (payload: { amount: number; recipient_name?: string; recipient_email?: string; message?: string; theme_style?: "fun_party" | "fun_pop" | "glam_chic" | "glam_luxe" }) =>
      request<{ gift_card: GiftCard; payment_details: GiftCardPaymentDetails }>("/api/customers/gift-cards", {
        method: "POST",
        customerAuth: true,
        body: JSON.stringify(payload),
      }),
  },
  services: {
    listPublic: () => request<Service[]>("/api/services"),
    listAdmin: () => request<Service[]>("/api/admin/services", { auth: true }),
    create: (payload: Partial<Service>) =>
      request<Service>("/api/admin/services", {
        method: "POST",
        auth: true,
        body: JSON.stringify(payload),
      }),
    update: (id: string, payload: Partial<Service>) =>
      request<Service>(`/api/admin/services/${id}`, {
        method: "PUT",
        auth: true,
        body: JSON.stringify(payload),
      }),
    remove: (id: string) =>
      request<void>(`/api/admin/services/${id}`, {
        method: "DELETE",
        auth: true,
      }),
  },
  bookings: {
    create: (payload: Pick<Booking, "service_id" | "booking_date" | "booking_time" | "client_name" | "client_email" | "client_phone"> & {
      notes?: string;
      create_account?: boolean;
      password?: string;
      marketing_consent?: boolean;
      first_name?: string;
      last_name?: string;
      deposit_method?: DepositMethod;
    }) =>
      request<Booking & { customer_token?: string }>("/api/bookings", {
        method: "POST",
        headers: getCustomerToken() ? { Authorization: `Bearer ${getCustomerToken()}` } : undefined,
        body: JSON.stringify(payload),
      }),
    getPaymentStatus: (id: string) =>
      request<BookingPaymentStatusResponse>(`/api/bookings/payment-status/${id}`),
    retryPayment: (id: string) =>
      request<BookingPaymentStatusResponse>(`/api/bookings/payment-status/${id}/retry`, {
        method: "POST",
      }),
    cancelPayment: (id: string) =>
      request<{ ok: true }>(`/api/bookings/payment-status/${id}/cancel`, {
        method: "POST",
      }),
    getBalancePaymentStatus: (id: string) =>
      request<BookingPaymentStatusResponse>(`/api/bookings/balance-payment-status/${id}`),
    retryBalancePayment: (id: string) =>
      request<BookingPaymentStatusResponse>(`/api/bookings/balance-payment-status/${id}/retry`, {
        method: "POST",
      }),
    cancelBalancePayment: (id: string) =>
      request<{ ok: true; booking?: Booking }>(`/api/bookings/balance-payment-status/${id}/cancel`, {
        method: "POST",
      }),
    listAdmin: () => request<Booking[]>("/api/admin/bookings", { auth: true }),
    updateStatus: (id: string, status: BookingStatus) =>
      request<void>(`/api/admin/bookings/${id}`, {
        method: "PATCH",
        auth: true,
        body: JSON.stringify({ status }),
      }),
    updateDepositStatus: (id: string, deposit_status: DepositStatus) =>
      request<void>(`/api/admin/bookings/${id}/deposit`, {
        method: "PATCH",
        auth: true,
        body: JSON.stringify({ deposit_status }),
      }),
    createBalancePayment: (id: string, send_email = false) =>
      request<BookingBalancePaymentResponse>(`/api/admin/bookings/${id}/balance-payment`, {
        method: "POST",
        auth: true,
        body: JSON.stringify({ send_email }),
      }),
    sendReminder: (id: string) =>
      request<{ ok: true; booking: Booking }>(`/api/admin/bookings/${id}/reminder`, {
        method: "POST",
        auth: true,
      }),
    remove: (id: string) =>
      request<void>(`/api/admin/bookings/${id}`, {
        method: "DELETE",
        auth: true,
      }),
    syncCalendar: () =>
      request<{ synced: number; cleaned: number; errors: string[]; enabled: boolean }>("/api/admin/caldav/sync", {
        method: "POST",
        auth: true,
      }),
    caldavStatus: () => request<CalDavStatus>("/api/admin/caldav/status", { auth: true }),
  },
  paymentSettings: {
    getPublic: () =>
      request<PaymentSettings>("/api/payment-settings", {
        headers: getCustomerToken() ? { Authorization: `Bearer ${getCustomerToken()}` } : undefined,
      }),
    getAdmin: () => request<PaymentSettings>("/api/admin/payment-settings", { auth: true }),
    saveAdmin: (payload: Partial<PaymentSettings>) =>
      request<PaymentSettings>("/api/admin/payment-settings", {
        method: "PUT",
        auth: true,
        body: JSON.stringify(payload),
      }),
    testMollie: (payload?: { mollie_mode?: "test" | "live"; mollie_api_key?: string; mollie_test_api_key?: string; mollie_live_api_key?: string }) =>
      request<{ ok: boolean; methods_count: number; enabled_methods_count: number; all_methods_count: number; mode: "test" | "live" }>("/api/admin/payment-settings/test-mollie", {
        method: "POST",
        auth: true,
        body: JSON.stringify(payload || {}),
      }),
  },
  customers: {
    listAdmin: () => request<AdminCustomer[]>("/api/admin/customers", { auth: true }),
    updateTrust: (id: string, trusted_no_deposit: boolean) =>
      request<CustomerUser>(`/api/admin/customers/${id}/trust`, {
        method: "PATCH",
        auth: true,
        body: JSON.stringify({ trusted_no_deposit }),
      }),
    requestDeletion: (id: string) =>
      request<CustomerUser>(`/api/admin/customers/${id}/deletion-request`, {
        method: "POST",
        auth: true,
      }),
    cancelDeletionRequest: (id: string) =>
      request<CustomerUser>(`/api/admin/customers/${id}/deletion-request`, {
        method: "DELETE",
        auth: true,
      }),
    deleteNow: (id: string) =>
      request<{ ok: true }>(`/api/admin/customers/${id}/delete-now`, {
        method: "POST",
        auth: true,
      }),
  },
  giftCards: {
    listAdmin: () => request<Array<GiftCard & { customer_name: string; customer_email: string }>>("/api/admin/gift-cards", { auth: true }),
    updateAdmin: (id: string, payload: { status: GiftCardStatus; admin_note?: string }) =>
      request<GiftCard>(`/api/admin/gift-cards/${id}`, {
        method: "PATCH",
        auth: true,
        body: JSON.stringify(payload),
      }),
    remove: (id: string) =>
      request<void>(`/api/admin/gift-cards/${id}`, {
        method: "DELETE",
        auth: true,
      }),
  },
  contact: {
    create: (payload: { name: string; email: string; phone: string; message: string }) =>
      request<{ ok: true }>("/api/contact", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
  },
  support: {
    reportPaymentIssue: (payload: {
      client_name: string;
      client_email: string;
      client_phone: string;
      service_label: string;
      booking_slot: string;
      deposit_method: string;
      error_message: string;
      logs: Record<string, unknown>;
    }) =>
      request<{ ok: true }>("/api/payment-issues/report", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
  },
  availability: {
    listPublic: () => request<AvailabilityResponse>("/api/availability"),
    listPublicSlots: (date: string, service_id: string) =>
      request<AvailabilitySlotsResponse>(`/api/availability/slots?date=${encodeURIComponent(date)}&service_id=${encodeURIComponent(service_id)}`),
    listAdmin: () => request<AvailabilityResponse>("/api/admin/availability", { auth: true }),
    listWeeklySchedule: () => request<WeeklyScheduleDay[]>("/api/admin/weekly-schedule", { auth: true }),
    saveWeeklySchedule: (days: WeeklyScheduleDay[]) =>
      request<WeeklyScheduleDay[]>("/api/admin/weekly-schedule", {
        method: "PUT",
        auth: true,
        body: JSON.stringify({ days }),
      }),
    setStatus: (date: string, status: "open" | "closed") =>
      request<{ date: string; status: "open" | "closed" }>(`/api/admin/availability/${date}`, {
        method: "PUT",
        auth: true,
        body: JSON.stringify({ status }),
      }),
    applyRange: (payload: { date: string; start_time: string; end_time: string; mode?: "open_only" | "close_only" }) =>
      request<AvailabilityResponse>("/api/admin/availability/range", {
        method: "POST",
        auth: true,
        body: JSON.stringify(payload),
      }),
    setSlotStatus: (date: string, time: string, status: "open" | "closed") =>
      request<{ date: string; time: string; status: "open" | "closed" }>(`/api/admin/availability/slots/${date}/${encodeURIComponent(time)}`, {
        method: "PUT",
        auth: true,
        body: JSON.stringify({ status }),
      }),
    reset: (date: string) =>
      request<void>(`/api/admin/availability/${date}`, {
        method: "DELETE",
        auth: true,
      }),
    resetSlot: (date: string, time: string) =>
      request<void>(`/api/admin/availability/slots/${date}/${encodeURIComponent(time)}`, {
        method: "DELETE",
        auth: true,
      }),
  },
  gallery: {
    listPublic: () => request<GalleryImage[]>("/api/gallery"),
    listAdmin: () => request<GalleryImage[]>("/api/admin/gallery", { auth: true }),
    upload: (payload: { filename: string; dataUrl: string; alt_text: string; sort_order: number }) =>
      request<GalleryImage>("/api/admin/gallery", {
        method: "POST",
        auth: true,
        body: JSON.stringify(payload),
      }),
    update: (id: string, payload: { alt_text: string; sort_order?: number }) =>
      request<GalleryImage>(`/api/admin/gallery/${id}`, {
        method: "PUT",
        auth: true,
        body: JSON.stringify(payload),
      }),
    remove: (id: string) =>
      request<void>(`/api/admin/gallery/${id}`, {
        method: "DELETE",
        auth: true,
      }),
  },
  protection: {
    getConfig: () => request<ProtectionConfig>("/api/admin/protection/config", { auth: true }),
    listAssets: () => request<ProtectionAsset[]>("/api/admin/protection/assets", { auth: true }),
    listEvents: () => request<ProtectionEvent[]>("/api/admin/protection/events", { auth: true }),
    verify: (payload: { dataUrl?: string; image_url?: string; sha256?: string; phash64?: string }) =>
      request<ProtectionVerifyResponse>("/api/admin/protection/verify", {
        method: "POST",
        auth: true,
        body: JSON.stringify(payload),
      }),
    report: (payload: {
      asset_id?: string;
      event_type?: string;
      source_url?: string;
      reporter?: string;
      notes?: string;
      evidence?: Record<string, unknown>;
    }) =>
      request<{ ok: true }>("/api/admin/protection/report", {
        method: "POST",
        auth: true,
        body: JSON.stringify(payload),
      }),
    getDmcaTemplate: (params?: { asset_id?: string; source_url?: string }) => {
      const query = new URLSearchParams();
      if (params?.asset_id) query.set("asset_id", params.asset_id);
      if (params?.source_url) query.set("source_url", params.source_url);
      const suffix = query.toString() ? `?${query.toString()}` : "";
      return request<{ generated_at: string; asset: ProtectionAsset | null; source_url: string; template: string }>(`/api/admin/protection/dmca-template${suffix}`, { auth: true });
    },
  },
  content: {
    listPublic: () => request<SiteContentItem[]>("/api/content"),
    listAdmin: () => request<SiteContentItem[]>("/api/admin/content", { auth: true }),
    save: (values: Record<string, string>) =>
      request<SiteContentItem[]>("/api/admin/content", {
        method: "PUT",
        auth: true,
        body: JSON.stringify({ values }),
      }),
  },
};
