import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isRestorableAppRoute, LAST_VISITED_ROUTE_COOKIE } from "@/lib/last-visited-route";

export default async function Home() {
  const cookieStore = await cookies();
  const lastVisited = cookieStore.get(LAST_VISITED_ROUTE_COOKIE)?.value;
  redirect(isRestorableAppRoute(lastVisited) ? lastVisited : "/dashboard");
}
