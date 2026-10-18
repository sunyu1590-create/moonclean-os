import { execFileSync } from "node:child_process";
import packageInfo from "../../package.json";

export type BuildInfo = {
  version: string;
  commit: string;
  shortCommit: string;
  message: string;
  ref: string;
};

export function getBuildInfo(): BuildInfo {
  const configuredCommit =
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.GITHUB_SHA ||
    process.env.NEXT_PUBLIC_APP_COMMIT;
  let commit = configuredCommit || "unknown";
  if (!configuredCommit) {
    try {
      commit = execFileSync("git", ["rev-parse", "HEAD"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
        timeout: 1500,
      }).trim();
    } catch {
      // The commit is unavailable in source archives without Git metadata.
    }
  }

  return {
    version: packageInfo.version,
    commit,
    shortCommit: commit.slice(0, 7),
    message: process.env.VERCEL_GIT_COMMIT_MESSAGE || "",
    ref: process.env.VERCEL_GIT_COMMIT_REF || "unknown",
  };
}
