import { WorkspacePage } from "@/components/workspace/workspace-page";
export default async function Page({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const params = await searchParams;
  return <WorkspacePage module="notes" initialNoteId={params.id} />;
}
