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
    const githubRequest = (url: string) =>
      fetch(url, {
        headers: { Accept: "application/vnd.github+json" },
        cache: "no-store",
        dispatcher,
      } as RequestInit & { dispatcher: EnvHttpProxyAgent });
    const commitResponse = await githubRequest(
      `https://api.github.com/repos/${repository}/commits/main`,
    );
    if (!commitResponse.ok) throw new Error("暂时无法读取 GitHub 最新提交");
    const latestCommit = (await commitResponse.json()) as GitHubCommit;
    const packageResponse = await githubRequest(
      `https://api.github.com/repos/${repository}/contents/package.json?ref=${latestCommit.sha}`,
    );
    if (!packageResponse.ok) throw new Error("暂时无法读取 GitHub 最新版本号");
    const packageFile = (await packageResponse.json()) as {
      content?: string;
      encoding?: string;
    };
    const latestPackage = JSON.parse(
      Buffer.from(packageFile.content || "", packageFile.encoding === "base64" ? "base64" : "utf8").toString("utf8"),
    ) as { version?: string };
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
