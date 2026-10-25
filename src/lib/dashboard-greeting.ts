export type DashboardGreeting =
  | "早上好，今天的生意一目了然"
  | "下午好，今天的生意一目了然"
  | "晚上好，今天的生意一目了然";

export function dashboardGreetingAt(now: Date, timeZone?: string): DashboardGreeting {
  let hour = now.getHours();
  try {
    const value = new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      hourCycle: "h23",
      ...(timeZone ? { timeZone } : {}),
    }).formatToParts(now).find((part) => part.type === "hour")?.value;
    if (value) hour = Number(value);
  } catch { /* Fall back to the device's local time if the store timezone is invalid. */ }
  if (hour < 5 || hour >= 18) return "晚上好，今天的生意一目了然";
  if (hour >= 11) return "下午好，今天的生意一目了然";
  return "早上好，今天的生意一目了然";
}
