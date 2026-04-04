import { createReadStream } from "node:fs";
import { getMimeType } from "./utils.js";

export const readBody = (req) =>
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

export const getBearerToken = (req) => {
  const header = req.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
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

export const makeJsonHelpers = (env, req) => {
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
    file(res, filePath) {
      res.writeHead(200, { ...baseHeaders, "Content-Type": getMimeType(filePath) });
      createReadStream(filePath).pipe(res);
    },
  };
};
