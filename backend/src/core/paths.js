import path from "node:path";

export const ROOT = path.resolve(process.cwd());
export const DATA_DIR = path.join(ROOT, "data");
export const UPLOAD_DIR = path.join(ROOT, "uploads");
export const ENV_FILE = path.join(ROOT, ".env");
