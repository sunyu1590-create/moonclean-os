const keyName = (storeId: string) => `moonclean-deepseek-key-v1:${storeId}`;

export function readDeepSeekKey(storeId: string) {
  if (typeof window === "undefined") return "";
  try { return window.localStorage.getItem(keyName(storeId))?.trim() || ""; }
  catch { return ""; }
}

export function saveDeepSeekKey(storeId: string, apiKey: string) {
  if (typeof window === "undefined") return false;
  try { window.localStorage.setItem(keyName(storeId), apiKey.trim()); return true; }
  catch { return false; }
}

export function removeDeepSeekKey(storeId: string) {
  if (typeof window === "undefined") return;
  try { window.localStorage.removeItem(keyName(storeId)); } catch { /* Storage can be disabled by browser policy. */ }
}
