import { describe, expect, it } from "vitest";
import { getWorkspaceHotFeature, trackWorkspaceInteraction } from "./workspace-usage";

describe("workspace recent usage", () => {
  it("selects the most used feature in a rolling 60-second window", () => {
    const now = Date.now() + 120_000;
    trackWorkspaceInteraction("notes", now);
    trackWorkspaceInteraction("experiments", now + 1);
    trackWorkspaceInteraction("experiments", now + 2);

    expect(getWorkspaceHotFeature(now + 3)).toEqual({ feature: "experiments", count: 2 });
    expect(getWorkspaceHotFeature(now + 60_003)).toBeNull();
  });

  it("breaks equal counts in favor of the most recently used feature", () => {
    const now = Date.now() + 240_000;
    trackWorkspaceInteraction("competitors", now);
    trackWorkspaceInteraction("service", now + 1);

    expect(getWorkspaceHotFeature(now + 2)).toEqual({ feature: "service", count: 1 });
  });
});
