import crypto from "node:crypto";
import { DEFAULT_WEEKLY_SCHEDULE, LEGACY_DEFAULT_WEEKLY_SCHEDULE } from "../core/scheduling.js";
import { hashPassword } from "../core/security.js";
import { scheduleMatches, sortBy } from "../core/utils.js";
import { DEFAULT_SERVICES, LEGACY_DEFAULT_SERVICE_NAMES } from "./constants.js";

export const bootstrapDb = (db, env) => {
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
      client_name TEXT NOT NULL,
      client_email TEXT NOT NULL,
      client_phone TEXT NOT NULL DEFAULT '',
      booking_date TEXT NOT NULL,
      booking_time TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
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
  `);

  try {
    db.exec("ALTER TABLE services ADD COLUMN price_label TEXT NOT NULL DEFAULT '';");
  } catch {
    // Column already exists on migrated databases.
  }

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

  const contentCount = db.prepare("SELECT COUNT(*) AS count FROM site_content").get().count;
  if (!contentCount) {
    const now = new Date().toISOString();
    const insertContent = db.prepare("INSERT INTO site_content (id, key, value, updated_at) VALUES (?, ?, ?, ?)");
    [
      ["hero_slogan", "Prenez soin de vous"],
      ["hero_subtitle", "Bienvenue chez Just Beauty by Justine. Un espace dédié à votre bien-être, où chaque soin est un moment de douceur."],
      ["about_text", "Situé près de Bastogne, Just Beauty by Justine est un institut chaleureux et accueillant, pensé pour votre confort et votre détente."],
      ["phone", "+32 XXX XX XX XX"],
      ["email", "contact@justbeauty.be"],
      ["address", "Pres de Bastogne, Belgique"],
    ].forEach(([key, value]) => insertContent.run(crypto.randomUUID(), key, value, now));
  }

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
    const existingNormalized = DEFAULT_WEEKLY_SCHEDULE.map((_, weekday) => ({
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
