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
  // Codespaces may require its configured outbound proxy. Vercel has its own
  // networking and should use the native fetch implementation directly.
  const useCodespacesProxy = Boolean(
    process.env.CODESPACES || process.env.CODESPACE_NAME,
  );
  const dispatcher = useCodespacesProxy ? new EnvHttpProxyAgent() : undefined;
  try {
    const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
    const githubRequest = (
      url: string,
      accept = "application/vnd.github+json",
      useToken = false,
    ) =>
      fetch(url, {
        headers: {
          Accept: accept,
          ...(token && useToken ? { Authorization: `Bearer ${token}` } : {}),
        },
        cache: "no-store",
        signal: AbortSignal.timeout(12_000),
        ...(dispatcher ? { dispatcher } : {}),
      } as RequestInit & { dispatcher: EnvHttpProxyAgent });
    let [commitResponse, packageResponse] = await Promise.all([
      githubRequest(`https://api.github.com/repos/${repository}/commits/main`),
      githubRequest(
        `https://raw.githubusercontent.com/${repository}/main/package.json`,
        "application/json",
      ),
    ]);
    if (
      token &&
      [401, 403].includes(commitResponse.status)
    ) {
      commitResponse = await githubRequest(
        `https://api.github.com/repos/${repository}/commits/main`,
        "application/vnd.github+json",
        true,
      );
    }
    if (token && [401, 403].includes(packageResponse.status)) {
      packageResponse = await githubRequest(
        `https://raw.githubusercontent.com/${repository}/main/package.json`,
        "application/json",
        true,
      );
    }
    if (!commitResponse.ok) {
      if (commitResponse.status === 403 || commitResponse.status === 429) {
        throw new Error(
          "GitHub 暂时限制了版本查询。请稍后重试；Codespaces 配置 GITHUB_TOKEN 后可提高查询额度。",
        );
      }
      throw new Error(`GitHub 暂时无法读取最新提交（HTTP ${commitResponse.status}）。`);
    }
    if (!packageResponse.ok) {
      throw new Error(`GitHub 暂时无法读取版本号（HTTP ${packageResponse.status}）。`);
    }
    const latestCommit = (await commitResponse.json()) as GitHubCommit;
    const latestPackage = (await packageResponse.json()) as { version?: string };
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
    const message = error instanceof Error && error.name === "TimeoutError"
      ? "连接 GitHub 超时，请检查 Codespaces 网络后重试。"
      : error instanceof TypeError
        ? "Codespaces 暂时无法连接 GitHub，请检查网络后重试。"
        : error instanceof Error
          ? error.message
          : "检查更新失败，请稍后重试。";
    return NextResponse.json(
      { error: message },
      { status: 503 },
    );
  } finally {
    await dispatcher?.close();
  }
}
