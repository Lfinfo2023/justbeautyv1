import crypto from "node:crypto";

export const hashPassword = (password, sessionSecret) => {
  const salt = crypto.createHash("sha256").update(sessionSecret).digest("hex").slice(0, 32);
  return crypto.scryptSync(password, salt, 64).toString("hex");
};

export const matchesBootstrapPassword = (passwordHash, env) => passwordHash === hashPassword(env.ADMIN_PASSWORD, env.SESSION_SECRET);

export const createSessionToken = (secret) =>
  `${crypto.randomUUID()}.${crypto.createHmac("sha256", secret).update(crypto.randomUUID()).digest("hex")}`;

export const hashToken = (token, secret) => crypto.createHmac("sha256", secret).update(token).digest("hex");

export const verifyToken = (token, storedHash, secret) => {
  const computed = Buffer.from(hashToken(token, secret), "hex");
  const stored = Buffer.from(storedHash, "hex");
  return computed.length === stored.length && crypto.timingSafeEqual(computed, stored);
};
