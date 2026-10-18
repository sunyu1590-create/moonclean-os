import { execFileSync } from "node:child_process";
import { NextResponse } from "next/server";
import { EnvHttpProxyAgent } from "undici";
import packageInfo from "../../../../package.json";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const repository = "sunyu1590-create/moonclean-os";

type GitHubCommit = {
  sha: string;
  commit: {
    message: string;
    committer: { date: string } | null;
  };
};

function getCurrentCommit() {
  const configured =
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.GITHUB_SHA ||
    process.env.NEXT_PUBLIC_APP_COMMIT;
  if (configured) return configured;

  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 1500,
    }).trim();
  } catch {
    return "unknown";
  }
}

export async function GET() {
  const dispatcher = new EnvHttpProxyAgent();
  try {
    const [commitResponse, packageResponse] = await Promise.all([
      fetch(`https://api.github.com/repos/${repository}/commits/main`, {
        headers: { Accept: "application/vnd.github+json" },
        next: { revalidate: 60 },
        dispatcher,
      } as RequestInit & { dispatcher: EnvHttpProxyAgent }),
      fetch(`https://raw.githubusercontent.com/${repository}/main/package.json`, {
        next: { revalidate: 60 },
        dispatcher,
      } as RequestInit & { dispatcher: EnvHttpProxyAgent }),
    ]);
    if (!commitResponse.ok || !packageResponse.ok)
      throw new Error("暂时无法读取 GitHub 最新版本");

    const [latestCommit, latestPackage] = await Promise.all([
      commitResponse.json() as Promise<GitHubCommit>,
      packageResponse.json() as Promise<{ version?: string }>,
    ]);
    const currentCommit = getCurrentCommit();
    const currentShort = currentCommit.slice(0, 7);
    const latestShort = latestCommit.sha.slice(0, 7);

    return NextResponse.json({
      current: {
        version: packageInfo.version,
        commit: currentCommit,
        shortCommit: currentShort,
      },
      latest: {
        version: latestPackage.version || packageInfo.version,
        commit: latestCommit.sha,
        shortCommit: latestShort,
        date: latestCommit.commit.committer?.date || null,
        message: latestCommit.commit.message.split("\n")[0],
      },
      isLatest:
        currentCommit === "unknown" ? null : currentCommit === latestCommit.sha,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "检查更新失败，请稍后重试。",
      },
      { status: 503 },
    );
  } finally {
    await dispatcher.close();
  }
}
