export const LAST_VISITED_ROUTE_COOKIE = "moonclean-last-visited-route";

const appRoutes = new Set([
  "/dashboard",
  "/advertising",
  "/products",
  "/orders",
  "/inventory",
  "/tasks",
  "/notes",
  "/copilot",
  "/ai-chat",
  "/ai-settings",
  "/experiments",
  "/competitors",
  "/service",
  "/product-insights",
  "/pricing",
  "/after-sales",
  "/reports",
  "/finance",
  "/data",
  "/settings",
  "/motion",
  "/integrations",
  "/sync-center",
  "/account",
  "/migrate",
]);

export function isRestorableAppRoute(pathname: string | null | undefined): pathname is string {
  return typeof pathname === "string" && appRoutes.has(pathname);
}
