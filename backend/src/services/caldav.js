import { addMinutesToTime } from "../core/scheduling.js";
import { escapeIcsText } from "../core/templates.js";

export const createCalDavClient = (env) => {
  const baseUrl = String(env.CALDAV_URL || "").replace(/\/$/, "");
  const calendarPath = String(env.CALDAV_CALENDAR_PATH || "").replace(/^\/+/, "");
  const authHeader = env.CALDAV_USERNAME && env.CALDAV_PASSWORD
    ? `Basic ${Buffer.from(`${env.CALDAV_USERNAME}:${env.CALDAV_PASSWORD}`).toString("base64")}`
    : "";

  if (!baseUrl || !calendarPath || !authHeader) {
    return {
      enabled: false,
      upsertBookingEvent: async () => null,
      deleteBookingEvent: async () => null,
    };
  }

  const buildEventUrl = (eventPath) => `${baseUrl}/${calendarPath.replace(/\/$/, "")}/${eventPath.replace(/^\/+/, "")}`;
  const buildTimestamp = (date, time) => `${date.replace(/-/g, "")}T${time.replace(":", "")}00`;
  const buildServiceLabel = (service) => [service.category, service.name].filter(Boolean).join(" - ");

  const buildEventBody = ({ booking, service, eventUid, description }) => {
    const dtStart = buildTimestamp(booking.booking_date, booking.booking_time);
    const dtEnd = buildTimestamp(booking.booking_date, addMinutesToTime(booking.booking_time, service.duration_minutes));
    const createdAt = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
    const serviceLabel = buildServiceLabel(service);

    return [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Just Beauty//Booking Calendar//FR",
      "CALSCALE:GREGORIAN",
      "BEGIN:VEVENT",
      `UID:${escapeIcsText(eventUid)}`,
      `DTSTAMP:${createdAt}`,
      `DTSTART;TZID=${env.CALDAV_TIMEZONE}:${dtStart}`,
      `DTEND;TZID=${env.CALDAV_TIMEZONE}:${dtEnd}`,
      `SUMMARY:${escapeIcsText(`Just Beauty - ${booking.client_name} - ${serviceLabel}`)}`,
      `DESCRIPTION:${escapeIcsText(description)}`,
      `LOCATION:${escapeIcsText("Just Beauty")}`,
      `ORGANIZER;CN=${escapeIcsText(env.SMTP_FROM_NAME || "Just Beauty")}:mailto:${escapeIcsText(env.SMTP_FROM_EMAIL || env.BOOKING_ADMIN_EMAIL || env.ADMIN_EMAIL)}`,
      `ATTENDEE;CN=${escapeIcsText(booking.client_name)}:mailto:${escapeIcsText(booking.client_email)}`,
      "STATUS:CONFIRMED",
      "END:VEVENT",
      "END:VCALENDAR",
      "",
    ].join("\r\n");
  };

  const sendRequest = async (url, method, { body, etag } = {}) => {
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: authHeader,
        ...(body ? { "Content-Type": "text/calendar; charset=utf-8" } : {}),
        ...(etag ? { "If-Match": etag } : {}),
      },
      body,
    });

    if (!response.ok && response.status !== 412 && response.status !== 404) {
      const text = await response.text();
      throw new Error(`CalDAV ${method} failed (${response.status}): ${text.slice(0, 200)}`);
    }

    return response;
  };

  return {
    enabled: true,
    async upsertBookingEvent({ booking, service, existingEvent }) {
      const eventUid = existingEvent?.event_uid || `${booking.id}@justbeauty`;
      const eventPath = existingEvent?.event_path || `${booking.id}.ics`;
      const serviceLabel = buildServiceLabel(service);
      const description = [
        `Cliente: ${booking.client_name}`,
        `Email: ${booking.client_email}`,
        `Telephone: ${booking.client_phone || "Non renseigne"}`,
        `Service: ${serviceLabel}`,
      ].join("\n");
      const response = await sendRequest(
        buildEventUrl(eventPath),
        "PUT",
        { body: buildEventBody({ booking, service, eventUid, description }), etag: existingEvent?.etag || undefined },
      );
      return {
        event_uid: eventUid,
        event_path: eventPath,
        etag: response.headers.get("etag") || "",
        synced_at: new Date().toISOString(),
      };
    },
    async deleteBookingEvent(existingEvent) {
      if (!existingEvent) return null;
      await sendRequest(buildEventUrl(existingEvent.event_path), "DELETE", { etag: existingEvent.etag || undefined });
      return { ok: true };
    },
  };
};
