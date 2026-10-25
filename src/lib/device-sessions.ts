export type DeviceSessionRow = {
  session_id: string;
  device_id: string | null;
  device_label: string;
  created_at: string;
  last_seen_at: string;
  revoked_at: string | null;
};

export type DeviceSessionGroup = DeviceSessionRow & {
  current: boolean;
  session_count: number;
};

export function groupDeviceSessions(rows: DeviceSessionRow[], currentSessionId: string): DeviceSessionGroup[] {
  const groups = new Map<string, DeviceSessionGroup>();
  for (const row of rows) {
    const current = row.session_id === currentSessionId;
    const key = row.device_id || "legacy-unidentified";
    const group = groups.get(key);
    if (!group) {
      groups.set(key, { ...row, current, session_count: 1 });
      continue;
    }
    group.session_count += 1;
    group.current ||= current;
    if (current || row.last_seen_at > group.last_seen_at) {
      group.session_id = row.session_id;
      group.device_label = row.device_label;
      group.last_seen_at = row.last_seen_at;
    }
    if (row.created_at < group.created_at) group.created_at = row.created_at;
    if (row.revoked_at === null) group.revoked_at = null;
    else if (group.revoked_at !== null && row.revoked_at > group.revoked_at) group.revoked_at = row.revoked_at;
  }
  return [...groups.values()].sort((a, b) => b.last_seen_at.localeCompare(a.last_seen_at));
}
