export const FONT_PREFERENCE_KEY = "moonclean-font-preference-v1";

export function readOppoSansEnabled() {
  try {
    return localStorage.getItem(FONT_PREFERENCE_KEY) !== "system";
  } catch {
    return true;
  }
}

export function setOppoSansEnabled(enabled: boolean) {
  document.documentElement.dataset.appFont = enabled ? "oppo" : "system";
  try {
    localStorage.setItem(FONT_PREFERENCE_KEY, enabled ? "oppo" : "system");
  } catch {
    // Apply the choice to this tab even if local storage is unavailable.
  }
}
