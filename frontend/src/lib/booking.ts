import type { BookingStatus } from "@/lib/api";

const manicureOptionNames = new Set([
  "ongle casse",
  "french / baby boomer",
  "effet sirène / chrome",
  "nail arts",
  "strass / bijoux",
]);

export const getBookingStatusLabel = (status: BookingStatus) => {
  switch (status) {
    case "pending":
      return "En attente";
    case "confirmed":
      return "Confirmé";
    case "refused":
      return "Refusé";
    case "cancelled":
      return "Annulé";
    default:
      return status;
  }
};

export const getServiceLabel = (service?: { category?: string | null; name?: string | null } | null) =>
  [service?.category, service?.name].filter(Boolean).join(" - ");

export const isManicureOptionService = (service?: { category?: string | null; name?: string | null; price_label?: string | null } | null) => (
  service?.category === "Manucure"
  && (
    String(service?.price_label || "").includes("*")
    || manicureOptionNames.has(String(service?.name || "").toLowerCase())
  )
);
