import { NotesCenter } from "@/components/notes/notes-center";
export default async function Page({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const params = await searchParams;
  return <NotesCenter initialNoteId={params.id} />;
}
