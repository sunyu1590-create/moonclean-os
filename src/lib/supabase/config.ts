export function supabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (
    !url ||
    !key ||
    url.includes("your-project") ||
    key.includes("replace_me")
  ) {
    return null;
  }
  return { url, key };
}
export const localDemoEnabled = () =>
  process.env.NODE_ENV !== "production" &&
  process.env.NEXT_PUBLIC_DATA_MODE === "local";
