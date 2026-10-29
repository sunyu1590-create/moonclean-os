import { describe, expect, it } from "vitest";
import { matchesCloudLoadTestGrant } from "@/lib/cloud-load-test-access";

describe("cloud load test access", () => {
  it("shows the test controls only for the account returned by the allowlist", () => {
    expect(matchesCloudLoadTestGrant("test-user", "test-user")).toBe(true);
    expect(matchesCloudLoadTestGrant("regular-user", "test-user")).toBe(false);
    expect(matchesCloudLoadTestGrant("regular-user", null)).toBe(false);
    expect(matchesCloudLoadTestGrant(null, "test-user")).toBe(false);
  });
});
