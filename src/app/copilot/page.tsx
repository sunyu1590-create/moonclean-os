import { WorkspacePage } from "@/components/workspace/workspace-page";
export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string; competitor?: string; conversation?: string }> }) {
  const params = await searchParams;
  return <WorkspacePage module="copilot" initialQuestion={params.q} initialCompetitorId={params.competitor} initialConversationId={params.conversation} />;
}
