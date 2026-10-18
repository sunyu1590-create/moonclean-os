import { describe, expect, it, vi } from "vitest";

vi.mock("./server", () => ({ createServerSupabaseClient: vi.fn() }));
import { apiError, rejectCrossOriginMutation } from "./auth";

const request = (headers: Record<string, string>) =>
  new Request("http://127.0.0.1:3000/api/stores", {
    method: "POST",
    headers,
  });

describe("mutation origin protection behind a proxy", () => {
  it("allows a browser's same-origin request when the internal URL differs", () => {
    expect(
      rejectCrossOriginMutation(
        request({
          origin: "https://sample-3000.app.github.dev",
          "sec-fetch-site": "same-origin",
          host: "127.0.0.1:3000",
        }),
      ),
    ).toBeNull();
  });

  it("allows a matching browser-facing Host without Fetch Metadata", () => {
    expect(
      rejectCrossOriginMutation(
        request({ origin: "http://localhost:3000", host: "localhost:3000" }),
      ),
    ).toBeNull();
  });

  it("rejects cross-site requests even with a forged matching Origin", () => {
    expect(
      rejectCrossOriginMutation(
        request({
          origin: "http://127.0.0.1:3000",
          "sec-fetch-site": "cross-site",
        }),
      )?.status,
    ).toBe(403);
  });

  it("rejects an unrelated origin when browser metadata is absent", () => {
    expect(
      rejectCrossOriginMutation(
        request({ origin: "https://attacker.example", host: "localhost:3000" }),
      )?.status,
    ).toBe(403);
  });
});

it("returns the message from a Supabase database error", async () => {
  const response = apiError({ code: "42501", message: "permission denied" });
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({ error: "permission denied" });
});
