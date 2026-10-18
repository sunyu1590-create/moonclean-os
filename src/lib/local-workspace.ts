export function shouldBypassAuthForLocalWorkspace(
  pathname: string,
  modeCookie: string | undefined,
  localDemoEnabled: boolean,
): boolean {
  return !pathname.startsWith("/api/") && (localDemoEnabled || modeCookie === "local");
}
