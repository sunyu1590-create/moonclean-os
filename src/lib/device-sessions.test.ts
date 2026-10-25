import { describe, expect, it } from "vitest";
import { groupDeviceSessions } from "@/lib/device-sessions";

describe("设备登录会话归并", () => {
  it("把同一浏览器的多次登录显示为一台设备并保留当前会话状态", () => {
    const rows = [
      { session_id: "session-current", device_id: "device-a", device_label: "Edge · Android", created_at: "2026-10-25T10:00:00Z", last_seen_at: "2026-10-25T11:00:00Z", revoked_at: null },
      { session_id: "session-old", device_id: "device-a", device_label: "Edge · Android", created_at: "2026-10-24T10:00:00Z", last_seen_at: "2026-10-24T11:00:00Z", revoked_at: "2026-10-24T12:00:00Z" },
      { session_id: "session-other", device_id: "device-b", device_label: "Safari · iOS", created_at: "2026-10-23T10:00:00Z", last_seen_at: "2026-10-23T11:00:00Z", revoked_at: null },
    ];
    expect(groupDeviceSessions(rows, "session-current")).toEqual([
      { ...rows[0], created_at: "2026-10-24T10:00:00Z", current: true, session_count: 2 },
      { ...rows[2], current: false, session_count: 1 },
    ]);
  });
});
