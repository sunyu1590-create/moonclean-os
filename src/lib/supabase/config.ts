// Publishable keys are designed for browser use. Database access still requires
// an authenticated user and is restricted by RLS for every tenant table.
const defaultCloudConfig = {
  url: "https://duolfhyodjhuatucjhtz.supabase.co",
  key: "sb_publishable_r8vHGTUIcTbvOyGC8GJPRA_I9yra-OC",
};

export function supabaseConfig() {
  // This app's production deployment is pinned to its canonical MoonClean OS
  // project. The Vercel Supabase integration can inject NEXT_PUBLIC_* values
  // from a different project, which would split login and data across DBs.
  if (process.env.NODE_ENV === "production") return defaultCloudConfig;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return url && key && !url.includes("your-project") && !key.includes("replace_me")
    ? { url, key }
    : defaultCloudConfig;
}
export const localDemoEnabled = () =>
  process.env.NODE_ENV !== "production" &&
  process.env.NEXT_PUBLIC_DATA_MODE === "local";
