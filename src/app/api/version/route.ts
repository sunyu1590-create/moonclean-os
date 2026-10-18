import { NextResponse } from "next/server";
import { getBuildInfo } from "@/lib/build-info";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const productionHost = "moonclean-os.vercel.app";

export async function GET() {
  const current = getBuildInfo();

  try {
    // The GitHub repository is private, so anonymous GitHub API requests return
    // 404. Vercel exposes its public production build metadata without a token.
    // Codespaces and preview deployments compare their commit to that endpoint.
    const isProductionDeployment = process.env.VERCEL_ENV === "production";
    const latest = isProductionDeployment
      ? current
      : await fetch(`https://${productionHost}/api/build-info`, {
          cache: "no-store",
          signal: AbortSignal.timeout(12_000),
        }).then(async (response) => {
          if (!response.ok)
            throw new Error(`正式版本信息暂时不可用（HTTP ${response.status}）。`);
          return (await response.json()) as ReturnType<typeof getBuildInfo>;
        });

    return NextResponse.json(
      {
        current: {
          version: current.version,
          commit: current.commit,
          shortCommit: current.shortCommit,
        },
        latest: {
          version: latest.version,
          commit: latest.commit,
          shortCommit: latest.shortCommit,
          date: null,
          message: latest.message || `正式部署分支：${latest.ref}`,
        },
        source: "vercel-production",
        isLatest:
          current.commit === "unknown" ? null : current.commit === latest.commit,
      },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  } catch (error) {
    const message =
      error instanceof Error && error.name === "TimeoutError"
        ? "连接正式版本服务超时，请稍后重试。"
        : error instanceof Error
          ? error.message
          : "检查更新失败，请稍后重试。";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
