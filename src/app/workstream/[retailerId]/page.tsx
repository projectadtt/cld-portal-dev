import { permanentRedirect } from "next/navigation";

/**
 * The account workspace now lives under /retailers/[retailerId], alongside the
 * pipeline it belongs to. This route stays as a redirect so links and
 * bookmarks made while it was the detail page still land in the right place.
 */
export default async function WorkstreamRetailerRedirect({
  params,
}: PageProps<"/workstream/[retailerId]">) {
  permanentRedirect("/retailers/" + (await params).retailerId);
}
