import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "..", "..", ".env") });

function required(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required env var: ${key}`);
  return value;
}

function optional(key: string, fallback: string): string {
  return process.env[key] || fallback;
}

export const env = {
  BRIGHT_DATA_API_KEY: required("BRIGHT_DATA_API_KEY"),
  BRIGHT_DATA_SERP_ZONE: optional("BRIGHT_DATA_SERP_ZONE", "serp"),
  BRIGHT_DATA_WEB_SCRAPER_ZONE: optional("BRIGHT_DATA_WEB_SCRAPER_ZONE", "web_scraper"),
  BRIGHT_DATA_WEB_UNLOCKER_ZONE: optional("BRIGHT_DATA_WEB_UNLOCKER_ZONE", "web_unlocker"),
  GOOGLE_API_KEY: optional("GOOGLE_API_KEY", ""),
  FRONTEND_URL: optional("FRONTEND_URL", "http://localhost:3000"),
  PORT: parseInt(optional("PORT", "8000"), 10),
  NODE_ENV: optional("NODE_ENV", "development"),
};
