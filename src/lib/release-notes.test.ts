import { describe, expect, it } from "vitest";
import packageInfo from "../../package.json";
import { APP_VERSION, RELEASE_NOTES } from "./release-notes";

describe("release version", () => {
  it("keeps the application version and latest release notes in sync", () => {
    expect(APP_VERSION).toBe(packageInfo.version);
    expect(RELEASE_NOTES[0].version).toBe(APP_VERSION);
    expect(new Set(RELEASE_NOTES.map((release) => release.version)).size).toBe(RELEASE_NOTES.length);
  });
});
