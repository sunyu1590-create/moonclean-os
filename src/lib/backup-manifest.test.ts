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
      // Account settings, personal free-chat history, service credentials, and
      // test access controls are deliberately excluded from business backups.
      .filter((name) => !["stores", "store_members", "profiles", "store_ai_credentials", "user_device_sessions", "user_preferences", "free_ai_chat_conversations", "moonclean_load_test_access"].includes(name)),
    );

    expect(new Set(BACKUP_STORE_TABLES)).toEqual(publicTables);
    expect(BACKUP_STORE_TABLES).not.toContain("platform_credentials");
    expect(BACKUP_STORE_TABLES).not.toContain("store_ai_credentials");
  });
});
