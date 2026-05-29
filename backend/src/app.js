import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import sharp from "sharp";

const ROOT = path.resolve(process.cwd());
const DATA_DIR = path.join(ROOT, "data");
const UPLOAD_DIR = path.join(ROOT, "uploads");
const ENV_FILE = path.join(ROOT, ".env");

const defaultEnv = {
  PORT: "3105",
  HOST: "0.0.0.0",
  DB_FILE: path.join(DATA_DIR, "app.db"),
  ADMIN_EMAIL: "admin@justbeauty.local",
  ADMIN_PASSWORD: "change-me-now",
  ADMIN_NAME: "Just Beauty Admin",
  SESSION_SECRET: crypto.randomBytes(32).toString("hex"),
  CORS_ORIGIN: "https://just-beauty.be",
  PUBLIC_BASE_URL: "https://just-beauty.be",
  API_PUBLIC_BASE_URL: "https://just-beauty.be",
  SMTP_HOST: "",
  SMTP_PORT: "587",
  SMTP_SECURE: "false",
  SMTP_USER: "",
  SMTP_PASS: "",
  SMTP_FROM_EMAIL: "contact@justbeauty.be",
  SMTP_FROM_NAME: "Just Beauty",
  BOOKING_ADMIN_EMAIL: "contact@justbeauty.be",
  CONTACT_ADMIN_EMAIL: "contact@justbeauty.be",
  TELEGRAM_BOT_TOKEN: "",
  TELEGRAM_CHAT_ID: "",
  TELEGRAM_WEBHOOK_SECRET_TOKEN: "",
  CALDAV_URL: "",
  CALDAV_USERNAME: "",
  CALDAV_PASSWORD: "",
  CALDAV_CALENDAR_PATH: "",
  CALDAV_TIMEZONE: "Europe/Brussels",
  MOLLIE_API_KEY: "",
  LOYALTY_POINTS_PER_EURO: "1",
  PROTECTION_ENABLED: "true",
  PROTECTION_WATERMARK_TEXT: "Just Beauty - usage reserve",
  PROTECTION_WATERMARK_OPACITY: "0.16",
  PROTECTION_BLOCK_HOTLINK: "true",
  PROTECTION_ALLOWED_EMBED_HOSTS: "just-beauty.be,www.just-beauty.be",
  PROTECTION_REPORT_EMAIL: "contact@justbeauty.be",
};

const parseEnvFile = (raw) =>
  raw.split(/\r?\n/).reduce((acc, line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return acc;
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) return acc;
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, "");
    acc[key] = value;
    return acc;
  }, {});

const ensureEnv = async () => {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(UPLOAD_DIR, { recursive: true });

  try {
    await fs.access(ENV_FILE);
  } catch {
    const content = Object.entries(defaultEnv).map(([key, value]) => `${key}=${value}`).join("\n");
    await fs.writeFile(ENV_FILE, `${content}\n`, "utf8");
  }

  const raw = await fs.readFile(ENV_FILE, "utf8");
  return { ...defaultEnv, ...parseEnvFile(raw) };
};

const parseAllowedOrigins = (value) =>
  String(value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

const getCorsHeaders = (env, req) => {
  const allowedOrigins = parseAllowedOrigins(env.CORS_ORIGIN);
  const requestOrigin = String(req?.headers?.origin || "").trim();
  const allowOrigin = requestOrigin && allowedOrigins.includes(requestOrigin)
    ? requestOrigin
    : (allowedOrigins[0] || "*");

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    Vary: "Origin",
  };
};

const hashPassword = (password, sessionSecret) => {
  const salt = crypto.createHash("sha256").update(sessionSecret).digest("hex").slice(0, 32);
  return crypto.scryptSync(password, salt, 64).toString("hex");
};

const matchesBootstrapPassword = (passwordHash, env) => passwordHash === hashPassword(env.ADMIN_PASSWORD, env.SESSION_SECRET);

const createSessionToken = (secret) =>
  `${crypto.randomUUID()}.${crypto.createHmac("sha256", secret).update(crypto.randomUUID()).digest("hex")}`;

const hashToken = (token, secret) => crypto.createHmac("sha256", secret).update(token).digest("hex");

const verifyToken = (token, storedHash, secret) => {
  const computed = Buffer.from(hashToken(token, secret), "hex");
  const stored = Buffer.from(storedHash, "hex");
  return computed.length === stored.length && crypto.timingSafeEqual(computed, stored);
};

const getMimeType = (filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  if (ext === ".svg") return "image/svg+xml";
  return "application/octet-stream";
};

const sanitizeFilename = (value) => value.replace(/[^a-zA-Z0-9._-]/g, "-");
const normalizeDate = (value) => String(value || "").trim().slice(0, 10);
const normalizeTime = (value) => String(value || "").trim().slice(0, 5);
const WEEKDAY_KEYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const APPOINTMENT_TIME_SLOTS = ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30", "18:00", "18:30", "19:00", "19:30"];
const DEFAULT_SERVICE_DURATION_MINUTES = 90;
const DEFAULT_WEEKLY_SCHEDULE = [
  { weekday: 0, is_open: 0, ranges: [] },
  { weekday: 1, is_open: 1, ranges: [{ start_time: "15:00", end_time: "18:30" }] },
  { weekday: 2, is_open: 1, ranges: [{ start_time: "15:00", end_time: "18:30" }] },
  { weekday: 3, is_open: 1, ranges: [{ start_time: "15:00", end_time: "18:30" }] },
  { weekday: 4, is_open: 1, ranges: [{ start_time: "15:00", end_time: "18:30" }] },
  { weekday: 5, is_open: 1, ranges: [{ start_time: "15:00", end_time: "18:30" }] },
  { weekday: 6, is_open: 1, ranges: [{ start_time: "15:00", end_time: "18:30" }] },
];
const LEGACY_DEFAULT_WEEKLY_SCHEDULE = [
  { weekday: 0, is_open: 0, ranges: [] },
  { weekday: 1, is_open: 1, ranges: [{ start_time: "09:00", end_time: "12:00" }, { start_time: "13:00", end_time: "18:00" }] },
  { weekday: 2, is_open: 1, ranges: [{ start_time: "09:00", end_time: "12:00" }, { start_time: "13:00", end_time: "18:00" }] },
  { weekday: 3, is_open: 1, ranges: [{ start_time: "09:00", end_time: "12:00" }, { start_time: "13:00", end_time: "18:00" }] },
  { weekday: 4, is_open: 1, ranges: [{ start_time: "09:00", end_time: "12:00" }, { start_time: "13:00", end_time: "18:00" }] },
  { weekday: 5, is_open: 1, ranges: [{ start_time: "09:00", end_time: "12:00" }, { start_time: "13:00", end_time: "18:00" }] },
  { weekday: 6, is_open: 1, ranges: [{ start_time: "09:00", end_time: "12:00" }, { start_time: "13:00", end_time: "16:00" }] },
];
const LEGACY_DEFAULT_SERVICE_NAMES = ["Massage relaxant", "Soin eclat", "Manucure complete"];
const DEFAULT_SERVICES = [
  { category: "Massage", name: "Corps complet", description: "", price: 65, price_label: "65 EUR", duration_minutes: 60, sort_order: 0 },
  { category: "Massage", name: "Dos / cranien", description: "", price: 40, price_label: "40 EUR", duration_minutes: 30, sort_order: 1 },
  { category: "Massage", name: "Bougie", description: "", price: 70, price_label: "70 EUR", duration_minutes: 60, sort_order: 2 },
  { category: "Soins du visage", name: "Simple", description: "", price: 50, price_label: "A partir de 50 EUR", duration_minutes: DEFAULT_SERVICE_DURATION_MINUTES, sort_order: 3 },
  { category: "Soins du visage", name: "Avec épilation", description: "", price: 55, price_label: "A partir de 55 EUR", duration_minutes: DEFAULT_SERVICE_DURATION_MINUTES, sort_order: 4 },
  { category: "Épilation", name: "Dessin des sourcils", description: "", price: 12.5, price_label: "12.50 EUR", duration_minutes: DEFAULT_SERVICE_DURATION_MINUTES, sort_order: 5 },
  { category: "Épilation", name: "Sourcils", description: "", price: 10, price_label: "10 EUR", duration_minutes: DEFAULT_SERVICE_DURATION_MINUTES, sort_order: 6 },
  { category: "Épilation", name: "Lèvres supérieures", description: "", price: 6, price_label: "6 EUR", duration_minutes: DEFAULT_SERVICE_DURATION_MINUTES, sort_order: 7 },
  { category: "Épilation", name: "Menton", description: "", price: 8, price_label: "8 EUR", duration_minutes: DEFAULT_SERVICE_DURATION_MINUTES, sort_order: 8 },
  { category: "Épilation", name: "Visage", description: "", price: 22.5, price_label: "22.50 EUR", duration_minutes: DEFAULT_SERVICE_DURATION_MINUTES, sort_order: 9 },
  { category: "Épilation", name: "Aisselles", description: "", price: 15, price_label: "15 EUR", duration_minutes: DEFAULT_SERVICE_DURATION_MINUTES, sort_order: 10 },
  { category: "Épilation", name: "Demi-jambe", description: "", price: 20, price_label: "20 EUR", duration_minutes: DEFAULT_SERVICE_DURATION_MINUTES, sort_order: 11 },
  { category: "Maquillage", name: "Maquillage", description: "", price: 35, price_label: "A partir de 35 EUR", duration_minutes: DEFAULT_SERVICE_DURATION_MINUTES, sort_order: 12 },
  { category: "Pédicure", name: "Pédicure simple", description: "", price: 30, price_label: "30 EUR", duration_minutes: DEFAULT_SERVICE_DURATION_MINUTES, sort_order: 13 },
  { category: "Pédicure", name: "Pose vernis simple", description: "", price: 10, price_label: "10 EUR", duration_minutes: DEFAULT_SERVICE_DURATION_MINUTES, sort_order: 14 },
  { category: "Pédicure", name: "Pose vernis semi-permanent", description: "", price: 35, price_label: "35 EUR", duration_minutes: DEFAULT_SERVICE_DURATION_MINUTES, sort_order: 15 },
  { category: "Pédicure", name: "French pédicure", description: "", price: 40, price_label: "40 EUR", duration_minutes: DEFAULT_SERVICE_DURATION_MINUTES, sort_order: 16 },
  { category: "Pédicure", name: "Dépose", description: "", price: 15, price_label: "15 EUR", duration_minutes: DEFAULT_SERVICE_DURATION_MINUTES, sort_order: 17 },
  { category: "Manucure", name: "Manucure simple", description: "", price: 20, price_label: "20 EUR", duration_minutes: DEFAULT_SERVICE_DURATION_MINUTES, sort_order: 18 },
  { category: "Manucure", name: "Semi-permanent", description: "", price: 30, price_label: "30 EUR", duration_minutes: DEFAULT_SERVICE_DURATION_MINUTES, sort_order: 19 },
  { category: "Manucure", name: "Gel sur ongle naturel", description: "", price: 40, price_label: "40 EUR", duration_minutes: DEFAULT_SERVICE_DURATION_MINUTES, sort_order: 20 },
  { category: "Manucure", name: "Rallongement chablon - Court", description: "", price: 65, price_label: "65 EUR", duration_minutes: DEFAULT_SERVICE_DURATION_MINUTES, sort_order: 21 },
  { category: "Manucure", name: "Rallongement chablon - Moyen", description: "", price: 70, price_label: "70 EUR", duration_minutes: DEFAULT_SERVICE_DURATION_MINUTES, sort_order: 22 },
  { category: "Manucure", name: "Rallongement chablon - Long", description: "", price: 75, price_label: "75 EUR", duration_minutes: DEFAULT_SERVICE_DURATION_MINUTES, sort_order: 23 },
  { category: "Manucure", name: "Ongle casse", description: "", price: 2.5, price_label: "2.50 EUR", duration_minutes: DEFAULT_SERVICE_DURATION_MINUTES, sort_order: 24 },
  { category: "Manucure", name: "French / Baby boomer", description: "", price: 1, price_label: "1 EUR*", duration_minutes: DEFAULT_SERVICE_DURATION_MINUTES, sort_order: 25 },
  { category: "Manucure", name: "Effet sirène / chrome", description: "", price: 0.5, price_label: "0.50 EUR*", duration_minutes: DEFAULT_SERVICE_DURATION_MINUTES, sort_order: 26 },
  { category: "Manucure", name: "Nail arts", description: "", price: 1, price_label: "Entre 1 EUR et 10 EUR*", duration_minutes: DEFAULT_SERVICE_DURATION_MINUTES, sort_order: 27 },
  { category: "Manucure", name: "Strass / bijoux", description: "", price: 0.8, price_label: "A partir de 0.80 EUR*", duration_minutes: DEFAULT_SERVICE_DURATION_MINUTES, sort_order: 28 },
];

const sortBy = (items, fields) =>
  [...items].sort((a, b) => {
    for (const field of fields) {
      if (a[field] < b[field]) return -1;
      if (a[field] > b[field]) return 1;
    }
    return 0;
  });

const toMinutes = (time) => {
  const normalized = normalizeTime(time);
  const [hours, minutes] = normalized.split(":").map((part) => Number(part || 0));
  return hours * 60 + minutes;
};

const addMinutesToTime = (time, minutesToAdd) => {
  const total = toMinutes(time) + Number(minutesToAdd || 0);
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
};

const rangesOverlap = (startA, endA, startB, endB) => startA < endB && startB < endA;

const slotFitsRange = (time, durationMinutes, range) => {
  const slotStart = toMinutes(time);
  const slotEnd = slotStart + Number(durationMinutes || 0);
  const rangeStart = toMinutes(range.start_time);
  const rangeEnd = toMinutes(range.end_time);
  return slotStart >= rangeStart && slotEnd <= rangeEnd;
};

const normalizeRange = (range) => {
  const start_time = normalizeTime(range?.start_time);
  const end_time = normalizeTime(range?.end_time);
  if (!start_time || !end_time) return null;
  if (!APPOINTMENT_TIME_SLOTS.includes(start_time)) return null;
  if (toMinutes(end_time) <= toMinutes(start_time)) return null;
  return { start_time, end_time };
};

const normalizeSchedulePayload = (payload) => {
  if (!Array.isArray(payload)) return [];
  return payload
    .map((day) => {
      const weekday = Number(day?.weekday);
      if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) return null;
      const ranges = Array.isArray(day?.ranges)
        ? day.ranges.map(normalizeRange).filter(Boolean)
        : [];
      return {
        weekday,
        is_open: day?.is_open === false || day?.is_open === 0 ? 0 : 1,
        ranges: sortBy(ranges, ["start_time", "end_time"]),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.weekday - b.weekday);
};

const scheduleMatches = (left, right) => JSON.stringify(left) === JSON.stringify(right);

const escapeIcsText = (value) =>
  String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");

const readBody = (req) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });

const readTextBody = (req) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });

const getBearerToken = (req) => {
  const header = req.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
};

const escapeHtml = (value) =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const escapeXml = (value) =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const envToBoolean = (value, fallback = false) => {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return fallback;
  return ["1", "true", "yes", "on"].includes(normalized);
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const hashSha256 = (buffer) => crypto.createHash("sha256").update(buffer).digest("hex");

const normalizeHost = (raw) => {
  const value = String(raw || "").trim();
  if (!value) return "";
  try {
    const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    return new URL(withProtocol).hostname.toLowerCase();
  } catch {
    return value.replace(/^https?:\/\//i, "").split("/")[0].toLowerCase();
  }
};

const getProtectionConfig = (env) => {
  const allowedHosts = String(env.PROTECTION_ALLOWED_EMBED_HOSTS || "")
    .split(",")
    .map((entry) => normalizeHost(entry))
    .filter(Boolean);

  const baseHost = normalizeHost(env.PUBLIC_BASE_URL);
  if (baseHost && !allowedHosts.includes(baseHost)) allowedHosts.push(baseHost);

  return {
    enabled: envToBoolean(env.PROTECTION_ENABLED, true),
    watermarkText: String(env.PROTECTION_WATERMARK_TEXT || "Just Beauty - usage reserve").trim(),
    watermarkOpacity: clamp(Number(env.PROTECTION_WATERMARK_OPACITY || 0.16), 0.05, 0.6),
    blockHotlink: envToBoolean(env.PROTECTION_BLOCK_HOTLINK, true),
    allowedHosts,
    reportEmail: String(env.PROTECTION_REPORT_EMAIL || env.BOOKING_ADMIN_EMAIL || env.ADMIN_EMAIL || "").trim(),
  };
};

const mimeFromDataUrl = (dataUrl) => {
  const match = String(dataUrl || "").match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: String(match[1] || "").toLowerCase(), base64: match[2] };
};

const extensionFromMimeType = (mimeType) => {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/gif") return "gif";
  if (mimeType === "image/svg+xml") return "svg";
  return "bin";
};

const isRasterImageMimeType = (mimeType) => ["image/jpeg", "image/png", "image/webp"].includes(mimeType);

const buildWatermarkOverlaySvg = ({ width, height, text, opacity }) => {
  const safeText = escapeXml(text);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <defs>
    <pattern id="p" width="340" height="220" patternUnits="userSpaceOnUse" patternTransform="rotate(-24)">
      <text x="8" y="112" fill="rgba(255,255,255,${opacity})" font-family="Georgia, serif" font-size="26" letter-spacing="1.2">${safeText}</text>
    </pattern>
  </defs>
  <rect x="0" y="0" width="${width}" height="${height}" fill="url(#p)" />
</svg>`;
};

const bitCountBigInt = (value) => {
  let count = 0;
  let current = BigInt(value);
  while (current) {
    current &= current - 1n;
    count += 1;
  }
  return count;
};

const hammingDistanceHex64 = (a, b) => {
  if (!a || !b) return Number.POSITIVE_INFINITY;
  try {
    const left = BigInt(`0x${a}`);
    const right = BigInt(`0x${b}`);
    return bitCountBigInt(left ^ right);
  } catch {
    return Number.POSITIVE_INFINITY;
  }
};

const computeDHash64 = async (buffer) => {
  const { data } = await sharp(buffer)
    .rotate()
    .grayscale()
    .resize(9, 8, { fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });

  let bits = 0n;
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      const left = data[(y * 9) + x];
      const right = data[(y * 9) + x + 1];
      bits = (bits << 1n) | (left > right ? 1n : 0n);
    }
  }
  return bits.toString(16).padStart(16, "0");
};

const applyVisibleWatermark = async (buffer, mimeType, protectionConfig) => {
  const image = sharp(buffer).rotate();
  const metadata = await image.metadata();
  const width = Number(metadata.width || 0);
  const height = Number(metadata.height || 0);
  if (!width || !height || !protectionConfig.watermarkText) return buffer;

  const overlay = Buffer.from(
    buildWatermarkOverlaySvg({
      width,
      height,
      text: protectionConfig.watermarkText,
      opacity: protectionConfig.watermarkOpacity,
    }),
    "utf8",
  );
  let output = image.composite([{ input: overlay, blend: "over" }]);
  if (mimeType === "image/jpeg") output = output.jpeg({ quality: 90, mozjpeg: true });
  if (mimeType === "image/png") output = output.png({ compressionLevel: 9 });
  if (mimeType === "image/webp") output = output.webp({ quality: 90 });
  return output.toBuffer();
};

const buildImageProtectionRecord = async ({ dataUrl, filename, protectionConfig }) => {
  const parsed = mimeFromDataUrl(dataUrl);
  if (!parsed) throw new Error("Invalid image payload");

  const mimeType = parsed.mimeType;
  const sourceBuffer = Buffer.from(parsed.base64, "base64");
  const originalSha256 = hashSha256(sourceBuffer);
  const extension = sanitizeFilename((filename || "").split(".").pop() || extensionFromMimeType(mimeType) || "png");
  let outputBuffer = sourceBuffer;
  let watermarkApplied = 0;

  if (protectionConfig.enabled && isRasterImageMimeType(mimeType)) {
    try {
      outputBuffer = await applyVisibleWatermark(sourceBuffer, mimeType, protectionConfig);
      watermarkApplied = 1;
    } catch (error) {
      console.warn("Watermark processing failed, fallback to source image:", error instanceof Error ? error.message : error);
    }
  }

  let phash64 = "";
  try {
    if (isRasterImageMimeType(mimeType)) {
      phash64 = await computeDHash64(outputBuffer);
    }
  } catch (error) {
    console.warn("Perceptual hash computation failed:", error instanceof Error ? error.message : error);
  }

  return {
    mimeType,
    extension,
    outputBuffer,
    originalSha256,
    displayedSha256: hashSha256(outputBuffer),
    phash64,
    watermarkApplied,
  };
};

const computeContentFingerprint = ({ key, value, secret }) => {
  const payload = `${String(key || "").trim()}::${String(value || "")}`;
  const sha256 = hashSha256(Buffer.from(payload, "utf8"));
  const tag = crypto
    .createHmac("sha256", String(secret || "justbeauty-content-tag"))
    .update(payload)
    .digest("hex")
    .slice(0, 12);
  return { sha256, tag };
};

const renderMailShell = ({ title, eyebrow, intro, details, closing, cta, logoUrl }) => `
  <div style="margin:0;padding:32px;background:#f8f1ec;font-family:Georgia,'Times New Roman',serif;color:#453530;">
    <div style="max-width:640px;margin:0 auto;background:#fffaf7;border-radius:24px;overflow:hidden;box-shadow:0 12px 40px rgba(91,67,57,0.12);border:1px solid #efddd2;">
      <div style="padding:28px 36px;background:linear-gradient(135deg,#ead2c5 0%,#f7ece6 100%);">
        ${logoUrl ? `<img src="${escapeHtml(logoUrl)}" alt="Just Beauty" style="width:68px;height:68px;border-radius:999px;object-fit:cover;border:1px solid #efddd2;display:block;margin-bottom:16px;" />` : ""}
        <div style="font-size:12px;letter-spacing:0.35em;text-transform:uppercase;color:#8d6e63;margin-bottom:12px;">${escapeHtml(eyebrow)}</div>
        <div style="font-size:34px;line-height:1.15;color:#4d382f;font-weight:700;">${escapeHtml(title)}</div>
      </div>
      <div style="padding:32px 36px;">
        <p style="margin:0 0 20px;font-size:16px;line-height:1.7;color:#5d4941;">${escapeHtml(intro)}</p>
        <div style="background:#fbf4ef;border:1px solid #efddd2;border-radius:18px;padding:18px 20px;margin:0 0 24px;">
          ${details.map((detail) => `<div style="margin:0 0 10px;font-size:15px;line-height:1.6;color:#5b4339;"><strong style="color:#4d382f;">${escapeHtml(detail.label)}:</strong> ${escapeHtml(detail.value)}</div>`).join("")}
        </div>
        ${cta ? `<div style="margin:0 0 24px;">${cta}</div>` : ""}
        <p style="margin:0;font-size:15px;line-height:1.8;color:#6f5a52;">${escapeHtml(closing)}</p>
      </div>
    </div>
  </div>
`;

const GIFT_CARD_THEMES = {
  fun_party: {
    label: "Drole - Party",
    imagePath: "/assets/gift/fun-party2.png",
    frame: "#ffccbc",
    titleColor: "#7a2f00",
    labelColor: "#6d1f1f",
    valueColor: "#2f195f",
    messageColor: "#4b2e00",
    textBg: "rgba(255,245,232,0.85)",
  },
  fun_pop: {
    label: "Drole - Pop",
    imagePath: "/assets/gift/fun-pop2.png",
    frame: "#f8bbd0",
    titleColor: "#6a00a8",
    labelColor: "#8a0055",
    valueColor: "#1f3fb2",
    messageColor: "#5b1f7f",
    textBg: "rgba(255,240,252,0.84)",
  },
  glam_chic: {
    label: "Glamour - Chic",
    imagePath: "/assets/gift/glam-chic2.png",
    frame: "#d7ccc8",
    titleColor: "#5d2e28",
    labelColor: "#6b3a33",
    valueColor: "#3c2220",
    messageColor: "#6a3f39",
    textBg: "rgba(255,248,242,0.82)",
  },
  glam_luxe: {
    label: "Glamour - Luxe",
    imagePath: "/assets/gift/glam-luxe2.png",
    frame: "#cdb7a6",
    titleColor: "#d8b98f",
    labelColor: "#ead6b5",
    valueColor: "#f7e9cf",
    messageColor: "#fff1dc",
    textBg: "rgba(25,18,16,0.62)",
  },
};

const normalizeGiftCardTheme = (value) => {
  const key = String(value || "").trim();
  return GIFT_CARD_THEMES[key] ? key : "glam_chic";
};

const buildGiftCardEmailCardHtml = ({ giftCard, customer, publicBaseUrl }) => {
  const themeKey = normalizeGiftCardTheme(giftCard.theme_style);
  const theme = GIFT_CARD_THEMES[themeKey];
  const ownerName = String(giftCard.recipient_name || `${customer.first_name || ""} ${customer.last_name || ""}`).trim() || "Cliente";
  const messageLine = String(giftCard.message || "").trim();
  const backgroundImageUrl = `${String(publicBaseUrl || "").replace(/\/$/, "")}${theme.imagePath}`;
  return `
    <div style="border:1px solid ${theme.frame};border-radius:20px;overflow:hidden;background-image:url('${escapeHtml(backgroundImageUrl)}');background-size:cover;background-position:center;background-repeat:no-repeat;padding:22px 22px 18px;box-shadow:0 12px 30px rgba(0,0,0,0.14);">
      <div style="display:inline-block;padding:5px 10px;border-radius:999px;background:${theme.textBg};font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:${theme.labelColor};margin-bottom:10px;">Just Beauty - cheque cadeau</div>
      <div style="display:inline-block;padding:8px 12px;border-radius:12px;background:${theme.textBg};font-size:28px;line-height:1.15;font-weight:700;color:${theme.titleColor};margin-bottom:14px;">${escapeHtml(Number(giftCard.amount || 0).toFixed(2))} ${escapeHtml(giftCard.currency || "EUR")}</div>
      <div style="display:block;width:fit-content;padding:6px 10px;border-radius:10px;background:${theme.textBg};font-size:14px;line-height:1.5;color:${theme.valueColor};margin-bottom:8px;"><strong style="color:${theme.labelColor};">Pour :</strong> ${escapeHtml(ownerName)}</div>
      <div style="display:block;width:fit-content;padding:6px 10px;border-radius:10px;background:${theme.textBg};font-size:14px;line-height:1.5;color:${theme.valueColor};margin-bottom:${messageLine ? "8px" : "0"};"><strong style="color:${theme.labelColor};">Code :</strong> ${escapeHtml(giftCard.code || "")}</div>
      ${messageLine ? `<div style="display:block;width:fit-content;max-width:100%;padding:6px 10px;border-radius:10px;background:${theme.textBg};font-size:14px;line-height:1.5;color:${theme.messageColor};"><strong style="color:${theme.labelColor};">Message :</strong> ${escapeHtml(messageLine)}</div>` : ""}
    </div>
  `;
};

const renderActionPage = ({ title, message, actionLabel }) => `
  <!doctype html>
  <html lang="fr">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${escapeHtml(title)}</title>
      <style>
        body { margin:0; font-family: Georgia, "Times New Roman", serif; background:#f8f1ec; color:#453530; }
        .wrap { max-width:720px; margin:48px auto; padding:0 20px; }
        .card { background:#fffaf7; border:1px solid #efddd2; border-radius:28px; overflow:hidden; box-shadow:0 12px 40px rgba(91,67,57,0.12); }
        .hero { padding:28px 36px; background:linear-gradient(135deg,#ead2c5 0%,#f7ece6 100%); }
        .eyebrow { font-size:12px; letter-spacing:.35em; text-transform:uppercase; color:#8d6e63; margin-bottom:12px; }
        .title { font-size:34px; line-height:1.15; color:#4d382f; font-weight:700; }
        .body { padding:32px 36px; }
        .message { font-size:17px; line-height:1.8; color:#5d4941; margin:0 0 24px; }
        .cta { display:inline-block; text-decoration:none; background:#b67d6c; color:#fffaf7; padding:14px 20px; border-radius:999px; }
      </style>
    </head>
    <body>
      <div class="wrap">
        <div class="card">
          <div class="hero">
            <div class="eyebrow">Just Beauty</div>
            <div class="title">${escapeHtml(title)}</div>
          </div>
          <div class="body">
            <p class="message">${escapeHtml(message)}</p>
            <a class="cta" href="${escapeHtml(actionLabel.href)}">${escapeHtml(actionLabel.label)}</a>
          </div>
        </div>
      </div>
    </body>
  </html>
`;

const bootstrapDb = (db, env) => {
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS admins (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      admin_id TEXT NOT NULL,
      token_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      phone TEXT NOT NULL DEFAULT '',
      marketing_consent INTEGER NOT NULL DEFAULT 0,
      deletion_requested_at TEXT NOT NULL DEFAULT '',
      deletion_scheduled_for TEXT NOT NULL DEFAULT '',
      deletion_requested_by TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS customer_sessions (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      token_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS services (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      price REAL NOT NULL,
      price_label TEXT NOT NULL DEFAULT '',
      duration_minutes INTEGER NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY,
      service_id TEXT NOT NULL,
      customer_id TEXT,
      client_name TEXT NOT NULL,
      client_email TEXT NOT NULL,
      client_phone TEXT NOT NULL DEFAULT '',
      booking_date TEXT NOT NULL,
      booking_time TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      notes TEXT NOT NULL DEFAULT '',
      reminder_sent_at TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS booking_action_tokens (
      id TEXT PRIMARY KEY,
      booking_id TEXT NOT NULL,
      token_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS gallery_images (
      id TEXT PRIMARY KEY,
      url TEXT NOT NULL,
      alt_text TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS media_protection_assets (
      id TEXT PRIMARY KEY,
      gallery_image_id TEXT NOT NULL UNIQUE,
      original_sha256 TEXT NOT NULL,
      displayed_sha256 TEXT NOT NULL,
      phash64 TEXT NOT NULL DEFAULT '',
      watermark_text TEXT NOT NULL DEFAULT '',
      watermark_applied INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (gallery_image_id) REFERENCES gallery_images(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS media_protection_events (
      id TEXT PRIMARY KEY,
      asset_id TEXT,
      event_type TEXT NOT NULL,
      source_url TEXT NOT NULL DEFAULT '',
      reporter TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      evidence_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      FOREIGN KEY (asset_id) REFERENCES media_protection_assets(id) ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS content_fingerprints (
      id TEXT PRIMARY KEY,
      content_key TEXT NOT NULL UNIQUE,
      sha256 TEXT NOT NULL,
      canary_tag TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS site_content (
      id TEXT PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS availability_overrides (
      date TEXT PRIMARY KEY,
      status TEXT NOT NULL CHECK(status IN ('open', 'closed')),
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS availability_slot_overrides (
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('open', 'closed')),
      updated_at TEXT NOT NULL,
      PRIMARY KEY (date, time)
    );
    CREATE TABLE IF NOT EXISTS weekly_schedule (
      weekday INTEGER PRIMARY KEY,
      is_open INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS weekly_schedule_ranges (
      id TEXT PRIMARY KEY,
      weekday INTEGER NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (weekday) REFERENCES weekly_schedule(weekday) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS contact_messages (
      id TEXT PRIMARY KEY,
      client_name TEXT NOT NULL,
      client_email TEXT NOT NULL,
      client_phone TEXT NOT NULL DEFAULT '',
      message TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS booking_calendar_events (
      booking_id TEXT PRIMARY KEY,
      event_uid TEXT NOT NULL,
      event_path TEXT NOT NULL,
      etag TEXT NOT NULL DEFAULT '',
      synced_at TEXT NOT NULL,
      FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS loyalty_transactions (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      booking_id TEXT,
      points INTEGER NOT NULL,
      type TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
      FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS gift_cards (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'EUR',
      recipient_name TEXT NOT NULL DEFAULT '',
      recipient_email TEXT NOT NULL DEFAULT '',
      message TEXT NOT NULL DEFAULT '',
      theme_style TEXT NOT NULL DEFAULT 'glam_chic',
      payment_method TEXT NOT NULL DEFAULT 'bank_transfer',
      payment_reference TEXT NOT NULL DEFAULT '',
      bank_account_snapshot TEXT NOT NULL DEFAULT '',
      bank_name_snapshot TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending_payment',
      admin_note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      validated_at TEXT NOT NULL DEFAULT '',
      expires_at TEXT NOT NULL DEFAULT '',
      used_at TEXT NOT NULL DEFAULT '',
      expiration_reminder_sent_at TEXT NOT NULL DEFAULT '',
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
    );
  `);
  try {
    db.exec("ALTER TABLE services ADD COLUMN price_label TEXT NOT NULL DEFAULT '';");
  } catch {
    // Column already exists on migrated databases.
  }
  try {
    db.exec("ALTER TABLE bookings ADD COLUMN customer_id TEXT;");
  } catch {
    // Column already exists on migrated databases.
  }
  try {
    db.exec("ALTER TABLE customers ADD COLUMN trusted_no_deposit INTEGER NOT NULL DEFAULT 0;");
  } catch {
    // Column already exists on migrated databases.
  }
  try {
    db.exec("ALTER TABLE customers ADD COLUMN deletion_requested_at TEXT NOT NULL DEFAULT '';");
  } catch {
    // Column already exists on migrated databases.
  }
  try {
    db.exec("ALTER TABLE customers ADD COLUMN deletion_scheduled_for TEXT NOT NULL DEFAULT '';");
  } catch {
    // Column already exists on migrated databases.
  }
  try {
    db.exec("ALTER TABLE customers ADD COLUMN deletion_requested_by TEXT NOT NULL DEFAULT '';");
  } catch {
    // Column already exists on migrated databases.
  }
  try {
    db.exec("ALTER TABLE bookings ADD COLUMN deposit_required INTEGER NOT NULL DEFAULT 0;");
  } catch {
    // Column already exists on migrated databases.
  }
  try {
    db.exec("ALTER TABLE bookings ADD COLUMN deposit_amount REAL NOT NULL DEFAULT 0;");
  } catch {
    // Column already exists on migrated databases.
  }
  try {
    db.exec("ALTER TABLE bookings ADD COLUMN deposit_method TEXT NOT NULL DEFAULT 'none';");
  } catch {
    // Column already exists on migrated databases.
  }
  try {
    db.exec("ALTER TABLE bookings ADD COLUMN deposit_status TEXT NOT NULL DEFAULT 'not_required';");
  } catch {
    // Column already exists on migrated databases.
  }
  try {
    db.exec("ALTER TABLE bookings ADD COLUMN deposit_reference TEXT NOT NULL DEFAULT '';");
  } catch {
    // Column already exists on migrated databases.
  }
  try {
    db.exec("ALTER TABLE bookings ADD COLUMN deposit_checkout_url TEXT NOT NULL DEFAULT '';");
  } catch {
    // Column already exists on migrated databases.
  }
  try {
    db.exec("ALTER TABLE bookings ADD COLUMN deposit_payment_id TEXT NOT NULL DEFAULT '';");
  } catch {
    // Column already exists on migrated databases.
  }
    try {
      db.exec("ALTER TABLE bookings ADD COLUMN deposit_paid_at TEXT NOT NULL DEFAULT '';");
    } catch {
      // Column already exists on migrated databases.
    }
    try {
      db.exec("ALTER TABLE bookings ADD COLUMN balance_payment_id TEXT NOT NULL DEFAULT '';");
    } catch {
      // Column already exists on migrated databases.
    }
    try {
      db.exec("ALTER TABLE bookings ADD COLUMN balance_payment_status TEXT NOT NULL DEFAULT 'not_requested';");
    } catch {
      // Column already exists on migrated databases.
    }
    try {
      db.exec("ALTER TABLE bookings ADD COLUMN balance_checkout_url TEXT NOT NULL DEFAULT '';");
    } catch {
      // Column already exists on migrated databases.
    }
    try {
      db.exec("ALTER TABLE bookings ADD COLUMN balance_paid_at TEXT NOT NULL DEFAULT '';");
    } catch {
      // Column already exists on migrated databases.
    }
    try {
      db.exec("ALTER TABLE bookings ADD COLUMN reminder_sent_at TEXT NOT NULL DEFAULT '';");
    } catch {
      // Column already exists on migrated databases.
    }
    try {
      db.exec("ALTER TABLE gift_cards ADD COLUMN expiration_reminder_sent_at TEXT NOT NULL DEFAULT '';");
    } catch {
      // Column already exists on migrated databases.
    }
    try {
      db.exec("ALTER TABLE gift_cards ADD COLUMN theme_style TEXT NOT NULL DEFAULT 'glam_chic';");
    } catch {
      // Column already exists on migrated databases.
    }
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_media_protection_assets_displayed_sha256 ON media_protection_assets(displayed_sha256);
      CREATE INDEX IF NOT EXISTS idx_media_protection_assets_original_sha256 ON media_protection_assets(original_sha256);
      CREATE INDEX IF NOT EXISTS idx_media_protection_assets_phash64 ON media_protection_assets(phash64);
      CREATE INDEX IF NOT EXISTS idx_media_protection_events_type_created ON media_protection_events(event_type, created_at);
      CREATE INDEX IF NOT EXISTS idx_gift_cards_customer_created ON gift_cards(customer_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_gift_cards_status_expires ON gift_cards(status, expires_at);
    `);

  const adminCount = db.prepare("SELECT COUNT(*) AS count FROM admins").get().count;
  if (!adminCount) {
    db.prepare("INSERT INTO admins (id, email, password_hash, name, created_at) VALUES (?, ?, ?, ?, ?)")
      .run(
        crypto.randomUUID(),
        env.ADMIN_EMAIL,
        hashPassword(env.ADMIN_PASSWORD, env.SESSION_SECRET),
        env.ADMIN_NAME,
        new Date().toISOString(),
      );
  }
  const seedAdmin = db.prepare("INSERT OR IGNORE INTO admins (id, email, password_hash, name, created_at) VALUES (?, ?, ?, ?, ?)");
  seedAdmin.run(
    crypto.randomUUID(),
    "lambert.f@lfinfo.be",
    hashPassword("changemenow", env.SESSION_SECRET),
    "Lambert",
    new Date().toISOString(),
  );

  const insertService = db.prepare(`
    INSERT INTO services (id, category, name, description, price, price_label, duration_minutes, sort_order, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const seedDefaultServices = () => {
    const now = new Date().toISOString();
    DEFAULT_SERVICES.forEach((service) => {
      insertService.run(
        crypto.randomUUID(),
        service.category,
        service.name,
        service.description,
        service.price,
        service.price_label,
        service.duration_minutes,
        service.sort_order,
        1,
        now,
        now,
      );
    });
  };

  const serviceCount = db.prepare("SELECT COUNT(*) AS count FROM services").get().count;
  if (!serviceCount) {
    seedDefaultServices();
  } else {
    const existingServices = db.prepare("SELECT name FROM services ORDER BY sort_order, name").all().map((row) => row.name);
    const shouldReplaceLegacyDefaults = existingServices.length === LEGACY_DEFAULT_SERVICE_NAMES.length
      && LEGACY_DEFAULT_SERVICE_NAMES.every((name) => existingServices.includes(name));

    if (shouldReplaceLegacyDefaults) {
      db.prepare("DELETE FROM services").run();
      seedDefaultServices();
    }
  }
  [
    ["UPDATE services SET category = 'Épilation' WHERE category = 'Epilation'"],
    ["UPDATE services SET category = 'Pédicure' WHERE category = 'Pedicure'"],
    ["UPDATE services SET name = 'Avec épilation' WHERE name = 'Avec epilation'"],
    ["UPDATE services SET name = 'Lèvres supérieures' WHERE name = 'Levres superieures'"],
    ["UPDATE services SET name = 'Demi-jambe' WHERE name = 'Demi jambe'"],
    ["UPDATE services SET name = 'Pédicure simple' WHERE name = 'Pedicure simple'"],
    ["UPDATE services SET name = 'Dépose' WHERE name = 'Depose'"],
    ["UPDATE services SET name = 'Effet sirène / chrome' WHERE name = 'Effet sirene / chrome'"],
  ].forEach(([statement]) => db.prepare(statement).run());

  const contentCount = db.prepare("SELECT COUNT(*) AS count FROM site_content").get().count;
  const defaultContentEntries = [
    ["hero_slogan", "Prenez soin de vous"],
    ["hero_subtitle", "Bienvenue chez Just Beauty by Justine. Un espace dédié à votre bien-être, où chaque soin est un moment de douceur."],
    ["about_text", "Situé près de Bastogne, Just Beauty by Justine est un institut chaleureux et accueillant, pensé pour votre confort et votre détente."],
    ["phone", "+32 XXX XX XX XX"],
    ["email", "contact@justbeauty.be"],
    ["address", "Pres de Bastogne, Belgique"],
    ["business_name", "Just Beauty by Justine"],
    ["legal_entity_name", "À renseigner"],
    ["company_number", "À renseigner"],
    ["vat_number", "À renseigner"],
    ["registered_address", "À renseigner"],
    ["legal_contact_email", "contact@justbeauty.be"],
    ["hosting_provider", "À renseigner"],
    ["hosting_address", "À renseigner"],
    ["privacy_contact_email", "contact@justbeauty.be"],
    ["payments_enabled", "0"],
    ["payment_deposit_rate", "10"],
    ["payment_deposit_threshold", "20"],
    ["payment_allow_bank_transfer", "1"],
    ["payment_bank_account", ""],
    ["payment_bank_name", "Just Beauty"],
    ["payment_bank_reference_prefix", "ACOMPTE"],
    ["giftcard_bank_account", ""],
    ["giftcard_bank_name", "Just Beauty"],
    ["giftcard_transfer_instructions", "Veuillez indiquer la reference du cheque cadeau dans la communication du virement."],
    ["payment_mollie_mode", "test"],
    ["payment_mollie_test_api_key", ""],
    ["payment_mollie_live_api_key", ""],
    ["payment_mollie_api_key", ""],
  ];
  if (!contentCount) {
    const now = new Date().toISOString();
    const insertContent = db.prepare("INSERT INTO site_content (id, key, value, updated_at) VALUES (?, ?, ?, ?)");
    defaultContentEntries.forEach(([key, value]) => insertContent.run(crypto.randomUUID(), key, value, now));
  } else {
    const now = new Date().toISOString();
    const upsertContent = db.prepare(`
      INSERT INTO site_content (id, key, value, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(key) DO NOTHING
    `);
    defaultContentEntries.forEach(([key, value]) => upsertContent.run(crypto.randomUUID(), key, value, now));
  }
  [
    ["hero_subtitle", "Bienvenue chez Just Beauty by Justine. Un espace dedie a votre bien-etre, ou chaque soin est un moment de douceur.", "Bienvenue chez Just Beauty by Justine. Un espace dédié à votre bien-être, où chaque soin est un moment de douceur."],
    ["about_text", "Situe pres de Bastogne, Just Beauty by Justine est un institut chaleureux et accueillant, pense pour votre confort et votre detente.", "Situé près de Bastogne, Just Beauty by Justine est un institut chaleureux et accueillant, pensé pour votre confort et votre détente."],
    ["legal_entity_name", "A completer", "À renseigner"],
    ["company_number", "A completer", "À renseigner"],
    ["vat_number", "A completer", "À renseigner"],
    ["registered_address", "A completer", "À renseigner"],
    ["hosting_provider", "A completer", "À renseigner"],
    ["hosting_address", "A completer", "À renseigner"],
  ].forEach(([key, oldValue, newValue]) => {
    db.prepare("UPDATE site_content SET value = ?, updated_at = ? WHERE key = ? AND value = ?")
      .run(newValue, new Date().toISOString(), key, oldValue);
  });
  const contentRows = db.prepare("SELECT key, value FROM site_content").all();
  const upsertFingerprint = db.prepare(`
    INSERT INTO content_fingerprints (id, content_key, sha256, canary_tag, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(content_key) DO UPDATE SET
      sha256 = excluded.sha256,
      canary_tag = excluded.canary_tag,
      updated_at = excluded.updated_at
  `);
  const fingerprintNow = new Date().toISOString();
  contentRows.forEach((row) => {
    const fingerprint = computeContentFingerprint({
      key: row.key,
      value: row.value,
      secret: env.SESSION_SECRET,
    });
    upsertFingerprint.run(
      crypto.randomUUID(),
      row.key,
      fingerprint.sha256,
      `JB-${fingerprint.tag}`,
      fingerprintNow,
    );
  });

  const weeklyScheduleCount = db.prepare("SELECT COUNT(*) AS count FROM weekly_schedule").get().count;
  if (!weeklyScheduleCount) {
    const now = new Date().toISOString();
    const insertDay = db.prepare("INSERT INTO weekly_schedule (weekday, is_open, updated_at) VALUES (?, ?, ?)");
    const insertRange = db.prepare(`
      INSERT INTO weekly_schedule_ranges (id, weekday, start_time, end_time, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    DEFAULT_WEEKLY_SCHEDULE.forEach((day) => {
      insertDay.run(day.weekday, day.is_open, now);
      day.ranges.forEach((range) => insertRange.run(crypto.randomUUID(), day.weekday, range.start_time, range.end_time, now));
    });
  } else {
    const existingDays = sortBy(db.prepare("SELECT weekday, is_open FROM weekly_schedule").all(), ["weekday"]);
    const existingRanges = sortBy(db.prepare("SELECT weekday, start_time, end_time FROM weekly_schedule_ranges").all(), ["weekday", "start_time", "end_time"]);
    const existingNormalized = WEEKDAY_KEYS.map((_, weekday) => ({
      weekday,
      is_open: Number(existingDays.find((day) => day.weekday === weekday)?.is_open || 0),
      ranges: existingRanges
        .filter((range) => range.weekday === weekday)
        .map((range) => ({ start_time: range.start_time, end_time: range.end_time })),
    }));

    if (scheduleMatches(existingNormalized, LEGACY_DEFAULT_WEEKLY_SCHEDULE)) {
      const now = new Date().toISOString();
      db.prepare("DELETE FROM weekly_schedule_ranges").run();
      db.prepare("DELETE FROM weekly_schedule").run();
      const insertDay = db.prepare("INSERT INTO weekly_schedule (weekday, is_open, updated_at) VALUES (?, ?, ?)");
      const insertRange = db.prepare(`
        INSERT INTO weekly_schedule_ranges (id, weekday, start_time, end_time, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `);
      DEFAULT_WEEKLY_SCHEDULE.forEach((day) => {
        insertDay.run(day.weekday, day.is_open, now);
        day.ranges.forEach((range) => insertRange.run(crypto.randomUUID(), day.weekday, range.start_time, range.end_time, now));
      });
    }
  }
};

const makeJsonHelpers = (env, req) => {
  const baseHeaders = getCorsHeaders(env, req);
  return {
    empty(res, statusCode = 204) {
      res.writeHead(statusCode, baseHeaders);
      res.end();
    },
    json(res, statusCode, payload) {
      res.writeHead(statusCode, { ...baseHeaders, "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(payload));
    },
    html(res, statusCode, payload) {
      res.writeHead(statusCode, { ...baseHeaders, "Content-Type": "text/html; charset=utf-8" });
      res.end(payload);
    },
    file(res, filePath, extraHeaders = {}) {
      res.writeHead(200, {
        ...baseHeaders,
        "Content-Type": getMimeType(filePath),
        "X-Robots-Tag": "noimageai, noai",
        ...extraHeaders,
      });
      createReadStream(filePath).pipe(res);
    },
  };
};

const createCalDavClient = (env) => {
  const baseUrl = String(env.CALDAV_URL || "").replace(/\/$/, "");
  const calendarPath = String(env.CALDAV_CALENDAR_PATH || "").replace(/^\/+/, "");
  const authHeader = env.CALDAV_USERNAME && env.CALDAV_PASSWORD
    ? `Basic ${Buffer.from(`${env.CALDAV_USERNAME}:${env.CALDAV_PASSWORD}`).toString("base64")}`
    : "";

  if (!baseUrl || !calendarPath || !authHeader) {
    console.warn("CalDAV disabled: missing configuration", {
      hasUrl: Boolean(baseUrl),
      hasCalendarPath: Boolean(calendarPath),
      hasUsername: Boolean(env.CALDAV_USERNAME),
      hasPassword: Boolean(env.CALDAV_PASSWORD),
    });
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
    const dtEnd = buildTimestamp(booking.booking_date, addMinutesToTime(booking.booking_time, service.duration_minutes || DEFAULT_SERVICE_DURATION_MINUTES));
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
    console.log("CalDAV request", {
      method,
      url,
      hasBody: Boolean(body),
      etag: etag || null,
    });
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: authHeader,
        ...(body ? { "Content-Type": "text/calendar; charset=utf-8" } : {}),
        ...(etag ? { "If-Match": etag } : {}),
      },
      body,
    });

    console.log("CalDAV response", {
      method,
      url,
      status: response.status,
      statusText: response.statusText,
      etag: response.headers.get("etag"),
    });

    if (!response.ok && response.status !== 412 && response.status !== 404) {
      const text = await response.text();
      console.error("CalDAV error body", text.slice(0, 500));
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
      console.log("CalDAV booking synced", {
        bookingId: booking.id,
        eventUid,
        eventPath,
      });
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
      console.log("CalDAV booking deleted", {
        eventUid: existingEvent.event_uid,
        eventPath: existingEvent.event_path,
      });
      return { ok: true };
    },
  };
};

const createMollieClient = (apiKey) => {
  const normalizedApiKey = String(apiKey || "").trim();
  const apiBaseUrl = "https://api.mollie.com/v2";

  if (!normalizedApiKey) {
    return {
      enabled: false,
      createPayment: async () => null,
      getPayment: async () => null,
      testConnection: async () => ({ ok: false, methods_count: 0 }),
    };
  }

  const sendRequest = async (pathname, { method = "GET", body } = {}) => {
    const response = await fetch(`${apiBaseUrl}${pathname}`, {
      method,
      headers: {
        Authorization: `Bearer ${normalizedApiKey}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Mollie ${method} ${pathname} failed (${response.status}): ${text.slice(0, 200)}`);
    }

    return response.json();
  };

  return {
    enabled: true,
    createPayment: async ({ amountValue, description, redirectUrl, webhookUrl, metadata }) =>
      sendRequest("/payments", {
        method: "POST",
        body: {
          amount: {
            currency: "EUR",
            value: Number(amountValue).toFixed(2),
          },
          description,
          redirectUrl,
          webhookUrl,
          metadata,
        },
      }),
    getPayment: async (paymentId) => sendRequest(`/payments/${encodeURIComponent(paymentId)}`),
    testConnection: async () => {
      const enabledPayload = await sendRequest("/methods?sequenceType=oneoff");
      const allPayload = await sendRequest("/methods/all?sequenceType=oneoff");
      const enabledMethods = Array.isArray(enabledPayload?._embedded?.methods) ? enabledPayload._embedded.methods : [];
      const allMethods = Array.isArray(allPayload?._embedded?.methods) ? allPayload._embedded.methods : [];
      return {
        ok: true,
        methods_count: enabledMethods.length,
        enabled_methods_count: enabledMethods.length,
        all_methods_count: allMethods.length,
      };
    },
  };
};

const createTelegramNotifier = (env) => {
  const botToken = String(env.TELEGRAM_BOT_TOKEN || "").trim();
  const chatId = String(env.TELEGRAM_CHAT_ID || "").trim();

  if (!botToken || !chatId) {
    console.warn("Telegram notifications disabled: missing configuration");
    return {
      sendBookingCreatedAlert: async () => {},
      answerCallbackQuery: async () => {},
      sendActionResult: async () => {},
      clearInlineKeyboard: async () => {},
    };
  }

  const apiBase = `https://api.telegram.org/bot${botToken}`;
  const buildServiceLabel = (service) => [service.category, service.name].filter(Boolean).join(" - ");
  const sendRequest = async (method, payload) => {
    const response = await fetch(`${apiBase}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Telegram API ${method} failed (${response.status}): ${body}`);
    }

    const data = await response.json();
    if (!data?.ok) {
      throw new Error(`Telegram API ${method} rejected payload`);
    }
    return data;
  };

  return {
    async sendBookingCreatedAlert({ booking, service, actionLinks }) {
      const serviceLabel = buildServiceLabel(service);
      const confirmCallbackData = `booking_action:confirmed:${booking.id}`;
      const refuseCallbackData = `booking_action:refused:${booking.id}`;
      const text = [
        "<b>Nouvelle demande de rendez-vous</b>",
        "",
        `<b>Cliente:</b> ${escapeHtml(booking.client_name)}`,
        `<b>Email:</b> ${escapeHtml(booking.client_email)}`,
        `<b>Telephone:</b> ${escapeHtml(booking.client_phone || "Non renseigne")}`,
        `<b>Service:</b> ${escapeHtml(serviceLabel)}`,
        `<b>Date:</b> ${escapeHtml(booking.booking_date)}`,
        `<b>Heure:</b> ${escapeHtml(String(booking.booking_time || "").slice(0, 5))}`,
        "",
        "Action rapide Telegram via boutons ci-dessous.",
        `<a href="${escapeHtml(actionLinks.confirm)}">Lien confirmer</a> | <a href="${escapeHtml(actionLinks.refuse)}">Lien refuser</a>`,
      ].join("\n");

      await sendRequest("sendMessage", {
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup: {
          inline_keyboard: [
            [
              { text: "Confirmer", callback_data: confirmCallbackData },
              { text: "Refuser", callback_data: refuseCallbackData },
            ],
          ],
        },
      });
      console.log("Admin Telegram notification sent");
    },
    async answerCallbackQuery({ callbackQueryId, text, showAlert = false }) {
      await sendRequest("answerCallbackQuery", {
        callback_query_id: callbackQueryId,
        text: String(text || "").slice(0, 180),
        show_alert: Boolean(showAlert),
      });
    },
    async sendActionResult({ chatId: targetChatId, bookingId, action, status, success = true, reason = "" }) {
      const actionLabel = action === "confirmed" ? "confirmee" : "refusee";
      const suffix = status && status !== action ? ` (etat actuel: ${status})` : "";
      const resultLabel = success ? "Action effectuee" : "Action non appliquee";
      const reasonLabel = reason ? ` - ${reason}` : "";
      await sendRequest("sendMessage", {
        chat_id: targetChatId || chatId,
        text: `${resultLabel}: reservation ${bookingId} ${actionLabel}${suffix}${reasonLabel}`,
      });
    },
    async clearInlineKeyboard({ chatId: targetChatId, messageId }) {
      if (!targetChatId || !messageId) return;
      await sendRequest("editMessageReplyMarkup", {
        chat_id: targetChatId,
        message_id: messageId,
        reply_markup: { inline_keyboard: [] },
      });
    },
  };
};


const createMailer = async (env) => {
  const logoUrl = `${env.PUBLIC_BASE_URL.replace(/\/$/, "")}/logo.jpg`;
  const buildServiceLabel = (service) => [service.category, service.name].filter(Boolean).join(" - ");

  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
    console.warn("SMTP disabled: missing configuration");
      return {
        sendBookingCreatedEmails: async () => {},
        sendBookingStatusEmail: async () => {},
        sendContactEmail: async () => {},
        sendPaymentIssueEmail: async () => {},
        sendCustomerDeletionScheduledEmail: async () => {},
        sendBookingBalancePaymentEmail: async () => {},
        sendGiftCardRequestConfirmationEmail: async () => {},
        sendGiftCardValidatedEmail: async () => {},
        sendGiftCardActivatedEmail: async () => {},
        sendGiftCardBeneficiaryEmail: async () => {},
        sendGiftCardExpiryReminderEmail: async () => {},
        sendBookingReminderEmails: async () => {},
      };
  }

  try {
    const { default: nodemailer } = await import("nodemailer");

    const transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: Number(env.SMTP_PORT || 587),
      secure: env.SMTP_SECURE === "true",
      requireTLS: true,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    });

    await transporter.verify();
    console.log("SMTP transporter ready");

    return {
      async sendBookingCreatedEmails({ booking, service, actionLinks }) {
        try {
          const serviceLabel = buildServiceLabel(service);
          const clientHtml = renderMailShell({
            logoUrl,
            eyebrow: "Just Beauty",
            title: `Votre demande pour ${serviceLabel} est bien enregistrée`,
            intro: `Bonjour ${booking.client_name}, votre demande de rendez-vous a bien été reçue et attend maintenant la confirmation de Justine.`,
            details: [
              { label: "Cliente", value: booking.client_name },
              { label: "Service", value: serviceLabel },
              { label: "Date", value: booking.booking_date },
              { label: "Heure", value: booking.booking_time.slice(0, 5) },
              { label: "Téléphone", value: booking.client_phone || "Non renseigné" },
            ],
            closing: "Merci pour votre confiance. Pensez aussi à vérifier votre dossier spam ou courrier indésirable.",
          });

          const adminCta = `
            <a href="${escapeHtml(actionLinks.confirm)}" style="display:inline-block;margin-right:12px;margin-bottom:12px;text-decoration:none;background:#b67d6c;color:#fffaf7;padding:14px 20px;border-radius:999px;">Confirmer</a>
            <a href="${escapeHtml(actionLinks.refuse)}" style="display:inline-block;margin-right:12px;margin-bottom:12px;text-decoration:none;background:#fffaf7;color:#7a5146;padding:14px 20px;border-radius:999px;border:1px solid #d9b8a8;">Refuser</a>
          `;

          const adminHtml = renderMailShell({
            logoUrl,
            eyebrow: "Nouvelle réservation",
            title: `Nouvelle demande: ${booking.client_name} - ${serviceLabel}`,
            intro: "Vous pouvez traiter ce rendez-vous directement depuis cet e-mail, sans passer par l'administration.",
            details: [
              { label: "Cliente", value: booking.client_name },
              { label: "Email", value: booking.client_email },
              { label: "Téléphone", value: booking.client_phone || "Non renseigné" },
              { label: "Service", value: serviceLabel },
              { label: "Date", value: booking.booking_date },
              { label: "Heure", value: booking.booking_time.slice(0, 5) },
            ],
            cta: adminCta,
            closing: "En cas de refus, la cliente sera invitée à reprogrammer son rendez-vous.",
          });

          const infoClient = await transporter.sendMail({
            from: `"${env.SMTP_FROM_NAME}" <${env.SMTP_FROM_EMAIL}>`,
            to: booking.client_email,
            subject: `Just Beauty | Demande reçue - ${booking.client_name} - ${serviceLabel}`,
            html: clientHtml,
          });

          console.log("Client mail sent:", infoClient);

          const infoAdmin = await transporter.sendMail({
            from: `"${env.SMTP_FROM_NAME}" <${env.SMTP_FROM_EMAIL}>`,
            to: env.BOOKING_ADMIN_EMAIL || env.SMTP_FROM_EMAIL || env.ADMIN_EMAIL,
            subject: `Just Beauty | Nouvelle réservation - ${booking.client_name} - ${serviceLabel}`,
            html: adminHtml,
          });

          console.log("Admin mail sent:", infoAdmin);
        } catch (error) {
          console.error("sendBookingCreatedEmails error:", error);
          throw error;
        }
      },

      async sendBookingStatusEmail({ booking, service, publicBaseUrl }) {
        try {
          const isConfirmed = booking.status === "confirmed";
          const isCancelled = booking.status === "cancelled";
          const serviceLabel = buildServiceLabel(service);

          const clientHtml = renderMailShell({
            logoUrl,
            eyebrow: isConfirmed
              ? "Rendez-vous confirmé"
              : isCancelled
                ? "Rendez-vous annulé"
                : "Rendez-vous à reprogrammer",
            title: isConfirmed
              ? `Votre rendez-vous pour ${serviceLabel} est confirmé`
              : isCancelled
                ? `Votre rendez-vous pour ${serviceLabel} a été annulé`
                : `Votre rendez-vous pour ${serviceLabel} n'a pas pu être maintenu`,
            intro: isConfirmed
              ? `Bonjour ${booking.client_name}, bonne nouvelle : votre rendez-vous vient d'être confirmé par Just Beauty.`
              : isCancelled
                ? `Bonjour ${booking.client_name}, votre rendez-vous a été annulé avant la date prévue.`
                : `Bonjour ${booking.client_name}, votre demande n'a malheureusement pas pu être maintenue sur le créneau choisi.`,
            details: [
              { label: "Cliente", value: booking.client_name },
              { label: "Service", value: serviceLabel },
              { label: "Date", value: booking.booking_date },
              { label: "Heure", value: booking.booking_time.slice(0, 5) },
            ],
            cta: !isConfirmed
              ? `<a href="${escapeHtml(`${publicBaseUrl}/rendez-vous`)}" style="display:inline-block;text-decoration:none;background:#b67d6c;color:#fffaf7;padding:14px 20px;border-radius:999px;">Reprogrammer mon rendez-vous</a>`
              : "",
            closing: isConfirmed
              ? "Pensez à vérifier également vos spams si vous ne retrouvez pas nos prochains e-mails."
              : isCancelled
                ? "Si vous souhaitez reprendre rendez-vous, vous pouvez choisir un nouveau créneau directement sur le site."
                : "Nous vous invitons à reprogrammer un nouveau moment cocooning via le site quand vous le souhaitez.",
          });

          const info = await transporter.sendMail({
            from: `"${env.SMTP_FROM_NAME}" <${env.SMTP_FROM_EMAIL}>`,
            to: booking.client_email,
            subject: isConfirmed
              ? `Just Beauty | Rendez-vous confirmé - ${booking.client_name} - ${serviceLabel}`
              : isCancelled
                ? `Just Beauty | Rendez-vous annulé - ${booking.client_name} - ${serviceLabel}`
                : `Just Beauty | Rendez-vous à reprogrammer - ${booking.client_name} - ${serviceLabel}`,
            html: clientHtml,
          });

          console.log("Status mail sent:", info);
        } catch (error) {
          console.error("sendBookingStatusEmail error:", error);
          throw error;
        }
      },
      async sendBookingReminderEmails({ booking, service, publicBaseUrl }) {
        try {
          const serviceLabel = buildServiceLabel(service);
          const details = [
            { label: "Cliente", value: booking.client_name },
            { label: "Service", value: serviceLabel },
            { label: "Date", value: booking.booking_date },
            { label: "Heure", value: booking.booking_time.slice(0, 5) },
            { label: "TÃ©lÃ©phone", value: booking.client_phone || "Non renseignÃ©" },
          ];
          const clientHtml = renderMailShell({
            logoUrl,
            eyebrow: "Rappel rendez-vous",
            title: `Votre rendez-vous de demain chez Just Beauty`,
            intro: `Bonjour ${booking.client_name}, nous vous rappelons votre rendez-vous prÃ©vu demain pour ${serviceLabel}.`,
            details,
            cta: `<a href="${escapeHtml(`${publicBaseUrl}/rendez-vous`)}" style="display:inline-block;text-decoration:none;background:#b67d6c;color:#fffaf7;padding:14px 20px;border-radius:999px;">Voir les rendez-vous</a>`,
            closing: "A trÃ¨s bientÃ´t chez Just Beauty.",
          });
          const adminHtml = renderMailShell({
            logoUrl,
            eyebrow: "Rappel envoyÃ©",
            title: `Rappel rendez-vous: ${booking.client_name} - ${serviceLabel}`,
            intro: "Un rappel de rendez-vous a Ã©tÃ© envoyÃ© Ã  la cliente.",
            details: [
              ...details,
              { label: "Email", value: booking.client_email },
            ],
            closing: "Ce rappel concerne le rendez-vous prÃ©vu demain.",
          });

          await transporter.sendMail({
            from: `"${env.SMTP_FROM_NAME}" <${env.SMTP_FROM_EMAIL}>`,
            to: booking.client_email,
            subject: `Just Beauty | Rappel rendez-vous demain - ${booking.client_name} - ${serviceLabel}`,
            html: clientHtml,
          });

          await transporter.sendMail({
            from: `"${env.SMTP_FROM_NAME}" <${env.SMTP_FROM_EMAIL}>`,
            to: env.BOOKING_ADMIN_EMAIL || env.SMTP_FROM_EMAIL || env.ADMIN_EMAIL,
            subject: `Just Beauty | Rappel envoyÃ© - ${booking.client_name} - ${serviceLabel}`,
            html: adminHtml,
          });
        } catch (error) {
          console.error("sendBookingReminderEmails error:", error);
          throw error;
        }
      },
      async sendContactEmail({ message }) {
        try {
          const adminHtml = renderMailShell({
            logoUrl,
            eyebrow: "Nouveau message",
            title: "Le formulaire de contact vient d'être utilisé",
            intro: "Un message client vient d'être envoyé depuis le site Just Beauty.",
            details: [
              { label: "Nom", value: message.client_name },
              { label: "Email", value: message.client_email },
              { label: "Téléphone", value: message.client_phone || "Non renseigné" },
              { label: "Message", value: message.message },
            ],
            closing: "Vous pouvez répondre directement à l'adresse e-mail de la cliente si nécessaire.",
          });

          const clientHtml = renderMailShell({
            logoUrl,
            eyebrow: "Just Beauty",
            title: "Votre message a bien été envoyé",
            intro: `Bonjour ${message.client_name}, nous avons bien reçu votre message et nous reviendrons vers vous rapidement.`,
            details: [
              { label: "Email", value: message.client_email },
              { label: "Téléphone", value: message.client_phone || "Non renseigné" },
              { label: "Message", value: message.message },
            ],
            closing: "Merci pour votre confiance.",
          });

          await transporter.sendMail({
            from: `"${env.SMTP_FROM_NAME}" <${env.SMTP_FROM_EMAIL}>`,
            to: env.CONTACT_ADMIN_EMAIL || env.BOOKING_ADMIN_EMAIL || env.ADMIN_EMAIL,
            replyTo: message.client_email,
            subject: "Just Beauty | Nouveau message de contact",
            html: adminHtml,
          });

          await transporter.sendMail({
            from: `"${env.SMTP_FROM_NAME}" <${env.SMTP_FROM_EMAIL}>`,
            to: message.client_email,
            subject: "Just Beauty | Nous avons bien reçu votre message",
            html: clientHtml,
          });
        } catch (error) {
          console.error("sendContactEmail error:", error);
          throw error;
        }
      },
      async sendPaymentIssueEmail({ report }) {
        try {
          const adminHtml = renderMailShell({
            logoUrl,
            eyebrow: "Problème paiement",
            title: "Un incident de paiement a été signalé",
            intro: "Un signalement a été envoyé depuis le parcours de réservation pour aider au débogage du paiement.",
            details: [
              { label: "Nom", value: report.client_name || "Non renseigné" },
              { label: "E-mail", value: report.client_email || "Non renseigné" },
              { label: "Téléphone", value: report.client_phone || "Non renseigné" },
              { label: "Service", value: report.service_label || "Non renseigné" },
              { label: "Date / heure", value: report.booking_slot || "Non renseigné" },
              { label: "Mode acompte", value: report.deposit_method || "Non renseigné" },
              { label: "Erreur", value: report.error_message || "Non renseignée" },
            ],
            closing: "Les journaux techniques complets sont inclus ci-dessous pour l'analyse.",
            cta: `<pre style="white-space:pre-wrap;word-break:break-word;background:#fffaf7;border:1px solid #efddd2;border-radius:16px;padding:16px;font-size:12px;line-height:1.6;color:#5b4339;overflow:auto;">${escapeHtml(JSON.stringify(report.logs || {}, null, 2))}</pre>`,
          });

          await transporter.sendMail({
            from: `"${env.SMTP_FROM_NAME}" <${env.SMTP_FROM_EMAIL}>`,
            to: "lambert.f@lfinfo.be",
            replyTo: report.client_email || env.CONTACT_ADMIN_EMAIL || env.ADMIN_EMAIL,
            subject: `Just Beauty | Incident paiement - ${report.client_name || "Cliente inconnue"}`,
            html: adminHtml,
          });
        } catch (error) {
          console.error("sendPaymentIssueEmail error:", error);
          throw error;
        }
      },

      async sendCustomerDeletionScheduledEmail({ customer, scheduledFor, publicBaseUrl }) {
        const requestedBy = customer.deletion_requested_by || "admin";
        const daysLabel = requestedBy === "customer" ? "3 jours" : "30 jours";
        const clientHtml = renderMailShell({
          logoUrl,
          eyebrow: "Suppression planifiée",
          title: `Votre compte client sera supprimé dans ${daysLabel}`,
          intro: `Bonjour ${customer.first_name}, une demande de suppression de votre compte Just Beauty a été enregistrée.`,
          details: [
            { label: "Compte", value: customer.email },
            { label: "Demande initiée par", value: requestedBy === "customer" ? "vous-même" : "l'administration" },
            { label: "Suppression prévue le", value: scheduledFor.slice(0, 10) },
          ],
          cta: `<a href="${escapeHtml(`${publicBaseUrl}/mon-compte`)}" style="display:inline-block;text-decoration:none;background:#b67d6c;color:#fffaf7;padding:14px 20px;border-radius:999px;">Consulter mon compte</a>`,
          closing: "Si vous souhaitez conserver votre compte, contactez rapidement Just Beauty avant cette date.",
        });

        await transporter.sendMail({
          from: `"${env.SMTP_FROM_NAME}" <${env.SMTP_FROM_EMAIL}>`,
          to: customer.email,
          subject: "Just Beauty | Suppression planifiée de votre compte client",
          html: clientHtml,
        });
      },
      async sendBookingBalancePaymentEmail({ booking, service, checkoutUrl, amountValue, publicBaseUrl }) {
        const serviceLabel = buildServiceLabel(service);
        const clientHtml = renderMailShell({
          logoUrl,
          eyebrow: "Paiement du solde",
          title: `Le solde de votre prestation ${serviceLabel} est prêt`,
          intro: `Bonjour ${booking.client_name}, vous pouvez maintenant régler le solde de votre rendez-vous en ligne via Mollie.`,
          details: [
            { label: "Cliente", value: booking.client_name },
            { label: "Service", value: serviceLabel },
            { label: "Date", value: booking.booking_date },
            { label: "Heure", value: booking.booking_time.slice(0, 5) },
            { label: "Montant à régler", value: `${Number(amountValue || 0).toFixed(2)} EUR` },
          ],
          cta: `<a href="${escapeHtml(checkoutUrl)}" style="display:inline-block;text-decoration:none;background:#b67d6c;color:#fffaf7;padding:14px 20px;border-radius:999px;">Payer le solde</a>`,
          closing: `Si besoin, vous pouvez également retrouver votre rendez-vous sur ${escapeHtml(publicBaseUrl)}.`,
        });

        await transporter.sendMail({
          from: `"${env.SMTP_FROM_NAME}" <${env.SMTP_FROM_EMAIL}>`,
          to: booking.client_email,
          subject: `Just Beauty | Paiement du solde - ${booking.client_name} - ${serviceLabel}`,
          html: clientHtml,
        });
      },
      async sendGiftCardRequestConfirmationEmail({ customer, giftCard, paymentDetails, publicBaseUrl }) {
        const clientHtml = renderMailShell({
          logoUrl,
          eyebrow: "Cheque cadeau",
          title: `Votre demande est enregistree`,
          intro: `Bonjour ${customer.first_name}, votre demande de cheque cadeau est bien enregistree. Le cheque sera active apres validation du virement.`,
          details: [
            { label: "Code", value: giftCard.code },
            { label: "Montant", value: `${Number(giftCard.amount || 0).toFixed(2)} ${giftCard.currency || "EUR"}` },
            { label: "Reference virement", value: giftCard.payment_reference },
            { label: "Compte", value: `${paymentDetails.bank_name || ""} ${paymentDetails.bank_account || ""}`.trim() || "A configurer" },
          ],
          cta: `${buildGiftCardEmailCardHtml({ giftCard, customer, publicBaseUrl })}<div style="height:14px"></div><a href="${escapeHtml(`${publicBaseUrl}/cheques-cadeaux`)}" style="display:inline-block;text-decoration:none;background:#b67d6c;color:#fffaf7;padding:14px 20px;border-radius:999px;">Suivre ma demande</a>`,
          closing: paymentDetails.instructions || "Merci pour votre confiance.",
        });
        await transporter.sendMail({
          from: `"${env.SMTP_FROM_NAME}" <${env.SMTP_FROM_EMAIL}>`,
          to: customer.email,
          subject: `Just Beauty | Demande cheque cadeau recue - ${giftCard.code}`,
          html: clientHtml,
        });
      },
      async sendGiftCardValidatedEmail({ customer, giftCard, publicBaseUrl }) {
        const clientHtml = renderMailShell({
          logoUrl,
          eyebrow: "Cheque cadeau",
          title: `Demande validee - ${giftCard.code}`,
          intro: `Bonjour ${customer.first_name}, votre demande de cheque cadeau a ete validee par Just Beauty.`,
          details: [
            { label: "Code", value: giftCard.code },
            { label: "Montant", value: `${Number(giftCard.amount || 0).toFixed(2)} ${giftCard.currency || "EUR"}` },
            { label: "Statut", value: "Validation confirmee" },
          ],
          cta: `${buildGiftCardEmailCardHtml({ giftCard, customer, publicBaseUrl })}<div style="height:14px"></div><a href="${escapeHtml(`${publicBaseUrl}/cheques-cadeaux`)}" style="display:inline-block;text-decoration:none;background:#b67d6c;color:#fffaf7;padding:14px 20px;border-radius:999px;">Voir mes cheques cadeaux</a>`,
          closing: "Merci pour votre confiance.",
        });
        await transporter.sendMail({
          from: `"${env.SMTP_FROM_NAME}" <${env.SMTP_FROM_EMAIL}>`,
          to: customer.email,
          subject: `Just Beauty | Demande cheque cadeau validee - ${giftCard.code}`,
          html: clientHtml,
        });
      },
      async sendGiftCardActivatedEmail({ customer, giftCard, publicBaseUrl }) {
        const clientHtml = renderMailShell({
          logoUrl,
          eyebrow: "Cheque cadeau actif",
          title: `Votre cheque cadeau est actif`,
          intro: `Bonjour ${customer.first_name}, votre cheque cadeau ${giftCard.code} est maintenant actif et utilisable.`,
          details: [
            { label: "Code", value: giftCard.code },
            { label: "Montant", value: `${Number(giftCard.amount || 0).toFixed(2)} ${giftCard.currency || "EUR"}` },
            { label: "Expire le", value: String(giftCard.expires_at || "").slice(0, 10) || "Non defini" },
          ],
          cta: `${buildGiftCardEmailCardHtml({ giftCard, customer, publicBaseUrl })}<div style="height:14px"></div><a href="${escapeHtml(`${publicBaseUrl}/cheques-cadeaux`)}" style="display:inline-block;text-decoration:none;background:#b67d6c;color:#fffaf7;padding:14px 20px;border-radius:999px;">Consulter mes cheques cadeaux</a>`,
          closing: "Pensez a utiliser ce cheque avant son expiration.",
        });
        await transporter.sendMail({
          from: `"${env.SMTP_FROM_NAME}" <${env.SMTP_FROM_EMAIL}>`,
          to: customer.email,
          subject: `Just Beauty | Cheque cadeau actif - ${giftCard.code}`,
          html: clientHtml,
        });
      },
      async sendGiftCardBeneficiaryEmail({ senderCustomer, giftCard, publicBaseUrl }) {
        if (!giftCard.recipient_email) return;
        const recipientName = String(giftCard.recipient_name || "Vous");
        const clientHtml = renderMailShell({
          logoUrl,
          eyebrow: "Vous avez recu un cheque cadeau",
          title: `${recipientName}, une surprise vous attend`,
          intro: `${senderCustomer.first_name} ${senderCustomer.last_name} vous offre un cheque cadeau Just Beauty.`,
          details: [
            { label: "Code", value: giftCard.code },
            { label: "Montant", value: `${Number(giftCard.amount || 0).toFixed(2)} ${giftCard.currency || "EUR"}` },
            { label: "Expire le", value: String(giftCard.expires_at || "").slice(0, 10) || "Non defini" },
          ],
          cta: `${buildGiftCardEmailCardHtml({ giftCard, customer: senderCustomer, publicBaseUrl })}<div style="height:14px"></div><a href="${escapeHtml(`${publicBaseUrl}/rendez-vous`)}" style="display:inline-block;text-decoration:none;background:#b67d6c;color:#fffaf7;padding:14px 20px;border-radius:999px;">Prendre rendez-vous</a>`,
          closing: "Conservez ce code et presentez-le lors de votre reservation.",
        });
        await transporter.sendMail({
          from: `"${env.SMTP_FROM_NAME}" <${env.SMTP_FROM_EMAIL}>`,
          to: giftCard.recipient_email,
          subject: `Just Beauty | Cheque cadeau pour vous - ${giftCard.code}`,
          html: clientHtml,
        });
      },
      async sendGiftCardExpiryReminderEmail({ customer, giftCard, publicBaseUrl, daysRemaining }) {
        const clientHtml = renderMailShell({
          logoUrl,
          eyebrow: "Rappel expiration",
          title: `Votre cheque cadeau expire bientot`,
          intro: `Bonjour ${customer.first_name}, votre cheque cadeau ${giftCard.code} arrive a expiration dans ${daysRemaining} jour(s).`,
          details: [
            { label: "Code", value: giftCard.code },
            { label: "Montant", value: `${Number(giftCard.amount || 0).toFixed(2)} ${giftCard.currency || "EUR"}` },
            { label: "Date d'expiration", value: String(giftCard.expires_at || "").slice(0, 10) || "Non definie" },
          ],
          cta: `${buildGiftCardEmailCardHtml({ giftCard, customer, publicBaseUrl })}<div style="height:14px"></div><a href="${escapeHtml(`${publicBaseUrl}/cheques-cadeaux`)}" style="display:inline-block;text-decoration:none;background:#b67d6c;color:#fffaf7;padding:14px 20px;border-radius:999px;">Voir mes cheques cadeaux</a>`,
          closing: "N'hesitez pas a nous contacter si vous avez une question.",
        });
        await transporter.sendMail({
          from: `"${env.SMTP_FROM_NAME}" <${env.SMTP_FROM_EMAIL}>`,
          to: customer.email,
          subject: `Just Beauty | Rappel expiration cheque cadeau - ${giftCard.code}`,
          html: clientHtml,
        });
      },
    };
  } catch (error) {
    console.error("Mailer init error:", error);
    return {
      sendBookingCreatedEmails: async () => {},
      sendBookingStatusEmail: async () => {},
      sendContactEmail: async () => {},
      sendPaymentIssueEmail: async () => {},
      sendCustomerDeletionScheduledEmail: async () => {},
      sendBookingBalancePaymentEmail: async () => {},
      sendGiftCardRequestConfirmationEmail: async () => {},
      sendGiftCardValidatedEmail: async () => {},
      sendGiftCardActivatedEmail: async () => {},
      sendGiftCardBeneficiaryEmail: async () => {},
      sendGiftCardExpiryReminderEmail: async () => {},
      sendBookingReminderEmails: async () => {},
    };
  }
};

const createApp = async () => {
  const env = await ensureEnv();
  const db = new DatabaseSync(env.DB_FILE);
  bootstrapDb(db, env);
  const mailer = await createMailer(env);
  const telegramNotifier = createTelegramNotifier(env);
  const calDav = createCalDavClient(env);
  const publicBaseUrl = env.PUBLIC_BASE_URL.replace(/\/$/, "");
  const apiPublicBaseUrl = String(env.API_PUBLIC_BASE_URL || env.PUBLIC_BASE_URL || "").replace(/\/$/, "");
  const protectionConfig = getProtectionConfig(env);
  const upsertMediaProtectionAsset = db.prepare(`
    INSERT INTO media_protection_assets (id, gallery_image_id, original_sha256, displayed_sha256, phash64, watermark_text, watermark_applied, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(gallery_image_id) DO UPDATE SET
      original_sha256 = excluded.original_sha256,
      displayed_sha256 = excluded.displayed_sha256,
      phash64 = excluded.phash64,
      watermark_text = excluded.watermark_text,
      watermark_applied = excluded.watermark_applied
  `);
  const upsertContentFingerprint = db.prepare(`
    INSERT INTO content_fingerprints (id, content_key, sha256, canary_tag, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(content_key) DO UPDATE SET
      sha256 = excluded.sha256,
      canary_tag = excluded.canary_tag,
      updated_at = excluded.updated_at
  `);
  const insertProtectionEvent = db.prepare(`
    INSERT INTO media_protection_events (id, asset_id, event_type, source_url, reporter, notes, evidence_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const sendBookingCreatedNotifications = async ({ booking, service, actionLinks }) => {
    await Promise.all([
      mailer.sendBookingCreatedEmails({ booking, service, actionLinks }),
      telegramNotifier.sendBookingCreatedAlert({ booking, service, actionLinks }),
    ]);
  };
  const refreshAllContentFingerprints = () => {
    try {
      const rows = db.prepare("SELECT key, value FROM site_content").all();
      const now = new Date().toISOString();
      rows.forEach((row) => {
        const fingerprint = computeContentFingerprint({
          key: row.key,
          value: row.value,
          secret: env.SESSION_SECRET,
        });
        upsertContentFingerprint.run(
          crypto.randomUUID(),
          row.key,
          fingerprint.sha256,
          `JB-${fingerprint.tag}`,
          now,
        );
      });
    } catch (error) {
      console.warn("Content fingerprint refresh skipped:", error instanceof Error ? error.message : error);
    }
  };
  const getContentWithFingerprints = () => {
    try {
      return db.prepare(`
        SELECT site_content.*, content_fingerprints.canary_tag AS fingerprint_tag
        FROM site_content
        LEFT JOIN content_fingerprints ON content_fingerprints.content_key = site_content.key
        ORDER BY site_content.key
      `).all();
    } catch {
      return sortBy(db.prepare("SELECT * FROM site_content").all(), ["key"]);
    }
  };
  const canServeProtectedUpload = (req) => {
    if (!protectionConfig.blockHotlink) return true;
    const origin = normalizeHost(req.headers.origin || "");
    const referer = normalizeHost(req.headers.referer || "");
    const sourceHost = origin || referer;
    if (!sourceHost) return true;
    return protectionConfig.allowedHosts.includes(sourceHost);
  };
  refreshAllContentFingerprints();

  const getWeeklySchedule = () => {
    const dayRows = sortBy(db.prepare("SELECT weekday, is_open, updated_at FROM weekly_schedule").all(), ["weekday"]);
    const rangeRows = sortBy(db.prepare("SELECT weekday, start_time, end_time, updated_at FROM weekly_schedule_ranges").all(), ["weekday", "start_time", "end_time"]);
    const rangesByWeekday = new Map();
    rangeRows.forEach((range) => {
      const list = rangesByWeekday.get(range.weekday) || [];
      list.push({ start_time: range.start_time, end_time: range.end_time, updated_at: range.updated_at });
      rangesByWeekday.set(range.weekday, list);
    });
    return WEEKDAY_KEYS.map((_, weekday) => {
      const row = dayRows.find((item) => item.weekday === weekday) || { weekday, is_open: 0, updated_at: new Date().toISOString() };
      return {
        weekday,
        key: WEEKDAY_KEYS[weekday],
        is_open: Boolean(row.is_open),
        updated_at: row.updated_at,
        ranges: rangesByWeekday.get(weekday) || [],
      };
    });
  };

  const getDayAvailabilityOverrides = () => sortBy(db.prepare("SELECT date, status, updated_at FROM availability_overrides").all(), ["date"]);
  const getSlotAvailabilityOverrides = () => sortBy(db.prepare("SELECT date, time, status, updated_at FROM availability_slot_overrides").all(), ["date", "time"]);
  const getWeeklyRangesForDate = (date) => {
    const normalizedDate = normalizeDate(date);
    const weekday = new Date(`${normalizedDate}T12:00:00`).getDay();
    const day = getWeeklySchedule().find((item) => item.weekday === weekday);
    if (!day?.is_open) return [];
    return day.ranges;
  };
  const getActiveBookingsForDate = (date, excludeBookingId = null) => db.prepare(`
    SELECT bookings.id, bookings.booking_time, bookings.status, services.duration_minutes
    FROM bookings
    JOIN services ON services.id = bookings.service_id
    WHERE bookings.booking_date = ?
      AND bookings.status IN ('pending', 'confirmed')
      ${excludeBookingId ? "AND bookings.id != ?" : ""}
  `).all(...(excludeBookingId ? [date, excludeBookingId] : [date]));
  const hasBookingConflict = (date, time, durationMinutes, excludeBookingId = null) => {
    const start = toMinutes(time);
    const end = start + Number(durationMinutes || DEFAULT_SERVICE_DURATION_MINUTES);
    return getActiveBookingsForDate(date, excludeBookingId).some((booking) => {
      const bookingStart = toMinutes(booking.booking_time);
      const bookingEnd = bookingStart + Number(booking.duration_minutes || DEFAULT_SERVICE_DURATION_MINUTES);
      return rangesOverlap(start, end, bookingStart, bookingEnd);
    });
  };
  const getAvailabilityOverrides = () => ({
    weeklySchedule: getWeeklySchedule(),
    days: getDayAvailabilityOverrides(),
    slots: getSlotAvailabilityOverrides(),
    timeSlots: APPOINTMENT_TIME_SLOTS,
  });
  const isDateAvailable = (date) => {
    const normalizedDate = normalizeDate(date);
    const override = db.prepare("SELECT status FROM availability_overrides WHERE date = ?").get(normalizedDate);
    if (override?.status === "open") return true;
    if (override?.status === "closed") return false;
    return getWeeklyRangesForDate(normalizedDate).length > 0;
  };
  const isTimeSlotAvailable = (date, time, serviceDurationMinutes = DEFAULT_SERVICE_DURATION_MINUTES, excludeBookingId = null) => {
    const normalizedDate = normalizeDate(date);
    const normalizedTime = normalizeTime(time);
    if (!APPOINTMENT_TIME_SLOTS.includes(normalizedTime)) return false;

    const slotOverride = db.prepare("SELECT status FROM availability_slot_overrides WHERE date = ? AND time = ?").get(normalizedDate, normalizedTime);
    const dayOverride = db.prepare("SELECT status FROM availability_overrides WHERE date = ?").get(normalizedDate);

    if (slotOverride?.status === "closed") return false;
    if (dayOverride?.status === "closed") return false;

    const defaultOpen = getWeeklyRangesForDate(normalizedDate).some((range) => slotFitsRange(normalizedTime, serviceDurationMinutes, range));
    const isOpen = slotOverride?.status === "open"
      ? true
      : dayOverride?.status === "open"
        ? true
        : defaultOpen;

    if (!isOpen) return false;
    if (hasBookingConflict(normalizedDate, normalizedTime, serviceDurationMinutes, excludeBookingId)) return false;
    return true;
  };

  const getBookingWithService = (bookingId) => {
    const row = db.prepare(`
      SELECT bookings.*, services.name AS service_name, services.category AS service_category, services.description AS service_description, services.duration_minutes AS service_duration_minutes, services.price AS service_price
      FROM bookings
      JOIN services ON services.id = bookings.service_id
      WHERE bookings.id = ?
    `).get(bookingId);

    if (!row) return null;

    return {
      booking: {
        id: row.id,
        service_id: row.service_id,
        customer_id: row.customer_id || null,
        client_name: row.client_name,
        client_email: row.client_email,
        client_phone: row.client_phone,
        booking_date: row.booking_date,
        booking_time: row.booking_time,
        status: row.status,
        notes: row.notes,
        deposit_required: Boolean(row.deposit_required),
        deposit_amount: Number(row.deposit_amount || 0),
        deposit_method: row.deposit_method || "none",
        deposit_status: row.deposit_status || "not_required",
        deposit_reference: row.deposit_reference || "",
        deposit_checkout_url: row.deposit_checkout_url || "",
        deposit_payment_id: row.deposit_payment_id || "",
        deposit_paid_at: row.deposit_paid_at || "",
        reminder_sent_at: row.reminder_sent_at || "",
        created_at: row.created_at,
        updated_at: row.updated_at,
      },
      service: {
        id: row.service_id,
        name: row.service_name,
        category: row.service_category,
        description: row.service_description,
        duration_minutes: row.service_duration_minutes,
        price: row.service_price,
      },
    };
  };
  const getTomorrowDateKey = () => {
    const timeZone = env.CALDAV_TIMEZONE || "Europe/Brussels";
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const parts = Object.fromEntries(formatter.formatToParts(new Date()).map((part) => [part.type, part.value]));
    const tomorrowAtNoonUtc = new Date(Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day) + 1,
      12,
    ));
    const tomorrowParts = Object.fromEntries(formatter.formatToParts(tomorrowAtNoonUtc).map((part) => [part.type, part.value]));
    return `${tomorrowParts.year}-${tomorrowParts.month}-${tomorrowParts.day}`;
  };
  const sendBookingReminder = async (bookingId, { force = false } = {}) => {
    const snapshot = getBookingWithService(bookingId);
    if (!snapshot) return { ok: false, reason: "booking_not_found" };
    if (snapshot.booking.status !== "confirmed") return { ok: false, reason: "not_confirmed", booking: snapshot.booking };
    if (!force && snapshot.booking.reminder_sent_at) return { ok: true, skipped: true, reason: "already_sent", booking: snapshot.booking };

    await mailer.sendBookingReminderEmails({
      booking: snapshot.booking,
      service: snapshot.service,
      publicBaseUrl,
    });

    const sentAt = new Date().toISOString();
    db.prepare("UPDATE bookings SET reminder_sent_at = ?, updated_at = ? WHERE id = ?").run(sentAt, sentAt, bookingId);
    const updated = getBookingWithService(bookingId);
    return { ok: true, skipped: false, booking: updated?.booking || snapshot.booking };
  };
  const sendTomorrowBookingReminders = async () => {
    const tomorrow = getTomorrowDateKey();
    const rows = db.prepare(`
      SELECT id
      FROM bookings
      WHERE booking_date = ?
        AND status = 'confirmed'
        AND (deposit_required = 0 OR deposit_status = 'paid')
        AND (reminder_sent_at IS NULL OR reminder_sent_at = '')
      ORDER BY booking_time
    `).all(tomorrow);
    let sent = 0;
    const errors = [];

    for (const row of rows) {
      try {
        const result = await sendBookingReminder(row.id);
        if (result.ok && !result.skipped) sent += 1;
      } catch (error) {
        errors.push(`booking ${row.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    if (sent || errors.length) {
      console.log(`Booking reminders checked for ${tomorrow}: ${sent} sent, ${errors.length} error(s)`);
    }
    errors.forEach((error) => console.warn("Booking reminder failed:", error));
    return { date: tomorrow, checked: rows.length, sent, errors };
  };
  const normalizeMolliePaymentStatus = (status) => {
    const normalized = String(status || "").trim().toLowerCase();
    if (normalized === "paid") return "paid";
    if (normalized === "expired") return "expired";
    if (normalized === "failed") return "failed";
    if (normalized === "canceled") return "cancelled";
    if (["open", "pending", "authorized"].includes(normalized)) return "open";
    return normalized || "open";
  };

  const createBookingActionLinks = (bookingId) => {
    const token = createSessionToken(env.SESSION_SECRET);
    const now = new Date();
    db.prepare("INSERT INTO booking_action_tokens (id, booking_id, token_hash, created_at, expires_at) VALUES (?, ?, ?, ?, ?)")
      .run(
        crypto.randomUUID(),
        bookingId,
        hashToken(token, env.SESSION_SECRET),
        now.toISOString(),
        new Date(now.getTime() + 1000 * 60 * 60 * 24 * 14).toISOString(),
      );
    return {
      confirm: `${publicBaseUrl}/api/booking-actions/${encodeURIComponent(token)}?action=confirmed`,
      refuse: `${publicBaseUrl}/api/booking-actions/${encodeURIComponent(token)}?action=refused`,
    };
  };

  const findBookingActionToken = (token) => {
    const tokens = db.prepare("SELECT * FROM booking_action_tokens").all();
    return tokens.find((entry) => {
      if (Date.parse(entry.expires_at) < Date.now()) return false;
      return verifyToken(token, entry.token_hash, env.SESSION_SECRET);
    }) || null;
  };
  const telegramWebhookSecretToken = String(env.TELEGRAM_WEBHOOK_SECRET_TOKEN || "").trim();
  const normalizeTelegramChatId = (value) => String(value ?? "").trim();
  const isAdminTelegramChat = (chatId) => {
    const adminChatId = normalizeTelegramChatId(env.TELEGRAM_CHAT_ID);
    return Boolean(adminChatId && normalizeTelegramChatId(chatId) === adminChatId);
  };
  const getBookingStatusLabel = (status) => {
    if (status === "confirmed") return "confirmee";
    if (status === "refused") return "refusee";
    if (status === "cancelled") return "annulee";
    return "traitee";
  };
  const parseTelegramTextAction = (text) => {
    const raw = String(text || "").trim();
    if (!raw) return null;
    const match = raw.match(/^\/?([a-zA-Z_]+)\s+([a-fA-F0-9-]{6,})$/);
    if (!match) return null;
    const command = match[1].toLowerCase();
    const bookingId = match[2];
    if (["confirm", "confirmer", "accept", "accepter"].includes(command)) {
      return { action: "confirmed", bookingId };
    }
    if (["refuse", "refuser", "reject", "annuler", "cancel"].includes(command)) {
      return { action: "refused", bookingId };
    }
    return null;
  };
  const parseTelegramWebhookAction = (payload) => {
    const callbackQuery = payload?.callback_query || null;
    const callbackData = String(callbackQuery?.data || "");
    const callbackMatch = callbackData.match(/^booking_action:(confirmed|refused):([a-fA-F0-9-]{6,})$/);
    if (callbackMatch) {
      return {
        action: callbackMatch[1],
        bookingId: callbackMatch[2],
        callbackQueryId: String(callbackQuery?.id || ""),
        chatId: callbackQuery?.message?.chat?.id ?? callbackQuery?.from?.id ?? "",
        messageId: callbackQuery?.message?.message_id ?? "",
      };
    }

    const textAction = parseTelegramTextAction(payload?.message?.text || "");
    if (!textAction) return null;
    return {
      action: textAction.action,
      bookingId: textAction.bookingId,
      callbackQueryId: "",
      chatId: payload?.message?.chat?.id ?? "",
      messageId: "",
    };
  };
  const applyTelegramBookingAction = async ({ action, bookingId }) => {
    const snapshot = getBookingWithService(bookingId);
    if (!snapshot) {
      return { ok: false, reason: "booking_not_found", bookingId };
    }
    if (snapshot.booking.status !== "pending") {
      return {
        ok: false,
        reason: "already_processed",
        bookingId,
        status: snapshot.booking.status,
      };
    }
    await updateBookingStatus(bookingId, action);
    return { ok: true, bookingId, status: action };
  };

  const getBookingCalendarEvent = (bookingId) => db.prepare("SELECT * FROM booking_calendar_events WHERE booking_id = ?").get(bookingId) || null;
  const saveBookingCalendarEvent = (bookingId, event) => {
    db.prepare(`
      INSERT INTO booking_calendar_events (booking_id, event_uid, event_path, etag, synced_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(booking_id) DO UPDATE SET
        event_uid = excluded.event_uid,
        event_path = excluded.event_path,
        etag = excluded.etag,
        synced_at = excluded.synced_at
    `).run(bookingId, event.event_uid, event.event_path, event.etag || "", event.synced_at);
  };
  const deleteBookingCalendarEventRecord = (bookingId) => {
    db.prepare("DELETE FROM booking_calendar_events WHERE booking_id = ?").run(bookingId);
  };
  const syncBookingCalendar = async (snapshot) => {
    if (!snapshot || !calDav.enabled) return;
    const existingEvent = getBookingCalendarEvent(snapshot.booking.id);
    if (snapshot.booking.status === "confirmed") {
      const event = await calDav.upsertBookingEvent({ booking: snapshot.booking, service: snapshot.service, existingEvent });
      if (event) saveBookingCalendarEvent(snapshot.booking.id, event);
      return;
    }
    if (existingEvent) {
      await calDav.deleteBookingEvent(existingEvent);
      deleteBookingCalendarEventRecord(snapshot.booking.id);
    }
  };
  const syncAllConfirmedBookings = async () => {
    const confirmedBookingIds = db.prepare("SELECT id FROM bookings WHERE status = 'confirmed' ORDER BY booking_date, booking_time").all();
    let synced = 0;
    let cleaned = 0;
    const errors = [];

    for (const row of confirmedBookingIds) {
      try {
        const snapshot = getBookingWithService(row.id);
        if (snapshot) {
          await syncBookingCalendar(snapshot);
          synced += 1;
        }
      } catch (error) {
        errors.push(`booking ${row.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    const staleEvents = db.prepare(`
      SELECT booking_calendar_events.booking_id
      FROM booking_calendar_events
      LEFT JOIN bookings ON bookings.id = booking_calendar_events.booking_id
      WHERE bookings.id IS NULL OR bookings.status != 'confirmed'
    `).all();

    for (const row of staleEvents) {
      try {
        const event = getBookingCalendarEvent(row.booking_id);
        if (event) {
          await calDav.deleteBookingEvent(event);
          deleteBookingCalendarEventRecord(row.booking_id);
          cleaned += 1;
        }
      } catch (error) {
        errors.push(`cleanup ${row.booking_id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return { synced, cleaned, errors, enabled: calDav.enabled };
  };
  const syncConfirmedBookingsForService = async (serviceId) => {
    const rows = db.prepare("SELECT id FROM bookings WHERE service_id = ? AND status = 'confirmed' ORDER BY booking_date, booking_time").all(serviceId);
    for (const row of rows) {
      const snapshot = getBookingWithService(row.id);
      if (!snapshot) continue;
      try {
        await syncBookingCalendar(snapshot);
      } catch (error) {
        console.warn("Service-linked calendar sync failed:", error instanceof Error ? error.message : error);
      }
    }
  };
  const cleanupCalendarForServiceBookings = async (serviceId) => {
    const rows = db.prepare("SELECT id FROM bookings WHERE service_id = ?").all(serviceId);
    for (const row of rows) {
      const event = getBookingCalendarEvent(row.id);
      if (!event) continue;
      try {
        if (calDav.enabled) {
          await calDav.deleteBookingEvent(event);
        }
      } catch (error) {
        console.warn("Service-linked calendar delete failed:", error instanceof Error ? error.message : error);
      }
      deleteBookingCalendarEventRecord(row.id);
    }
  };

  const updateBookingStatus = async (bookingId, status) => {
    const snapshot = getBookingWithService(bookingId);
    if (!snapshot) return null;
    if (snapshot.booking.status === status) return snapshot;

    db.prepare("UPDATE bookings SET status = ?, updated_at = ? WHERE id = ?").run(status, new Date().toISOString(), bookingId);
    const updated = getBookingWithService(bookingId);

    if (updated) {
      try {
        await syncBookingCalendar(updated);
      } catch (error) {
        console.warn("Calendar sync failed:", error instanceof Error ? error.message : error);
      }

      if (status === "confirmed") {
        awardBookingLoyaltyVisit(updated);
      } else if (shouldRevokeBookingLoyalty(updated)) {
        deleteBookingLoyaltyTransactions(updated.booking.id);
      }
    }

    if (updated && (status === "confirmed" || status === "refused")) {
      try {
        await mailer.sendBookingStatusEmail({ ...updated, publicBaseUrl });
      } catch (error) {
        console.warn("Status email failed:", error instanceof Error ? error.message : error);
      }
    }

    return updated;
  };

  const getAuthAdmin = (req) => {
    const token = getBearerToken(req);
    if (!token) return null;

    const sessions = db.prepare(`
      SELECT sessions.id, sessions.admin_id, sessions.token_hash, sessions.expires_at, admins.email, admins.name
      FROM sessions
      JOIN admins ON admins.id = sessions.admin_id
    `).all();

    const session = sessions.find((entry) => {
      if (Date.parse(entry.expires_at) < Date.now()) return false;
      return verifyToken(token, entry.token_hash, env.SESSION_SECRET);
    });

    if (!session) return null;
    return {
      id: session.admin_id,
      email: session.email,
      name: session.name,
    };
  };

  const getAdminRecord = (adminId) => db.prepare("SELECT * FROM admins WHERE id = ?").get(adminId);
  const getCustomerRecord = (customerId) => db.prepare("SELECT * FROM customers WHERE id = ?").get(customerId);
  const getCustomerByEmail = (email) => db.prepare("SELECT * FROM customers WHERE email = ?").get(String(email || "").trim().toLowerCase());
  const getCustomerCompletedVisits = (customerId) => {
    const summary = db.prepare(`
      SELECT COALESCE(SUM(points), 0) AS total_visits
      FROM loyalty_transactions
      WHERE customer_id = ?
    `).get(customerId);
    return Number(summary?.total_visits || 0);
  };
  const buildCustomerLoyaltySummary = (completedVisits) => {
    const normalizedVisits = Math.max(0, Number(completedVisits || 0));
    const progressVisits = normalizedVisits % 10;
    const nextDiscountAt = Math.ceil((normalizedVisits + 1) / 10) * 10;

    return {
      completed_visits: normalizedVisits,
      progress_visits: progressVisits,
      visits_until_discount: progressVisits === 0 ? 10 : 10 - progressVisits,
      available_discounts: Math.floor(normalizedVisits / 10),
      discount_rate: 10,
      next_discount_at: nextDiscountAt,
    };
  };
  const getCustomerProfile = (customerId) => {
    const customer = getCustomerRecord(customerId);
    if (!customer) return null;
    const completedVisits = getCustomerCompletedVisits(customerId);
    const loyalty = buildCustomerLoyaltySummary(completedVisits);
    return {
      id: customer.id,
      email: customer.email,
      first_name: customer.first_name,
      last_name: customer.last_name,
      phone: customer.phone,
      marketing_consent: Boolean(customer.marketing_consent),
      trusted_no_deposit: Boolean(customer.trusted_no_deposit),
      deletion_requested_at: customer.deletion_requested_at || "",
      deletion_scheduled_for: customer.deletion_scheduled_for || "",
      deletion_requested_by: customer.deletion_requested_by || "",
      loyalty_points: completedVisits,
      loyalty_completed_visits: loyalty.completed_visits,
      loyalty_progress_visits: loyalty.progress_visits,
      loyalty_visits_until_discount: loyalty.visits_until_discount,
      loyalty_available_discounts: loyalty.available_discounts,
      loyalty_discount_rate: loyalty.discount_rate,
      loyalty_next_discount_at: loyalty.next_discount_at,
      created_at: customer.created_at,
      updated_at: customer.updated_at,
    };
  };
  const getContentValue = (key, fallback = "") => {
    const row = db.prepare("SELECT value FROM site_content WHERE key = ?").get(key);
    return row ? String(row.value ?? fallback) : fallback;
  };
  const getMollieMode = () => {
    const mode = String(getContentValue("payment_mollie_mode", "test")).trim().toLowerCase();
    return mode === "live" ? "live" : "test";
  };
  const getMollieApiKey = (mode = getMollieMode()) => {
    const normalizedMode = mode === "live" ? "live" : "test";
    const legacyKey = getContentValue("payment_mollie_api_key", "").trim();
    const envKey = String(env.MOLLIE_API_KEY || "").trim();
    const storedTestKey = getContentValue("payment_mollie_test_api_key", "").trim();
    const storedLiveKey = getContentValue("payment_mollie_live_api_key", "").trim();
    const preferredStoredKey = normalizedMode === "live" ? storedLiveKey : storedTestKey;
    if (preferredStoredKey) return preferredStoredKey;
    if (legacyKey) return legacyKey;
    if (!envKey) return "";
    if (normalizedMode === "live") {
      return envKey.startsWith("live_") ? envKey : "";
    }
    return envKey.startsWith("test_") ? envKey : "";
  };
  const getMollieClient = (mode = getMollieMode()) => createMollieClient(getMollieApiKey(mode));
  const parseBooleanSetting = (value, fallback = false) => {
    if (value === undefined || value === null || value === "") return fallback;
    return ["1", "true", "yes", "on"].includes(String(value).trim().toLowerCase());
  };
  const getPaymentSettings = ({ includeSecrets = false } = {}) => {
    const enabled = parseBooleanSetting(getContentValue("payments_enabled", "0"), false);
    const depositRate = Math.max(0, Number(getContentValue("payment_deposit_rate", "10")) || 10);
    const depositThreshold = Math.max(0, Number(getContentValue("payment_deposit_threshold", "20")) || 20);
    const allowBankTransfer = parseBooleanSetting(getContentValue("payment_allow_bank_transfer", "1"), true);
    const bankAccount = getContentValue("payment_bank_account", "");
    const bankName = getContentValue("payment_bank_name", "Just Beauty");
    const bankReferencePrefix = getContentValue("payment_bank_reference_prefix", "ACOMPTE");
    const mollieMode = getMollieMode();
    const mollieTestApiKey = getMollieApiKey("test");
    const mollieLiveApiKey = getMollieApiKey("live");
    const selectedMollieApiKey = getMollieApiKey(mollieMode);

    return {
      enabled,
      deposit_rate: depositRate,
      deposit_threshold: depositThreshold,
      allow_bank_transfer: allowBankTransfer,
      bank_account: bankAccount,
      bank_name: bankName,
      bank_reference_prefix: bankReferencePrefix,
      mollie_mode: mollieMode,
      mollie_enabled: Boolean(selectedMollieApiKey),
      mollie_test_api_configured: Boolean(mollieTestApiKey),
      mollie_live_api_configured: Boolean(mollieLiveApiKey),
      ...(includeSecrets ? {
        mollie_api_configured: Boolean(selectedMollieApiKey),
        mollie_api_key: selectedMollieApiKey,
        mollie_test_api_key: mollieTestApiKey,
        mollie_live_api_key: mollieLiveApiKey,
      } : {}),
    };
  };
  const buildBookingDepositReference = (bookingId) => {
    const prefix = getPaymentSettings().bank_reference_prefix || "ACOMPTE";
    return `${prefix}-${String(bookingId || "").slice(0, 8).toUpperCase()}`;
  };
  const buildDepositAmount = (service, customer) => {
    const settings = getPaymentSettings();
    const servicePrice = Number(service?.price || 0);
    const isTrusted = Boolean(customer?.trusted_no_deposit);
    const depositRequired = settings.enabled && servicePrice > settings.deposit_threshold && !isTrusted;
    const rawAmount = servicePrice * (settings.deposit_rate / 100);

    return {
      enabled: settings.enabled,
      required: depositRequired,
      amount: depositRequired ? Number(rawAmount.toFixed(2)) : 0,
      rate: settings.deposit_rate,
      threshold: settings.deposit_threshold,
      allow_bank_transfer: settings.allow_bank_transfer,
      bank_account: settings.bank_account,
      bank_name: settings.bank_name,
      customer_is_trusted: isTrusted,
    };
  };
  const serializeBookingRow = (row) => ({
    ...row,
    customer_id: row.customer_id || null,
    service_price: Number(row.service_price || 0),
    deposit_required: Boolean(row.deposit_required),
    deposit_amount: Number(row.deposit_amount || 0),
    deposit_method: row.deposit_method || "none",
    deposit_status: row.deposit_status || "not_required",
    deposit_reference: row.deposit_reference || "",
    deposit_checkout_url: row.deposit_checkout_url || "",
    deposit_payment_id: row.deposit_payment_id || "",
    deposit_paid_at: row.deposit_paid_at || "",
    balance_payment_id: row.balance_payment_id || "",
    balance_payment_status: row.balance_payment_status || "not_requested",
    balance_checkout_url: row.balance_checkout_url || "",
    balance_paid_at: row.balance_paid_at || "",
    reminder_sent_at: row.reminder_sent_at || "",
  });
  const getCustomerBookings = (customerId) => db.prepare(`
    SELECT bookings.*, services.name AS service_name, services.category AS service_category, services.duration_minutes AS service_duration_minutes
    FROM bookings
    LEFT JOIN services ON services.id = bookings.service_id
    WHERE bookings.customer_id = ?
      AND (bookings.deposit_required = 0 OR bookings.deposit_status = 'paid')
    ORDER BY bookings.booking_date DESC, bookings.booking_time DESC
  `).all(customerId).map((row) => ({
    ...serializeBookingRow(row),
    services: row.service_name ? { name: row.service_name, category: row.service_category, duration_minutes: row.service_duration_minutes } : null,
  }));
  const getCustomerLoyaltyTransactions = (customerId) => sortBy(
    db.prepare("SELECT * FROM loyalty_transactions WHERE customer_id = ?").all(customerId).map((row) => ({
      id: row.id,
      booking_id: row.booking_id,
      visits: Number(row.points || 0),
      type: row.type,
      description: row.description,
      created_at: row.created_at,
    })),
    ["created_at", "id"],
  ).reverse();
  const getGiftCardPaymentDetails = () => {
    const bankAccount = getContentValue("giftcard_bank_account", "").trim() || getContentValue("payment_bank_account", "").trim();
    const bankName = getContentValue("giftcard_bank_name", "").trim() || getContentValue("payment_bank_name", "Just Beauty").trim();
    const instructions = getContentValue(
      "giftcard_transfer_instructions",
      "Veuillez indiquer la reference du cheque cadeau dans la communication du virement.",
    ).trim();
    return {
      bank_account: bankAccount,
      bank_name: bankName,
      instructions,
    };
  };
  const sanitizeGiftCardStatus = (value) => {
    const normalized = String(value || "").trim().toLowerCase();
    if (normalized === "active") return "active";
    if (normalized === "refused") return "refused";
    if (normalized === "used") return "used";
    if (normalized === "expired") return "expired";
    return "pending_payment";
  };
  const buildGiftCardCode = () => `JBGC-${crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}`;
  const serializeGiftCardRow = (row) => ({
    id: row.id,
    customer_id: row.customer_id,
    code: row.code,
    amount: Number(row.amount || 0),
    currency: row.currency || "EUR",
    recipient_name: row.recipient_name || "",
    recipient_email: row.recipient_email || "",
    message: row.message || "",
    theme_style: normalizeGiftCardTheme(row.theme_style || "glam_chic"),
    payment_method: row.payment_method || "bank_transfer",
    payment_reference: row.payment_reference || "",
    bank_account_snapshot: row.bank_account_snapshot || "",
    bank_name_snapshot: row.bank_name_snapshot || "",
    status: sanitizeGiftCardStatus(row.status),
    admin_note: row.admin_note || "",
    created_at: row.created_at,
    updated_at: row.updated_at,
    validated_at: row.validated_at || "",
    expires_at: row.expires_at || "",
    used_at: row.used_at || "",
    expiration_reminder_sent_at: row.expiration_reminder_sent_at || "",
  });
  const refreshExpiredGiftCards = () => {
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE gift_cards
      SET status = 'expired', updated_at = ?
      WHERE status = 'active' AND expires_at != '' AND expires_at <= ?
    `).run(now, now);
  };
  const getCustomerGiftCards = (customerId) => {
    refreshExpiredGiftCards();
    return db.prepare("SELECT * FROM gift_cards WHERE customer_id = ? ORDER BY created_at DESC").all(customerId).map(serializeGiftCardRow);
  };
  const createCustomerGiftCard = ({ customerId, amount, recipientName, recipientEmail, message, themeStyle }) => {
    const normalizedAmount = Number(amount || 0);
    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      throw new Error("Montant invalide");
    }
    const payment = getGiftCardPaymentDetails();
    if (!payment.bank_account) {
      throw new Error("Le numero de compte cheque cadeau n'est pas configure");
    }
    const now = new Date().toISOString();
    const code = buildGiftCardCode();
    const id = crypto.randomUUID();
    const paymentReference = `CADEAU-${id.slice(0, 8).toUpperCase()}`;
    const normalizedThemeStyle = normalizeGiftCardTheme(themeStyle);
    db.prepare(`
      INSERT INTO gift_cards (
        id, customer_id, code, amount, currency, recipient_name, recipient_email, message, theme_style,
        payment_method, payment_reference, bank_account_snapshot, bank_name_snapshot,
        status, admin_note, created_at, updated_at, validated_at, expires_at, used_at, expiration_reminder_sent_at
      ) VALUES (?, ?, ?, ?, 'EUR', ?, ?, ?, ?, 'bank_transfer', ?, ?, ?, 'pending_payment', '', ?, ?, '', '', '', '')
    `).run(
      id,
      customerId,
      code,
      Number(normalizedAmount.toFixed(2)),
      String(recipientName || "").trim(),
      String(recipientEmail || "").trim().toLowerCase(),
      String(message || "").trim(),
      normalizedThemeStyle,
      paymentReference,
      payment.bank_account,
      payment.bank_name,
      now,
      now,
    );
    return serializeGiftCardRow(db.prepare("SELECT * FROM gift_cards WHERE id = ?").get(id));
  };
  const getAdminGiftCards = () => {
    refreshExpiredGiftCards();
    return db.prepare(`
      SELECT gift_cards.*, customers.first_name AS customer_first_name, customers.last_name AS customer_last_name, customers.email AS customer_email
      FROM gift_cards
      JOIN customers ON customers.id = gift_cards.customer_id
      ORDER BY gift_cards.created_at DESC
    `).all().map((row) => ({
      ...serializeGiftCardRow(row),
      customer_name: `${row.customer_first_name || ""} ${row.customer_last_name || ""}`.trim(),
      customer_email: row.customer_email || "",
    }));
  };
  const getGiftCardWithCustomer = (giftCardId) => db.prepare(`
    SELECT gift_cards.*, customers.first_name AS customer_first_name, customers.last_name AS customer_last_name, customers.email AS customer_email
    FROM gift_cards
    JOIN customers ON customers.id = gift_cards.customer_id
    WHERE gift_cards.id = ?
  `).get(giftCardId);
  const updateGiftCardStatus = (giftCardId, status, adminNote = "") => {
    const existing = db.prepare("SELECT * FROM gift_cards WHERE id = ?").get(giftCardId);
    if (!existing) return null;
    refreshExpiredGiftCards();
    const fresh = db.prepare("SELECT * FROM gift_cards WHERE id = ?").get(giftCardId);
    const currentStatus = sanitizeGiftCardStatus(fresh.status);
    const target = sanitizeGiftCardStatus(status);
    if (currentStatus === "expired" && target !== "expired") {
      throw new Error("Cheque cadeau expire: statut non modifiable");
    }
    const now = new Date();
    const nowIso = now.toISOString();
    let validatedAt = fresh.validated_at || "";
    let expiresAt = fresh.expires_at || "";
    let usedAt = fresh.used_at || "";
    if (target === "active") {
      validatedAt = nowIso;
      expiresAt = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 365).toISOString();
      usedAt = "";
    } else if (target === "used") {
      if (currentStatus !== "active") {
        throw new Error("Un cheque cadeau doit etre actif avant d'etre marque comme utilise");
      }
      usedAt = nowIso;
      if (!expiresAt) {
        expiresAt = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 365).toISOString();
      }
      if (!validatedAt) validatedAt = nowIso;
    } else if (target === "refused" || target === "pending_payment") {
      validatedAt = "";
      expiresAt = "";
      usedAt = "";
    }
    db.prepare(`
      UPDATE gift_cards
      SET status = ?, admin_note = ?, updated_at = ?, validated_at = ?, expires_at = ?, used_at = ?, expiration_reminder_sent_at = ?
      WHERE id = ?
    `).run(target, String(adminNote || "").trim(), nowIso, validatedAt, expiresAt, usedAt, "", giftCardId);
    return {
      previous_status: currentStatus,
      card: serializeGiftCardRow(db.prepare("SELECT * FROM gift_cards WHERE id = ?").get(giftCardId)),
    };
  };
  const processGiftCardExpiryReminders = async () => {
    const now = Date.now();
    const limitDate = new Date(now + (1000 * 60 * 60 * 24 * 30)).toISOString();
    const rows = db.prepare(`
      SELECT gift_cards.*, customers.first_name AS customer_first_name, customers.last_name AS customer_last_name, customers.email AS customer_email
      FROM gift_cards
      JOIN customers ON customers.id = gift_cards.customer_id
      WHERE gift_cards.status = 'active'
        AND gift_cards.expires_at != ''
        AND gift_cards.expires_at > ?
        AND gift_cards.expires_at <= ?
        AND gift_cards.expiration_reminder_sent_at = ''
      ORDER BY gift_cards.expires_at ASC
      LIMIT 20
    `).all(new Date(now).toISOString(), limitDate);

    for (const row of rows) {
      const expiresAt = Date.parse(row.expires_at || "");
      const daysRemaining = Math.max(1, Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24)));
      try {
        await mailer.sendGiftCardExpiryReminderEmail({
          customer: {
            first_name: row.customer_first_name || "",
            last_name: row.customer_last_name || "",
            email: row.customer_email || "",
          },
          giftCard: serializeGiftCardRow(row),
          publicBaseUrl,
          daysRemaining,
        });
        db.prepare("UPDATE gift_cards SET expiration_reminder_sent_at = ?, updated_at = ? WHERE id = ?")
          .run(new Date().toISOString(), new Date().toISOString(), row.id);
      } catch (error) {
        console.warn("Gift card expiry reminder failed:", error instanceof Error ? error.message : error);
      }
    }
  };
  const deleteBookingLoyaltyTransactions = (bookingId) => {
    db.prepare("DELETE FROM loyalty_transactions WHERE booking_id = ?").run(bookingId);
  };
  const shouldRevokeBookingLoyalty = (snapshot) => {
    const bookingDate = normalizeDate(snapshot?.booking?.booking_date);
    if (!bookingDate) return false;
    const today = normalizeDate(new Date().toISOString());
    return bookingDate > today;
  };
  const awardBookingLoyaltyVisit = (snapshot) => {
    const customerId = snapshot?.booking?.customer_id;
    if (!customerId) return;
    const existing = db.prepare("SELECT id FROM loyalty_transactions WHERE booking_id = ? AND type = 'booking_confirmed'").get(snapshot.booking.id);
    if (existing) return;
    db.prepare(`
      INSERT INTO loyalty_transactions (id, customer_id, booking_id, points, type, description, created_at)
      VALUES (?, ?, ?, ?, 'booking_confirmed', ?, ?)
    `).run(
      crypto.randomUUID(),
      customerId,
      snapshot.booking.id,
      1,
      `Passage valide pour ${snapshot.service.category} - ${snapshot.service.name}`,
      new Date().toISOString(),
    );
  };
  const getCalDavStatus = () => ({
    enabled: calDav.enabled,
    synced_events: Number(db.prepare("SELECT COUNT(*) AS count FROM booking_calendar_events").get()?.count || 0),
    confirmed_bookings: Number(db.prepare("SELECT COUNT(*) AS count FROM bookings WHERE status = 'confirmed'").get()?.count || 0),
  });
  const createCustomerSession = (customerId) => {
    const token = createSessionToken(env.SESSION_SECRET);
    const now = new Date();
    db.prepare("INSERT INTO customer_sessions (id, customer_id, token_hash, created_at, expires_at) VALUES (?, ?, ?, ?, ?)")
      .run(
        crypto.randomUUID(),
        customerId,
        hashToken(token, env.SESSION_SECRET),
        now.toISOString(),
        new Date(now.getTime() + 1000 * 60 * 60 * 24 * 30).toISOString(),
      );
    return token;
  };
  const createCustomerAccount = ({ email, password, first_name, last_name, phone = "", marketing_consent = false }) => {
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const now = new Date().toISOString();
    const customer = {
      id: crypto.randomUUID(),
      email: normalizedEmail,
      password_hash: hashPassword(String(password || ""), env.SESSION_SECRET),
      first_name: String(first_name || "").trim(),
      last_name: String(last_name || "").trim(),
      phone: String(phone || "").trim(),
      marketing_consent: marketing_consent ? 1 : 0,
      deletion_requested_at: "",
      deletion_scheduled_for: "",
      deletion_requested_by: "",
      created_at: now,
      updated_at: now,
    };
    db.prepare(`
      INSERT INTO customers (id, email, password_hash, first_name, last_name, phone, marketing_consent, deletion_requested_at, deletion_scheduled_for, deletion_requested_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      customer.id,
      customer.email,
      customer.password_hash,
      customer.first_name,
      customer.last_name,
      customer.phone,
      customer.marketing_consent,
      customer.deletion_requested_at,
      customer.deletion_scheduled_for,
      customer.deletion_requested_by,
      customer.created_at,
      customer.updated_at,
    );
    return getCustomerProfile(customer.id);
  };
  const getAdminCustomers = () => {
    const customers = db.prepare("SELECT * FROM customers ORDER BY updated_at DESC").all();
    const bookingRows = db.prepare(`
      SELECT customer_id, booking_date, booking_time, status
      FROM bookings
      WHERE customer_id IS NOT NULL
      ORDER BY booking_date DESC, booking_time DESC
    `).all();
    const byCustomer = new Map();

    bookingRows.forEach((row) => {
      const list = byCustomer.get(row.customer_id) || [];
      list.push(row);
      byCustomer.set(row.customer_id, list);
    });

    const inactiveThreshold = new Date();
    inactiveThreshold.setDate(inactiveThreshold.getDate() - 120);

    return customers.map((customer) => {
      const bookings = byCustomer.get(customer.id) || [];
      const confirmedBookings = bookings.filter((booking) => booking.status === "confirmed");
      const lastBooking = bookings[0] || null;
      const lastConfirmedBooking = confirmedBookings[0] || null;
      const lastBookingAt = lastBooking ? `${lastBooking.booking_date}T${lastBooking.booking_time}:00` : "";
      const lastConfirmedBookingAt = lastConfirmedBooking ? `${lastConfirmedBooking.booking_date}T${lastConfirmedBooking.booking_time}:00` : "";
      const isInactive = !lastBookingAt || new Date(lastBookingAt) < inactiveThreshold;

      return {
        id: customer.id,
        email: customer.email,
        first_name: customer.first_name,
        last_name: customer.last_name,
        phone: customer.phone,
        marketing_consent: Boolean(customer.marketing_consent),
        trusted_no_deposit: Boolean(customer.trusted_no_deposit),
        deletion_requested_at: customer.deletion_requested_at || "",
        deletion_scheduled_for: customer.deletion_scheduled_for || "",
        deletion_requested_by: customer.deletion_requested_by || "",
        created_at: customer.created_at,
        updated_at: customer.updated_at,
        total_bookings: bookings.length,
        confirmed_bookings: confirmedBookings.length,
        pending_bookings: bookings.filter((booking) => booking.status === "pending").length,
        last_booking_at: lastBookingAt,
        last_confirmed_booking_at: lastConfirmedBookingAt,
        is_inactive: isInactive,
      };
    });
  };
  const updateCustomerTrust = (customerId, trusted) => {
    db.prepare("UPDATE customers SET trusted_no_deposit = ?, updated_at = ? WHERE id = ?")
      .run(trusted ? 1 : 0, new Date().toISOString(), customerId);
    return getCustomerProfile(customerId);
  };
  const clearCustomerDeletionRequest = (customerId) => {
    db.prepare(`
      UPDATE customers
      SET deletion_requested_at = '', deletion_scheduled_for = '', deletion_requested_by = '', updated_at = ?
      WHERE id = ?
    `).run(new Date().toISOString(), customerId);
    return getCustomerProfile(customerId);
  };
  const requestCustomerDeletion = (customerId, requestedBy = "admin") => {
    const now = new Date();
    const delayDays = requestedBy === "customer" ? 3 : 30;
    const scheduled = new Date(now.getTime() + (1000 * 60 * 60 * 24 * delayDays));
    db.prepare(`
      UPDATE customers
      SET deletion_requested_at = ?, deletion_scheduled_for = ?, deletion_requested_by = ?, updated_at = ?
      WHERE id = ?
    `).run(now.toISOString(), scheduled.toISOString(), requestedBy, now.toISOString(), customerId);
    return getCustomerProfile(customerId);
  };
  const deleteCustomerAccount = async (customerId) => {
    const customer = getCustomerRecord(customerId);
    if (!customer) return false;

    const bookingRows = db.prepare("SELECT id FROM bookings WHERE customer_id = ?").all(customerId);
    for (const row of bookingRows) {
      const event = getBookingCalendarEvent(row.id);
      if (event) {
        try {
          await calDav.deleteBookingEvent(event);
        } catch (error) {
          console.warn("Customer deletion calendar cleanup failed:", error instanceof Error ? error.message : error);
        }
      }
      deleteBookingCalendarEventRecord(row.id);
    }

    db.exec("BEGIN");
    try {
      db.prepare("DELETE FROM booking_action_tokens WHERE booking_id IN (SELECT id FROM bookings WHERE customer_id = ?)").run(customerId);
      db.prepare("DELETE FROM booking_calendar_events WHERE booking_id IN (SELECT id FROM bookings WHERE customer_id = ?)").run(customerId);
      db.prepare("DELETE FROM bookings WHERE customer_id = ?").run(customerId);
      db.prepare("DELETE FROM customer_sessions WHERE customer_id = ?").run(customerId);
      db.prepare("DELETE FROM customers WHERE id = ?").run(customerId);
      db.exec("COMMIT");
      return true;
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  };
  let lastCustomerDeletionSweepAt = 0;
  const purgeScheduledCustomerDeletions = async (force = false) => {
    const nowTs = Date.now();
    if (!force && nowTs - lastCustomerDeletionSweepAt < 60_000) return;
    lastCustomerDeletionSweepAt = nowTs;
    const dueCustomers = db.prepare(`
      SELECT id
      FROM customers
      WHERE deletion_scheduled_for != ''
        AND deletion_scheduled_for <= ?
    `).all(new Date().toISOString());

    for (const row of dueCustomers) {
      try {
        await deleteCustomerAccount(row.id);
      } catch (error) {
        console.warn("Scheduled customer deletion failed:", error instanceof Error ? error.message : error);
      }
    }
  };
  await purgeScheduledCustomerDeletions(true);
  const updateBookingDepositStatus = (bookingId, depositStatus, extra = {}) => {
    const current = getBookingWithService(bookingId);
    if (!current) return null;

    const updated = {
      deposit_status: depositStatus,
      deposit_paid_at: extra.deposit_paid_at ?? current.booking.deposit_paid_at ?? "",
      deposit_checkout_url: extra.deposit_checkout_url ?? current.booking.deposit_checkout_url ?? "",
      deposit_payment_id: extra.deposit_payment_id ?? current.booking.deposit_payment_id ?? "",
      deposit_method: extra.deposit_method ?? current.booking.deposit_method ?? "none",
    };

    db.prepare(`
      UPDATE bookings
      SET deposit_status = ?, deposit_paid_at = ?, deposit_checkout_url = ?, deposit_payment_id = ?, deposit_method = ?, updated_at = ?
      WHERE id = ?
    `).run(
      updated.deposit_status,
      updated.deposit_paid_at,
      updated.deposit_checkout_url,
      updated.deposit_payment_id,
      updated.deposit_method,
      new Date().toISOString(),
      bookingId,
    );

    return getBookingWithService(bookingId);
  };
  const updateBookingBalanceStatus = (bookingId, balanceStatus, extra = {}) => {
    const current = getBookingWithService(bookingId);
    if (!current) return null;

    const updated = {
      balance_payment_status: balanceStatus,
      balance_paid_at: extra.balance_paid_at ?? current.booking.balance_paid_at ?? "",
      balance_checkout_url: extra.balance_checkout_url ?? current.booking.balance_checkout_url ?? "",
      balance_payment_id: extra.balance_payment_id ?? current.booking.balance_payment_id ?? "",
    };

    db.prepare(`
      UPDATE bookings
      SET balance_payment_status = ?, balance_paid_at = ?, balance_checkout_url = ?, balance_payment_id = ?, updated_at = ?
      WHERE id = ?
    `).run(
      updated.balance_payment_status,
      updated.balance_paid_at,
      updated.balance_checkout_url,
      updated.balance_payment_id,
      new Date().toISOString(),
      bookingId,
    );

    return getBookingWithService(bookingId);
  };
  const buildBookingBalanceAmount = (snapshot) => {
    const servicePrice = Number(snapshot?.service?.price || 0);
    const paidDeposit = snapshot?.booking?.deposit_status === "paid" ? Number(snapshot?.booking?.deposit_amount || 0) : 0;
    return Math.max(0, Number((servicePrice - paidDeposit).toFixed(2)));
  };
  const buildBalanceQrCodeUrl = (checkoutUrl) => `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(checkoutUrl)}`;
  const createBookingBalancePayment = async (bookingId) => {
    const snapshot = getBookingWithService(bookingId);
    if (!snapshot) {
      throw new Error("Rendez-vous introuvable");
    }
    if (snapshot.booking.balance_payment_status === "paid") {
      throw new Error("Le solde de cette prestation est deja regle.");
    }

    const settings = getPaymentSettings();
    if (!settings.enabled) {
      throw new Error("Le module d'acompte est desactive.");
    }

    const amountValue = buildBookingBalanceAmount(snapshot);
    if (amountValue <= 0) {
      throw new Error("Aucun solde restant a encaisser.");
    }

    const mollieClient = getMollieClient();
    if (!mollieClient.enabled) {
      throw new Error("Mollie n'est pas configure.");
    }

    const payment = await mollieClient.createPayment({
      amountValue,
      description: `Solde Just Beauty - ${snapshot.booking.client_name} - ${snapshot.service.category} - ${snapshot.service.name}`,
      redirectUrl: `${publicBaseUrl}/mon-compte`,
      webhookUrl: `${apiPublicBaseUrl}/api/payments/mollie/webhook`,
      metadata: {
        bookingId: snapshot.booking.id,
        customerId: snapshot.booking.customer_id,
        serviceId: snapshot.service.id,
        paymentKind: "balance",
      },
    });

    const normalizedStatus = normalizeMolliePaymentStatus(payment?.status);
    const updated = updateBookingBalanceStatus(bookingId, normalizedStatus, {
      balance_payment_id: payment?.id || "",
      balance_checkout_url: normalizedStatus === "open" ? payment?._links?.checkout?.href || "" : "",
      balance_paid_at: normalizedStatus === "paid" ? new Date().toISOString() : "",
    });

    return {
      snapshot: updated || snapshot,
      payment,
      amountValue,
      checkoutUrl: payment?._links?.checkout?.href || "",
      qrCodeUrl: payment?._links?.checkout?.href ? buildBalanceQrCodeUrl(payment._links.checkout.href) : "",
    };
  };
  const finalizePaidDepositBooking = async (bookingId, payment = null) => {
    const current = getBookingWithService(bookingId);
    if (!current) return null;
    if (current.booking.deposit_status === "paid" && current.booking.deposit_paid_at) {
      return current;
    }

    const updated = updateBookingDepositStatus(bookingId, "paid", {
      deposit_paid_at: new Date().toISOString(),
      deposit_payment_id: payment?.id || current.booking.deposit_payment_id || "",
      deposit_checkout_url: "",
      deposit_method: "mollie",
    });

    if (!updated) return null;

    try {
      const actionLinks = createBookingActionLinks(updated.booking.id);
      await sendBookingCreatedNotifications({ booking: updated.booking, service: updated.service, actionLinks });
    } catch (error) {
      console.warn("Booking activation notification failed:", error instanceof Error ? error.message : error);
    }

    return updated;
  };
  const getAuthCustomer = (req) => {
    const token = getBearerToken(req);
    if (!token) return null;

    const sessions = db.prepare(`
      SELECT customer_sessions.id, customer_sessions.customer_id, customer_sessions.token_hash, customer_sessions.expires_at
      FROM customer_sessions
    `).all();

    const session = sessions.find((entry) => {
      if (Date.parse(entry.expires_at) < Date.now()) return false;
      return verifyToken(token, entry.token_hash, env.SESSION_SECRET);
    });
    return session ? getCustomerProfile(session.customer_id) : null;
  };

  const requireAdmin = (req, res) => {
    const send = makeJsonHelpers(env, req);
    const admin = getAuthAdmin(req);
    if (!admin) {
      send.json(res, 401, { error: "Unauthorized" });
      return null;
    }
    return admin;
  };
  const requireCustomer = (req, res) => {
    const send = makeJsonHelpers(env, req);
    const customer = getAuthCustomer(req);
    if (!customer) {
      send.json(res, 401, { error: "Unauthorized" });
      return null;
    }
    return customer;
  };

  sendTomorrowBookingReminders().catch((error) => {
    console.warn("Initial booking reminder check failed:", error instanceof Error ? error.message : error);
  });
  const bookingReminderInterval = setInterval(() => {
    sendTomorrowBookingReminders().catch((error) => {
      console.warn("Scheduled booking reminder check failed:", error instanceof Error ? error.message : error);
    });
  }, 1000 * 60 * 60);
  if (typeof bookingReminderInterval.unref === "function") bookingReminderInterval.unref();

  return createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || `localhost:${env.PORT}`}`);
    const pathname = url.pathname;
    const send = makeJsonHelpers(env, req);

    try {
      await purgeScheduledCustomerDeletions();
      refreshExpiredGiftCards();
      await processGiftCardExpiryReminders();
      if (req.method === "OPTIONS") {
        send.empty(res);
        return;
      }

      if (pathname.startsWith("/uploads/")) {
        if (!canServeProtectedUpload(req)) {
          send.json(res, 403, { error: "Hotlink non autorise" });
          return;
        }
        const relative = decodeURIComponent(pathname.replace("/uploads/", ""));
        const safePath = path.normalize(relative).replace(/^(\.\.[/\\])+/, "");
        const filePath = path.join(UPLOAD_DIR, safePath);
        if (!filePath.startsWith(UPLOAD_DIR)) {
          send.json(res, 403, { error: "Forbidden" });
          return;
        }
        try {
          await fs.access(filePath);
          const relativeUrl = `/uploads/${safePath.replace(/\\/g, "/")}`;
          const protectionAsset = db.prepare(`
            SELECT media_protection_assets.displayed_sha256
            FROM media_protection_assets
            JOIN gallery_images ON gallery_images.id = media_protection_assets.gallery_image_id
            WHERE gallery_images.url = ?
          `).get(relativeUrl);
          send.file(res, filePath, {
            "Content-Disposition": "inline",
            "X-Content-Source": "justbeauty-gallery",
            ...(protectionAsset?.displayed_sha256 ? { "X-Asset-Fingerprint": protectionAsset.displayed_sha256 } : {}),
          });
        } catch {
          send.json(res, 404, { error: "File not found" });
        }
        return;
      }

      if (pathname === "/api/health" && req.method === "GET") {
        send.json(res, 200, { ok: true });
        return;
      }

      if (pathname === "/api/telegram/webhook" && req.method === "POST") {
        const providedSecret = String(req.headers["x-telegram-bot-api-secret-token"] || "").trim();
        if (telegramWebhookSecretToken && providedSecret !== telegramWebhookSecretToken) {
          send.json(res, 403, { error: "Forbidden" });
          return;
        }

        const payload = await readBody(req);
        const actionPayload = parseTelegramWebhookAction(payload);
        if (!actionPayload) {
          send.json(res, 200, { ok: true, ignored: true });
          return;
        }

        if (!isAdminTelegramChat(actionPayload.chatId)) {
          if (actionPayload.callbackQueryId) {
            try {
              await telegramNotifier.answerCallbackQuery({
                callbackQueryId: actionPayload.callbackQueryId,
                text: "Action non autorisee",
                showAlert: true,
              });
            } catch (error) {
              console.warn("Telegram callback answer failed:", error instanceof Error ? error.message : error);
            }
          }
          send.json(res, 200, { ok: true, ignored: true });
          return;
        }

        const result = await applyTelegramBookingAction(actionPayload);
        const callbackText = result.ok
          ? "Action recue et effectuee"
          : result.reason === "already_processed"
            ? `Deja ${getBookingStatusLabel(result.status)}`
            : "Reservation introuvable";

        if (actionPayload.callbackQueryId) {
          try {
            await telegramNotifier.answerCallbackQuery({
              callbackQueryId: actionPayload.callbackQueryId,
              text: callbackText,
              showAlert: !result.ok,
            });
          } catch (error) {
            console.warn("Telegram callback answer failed:", error instanceof Error ? error.message : error);
          }

          if (result.ok || result.reason === "already_processed") {
            try {
              await telegramNotifier.clearInlineKeyboard({
                chatId: actionPayload.chatId,
                messageId: actionPayload.messageId,
              });
            } catch (error) {
              console.warn("Telegram keyboard cleanup failed:", error instanceof Error ? error.message : error);
            }
          }
        }

        try {
          await telegramNotifier.sendActionResult({
            chatId: actionPayload.chatId,
            bookingId: result.bookingId || actionPayload.bookingId,
            action: actionPayload.action,
            status: result.status || "",
            success: Boolean(result.ok),
            reason: result.reason === "already_processed"
              ? "deja traitee"
              : result.reason === "booking_not_found"
                ? "introuvable"
                : "",
          });
        } catch (error) {
          console.warn("Telegram action result message failed:", error instanceof Error ? error.message : error);
        }

        send.json(res, 200, { ok: true, applied: result.ok });
        return;
      }

      if (pathname === "/api/payments/mollie/webhook" && req.method === "POST") {
        const rawBody = await readTextBody(req);
        const params = new URLSearchParams(rawBody);
        const paymentId = params.get("id") || "";

        const mollieClient = getMollieClient();
        if (paymentId && mollieClient.enabled) {
          try {
            const payment = await mollieClient.getPayment(paymentId);
            const bookingId = String(payment?.metadata?.bookingId || "");
            const paymentKind = String(payment?.metadata?.paymentKind || "deposit");
            if (bookingId) {
              const status = normalizeMolliePaymentStatus(payment.status);
              if (paymentKind === "balance") {
                updateBookingBalanceStatus(bookingId, status, {
                  balance_payment_id: payment.id || paymentId,
                  balance_checkout_url: status === "open" ? payment?._links?.checkout?.href || "" : "",
                  balance_paid_at: status === "paid" ? new Date().toISOString() : "",
                });
              } else if (status === "paid") {
                await finalizePaidDepositBooking(bookingId, payment);
              } else {
                updateBookingDepositStatus(bookingId, status, {
                  deposit_payment_id: payment.id || paymentId,
                  deposit_checkout_url: status === "open" ? undefined : "",
                  deposit_method: "mollie",
                });
              }
            }
          } catch (error) {
            console.warn("Mollie webhook failed:", error instanceof Error ? error.message : error);
          }
        }

        send.empty(res);
        return;
      }

      if (pathname.match(/^\/api\/bookings\/payment-status\/[^/]+$/) && req.method === "GET") {
        const bookingId = pathname.split("/").pop();
        let snapshot = getBookingWithService(bookingId);
        if (!snapshot || !snapshot.booking.deposit_required || snapshot.booking.deposit_method !== "mollie") {
          send.json(res, 404, { error: "Paiement introuvable" });
          return;
        }

        if (snapshot.booking.deposit_status !== "paid" && snapshot.booking.deposit_payment_id) {
          const mollieClient = getMollieClient();
          if (mollieClient.enabled) {
            try {
              const payment = await mollieClient.getPayment(snapshot.booking.deposit_payment_id);
              const status = normalizeMolliePaymentStatus(payment?.status);
              if (status === "paid") {
                snapshot = await finalizePaidDepositBooking(bookingId, payment);
              } else {
                snapshot = updateBookingDepositStatus(bookingId, status, {
                  deposit_payment_id: payment?.id || snapshot.booking.deposit_payment_id,
                  deposit_checkout_url: status === "open" ? snapshot.booking.deposit_checkout_url : "",
                  deposit_method: "mollie",
                });
              }
            } catch (error) {
              console.warn("Mollie status refresh failed:", error instanceof Error ? error.message : error);
            }
          }
        }

        snapshot = getBookingWithService(bookingId);
        if (!snapshot) {
          send.json(res, 404, { error: "Paiement introuvable" });
          return;
        }

        send.json(res, 200, {
          booking: snapshot.booking,
          service: snapshot.service,
          payment_status: snapshot.booking.deposit_status,
          can_retry: ["failed", "cancelled", "expired"].includes(snapshot.booking.deposit_status),
          can_cancel: snapshot.booking.deposit_status !== "paid",
        });
        return;
      }

      if (pathname.match(/^\/api\/bookings\/payment-status\/[^/]+\/retry$/) && req.method === "POST") {
        const bookingId = pathname.split("/")[4];
        const snapshot = getBookingWithService(bookingId);
        if (!snapshot || !snapshot.booking.deposit_required) {
          send.json(res, 404, { error: "Paiement introuvable" });
          return;
        }
        if (snapshot.booking.deposit_status === "paid") {
          send.json(res, 400, { error: "Ce paiement est deja valide." });
          return;
        }
        if (!isTimeSlotAvailable(snapshot.booking.booking_date, snapshot.booking.booking_time, snapshot.service.duration_minutes, snapshot.booking.id)) {
          send.json(res, 409, { error: "Ce creneau n'est plus disponible." });
          return;
        }

        const mollieClient = getMollieClient();
        if (!mollieClient.enabled) {
          send.json(res, 400, { error: "Le paiement Mollie n'est pas configure pour le moment." });
          return;
        }

        const payment = await mollieClient.createPayment({
          amountValue: snapshot.booking.deposit_amount,
          description: `Acompte Just Beauty - ${snapshot.booking.client_name} - ${snapshot.service.category} - ${snapshot.service.name}`,
          redirectUrl: `${publicBaseUrl}/rendez-vous?payment=return&booking=${encodeURIComponent(snapshot.booking.id)}`,
          webhookUrl: `${apiPublicBaseUrl}/api/payments/mollie/webhook`,
          metadata: {
            bookingId: snapshot.booking.id,
            customerId: snapshot.booking.customer_id,
            serviceId: snapshot.service.id,
          },
        });

        const updated = updateBookingDepositStatus(snapshot.booking.id, normalizeMolliePaymentStatus(payment?.status), {
          deposit_payment_id: payment?.id || "",
          deposit_checkout_url: payment?._links?.checkout?.href || "",
          deposit_paid_at: "",
          deposit_method: "mollie",
        });

        send.json(res, 200, {
          booking: updated?.booking || snapshot.booking,
          service: updated?.service || snapshot.service,
          payment_status: updated?.booking.deposit_status || "open",
          can_retry: false,
          can_cancel: true,
        });
        return;
      }

      if (pathname.match(/^\/api\/bookings\/payment-status\/[^/]+\/cancel$/) && req.method === "POST") {
        const bookingId = pathname.split("/")[4];
        const snapshot = getBookingWithService(bookingId);
        if (!snapshot || !snapshot.booking.deposit_required) {
          send.json(res, 404, { error: "Paiement introuvable" });
          return;
        }
        if (snapshot.booking.deposit_status === "paid") {
          send.json(res, 400, { error: "Ce paiement a deja ete valide." });
          return;
        }

        db.prepare("DELETE FROM bookings WHERE id = ?").run(snapshot.booking.id);
        send.json(res, 200, { ok: true });
        return;
      }

      if (pathname.startsWith("/api/booking-actions/") && req.method === "GET") {
        const token = decodeURIComponent(pathname.split("/").pop() || "");
        const action = url.searchParams.get("action");
        const tokenRecord = findBookingActionToken(token);

        if (!tokenRecord || (action !== "confirmed" && action !== "refused")) {
          send.html(res, 400, renderActionPage({
            title: "Lien indisponible",
            message: "Ce lien est invalide ou a expire. Merci de passer par l'administration.",
            actionLabel: { href: `${publicBaseUrl}/admin/login`, label: "Ouvrir l'administration" },
          }));
          return;
        }

        const snapshot = getBookingWithService(tokenRecord.booking_id);
        if (!snapshot) {
          send.html(res, 404, renderActionPage({
            title: "Reservation introuvable",
            message: "Cette reservation n'existe plus.",
            actionLabel: { href: publicBaseUrl, label: "Retour au site" },
          }));
          return;
        }

        await updateBookingStatus(tokenRecord.booking_id, action);

        send.html(res, 200, renderActionPage({
          title: action === "confirmed" ? "Rendez-vous confirme" : "Rendez-vous refuse",
          message: action === "confirmed"
            ? "La cliente a ete notifiee automatiquement par email."
            : "La cliente a ete notifiee et invitee a reprogrammer son rendez-vous.",
          actionLabel: { href: `${publicBaseUrl}/admin/login`, label: "Ouvrir l'administration" },
        }));
        return;
      }

      if (pathname === "/api/customer/auth/register" && req.method === "POST") {
        const body = await readBody(req);
        const email = String(body.email || "").trim().toLowerCase();
        const password = String(body.password || "");
        const firstName = String(body.first_name || "").trim();
        const lastName = String(body.last_name || "").trim();
        const phone = String(body.phone || "").trim();
        const marketingConsent = body.marketing_consent ? 1 : 0;

        if (!email || !password || !firstName || !lastName) {
          send.json(res, 400, { error: "Informations client manquantes" });
          return;
        }
        if (password.length < 10) {
          send.json(res, 400, { error: "Le mot de passe doit contenir au moins 10 caracteres" });
          return;
        }
        if (getCustomerByEmail(email)) {
          send.json(res, 400, { error: "Un compte existe deja avec cet email" });
          return;
        }

        const now = new Date().toISOString();
        const customerId = crypto.randomUUID();
        db.prepare(`
          INSERT INTO customers (id, email, password_hash, first_name, last_name, phone, marketing_consent, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          customerId,
          email,
          hashPassword(password, env.SESSION_SECRET),
          firstName,
          lastName,
          phone,
          marketingConsent,
          now,
          now,
        );

        const token = createSessionToken(env.SESSION_SECRET);
        db.prepare("INSERT INTO customer_sessions (id, customer_id, token_hash, created_at, expires_at) VALUES (?, ?, ?, ?, ?)")
          .run(
            crypto.randomUUID(),
            customerId,
            hashToken(token, env.SESSION_SECRET),
            now,
            new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
          );

        send.json(res, 201, { token, customer: getCustomerProfile(customerId) });
        return;
      }

      if (pathname === "/api/customer/auth/login" && req.method === "POST") {
        const body = await readBody(req);
        const customer = getCustomerByEmail(body.email);
        if (!customer || customer.password_hash !== hashPassword(String(body.password || ""), env.SESSION_SECRET)) {
          send.json(res, 401, { error: "Identifiants invalides" });
          return;
        }

        const token = createSessionToken(env.SESSION_SECRET);
        const now = new Date().toISOString();
        db.prepare("INSERT INTO customer_sessions (id, customer_id, token_hash, created_at, expires_at) VALUES (?, ?, ?, ?, ?)")
          .run(
            crypto.randomUUID(),
            customer.id,
            hashToken(token, env.SESSION_SECRET),
            now,
            new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
          );

        send.json(res, 200, { token, customer: getCustomerProfile(customer.id) });
        return;
      }

      if (pathname === "/api/customer/auth/me" && req.method === "GET") {
        const customer = requireCustomer(req, res);
        if (!customer) return;
        send.json(res, 200, { customer });
        return;
      }

      if (pathname === "/api/customer/auth/logout" && req.method === "POST") {
        const token = getBearerToken(req);
        if (token) {
          db.prepare("DELETE FROM customer_sessions WHERE token_hash = ?").run(hashToken(token, env.SESSION_SECRET));
        }
        send.empty(res);
        return;
      }

      if (pathname === "/api/customer/bookings" && req.method === "GET") {
        const customer = requireCustomer(req, res);
        if (!customer) return;
        send.json(res, 200, getCustomerBookings(customer.id));
        return;
      }

      if (pathname === "/api/customer/loyalty" && req.method === "GET") {
        const customer = requireCustomer(req, res);
        if (!customer) return;
        const loyalty = buildCustomerLoyaltySummary(customer.loyalty_completed_visits);
        send.json(res, 200, {
          summary: loyalty,
          transactions: getCustomerLoyaltyTransactions(customer.id),
        });
        return;
      }

      if (pathname === "/api/payment-settings" && req.method === "GET") {
        const customer = getAuthCustomer(req);
        send.json(res, 200, {
          ...getPaymentSettings(),
          trusted_customer: Boolean(customer?.trusted_no_deposit),
        });
        return;
      }

      if (pathname === "/api/admin/caldav/status" && req.method === "GET") {
        if (!requireAdmin(req, res)) return;
        send.json(res, 200, getCalDavStatus());
        return;
      }

      if (pathname === "/api/admin/payment-settings" && req.method === "GET") {
        if (!requireAdmin(req, res)) return;
        send.json(res, 200, getPaymentSettings({ includeSecrets: true }));
        return;
      }

      if (pathname === "/api/admin/payment-settings" && req.method === "PUT") {
        if (!requireAdmin(req, res)) return;
        const body = await readBody(req);
        const values = {
          payments_enabled: body.enabled ? "1" : "0",
          payment_deposit_rate: String(body.deposit_rate ?? getPaymentSettings().deposit_rate),
          payment_deposit_threshold: String(body.deposit_threshold ?? getPaymentSettings().deposit_threshold),
          payment_allow_bank_transfer: body.allow_bank_transfer === false ? "0" : "1",
          payment_bank_account: String(body.bank_account ?? ""),
          payment_bank_name: String(body.bank_name ?? "Just Beauty"),
          payment_bank_reference_prefix: String(body.bank_reference_prefix ?? "ACOMPTE"),
          payment_mollie_mode: body.mollie_mode === "live" ? "live" : "test",
          payment_mollie_test_api_key: String(body.mollie_test_api_key ?? getMollieApiKey("test")),
          payment_mollie_live_api_key: String(body.mollie_live_api_key ?? getMollieApiKey("live")),
          payment_mollie_api_key: String(
            body.mollie_mode === "live"
              ? (body.mollie_live_api_key ?? getMollieApiKey("live"))
              : (body.mollie_test_api_key ?? getMollieApiKey("test")),
          ),
        };
        const now = new Date().toISOString();
        const upsert = db.prepare(`
          INSERT INTO site_content (id, key, value, updated_at)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
        `);
        Object.entries(values).forEach(([key, value]) => upsert.run(crypto.randomUUID(), key, value, now));
        refreshAllContentFingerprints();
        send.json(res, 200, getPaymentSettings({ includeSecrets: true }));
        return;
      }

      if (pathname === "/api/admin/payment-settings/test-mollie" && req.method === "POST") {
        if (!requireAdmin(req, res)) return;
        const body = await readBody(req);
        const requestedMode = body.mollie_mode === "live" ? "live" : "test";
        const apiKey = String(
          body.mollie_api_key
            ?? (requestedMode === "live" ? body.mollie_live_api_key : body.mollie_test_api_key)
            ?? getMollieApiKey(requestedMode),
        ).trim();
        const mollieClient = createMollieClient(apiKey);
        if (!mollieClient.enabled) {
          send.json(res, 400, { error: "Cle API Mollie manquante" });
          return;
        }
        const result = await mollieClient.testConnection();
        send.json(res, 200, { ...result, mode: requestedMode });
        return;
      }

      if (pathname === "/api/auth/login" && req.method === "POST") {
        const body = await readBody(req);
        const admin = db.prepare("SELECT * FROM admins WHERE email = ?").get(body.email);
        if (!admin || admin.password_hash !== hashPassword(body.password || "", env.SESSION_SECRET)) {
          send.json(res, 401, { error: "Invalid credentials" });
          return;
        }

        const token = createSessionToken(env.SESSION_SECRET);
        const now = new Date();
        db.prepare("INSERT INTO sessions (id, admin_id, token_hash, created_at, expires_at) VALUES (?, ?, ?, ?, ?)")
          .run(
            crypto.randomUUID(),
            admin.id,
            hashToken(token, env.SESSION_SECRET),
            now.toISOString(),
            new Date(now.getTime() + 1000 * 60 * 60 * 24 * 7).toISOString(),
          );

        send.json(res, 200, {
          token,
          user: { id: admin.id, email: admin.email, name: admin.name },
          isAdmin: true,
          mustChangePassword: matchesBootstrapPassword(admin.password_hash, env),
        });
        return;
      }

      if (pathname === "/api/auth/me" && req.method === "GET") {
        const admin = requireAdmin(req, res);
        if (!admin) return;
        const adminRecord = getAdminRecord(admin.id);
        send.json(res, 200, {
          user: admin,
          isAdmin: true,
          mustChangePassword: adminRecord ? matchesBootstrapPassword(adminRecord.password_hash, env) : false,
        });
        return;
      }

      if (pathname === "/api/auth/change-password" && req.method === "POST") {
        const admin = requireAdmin(req, res);
        if (!admin) return;
        const adminRecord = getAdminRecord(admin.id);
        if (!adminRecord) {
          send.json(res, 404, { error: "Admin not found" });
          return;
        }

        const body = await readBody(req);
        const currentHash = hashPassword(String(body.currentPassword || ""), env.SESSION_SECRET);
        if (currentHash !== adminRecord.password_hash) {
          send.json(res, 400, { error: "Current password is incorrect" });
          return;
        }

        const newPassword = String(body.newPassword || "");
        if (newPassword.length < 10) {
          send.json(res, 400, { error: "New password must contain at least 10 characters" });
          return;
        }

        db.prepare("UPDATE admins SET password_hash = ? WHERE id = ?").run(hashPassword(newPassword, env.SESSION_SECRET), admin.id);
        send.json(res, 200, { ok: true, mustChangePassword: false });
        return;
      }

      if (pathname === "/api/auth/logout" && req.method === "POST") {
        const token = getBearerToken(req);
        if (token) {
          db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashToken(token, env.SESSION_SECRET));
        }
        send.empty(res);
        return;
      }

      if (pathname === "/api/customers/register" && req.method === "POST") {
        const body = await readBody(req);
        const email = String(body.email || "").trim().toLowerCase();
        const password = String(body.password || "");
        const firstName = String(body.first_name || "").trim();
        const lastName = String(body.last_name || "").trim();
        const phone = String(body.phone || "").trim();
        const marketingConsent = Boolean(body.marketing_consent);

        if (!email || !password || !firstName || !lastName) {
          send.json(res, 400, { error: "Informations d'inscription manquantes" });
          return;
        }
        if (password.length < 10) {
          send.json(res, 400, { error: "Le mot de passe doit contenir au moins 10 caracteres" });
          return;
        }
        if (getCustomerByEmail(email)) {
          send.json(res, 400, { error: "Un compte existe deja pour cet email" });
          return;
        }

        const customer = createCustomerAccount({
          email,
          password,
          first_name: firstName,
          last_name: lastName,
          phone,
          marketing_consent: marketingConsent,
        });
        const token = createCustomerSession(customer.id);
        send.json(res, 201, { token, user: customer });
        return;
      }

      if (pathname === "/api/customers/login" && req.method === "POST") {
        const body = await readBody(req);
        const email = String(body.email || "").trim().toLowerCase();
        const password = String(body.password || "");
        const customer = getCustomerByEmail(email);
        if (!customer || customer.password_hash !== hashPassword(password, env.SESSION_SECRET)) {
          send.json(res, 401, { error: "Identifiants invalides" });
          return;
        }
        const token = createCustomerSession(customer.id);
        send.json(res, 200, { token, user: getCustomerProfile(customer.id) });
        return;
      }

      if (pathname === "/api/customers/me" && req.method === "GET") {
        const customer = requireCustomer(req, res);
        if (!customer) return;
        send.json(res, 200, {
          user: customer,
          bookings: getCustomerBookings(customer.id),
          loyaltyTransactions: getCustomerLoyaltyTransactions(customer.id),
          giftCards: getCustomerGiftCards(customer.id),
          giftCardPaymentDetails: getGiftCardPaymentDetails(),
        });
        return;
      }

      if (pathname === "/api/customers/gift-cards" && req.method === "POST") {
        const customer = requireCustomer(req, res);
        if (!customer) return;
        const body = await readBody(req);
        try {
          const card = createCustomerGiftCard({
            customerId: customer.id,
            amount: body.amount,
            recipientName: body.recipient_name,
            recipientEmail: body.recipient_email,
            message: body.message,
            themeStyle: body.theme_style,
          });
          try {
            await mailer.sendGiftCardRequestConfirmationEmail({
              customer,
              giftCard: card,
              paymentDetails: getGiftCardPaymentDetails(),
              publicBaseUrl,
            });
          } catch (error) {
            console.warn("Gift card request confirmation email failed:", error instanceof Error ? error.message : error);
          }
          send.json(res, 201, {
            gift_card: card,
            payment_details: getGiftCardPaymentDetails(),
          });
        } catch (error) {
          send.json(res, 400, { error: error instanceof Error ? error.message : "Impossible de creer le cheque cadeau" });
        }
        return;
      }

      if (pathname === "/api/customers/delete" && req.method === "POST") {
        const customer = requireCustomer(req, res);
        if (!customer) return;
        const customerRecord = getCustomerRecord(customer.id);
        const updated = requestCustomerDeletion(customer.id, "customer");
        try {
          await mailer.sendCustomerDeletionScheduledEmail({
            customer: { ...customerRecord, deletion_requested_by: "customer" },
            scheduledFor: updated?.deletion_scheduled_for || "",
            publicBaseUrl,
          });
        } catch (error) {
          console.warn("Customer self-deletion notification failed:", error instanceof Error ? error.message : error);
        }
        send.json(res, 200, { ok: true, customer: updated });
        return;
      }

      if (pathname === "/api/customers/logout" && req.method === "POST") {
        const token = getBearerToken(req);
        if (token) {
          db.prepare("DELETE FROM customer_sessions WHERE token_hash = ?").run(hashToken(token, env.SESSION_SECRET));
        }
        send.empty(res);
        return;
      }

      if (pathname === "/api/services" && req.method === "GET") {
        const services = sortBy(
          db.prepare("SELECT * FROM services WHERE is_active = 1").all().map((row) => ({ ...row, is_active: Boolean(row.is_active) })),
          ["sort_order", "name"],
        );
        send.json(res, 200, services);
        return;
      }

      if (pathname === "/api/availability" && req.method === "GET") {
        send.json(res, 200, getAvailabilityOverrides());
        return;
      }

      if (pathname === "/api/availability/slots" && req.method === "GET") {
        const date = normalizeDate(url.searchParams.get("date") || "");
        const serviceId = String(url.searchParams.get("service_id") || "").trim();
        if (!date || !serviceId) {
          send.json(res, 400, { error: "Parametres date et service_id obligatoires" });
          return;
        }

        const service = db.prepare("SELECT id, duration_minutes FROM services WHERE id = ? AND is_active = 1").get(serviceId);
        if (!service) {
          send.json(res, 404, { error: "Service introuvable" });
          return;
        }

        if (!isDateAvailable(date)) {
          send.json(res, 200, { date, service_id: serviceId, slots: [], has_available: false });
          return;
        }

        const slots = APPOINTMENT_TIME_SLOTS.filter((slot) =>
          isTimeSlotAvailable(date, slot, Number(service.duration_minutes || DEFAULT_SERVICE_DURATION_MINUTES)));

        send.json(res, 200, {
          date,
          service_id: serviceId,
          slots,
          has_available: slots.length > 0,
        });
        return;
      }

      if (pathname === "/api/contact" && req.method === "POST") {
        const body = await readBody(req);
        const message = {
          id: crypto.randomUUID(),
          client_name: String(body.name || "").trim(),
          client_email: String(body.email || "").trim(),
          client_phone: String(body.phone || "").trim(),
          message: String(body.message || "").trim(),
          created_at: new Date().toISOString(),
        };

        if (!message.client_name || !message.client_email || !message.message) {
          send.json(res, 400, { error: "Informations de contact manquantes" });
          return;
        }

        db.prepare(`
          INSERT INTO contact_messages (id, client_name, client_email, client_phone, message, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(message.id, message.client_name, message.client_email, message.client_phone, message.message, message.created_at);

        try {
          await mailer.sendContactEmail({ message });
        } catch (error) {
          console.warn("Contact email failed:", error instanceof Error ? error.message : error);
        }

        send.json(res, 201, { ok: true });
        return;
      }

      if (pathname === "/api/payment-issues/report" && req.method === "POST") {
        const body = await readBody(req);
        const report = {
          client_name: String(body.client_name || "").trim(),
          client_email: String(body.client_email || "").trim(),
          client_phone: String(body.client_phone || "").trim(),
          service_label: String(body.service_label || "").trim(),
          booking_slot: String(body.booking_slot || "").trim(),
          deposit_method: String(body.deposit_method || "").trim(),
          error_message: String(body.error_message || "").trim(),
          logs: body.logs || {},
        };

        if (!report.error_message) {
          send.json(res, 400, { error: "Signalement incomplet" });
          return;
        }

        try {
          await mailer.sendPaymentIssueEmail({ report });
        } catch (error) {
          console.warn("Payment issue email failed:", error instanceof Error ? error.message : error);
        }

        send.json(res, 201, { ok: true });
        return;
      }

      if (pathname === "/api/bookings" && req.method === "POST") {
        const body = await readBody(req);
        const customer = getAuthCustomer(req);
        const service = db.prepare("SELECT * FROM services WHERE id = ? AND is_active = 1").get(body.service_id);
        if (!service) {
          send.json(res, 400, { error: "Unknown service" });
          return;
        }

        const bookingDate = normalizeDate(body.booking_date);
        const bookingTime = normalizeTime(body.booking_time);
        if (!bookingDate) {
          send.json(res, 400, { error: "La date selectionnee n'est pas disponible" });
          return;
        }
        const today = normalizeDate(new Date().toISOString());
        if (bookingDate <= today) {
          send.json(res, 400, { error: "Les reservations doivent etre prises a partir de demain." });
          return;
        }

        if (!APPOINTMENT_TIME_SLOTS.includes(bookingTime)) {
          send.json(res, 400, { error: "L'heure selectionnee n'est pas disponible" });
          return;
        }

        if (!isTimeSlotAvailable(bookingDate, bookingTime, service.duration_minutes)) {
          send.json(res, 400, { error: "Ce creneau n'est pas disponible" });
          return;
        }

        let customerId = customer?.id || null;
        let clientName = String(body.client_name || `${customer?.first_name || ""} ${customer?.last_name || ""}`).trim();
        let clientEmail = String(body.client_email || customer?.email || "").trim().toLowerCase();
        let clientPhone = String(body.client_phone || customer?.phone || "").trim();
        let createdCustomerToken = null;
        let bookingCustomerProfile = customer || null;

        if (!customer && body.create_account) {
          const firstName = String(body.first_name || clientName.split(" ").slice(0, 1).join(" ")).trim();
          const lastName = String(body.last_name || clientName.split(" ").slice(1).join(" ")).trim();
          const password = String(body.password || "");
          if (!firstName || !lastName || !clientEmail || password.length < 10) {
            send.json(res, 400, { error: "Informations insuffisantes pour creer le compte" });
            return;
          }
          if (getCustomerByEmail(clientEmail)) {
            send.json(res, 400, { error: "Un compte existe deja pour cet email. Connectez-vous pour continuer." });
            return;
          }
          const createdCustomer = createCustomerAccount({
            email: clientEmail,
            password,
            first_name: firstName,
            last_name: lastName,
            phone: clientPhone,
            marketing_consent: Boolean(body.marketing_consent),
          });
          customerId = createdCustomer.id;
          clientName = `${createdCustomer.first_name} ${createdCustomer.last_name}`.trim();
          clientPhone = createdCustomer.phone;
          createdCustomerToken = createCustomerSession(createdCustomer.id);
          bookingCustomerProfile = createdCustomer;
        }

        const now = new Date().toISOString();
        const depositChoice = String(body.deposit_method || "none");
        const depositConfig = buildDepositAmount(service, bookingCustomerProfile);
        const depositRequired = depositConfig.required;
        const bookingId = crypto.randomUUID();
        const normalizedDepositReference = depositRequired ? buildBookingDepositReference(bookingId) : "";
        const depositMethod = !depositRequired
          ? "none"
          : depositChoice === "mollie"
            ? "mollie"
            : "";

        if (depositRequired && !depositMethod) {
          send.json(res, 400, { error: "Le paiement de l'acompte doit etre effectue via Mollie." });
          return;
        }
        const mollieClient = getMollieClient();
        if (depositRequired && depositMethod === "mollie" && !mollieClient.enabled) {
          send.json(res, 400, { error: "Le paiement Mollie n'est pas configure pour le moment." });
          return;
        }

        let molliePayment = null;
        if (depositRequired && depositMethod === "mollie") {
          molliePayment = await mollieClient.createPayment({
            amountValue: depositConfig.amount,
            description: `Acompte Just Beauty - ${clientName} - ${service.category} - ${service.name}`,
            redirectUrl: `${publicBaseUrl}/rendez-vous?payment=return&booking=${encodeURIComponent(bookingId)}`,
            webhookUrl: `${apiPublicBaseUrl}/api/payments/mollie/webhook`,
            metadata: {
              bookingId,
              customerId,
              serviceId: service.id,
            },
          });
        }

        const booking = {
          id: bookingId,
          service_id: body.service_id,
          customer_id: customerId,
          client_name: clientName,
          client_email: clientEmail,
          client_phone: clientPhone,
          booking_date: bookingDate,
          booking_time: bookingTime,
          status: "pending",
          notes: String(body.notes || ""),
          deposit_required: depositRequired ? 1 : 0,
          deposit_amount: depositConfig.amount,
          deposit_method: depositMethod || "none",
          deposit_status: !depositRequired
            ? "not_required"
            : depositMethod === "mollie"
              ? normalizeMolliePaymentStatus(molliePayment?.status)
              : "not_required",
          deposit_reference: normalizedDepositReference,
          deposit_checkout_url: molliePayment?._links?.checkout?.href || "",
          deposit_payment_id: molliePayment?.id || "",
          deposit_paid_at: "",
          created_at: now,
          updated_at: now,
        };

        if (!booking.client_name || !booking.client_email || !booking.client_phone) {
          send.json(res, 400, { error: "Informations de reservation manquantes" });
          return;
        }

        db.prepare(`
          INSERT INTO bookings (
            id, service_id, customer_id, client_name, client_email, client_phone, booking_date, booking_time, status, notes,
            deposit_required, deposit_amount, deposit_method, deposit_status, deposit_reference, deposit_checkout_url, deposit_payment_id, deposit_paid_at,
            created_at, updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          booking.id,
          booking.service_id,
          booking.customer_id,
          booking.client_name,
          booking.client_email,
          booking.client_phone,
          booking.booking_date,
          booking.booking_time,
          booking.status,
          booking.notes,
          booking.deposit_required,
          booking.deposit_amount,
          booking.deposit_method,
          booking.deposit_status,
          booking.deposit_reference,
          booking.deposit_checkout_url,
          booking.deposit_payment_id,
          booking.deposit_paid_at,
          booking.created_at,
          booking.updated_at,
        );

        let responseBooking = booking;
        if (depositRequired && booking.deposit_method === "mollie" && booking.deposit_status === "paid") {
          const activated = await finalizePaidDepositBooking(booking.id, molliePayment);
          if (activated) {
            responseBooking = activated.booking;
          }
        } else if (!depositRequired) {
          try {
            const actionLinks = createBookingActionLinks(booking.id);
            await sendBookingCreatedNotifications({ booking, service, actionLinks });
          } catch (error) {
            console.warn("Booking notification failed:", error instanceof Error ? error.message : error);
          }
        }

        send.json(res, 201, {
          ...responseBooking,
          customer_token: createdCustomerToken,
          payment_required: Boolean(depositRequired),
        });
        return;
      }

      if (pathname === "/api/gallery" && req.method === "GET") {
        const items = sortBy(db.prepare("SELECT * FROM gallery_images").all(), ["sort_order", "created_at"])
          .map((item) => ({ ...item, url: item.url.startsWith("/") ? item.url : `/uploads/${item.url}` }));
        send.json(res, 200, items);
        return;
      }

      if (pathname === "/api/content" && req.method === "GET") {
        send.json(res, 200, getContentWithFingerprints());
        return;
      }

      if (pathname === "/api/admin/services" && req.method === "GET") {
        if (!requireAdmin(req, res)) return;
        const services = sortBy(
          db.prepare("SELECT * FROM services").all().map((row) => ({ ...row, is_active: Boolean(row.is_active) })),
          ["sort_order", "name"],
        );
        send.json(res, 200, services);
        return;
      }

      if (pathname === "/api/admin/services" && req.method === "POST") {
        if (!requireAdmin(req, res)) return;
        const body = await readBody(req);
        const now = new Date().toISOString();
        const service = {
          id: crypto.randomUUID(),
          category: String(body.category || "").trim(),
          name: String(body.name || "").trim(),
          description: String(body.description || ""),
          price: Number(body.price || 0),
          price_label: String(body.price_label || "").trim(),
          duration_minutes: Number(body.duration_minutes || DEFAULT_SERVICE_DURATION_MINUTES),
          sort_order: Number(body.sort_order || 0),
          is_active: body.is_active === false ? 0 : 1,
          created_at: now,
          updated_at: now,
        };
        db.prepare(`
          INSERT INTO services (id, category, name, description, price, price_label, duration_minutes, sort_order, is_active, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          service.id,
          service.category,
          service.name,
          service.description,
          service.price,
          service.price_label,
          service.duration_minutes,
          service.sort_order,
          service.is_active,
          service.created_at,
          service.updated_at,
        );
        send.json(res, 201, { ...service, is_active: Boolean(service.is_active) });
        return;
      }

      if (pathname.startsWith("/api/admin/services/") && req.method === "PUT") {
        if (!requireAdmin(req, res)) return;
        const id = pathname.split("/").pop();
        const existing = db.prepare("SELECT * FROM services WHERE id = ?").get(id);
        if (!existing) {
          send.json(res, 404, { error: "Service not found" });
          return;
        }
        const body = await readBody(req);
        const updated = {
          category: body.category ?? existing.category,
          name: body.name ?? existing.name,
          description: body.description ?? existing.description,
          price: Number(body.price ?? existing.price),
          price_label: body.price_label ?? existing.price_label ?? "",
          duration_minutes: Number(body.duration_minutes ?? existing.duration_minutes ?? DEFAULT_SERVICE_DURATION_MINUTES),
          sort_order: Number(body.sort_order ?? existing.sort_order),
          is_active: body.is_active === undefined ? existing.is_active : (body.is_active ? 1 : 0),
          updated_at: new Date().toISOString(),
        };
        db.prepare(`
          UPDATE services
          SET category = ?, name = ?, description = ?, price = ?, price_label = ?, duration_minutes = ?, sort_order = ?, is_active = ?, updated_at = ?
          WHERE id = ?
        `).run(
          updated.category,
          updated.name,
          updated.description,
          updated.price,
          updated.price_label,
          updated.duration_minutes,
          updated.sort_order,
          updated.is_active,
          updated.updated_at,
          id,
        );
        await syncConfirmedBookingsForService(id);
        send.json(res, 200, { id, ...existing, ...updated, is_active: Boolean(updated.is_active) });
        return;
      }

      if (pathname.startsWith("/api/admin/services/") && req.method === "DELETE") {
        if (!requireAdmin(req, res)) return;
        const serviceId = pathname.split("/").pop();
        await cleanupCalendarForServiceBookings(serviceId);
        db.prepare("DELETE FROM services WHERE id = ?").run(serviceId);
        send.empty(res);
        return;
      }

      if (pathname === "/api/admin/bookings" && req.method === "GET") {
        if (!requireAdmin(req, res)) return;
          const bookings = db.prepare(`
            SELECT bookings.*, services.name AS service_name, services.category AS service_category, services.duration_minutes AS service_duration_minutes, services.price AS service_price
            FROM bookings
            LEFT JOIN services ON services.id = bookings.service_id
            WHERE bookings.deposit_required = 0 OR bookings.deposit_status = 'paid'
            ORDER BY bookings.booking_date DESC, bookings.booking_time DESC
          `).all().map((row) => ({
            ...serializeBookingRow(row),
            services: row.service_name ? { name: row.service_name, category: row.service_category, duration_minutes: row.service_duration_minutes, price: Number(row.service_price || 0) } : null,
          }));
          send.json(res, 200, bookings);
          return;
        }

      if (pathname === "/api/admin/customers" && req.method === "GET") {
        if (!requireAdmin(req, res)) return;
        send.json(res, 200, getAdminCustomers());
        return;
      }

      if (pathname === "/api/admin/gift-cards" && req.method === "GET") {
        if (!requireAdmin(req, res)) return;
        send.json(res, 200, getAdminGiftCards());
        return;
      }

      if (pathname.match(/^\/api\/admin\/gift-cards\/[^/]+$/) && req.method === "PATCH") {
        if (!requireAdmin(req, res)) return;
        const id = pathname.split("/")[4];
        const body = await readBody(req);
        try {
          const updated = updateGiftCardStatus(id, body.status, body.admin_note);
          if (!updated?.card) {
            send.json(res, 404, { error: "Cheque cadeau introuvable" });
            return;
          }
          if (updated.card.status === "active" && updated.previous_status !== "active") {
            const cardWithCustomer = getGiftCardWithCustomer(id);
            if (cardWithCustomer?.customer_email) {
              const customerPayload = {
                first_name: cardWithCustomer.customer_first_name || "",
                last_name: cardWithCustomer.customer_last_name || "",
                email: cardWithCustomer.customer_email || "",
              };
              const cardPayload = serializeGiftCardRow(cardWithCustomer);
              try {
                await mailer.sendGiftCardValidatedEmail({
                  customer: customerPayload,
                  giftCard: cardPayload,
                  publicBaseUrl,
                });
                await mailer.sendGiftCardActivatedEmail({
                  customer: customerPayload,
                  giftCard: cardPayload,
                  publicBaseUrl,
                });
                await mailer.sendGiftCardBeneficiaryEmail({
                  senderCustomer: customerPayload,
                  giftCard: cardPayload,
                  publicBaseUrl,
                });
              } catch (error) {
                console.warn("Gift card activation emails failed:", error instanceof Error ? error.message : error);
              }
            }
          }
          send.json(res, 200, updated.card);
        } catch (error) {
          send.json(res, 400, { error: error instanceof Error ? error.message : "Impossible de mettre a jour le cheque cadeau" });
        }
        return;
      }

      if (pathname.match(/^\/api\/admin\/gift-cards\/[^/]+$/) && req.method === "DELETE") {
        if (!requireAdmin(req, res)) return;
        const id = pathname.split("/")[4];
        const existing = db.prepare("SELECT id FROM gift_cards WHERE id = ?").get(id);
        if (!existing) {
          send.json(res, 404, { error: "Cheque cadeau introuvable" });
          return;
        }
        db.prepare("DELETE FROM gift_cards WHERE id = ?").run(id);
        send.empty(res);
        return;
      }

      if (pathname === "/api/admin/caldav/sync" && req.method === "POST") {
        if (!requireAdmin(req, res)) return;
        const result = await syncAllConfirmedBookings();
        send.json(res, 200, result);
        return;
      }

      if (pathname.match(/^\/api\/admin\/bookings\/[^/]+\/deposit$/) && req.method === "PATCH") {
        if (!requireAdmin(req, res)) return;
        const id = pathname.split("/")[4];
        const body = await readBody(req);
        const status = String(body.deposit_status || "pending");
        const updated = updateBookingDepositStatus(id, status, {
          deposit_paid_at: status === "paid" ? new Date().toISOString() : "",
        });
        if (!updated) {
          send.json(res, 404, { error: "Booking not found" });
          return;
        }
        send.json(res, 200, { ok: true, booking: updated.booking });
        return;
      }

      if (pathname.match(/^\/api\/admin\/bookings\/[^/]+\/reminder$/) && req.method === "POST") {
        if (!requireAdmin(req, res)) return;
        const id = pathname.split("/")[4];
        try {
          const result = await sendBookingReminder(id, { force: true });
          if (!result.ok) {
            send.json(res, result.reason === "booking_not_found" ? 404 : 400, {
              error: result.reason === "not_confirmed"
                ? "Le rendez-vous doit etre confirme avant d'envoyer un rappel"
                : "Booking not found",
            });
            return;
          }
          send.json(res, 200, { ok: true, booking: result.booking });
        } catch (error) {
          send.json(res, 500, { error: error instanceof Error ? error.message : "Impossible d'envoyer le rappel" });
        }
        return;
      }

      if (pathname.startsWith("/api/admin/bookings/") && req.method === "PATCH") {
        if (!requireAdmin(req, res)) return;
        const id = pathname.split("/").pop();
        const body = await readBody(req);
        await updateBookingStatus(id, String(body.status || "pending"));
        send.json(res, 200, { ok: true });
        return;
      }

      if (pathname.match(/^\/api\/admin\/customers\/[^/]+\/trust$/) && req.method === "PATCH") {
        if (!requireAdmin(req, res)) return;
        const id = pathname.split("/")[4];
        const body = await readBody(req);
        const updated = updateCustomerTrust(id, Boolean(body.trusted_no_deposit));
        if (!updated) {
          send.json(res, 404, { error: "Client introuvable" });
          return;
        }
        send.json(res, 200, updated);
        return;
      }

      if (pathname.match(/^\/api\/admin\/customers\/[^/]+\/deletion-request$/) && req.method === "POST") {
        if (!requireAdmin(req, res)) return;
        const id = pathname.split("/")[4];
        const customerRecord = getCustomerRecord(id);
        if (!customerRecord) {
          send.json(res, 404, { error: "Client introuvable" });
          return;
        }
        const updated = requestCustomerDeletion(id, "admin");
        try {
          await mailer.sendCustomerDeletionScheduledEmail({
            customer: { ...customerRecord, deletion_requested_by: "admin" },
            scheduledFor: updated?.deletion_scheduled_for || "",
            publicBaseUrl,
          });
        } catch (error) {
          console.warn("Customer deletion notification failed:", error instanceof Error ? error.message : error);
        }
        send.json(res, 200, updated);
        return;
      }

      if (pathname.match(/^\/api\/admin\/customers\/[^/]+\/deletion-request$/) && req.method === "DELETE") {
        if (!requireAdmin(req, res)) return;
        const id = pathname.split("/")[4];
        const updated = clearCustomerDeletionRequest(id);
        if (!updated) {
          send.json(res, 404, { error: "Client introuvable" });
          return;
        }
        send.json(res, 200, updated);
        return;
      }

      if (pathname.match(/^\/api\/admin\/customers\/[^/]+\/delete-now$/) && req.method === "POST") {
        if (!requireAdmin(req, res)) return;
        const id = pathname.split("/")[4];
        const customerRecord = getCustomerRecord(id);
        if (!customerRecord) {
          send.json(res, 404, { error: "Client introuvable" });
          return;
        }
        await deleteCustomerAccount(id);
        send.json(res, 200, { ok: true });
        return;
      }

      if (pathname.match(/^\/api\/admin\/bookings\/[^/]+\/balance-payment$/) && req.method === "POST") {
        if (!requireAdmin(req, res)) return;
        const id = pathname.split("/")[4];
        const body = await readBody(req);
        try {
          const result = await createBookingBalancePayment(id);
          if (body.send_email && result.checkoutUrl) {
            await mailer.sendBookingBalancePaymentEmail({
              booking: result.snapshot.booking,
              service: result.snapshot.service,
              checkoutUrl: result.checkoutUrl,
              amountValue: result.amountValue,
              publicBaseUrl,
            });
          }
          send.json(res, 200, {
            booking: result.snapshot.booking,
            checkout_url: result.checkoutUrl,
            qr_code_url: result.qrCodeUrl,
            amount: result.amountValue,
          });
        } catch (error) {
          send.json(res, 400, { error: error instanceof Error ? error.message : "Impossible de generer le paiement du solde" });
        }
        return;
      }

      if (pathname.startsWith("/api/admin/bookings/") && req.method === "DELETE") {
        if (!requireAdmin(req, res)) return;
        const id = pathname.split("/").pop();
        const existing = getBookingWithService(id);
        if (!existing) {
          send.json(res, 404, { error: "Booking not found" });
          return;
        }
        const shouldSendCancellationEmail = shouldRevokeBookingLoyalty(existing);

        try {
          await syncBookingCalendar({ ...existing, booking: { ...existing.booking, status: "cancelled" } });
        } catch (error) {
          console.warn("Calendar cleanup failed:", error instanceof Error ? error.message : error);
        }

        db.prepare("DELETE FROM bookings WHERE id = ?").run(id);
        deleteBookingLoyaltyTransactions(id);
        if (shouldSendCancellationEmail) {
          try {
            await mailer.sendBookingStatusEmail({
              booking: { ...existing.booking, status: "cancelled" },
              service: existing.service,
              publicBaseUrl,
            });
          } catch (error) {
            console.warn("Cancellation email failed:", error instanceof Error ? error.message : error);
          }
        }
        send.empty(res);
        return;
      }

      if (pathname === "/api/admin/gallery" && req.method === "GET") {
        if (!requireAdmin(req, res)) return;
        const items = sortBy(db.prepare("SELECT * FROM gallery_images").all(), ["sort_order", "created_at"])
          .map((item) => ({ ...item, url: item.url.startsWith("/") ? item.url : `/uploads/${item.url}` }));
        send.json(res, 200, items);
        return;
      }

      if (pathname === "/api/admin/gallery" && req.method === "POST") {
        if (!requireAdmin(req, res)) return;
        const body = await readBody(req);
        if (!mimeFromDataUrl(body.dataUrl)) {
          send.json(res, 400, { error: "Invalid image payload" });
          return;
        }
        const protectedImage = await buildImageProtectionRecord({
          dataUrl: body.dataUrl,
          filename: String(body.filename || "image.png"),
          protectionConfig,
        });
        const extension = sanitizeFilename(protectedImage.extension || "png");
        const filename = `${Date.now()}-${crypto.randomUUID()}.${extension}`;
        const filePath = path.join(UPLOAD_DIR, filename);
        await fs.writeFile(filePath, protectedImage.outputBuffer);
        const image = {
          id: crypto.randomUUID(),
          url: `/uploads/${filename}`,
          alt_text: String(body.alt_text || ""),
          sort_order: Number(body.sort_order || 0),
          created_at: new Date().toISOString(),
        };
        db.prepare("INSERT INTO gallery_images (id, url, alt_text, sort_order, created_at) VALUES (?, ?, ?, ?, ?)")
          .run(image.id, image.url, image.alt_text, image.sort_order, image.created_at);
        upsertMediaProtectionAsset.run(
          crypto.randomUUID(),
          image.id,
          protectedImage.originalSha256,
          protectedImage.displayedSha256,
          protectedImage.phash64 || "",
          protectionConfig.watermarkText,
          protectedImage.watermarkApplied,
          image.created_at,
        );
        send.json(res, 201, image);
        return;
      }

      if (pathname.startsWith("/api/admin/gallery/") && req.method === "PUT") {
        if (!requireAdmin(req, res)) return;
        const id = pathname.split("/").pop();
        const existing = db.prepare("SELECT * FROM gallery_images WHERE id = ?").get(id);
        if (!existing) {
          send.json(res, 404, { error: "Image not found" });
          return;
        }
        const body = await readBody(req);
        const updated = {
          alt_text: String(body.alt_text ?? existing.alt_text ?? "").trim(),
          sort_order: Number(body.sort_order ?? existing.sort_order ?? 0),
        };
        db.prepare("UPDATE gallery_images SET alt_text = ?, sort_order = ? WHERE id = ?")
          .run(updated.alt_text, updated.sort_order, id);
        send.json(res, 200, { ...existing, ...updated });
        return;
      }

      if (pathname.startsWith("/api/admin/gallery/") && req.method === "DELETE") {
        if (!requireAdmin(req, res)) return;
        const id = pathname.split("/").pop();
        const existing = db.prepare("SELECT * FROM gallery_images WHERE id = ?").get(id);
        if (existing?.url?.startsWith("/uploads/")) {
          try {
            await fs.unlink(path.join(ROOT, existing.url.replace(/^\//, "")));
          } catch {
            // Ignore missing files.
          }
        }
        db.prepare("DELETE FROM media_protection_assets WHERE gallery_image_id = ?").run(id);
        db.prepare("DELETE FROM gallery_images WHERE id = ?").run(id);
        send.empty(res);
        return;
      }

      if (pathname === "/api/admin/protection/config" && req.method === "GET") {
        if (!requireAdmin(req, res)) return;
        send.json(res, 200, {
          enabled: protectionConfig.enabled,
          block_hotlink: protectionConfig.blockHotlink,
          allowed_hosts: protectionConfig.allowedHosts,
          watermark_text: protectionConfig.watermarkText,
          watermark_opacity: protectionConfig.watermarkOpacity,
          report_email: protectionConfig.reportEmail,
        });
        return;
      }

      if (pathname === "/api/admin/protection/assets" && req.method === "GET") {
        if (!requireAdmin(req, res)) return;
        const rows = db.prepare(`
          SELECT
            media_protection_assets.*,
            gallery_images.url AS image_url,
            gallery_images.alt_text AS image_alt_text,
            gallery_images.created_at AS image_created_at
          FROM media_protection_assets
          JOIN gallery_images ON gallery_images.id = media_protection_assets.gallery_image_id
          ORDER BY media_protection_assets.created_at DESC
        `).all();
        send.json(res, 200, rows);
        return;
      }

      if (pathname === "/api/admin/protection/events" && req.method === "GET") {
        if (!requireAdmin(req, res)) return;
        const rows = db.prepare(`
          SELECT media_protection_events.*, media_protection_assets.gallery_image_id
          FROM media_protection_events
          LEFT JOIN media_protection_assets ON media_protection_assets.id = media_protection_events.asset_id
          ORDER BY media_protection_events.created_at DESC
          LIMIT 200
        `).all().map((row) => ({
          ...row,
          evidence: (() => {
            try {
              return JSON.parse(row.evidence_json || "{}");
            } catch {
              return {};
            }
          })(),
        }));
        send.json(res, 200, rows);
        return;
      }

      if (pathname === "/api/admin/protection/verify" && req.method === "POST") {
        if (!requireAdmin(req, res)) return;
        const body = await readBody(req);
        let candidateSha256 = String(body.sha256 || "").trim().toLowerCase();
        let candidatePHash = String(body.phash64 || "").trim().toLowerCase();
        const imageUrl = String(body.image_url || "").trim();
        const hasDataUrl = Boolean(String(body.dataUrl || "").trim());

        if (hasDataUrl) {
          const parsed = mimeFromDataUrl(body.dataUrl);
          if (!parsed) {
            send.json(res, 400, { error: "Image payload invalide" });
            return;
          }
          const buffer = Buffer.from(parsed.base64, "base64");
          candidateSha256 = hashSha256(buffer);
          if (isRasterImageMimeType(parsed.mimeType)) {
            candidatePHash = await computeDHash64(buffer);
          }
        } else if (imageUrl) {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 8000);
          try {
            const response = await fetch(imageUrl, { signal: controller.signal });
            if (!response.ok) {
              send.json(res, 400, { error: `Impossible de recuperer l'image (${response.status})` });
              return;
            }
            const buffer = Buffer.from(await response.arrayBuffer());
            candidateSha256 = hashSha256(buffer);
            const contentType = String(response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
            if (isRasterImageMimeType(contentType)) {
              candidatePHash = await computeDHash64(buffer);
            }
          } catch (error) {
            send.json(res, 400, { error: error instanceof Error ? error.message : "Verification distante impossible" });
            return;
          } finally {
            clearTimeout(timeout);
          }
        }

        if (!candidateSha256 && !candidatePHash) {
          send.json(res, 400, { error: "Fournissez dataUrl, image_url, sha256 ou phash64" });
          return;
        }

        const assets = db.prepare(`
          SELECT
            media_protection_assets.*,
            gallery_images.url AS image_url,
            gallery_images.alt_text AS image_alt_text
          FROM media_protection_assets
          JOIN gallery_images ON gallery_images.id = media_protection_assets.gallery_image_id
        `).all();

        const exactMatches = assets.filter((asset) =>
          (candidateSha256 && (asset.displayed_sha256 === candidateSha256 || asset.original_sha256 === candidateSha256))
          || (candidatePHash && asset.phash64 === candidatePHash));

        const nearMatches = candidatePHash
          ? assets
            .filter((asset) => asset.phash64)
            .map((asset) => ({ ...asset, phash_distance: hammingDistanceHex64(candidatePHash, asset.phash64) }))
            .filter((asset) => Number.isFinite(asset.phash_distance) && asset.phash_distance <= 12)
            .sort((a, b) => a.phash_distance - b.phash_distance)
            .slice(0, 10)
          : [];

        insertProtectionEvent.run(
          crypto.randomUUID(),
          exactMatches[0]?.id || nearMatches[0]?.id || null,
          "verify_attempt",
          imageUrl,
          "admin",
          exactMatches.length > 0 ? "exact_match" : nearMatches.length > 0 ? "near_match" : "no_match",
          JSON.stringify({
            candidateSha256,
            candidatePHash,
            exactCount: exactMatches.length,
            nearCount: nearMatches.length,
          }),
          new Date().toISOString(),
        );

        send.json(res, 200, {
          matched: exactMatches.length > 0 || nearMatches.length > 0,
          exact_matches: exactMatches,
          near_matches: nearMatches,
          candidate: {
            sha256: candidateSha256,
            phash64: candidatePHash,
          },
        });
        return;
      }

      if (pathname === "/api/admin/protection/report" && req.method === "POST") {
        if (!requireAdmin(req, res)) return;
        const body = await readBody(req);
        const assetId = String(body.asset_id || "").trim() || null;
        const sourceUrl = String(body.source_url || "").trim();
        const reporter = String(body.reporter || "admin").trim();
        const notes = String(body.notes || "").trim();
        const eventType = String(body.event_type || "infringement_report").trim();
        const evidence = body.evidence && typeof body.evidence === "object" ? body.evidence : {};
        insertProtectionEvent.run(
          crypto.randomUUID(),
          assetId,
          eventType,
          sourceUrl,
          reporter,
          notes,
          JSON.stringify(evidence),
          new Date().toISOString(),
        );
        send.json(res, 201, { ok: true });
        return;
      }

      if (pathname === "/api/admin/protection/dmca-template" && req.method === "GET") {
        if (!requireAdmin(req, res)) return;
        const assetId = String(url.searchParams.get("asset_id") || "").trim();
        const sourceUrl = String(url.searchParams.get("source_url") || "").trim();
        const row = assetId
          ? db.prepare(`
            SELECT media_protection_assets.*, gallery_images.url AS image_url, gallery_images.alt_text
            FROM media_protection_assets
            JOIN gallery_images ON gallery_images.id = media_protection_assets.gallery_image_id
            WHERE media_protection_assets.id = ?
          `).get(assetId)
          : null;

        const nowIso = new Date().toISOString();
        const dmcaText = [
          "Subject: Unauthorized use of copyrighted content - Just Beauty",
          "",
          `Date: ${nowIso}`,
          "Rights holder: Just Beauty",
          `Contact: ${protectionConfig.reportEmail || env.BOOKING_ADMIN_EMAIL || env.ADMIN_EMAIL}`,
          "",
          "I am the rights holder (or authorized agent) for the content listed below.",
          "",
          `Original work URL: ${row?.image_url ? `${publicBaseUrl}${row.image_url}` : publicBaseUrl}`,
          row?.displayed_sha256 ? `Fingerprint (SHA-256): ${row.displayed_sha256}` : "",
          row?.phash64 ? `Perceptual hash (dHash64): ${row.phash64}` : "",
          sourceUrl ? `Infringing URL: ${sourceUrl}` : "Infringing URL: <to complete>",
          "",
          "I have a good-faith belief that this use is not authorized by the copyright owner, its agent, or the law.",
          "The information in this notice is accurate, and under penalty of perjury, I am authorized to act on behalf of the owner.",
          "",
          "Requested action: remove or disable access to the infringing content promptly.",
          "",
          "Signature:",
          "Just Beauty",
        ].filter(Boolean).join("\n");

        send.json(res, 200, {
          generated_at: nowIso,
          asset: row || null,
          source_url: sourceUrl,
          template: dmcaText,
        });
        return;
      }

      if (pathname === "/api/admin/content" && req.method === "GET") {
        if (!requireAdmin(req, res)) return;
        send.json(res, 200, getContentWithFingerprints());
        return;
      }

      if (pathname === "/api/admin/content" && req.method === "PUT") {
        if (!requireAdmin(req, res)) return;
        const body = await readBody(req);
        const entries = Object.entries(body.values || {});
        const now = new Date().toISOString();
        const upsert = db.prepare(`
          INSERT INTO site_content (id, key, value, updated_at)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
        `);
        entries.forEach(([key, value]) => upsert.run(crypto.randomUUID(), key, String(value), now));
        refreshAllContentFingerprints();
        send.json(res, 200, getContentWithFingerprints());
        return;
      }

      if (pathname === "/api/admin/availability" && req.method === "GET") {
        if (!requireAdmin(req, res)) return;
        send.json(res, 200, getAvailabilityOverrides());
        return;
      }

      if (pathname === "/api/admin/weekly-schedule" && req.method === "GET") {
        if (!requireAdmin(req, res)) return;
        send.json(res, 200, getWeeklySchedule());
        return;
      }

      if (pathname === "/api/admin/weekly-schedule" && req.method === "PUT") {
        if (!requireAdmin(req, res)) return;
        const body = await readBody(req);
        const schedule = normalizeSchedulePayload(body.days);
        if (schedule.length !== 7) {
          send.json(res, 400, { error: "Invalid weekly schedule" });
          return;
        }

        const now = new Date().toISOString();
        db.exec("BEGIN");
        try {
          db.prepare("DELETE FROM weekly_schedule_ranges").run();
          const upsertDay = db.prepare(`
            INSERT INTO weekly_schedule (weekday, is_open, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(weekday) DO UPDATE SET is_open = excluded.is_open, updated_at = excluded.updated_at
          `);
          const insertRange = db.prepare(`
            INSERT INTO weekly_schedule_ranges (id, weekday, start_time, end_time, updated_at)
            VALUES (?, ?, ?, ?, ?)
          `);

          schedule.forEach((day) => {
            upsertDay.run(day.weekday, day.is_open, now);
            day.ranges.forEach((range) => insertRange.run(crypto.randomUUID(), day.weekday, range.start_time, range.end_time, now));
          });
          db.exec("COMMIT");
        } catch (error) {
          db.exec("ROLLBACK");
          throw error;
        }

        send.json(res, 200, getWeeklySchedule());
        return;
      }

      if (pathname === "/api/admin/availability/range" && req.method === "POST") {
        if (!requireAdmin(req, res)) return;
        const body = await readBody(req);
        const normalizedDate = normalizeDate(body.date);
        const startTime = normalizeTime(body.start_time);
        const endTime = normalizeTime(body.end_time);
        const mode = body.mode === "close_only" ? "close_only" : "open_only";

        if (!normalizedDate || !startTime || !endTime || toMinutes(endTime) <= toMinutes(startTime)) {
          send.json(res, 400, { error: "Invalid range" });
          return;
        }

        const now = new Date().toISOString();
        const matchingSlots = APPOINTMENT_TIME_SLOTS.filter((slot) => toMinutes(slot) >= toMinutes(startTime) && toMinutes(slot) < toMinutes(endTime));
        if (!matchingSlots.length) {
          send.json(res, 400, { error: "No slots in range" });
          return;
        }

        db.exec("BEGIN");
        try {
          if (mode === "open_only") {
            db.prepare(`
              INSERT INTO availability_overrides (date, status, updated_at)
              VALUES (?, 'closed', ?)
              ON CONFLICT(date) DO UPDATE SET status = excluded.status, updated_at = excluded.updated_at
            `).run(normalizedDate, now);
          }

          const upsertSlot = db.prepare(`
            INSERT INTO availability_slot_overrides (date, time, status, updated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(date, time) DO UPDATE SET status = excluded.status, updated_at = excluded.updated_at
          `);
          matchingSlots.forEach((slot) => {
            upsertSlot.run(normalizedDate, slot, mode === "close_only" ? "closed" : "open", now);
          });
          db.exec("COMMIT");
        } catch (error) {
          db.exec("ROLLBACK");
          throw error;
        }

        send.json(res, 200, getAvailabilityOverrides());
        return;
      }

      if (pathname.startsWith("/api/admin/availability/slots/") && req.method === "PUT") {
        if (!requireAdmin(req, res)) return;
        const [, apiSegment, adminSegment, availabilitySegment, slotsSegment, date, time] = pathname.split("/");
        const normalizedDate = normalizeDate(date);
        const normalizedTime = normalizeTime(decodeURIComponent(time || ""));
        const body = await readBody(req);
        const status = body.status === "open" ? "open" : "closed";
        if (apiSegment !== "api" || adminSegment !== "admin" || availabilitySegment !== "availability" || slotsSegment !== "slots" || !normalizedDate || !APPOINTMENT_TIME_SLOTS.includes(normalizedTime)) {
          send.json(res, 400, { error: "Invalid slot" });
          return;
        }
        db.prepare(`
          INSERT INTO availability_slot_overrides (date, time, status, updated_at)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(date, time) DO UPDATE SET status = excluded.status, updated_at = excluded.updated_at
        `).run(normalizedDate, normalizedTime, status, new Date().toISOString());
        send.json(res, 200, { date: normalizedDate, time: normalizedTime, status });
        return;
      }

      if (pathname.startsWith("/api/admin/availability/slots/") && req.method === "DELETE") {
        if (!requireAdmin(req, res)) return;
        const [, apiSegment, adminSegment, availabilitySegment, slotsSegment, date, time] = pathname.split("/");
        const normalizedDate = normalizeDate(date);
        const normalizedTime = normalizeTime(decodeURIComponent(time || ""));
        if (apiSegment !== "api" || adminSegment !== "admin" || availabilitySegment !== "availability" || slotsSegment !== "slots" || !normalizedDate || !APPOINTMENT_TIME_SLOTS.includes(normalizedTime)) {
          send.json(res, 400, { error: "Invalid slot" });
          return;
        }
        db.prepare("DELETE FROM availability_slot_overrides WHERE date = ? AND time = ?").run(normalizedDate, normalizedTime);
        send.empty(res);
        return;
      }

      if (pathname.startsWith("/api/admin/availability/") && req.method === "PUT") {
        if (!requireAdmin(req, res)) return;
        const date = normalizeDate(pathname.split("/").pop());
        const body = await readBody(req);
        const status = body.status === "open" ? "open" : "closed";
        if (!date) {
          send.json(res, 400, { error: "Invalid date" });
          return;
        }
        db.prepare(`
          INSERT INTO availability_overrides (date, status, updated_at)
          VALUES (?, ?, ?)
          ON CONFLICT(date) DO UPDATE SET status = excluded.status, updated_at = excluded.updated_at
        `).run(date, status, new Date().toISOString());
        send.json(res, 200, { date, status });
        return;
      }

      if (pathname.startsWith("/api/admin/availability/") && req.method === "DELETE") {
        if (!requireAdmin(req, res)) return;
        const date = normalizeDate(pathname.split("/").pop());
        db.prepare("DELETE FROM availability_overrides WHERE date = ?").run(date);
        send.empty(res);
        return;
      }

      send.json(res, 404, { error: "Not found" });
    } catch (error) {
      send.json(res, 500, { error: error instanceof Error ? error.message : "Internal server error" });
    }
  }).listen(Number(env.PORT), env.HOST, () => {
    console.log(`JustBeauty backend listening on http://${env.HOST}:${env.PORT}`);
  });
};

await createApp();
