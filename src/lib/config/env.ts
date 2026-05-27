let _env: ReturnType<typeof loadEnv> | null = null;

function loadEnv() {
  const get = (key: string, fallback?: string): string => {
    const value = process.env[key];
    if (!value && fallback === undefined) {
      throw new Error(`Missing required env var: ${key}`);
    }
    return value || fallback || "";
  };

  return {
    BRIGHT_DATA_API_KEY: get("BRIGHT_DATA_API_KEY"),
    BRIGHT_DATA_SERP_ZONE: get("BRIGHT_DATA_SERP_ZONE", "serp"),
    BRIGHT_DATA_WEB_SCRAPER_ZONE: get("BRIGHT_DATA_WEB_SCRAPER_ZONE", "web_scraper"),
    BRIGHT_DATA_WEB_UNLOCKER_ZONE: get("BRIGHT_DATA_WEB_UNLOCKER_ZONE", "web_unlocker"),
    GOOGLE_API_KEY: get("GOOGLE_API_KEY", ""),
    FRONTEND_URL: get("FRONTEND_URL", "http://localhost:3000"),
    LLM_MODEL: get("LLM_MODEL", "gemini-1.5-flash"),
    NODE_ENV: get("NODE_ENV", "development"),
  };
}

export function getEnv() {
  if (!_env) _env = loadEnv();
  return _env;
}
