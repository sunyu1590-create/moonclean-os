import { describe, expect, it } from "vitest";
import { getMobileNavigationSlot } from "./mobile-navigation";

describe("custom mobile navigation active capsule", () => {
  it("positions by rendered order rather than shortcut selection order", () => {
    const renderedPaths = ["/dashboard", "/tasks", "/data", "/settings"];
    expect(getMobileNavigationSlot("/settings", renderedPaths, false)).toBe(3);
    expect(getMobileNavigationSlot("/tasks", renderedPaths, false)).toBe(1);
  });

  it("uses the More slot for hidden pages and while More is open", () => {
    const renderedPaths = ["/dashboard", "/products", "/data", "/finance"];
    expect(getMobileNavigationSlot("/settings", renderedPaths, false)).toBe(4);
    expect(getMobileNavigationSlot("/dashboard", renderedPaths, true)).toBe(4);
  });
});
