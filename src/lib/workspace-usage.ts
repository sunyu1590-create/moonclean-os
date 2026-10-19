export type WorkspaceFeature = "notes" | "experiments" | "competitors" | "service" | "copilot";
const WINDOW_MS = 60_000;
const MAX_EVENTS = 1_000;
const interactions: Array<{ feature: WorkspaceFeature; at: number }> = [];

export function getWorkspaceHotFeature(now = Date.now()) {
  const recent = interactions.filter(item => now >= item.at && now - item.at < WINDOW_MS);
  interactions.splice(0, interactions.length, ...recent);
  const counts = new Map<WorkspaceFeature, { count: number; latest: number }>();
  for (const item of recent) {
    const current = counts.get(item.feature) || { count: 0, latest: 0 };
    current.count += 1;
    current.latest = Math.max(current.latest, item.at);
    counts.set(item.feature, current);
  }
  let hot: { feature: WorkspaceFeature; count: number } | null = null;
  let latest = 0;
  for (const [feature, value] of counts) {
    if (!hot || value.count > hot.count || (value.count === hot.count && value.latest > latest)) {
      hot = { feature, count: value.count };
      latest = value.latest;
    }
  }
  return hot;
}

export function trackWorkspaceInteraction(feature: WorkspaceFeature, now = Date.now()) {
  interactions.push({ feature, at: now });
  if (interactions.length > MAX_EVENTS) interactions.splice(0, interactions.length - MAX_EVENTS);
  return getWorkspaceHotFeature(now);
}
