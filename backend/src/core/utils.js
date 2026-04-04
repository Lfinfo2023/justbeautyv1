import path from "node:path";

export const sortBy = (items, fields) =>
  [...items].sort((a, b) => {
    for (const field of fields) {
      if (a[field] < b[field]) return -1;
      if (a[field] > b[field]) return 1;
    }
    return 0;
  });

export const sanitizeFilename = (value) => value.replace(/[^a-zA-Z0-9._-]/g, "-");

export const getMimeType = (filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  if (ext === ".svg") return "image/svg+xml";
  return "application/octet-stream";
};

export const scheduleMatches = (left, right) => JSON.stringify(left) === JSON.stringify(right);
