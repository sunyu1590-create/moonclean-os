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
type GitHubCommitRecord = {
  sha?: string;
  message?: string;
  committer?: { date: string } | null;
  commit?: GitHubCommitRecord;
};
type GitHubCommitResponse = GitHubCommitRecord & {
  object?: { sha?: string };
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
          "User-Agent": "MoonCleanOS-VersionCheck/1.0",
          "X-GitHub-Api-Version": "2022-11-28",
          ...(token && useToken ? { Authorization: `Bearer ${token}` } : {}),
        },
        cache: "no-store",
        signal: AbortSignal.timeout(12_000),
        ...(dispatcher ? { dispatcher } : {}),
      } as RequestInit & { dispatcher: EnvHttpProxyAgent });
    async function loadLatestCommit(): Promise<GitHubCommit> {
      let lastStatus = 0;
      let lastError: unknown;
      const endpoints = [
        `https://api.github.com/repos/${repository}/commits/main`,
        `https://api.github.com/repos/${repository}/branches/main`,
      ];

      for (const endpoint of endpoints) {
        try {
          let response = await githubRequest(endpoint);
          if (token && [401, 403].includes(response.status))
            response = await githubRequest(endpoint, "application/vnd.github+json", true);
          lastStatus = response.status;
          if (response.ok) {
            const payload = (await response.json()) as GitHubCommitResponse;
            const candidate: GitHubCommitRecord = payload.sha
              ? payload
              : payload.commit || {};
            if (candidate?.sha) {
              return {
                sha: candidate.sha,
                commit: {
                  message: candidate.commit?.message || candidate.message || "",
                  committer: candidate.commit?.committer || candidate.committer || null,
                },
              };
            }
          }
        } catch (error) {
          lastError = error;
        }
      }

      // GitHub's smart Git endpoint is independent of the REST API and still
      // advertises the public main ref when REST is unavailable or returns 404.
      try {
        const refsResponse = await githubRequest(
          `https://github.com/${repository}.git/info/refs?service=git-upload-pack`,
          "application/x-git-upload-pack-advertisement",
        );
        lastStatus = refsResponse.status;
        if (refsResponse.ok) {
          const refs = await refsResponse.text();
          const match = refs.match(/([a-f0-9]{40}) refs\/heads\/main(?:\\n|\n|\r)/i);
          if (match) {
            return {
              sha: match[1],
              commit: { message: "", committer: null },
            };
          }
        }
      } catch (error) {
        lastError = error;
      }

      if (lastStatus === 403 || lastStatus === 429) {
        throw new Error(
          "GitHub 暂时限制了版本查询。请稍后重试；Codespaces 配置 GITHUB_TOKEN 后可提高查询额度。",
        );
      }
      if (lastError) throw lastError;
      throw new Error(`GitHub 暂时无法读取最新提交（HTTP ${lastStatus || 404}）。`);
    }

    const [latestCommit, initialPackageResponse] = await Promise.all([
      loadLatestCommit(),
      githubRequest(
        `https://raw.githubusercontent.com/${repository}/main/package.json`,
        "application/json",
      ),
    ]);
    let packageResponse = initialPackageResponse;
    if (token && [401, 403].includes(packageResponse.status)) {
      packageResponse = await githubRequest(
        `https://raw.githubusercontent.com/${repository}/main/package.json`,
        "application/json",
        true,
      );
    }
    if (!packageResponse.ok) {
      throw new Error(`GitHub 暂时无法读取版本号（HTTP ${packageResponse.status}）。`);
    }
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
