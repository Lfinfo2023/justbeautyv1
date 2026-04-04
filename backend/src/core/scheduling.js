export const WEEKDAY_KEYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
export const APPOINTMENT_TIME_SLOTS = ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30", "18:00", "18:30", "19:00", "19:30"];
export const DEFAULT_SERVICE_DURATION_MINUTES = 90;
export const DEFAULT_WEEKLY_SCHEDULE = [
  { weekday: 0, is_open: 0, ranges: [] },
  { weekday: 1, is_open: 1, ranges: [{ start_time: "15:00", end_time: "18:30" }] },
  { weekday: 2, is_open: 1, ranges: [{ start_time: "15:00", end_time: "18:30" }] },
  { weekday: 3, is_open: 1, ranges: [{ start_time: "15:00", end_time: "18:30" }] },
  { weekday: 4, is_open: 1, ranges: [{ start_time: "15:00", end_time: "18:30" }] },
  { weekday: 5, is_open: 1, ranges: [{ start_time: "15:00", end_time: "18:30" }] },
  { weekday: 6, is_open: 1, ranges: [{ start_time: "15:00", end_time: "18:30" }] },
];
export const LEGACY_DEFAULT_WEEKLY_SCHEDULE = [
  { weekday: 0, is_open: 0, ranges: [] },
  { weekday: 1, is_open: 1, ranges: [{ start_time: "09:00", end_time: "12:00" }, { start_time: "13:00", end_time: "18:00" }] },
  { weekday: 2, is_open: 1, ranges: [{ start_time: "09:00", end_time: "12:00" }, { start_time: "13:00", end_time: "18:00" }] },
  { weekday: 3, is_open: 1, ranges: [{ start_time: "09:00", end_time: "12:00" }, { start_time: "13:00", end_time: "18:00" }] },
  { weekday: 4, is_open: 1, ranges: [{ start_time: "09:00", end_time: "12:00" }, { start_time: "13:00", end_time: "18:00" }] },
  { weekday: 5, is_open: 1, ranges: [{ start_time: "09:00", end_time: "12:00" }, { start_time: "13:00", end_time: "18:00" }] },
  { weekday: 6, is_open: 1, ranges: [{ start_time: "09:00", end_time: "12:00" }, { start_time: "13:00", end_time: "16:00" }] },
];

export const normalizeDate = (value) => String(value || "").trim().slice(0, 10);
export const normalizeTime = (value) => String(value || "").trim().slice(0, 5);

export const toMinutes = (time) => {
  const normalized = normalizeTime(time);
  const [hours, minutes] = normalized.split(":").map((part) => Number(part || 0));
  return hours * 60 + minutes;
};

export const addMinutesToTime = (time, minutesToAdd) => {
  const total = toMinutes(time) + Number(minutesToAdd || 0);
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
};

export const rangesOverlap = (startA, endA, startB, endB) => startA < endB && startB < endA;

export const slotFitsRange = (time, durationMinutes, range) => {
  const slotStart = toMinutes(time);
  const slotEnd = slotStart + Number(durationMinutes || 0);
  const rangeStart = toMinutes(range.start_time);
  const rangeEnd = toMinutes(range.end_time);
  return slotStart >= rangeStart && slotEnd <= rangeEnd;
};

export const normalizeRange = (range) => {
  const start_time = normalizeTime(range?.start_time);
  const end_time = normalizeTime(range?.end_time);
  if (!start_time || !end_time) return null;
  if (!APPOINTMENT_TIME_SLOTS.includes(start_time)) return null;
  if (toMinutes(end_time) <= toMinutes(start_time)) return null;
  return { start_time, end_time };
};
