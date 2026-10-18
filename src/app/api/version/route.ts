import { NextResponse } from "next/server";
import { getBuildInfo } from "@/lib/build-info";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const repository = "sunyu1590-create/moonclean-os";
const productionHost = "moonclean-os.vercel.app";

type LatestVersion = {
  version: string;
  commit: string;
  shortCommit: string;
  date: string | null;
  message: string;
};

async function getGitHubMain(): Promise<LatestVersion> {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "MoonCleanOS-VersionCheck/1.0",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const [commitResponse, packageResponse] = await Promise.all([
    fetch(`https://api.github.com/repos/${repository}/commits/main`, {
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    }),
    fetch(`https://raw.githubusercontent.com/${repository}/main/package.json`, {
      headers: { "User-Agent": headers["User-Agent"] },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    }),
  ]);
  if (!commitResponse.ok)
    throw new Error(`GitHub 提交查询 HTTP ${commitResponse.status}`);
  if (!packageResponse.ok)
    throw new Error(`GitHub 版本文件 HTTP ${packageResponse.status}`);

  const [commit, packageInfo] = (await Promise.all([
    commitResponse.json(),
    packageResponse.json(),
  ])) as [
    {
      sha: string;
      commit: { message: string; committer: { date: string } | null };
    },
    { version?: string },
  ];
  return {
    version: packageInfo.version || "0.0.0",
    commit: commit.sha,
    shortCommit: commit.sha.slice(0, 7),
    date: commit.commit.committer?.date || null,
    message: commit.commit.message.split("\n")[0],
  };
}

async function getProductionVersion(): Promise<LatestVersion> {
  if (process.env.VERCEL_ENV === "production") {
    const current = getBuildInfo();
    return {
      version: current.version,
      commit: current.commit,
      shortCommit: current.shortCommit,
      date: null,
      message: current.message || `正式部署分支：${current.ref}`,
    };
  }

  const response = await fetch(`https://${productionHost}/api/build-info`, {
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok)
    throw new Error(`正式部署版本信息 HTTP ${response.status}`);
  const build = (await response.json()) as ReturnType<typeof getBuildInfo>;
  return {
    version: build.version,
    commit: build.commit,
    shortCommit: build.shortCommit,
    date: null,
    message: build.message || `正式部署分支：${build.ref}`,
  };
}

export async function GET() {
  const current = getBuildInfo();
  let latest: LatestVersion;
  let source: "github-main" | "vercel-production";

  try {
    latest = await getGitHubMain();
    source = "github-main";
  } catch {
    try {
      latest = await getProductionVersion();
      source = "vercel-production";
    } catch (error) {
      const message =
        error instanceof Error && error.name === "TimeoutError"
          ? "连接版本服务超时，请稍后重试。"
          : "暂时无法读取 GitHub 或正式部署版本，请稍后重试。";
      return NextResponse.json({ error: message }, { status: 503 });
    }
  }

  return NextResponse.json(
    {
      current: {
        version: current.version,
        commit: current.commit,
        shortCommit: current.shortCommit,
      },
      latest,
      source,
      isLatest:
        current.commit === "unknown" ? null : current.commit === latest.commit,
    },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } },
  );
}
