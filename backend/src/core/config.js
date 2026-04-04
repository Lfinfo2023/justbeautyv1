import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { DATA_DIR, ENV_FILE, UPLOAD_DIR } from "./paths.js";

export const defaultEnv = {
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
  CALDAV_URL: "",
  CALDAV_USERNAME: "",
  CALDAV_PASSWORD: "",
  CALDAV_CALENDAR_PATH: "",
  CALDAV_TIMEZONE: "Europe/Brussels",
  MOLLIE_API_KEY: "",
};

export const parseEnvFile = (raw) =>
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

export const ensureEnv = async () => {
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
