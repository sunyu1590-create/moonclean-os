import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BACKUP_STORE_TABLES } from "./backup-manifest";

describe("full cloud backup coverage", () => {
  it("includes every public tenant table created by the migrations", () => {
    const migrationDirectory = join(process.cwd(), "supabase/migrations");
    const migrations = readdirSync(migrationDirectory)
      .filter((file) => file.endsWith(".sql"))
      .map((file) => readFileSync(join(migrationDirectory, file), "utf8"))
      .join("\n");
    const publicTables = new Set(
      [...migrations.matchAll(/create\s+table(?:\s+if\s+not\s+exists)?\s+public\.(\w+)/gi)]
        .map((match) => match[1])
      // Service-only credentials are deliberately excluded from portable business backups.
      .filter((name) => !["stores", "store_members", "profiles", "store_ai_credentials"].includes(name)),
    );

    expect(new Set(BACKUP_STORE_TABLES)).toEqual(publicTables);
    expect(BACKUP_STORE_TABLES).not.toContain("platform_credentials");
    expect(BACKUP_STORE_TABLES).not.toContain("store_ai_credentials");
  });
});
